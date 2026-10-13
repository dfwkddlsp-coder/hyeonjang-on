// 폰 알림(Web Push): VAPID 서명 + 내용 암호화(RFC 8291 aes128gcm)를 WebCrypto로 직접 처리.
// VAPID 키는 처음 필요할 때 만들어 docs 'pushkey'(동기화·백업 안 함)에 보관 → 따로 설정할 비밀값 없음.
// 받을 사람: 운영자·관리자 중 알림을 켠 사람 (settings → 알림). 본인이 한 일은 본인에게 보내지 않음.
import { now } from './http.js';
import { sha256 } from './crypto.js';
import { loadPermTable, permsOf } from './perms.js';

const te = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

/* ---------- 알림 종류와 '누가 했을 때' ---------- */
export const PUSH_EVENTS = {
  eqcheck: { label: '장비점검 저장', from: ['staff', 'user', 'driver', 'guest'] },
  violation: { label: '삼진아웃 적발', from: ['staff', 'user'] },
  alcohol: { label: '음주 적발', from: ['staff', 'user'] },
  feedback: { label: '새 의견', from: ['staff', 'user', 'driver', 'guest'], need: 'feedback.view' },
  guestjoin: { label: '임시 출입 입장', from: [] },
  joinreq: { label: '가입 신청', from: [], need: 'join.approve' },
};
export const sourceOf = (u) => (u.role === 'admin' || u.role === 'manager' ? 'staff' : u.role);
/** 저장한 적 없으면: 모두 켬, 다만 운영자·관리자가 한 일은 끔 */
export function defaultPrefs() {
  const ev = {};
  for (const [k, e] of Object.entries(PUSH_EVENTS)) ev[k] = { on: true, from: Object.fromEntries(e.from.map((s) => [s, s !== 'staff'])) };
  return { events: ev, quiet: false, sticky: false }; // quiet: 소리·진동 없이 · sticky: 누를 때까지 남김
}
export function cleanPrefs(p) {
  const d = defaultPrefs();
  if (p) { d.quiet = !!p.quiet; d.sticky = !!p.sticky; }
  for (const k of Object.keys(PUSH_EVENTS)) {
    const x = p && p.events && p.events[k];
    if (!x) continue;
    d.events[k].on = !!x.on;
    for (const s of PUSH_EVENTS[k].from) if (x.from && s in x.from) d.events[k].from[s] = !!x.from[s];
  }
  return d;
}

/* ---------- VAPID 키 ---------- */
export async function vapidKeys(env) {
  const r = await env.DB.prepare("SELECT data FROM docs WHERE store='pushkey' AND id='vapid'").first();
  const saved = r && parse(r.data);
  if (saved) return saved;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const data = { jwk: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)) };
  // 두 요청이 동시에 만들면 먼저 저장된 것을 씀
  await env.DB.prepare("INSERT OR IGNORE INTO docs (store,id,data,deleted,created_at,updated_at) VALUES ('pushkey','vapid',?,0,?,0)").bind(JSON.stringify(data), now()).run();
  return parse((await env.DB.prepare("SELECT data FROM docs WHERE store='pushkey' AND id='vapid'").first()).data);
}

async function vapidAuth(keys, endpoint, sub) {
  const aud = new URL(endpoint).origin;
  const head = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(now() / 1000) + 12 * 3600, sub })));
  const key = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${head}.${body}`)); // WebCrypto는 r||s 64바이트 = JWT ES256 형식
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.pub}`;
}

const hkdf = async (salt, ikm, info, len) => new Uint8Array(await crypto.subtle.deriveBits(
  { name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));

/** RFC 8291 + RFC 8188 (aes128gcm, 레코드 하나) */
export async function encryptPayload(sub, text) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(te.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt); new DataView(head.buffer).setUint32(16, 4096); head[20] = asPub.length;
  return cat(head, asPub, ct);
}

/** 구독 하나에 보냄. 404·410(만료된 구독)이면 지움 */
export async function sendPush(env, keys, subRow, payload, origin) {
  const sub = parse(subRow.data);
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
        Authorization: await vapidAuth(keys, sub.endpoint, origin) },
      body: await encryptPayload(sub, JSON.stringify(payload)),
    });
    if (res.status === 404 || res.status === 410) await env.DB.prepare("DELETE FROM docs WHERE store='pushsub' AND id=?").bind(subRow.id).run();
    return res.status;
  } catch (e) { console.error('push', e && e.message); return 0; }
}

export const subId = (endpoint) => sha256(endpoint);

/** 알림 보내기: event 종류, actor = 한 사람(users 행) 또는 null, msg = {title, body, url} */
export async function notify(env, origin, event, actor, msg) {
  const ev = PUSH_EVENTS[event];
  if (!ev) return;
  // 받을 사람: 폰 알림 권한이 있는 사람 (+ 새 의견은 받은 의견 보기, 가입 신청은 승인 권한)
  const staff = [], table = await loadPermTable(env);
  for (const u of (await env.DB.prepare('SELECT id, role FROM users WHERE active=1').all()).results) {
    const P = await permsOf(env, u, table);
    if (P.has('push') && (!ev.need || P.has(ev.need))) staff.push(u);
  }
  const prefRows = new Map((await env.DB.prepare("SELECT id, data FROM docs WHERE store='pushpref'").all()).results.map((r) => [r.id, parse(r.data)]));
  const src = actor ? sourceOf(actor) : null;
  const prefOf = new Map();
  const to = staff.filter((u) => {
    if (actor && u.id === actor.id) return false;
    const all = cleanPrefs(prefRows.get(u.id)); prefOf.set(u.id, all);
    const p = all.events[event];
    return p.on && (!src || !ev.from.length || p.from[src]);
  }).map((u) => u.id);
  if (!to.length) return;
  const subs = (await env.DB.prepare("SELECT id, data FROM docs WHERE store='pushsub' AND json_extract(data,'$.userId') IN (SELECT value FROM json_each(?))").bind(JSON.stringify(to)).all()).results;
  if (!subs.length) return;
  const keys = await vapidKeys(env);
  await Promise.all(subs.map((s) => { const p = prefOf.get((parse(s.data) || {}).userId) || {};
    return sendPush(env, keys, s, { ...msg, tag: event, silent: !!p.quiet, sticky: !!p.sticky }, origin); }));
}
