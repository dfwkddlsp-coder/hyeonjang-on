// 폰 알림: 기기 구독, 알림 설정(종류·누가 했을 때), 시험 알림. 운영자·관리자만.
import { body, fail, json, now } from '../lib/http.js';
import { requireUser } from '../lib/session.js';
import { isStaff } from '../lib/policy.js';
import { stampBase } from '../lib/storage.js';
import { PUSH_EVENTS, cleanPrefs, sendPush, subId, vapidKeys } from '../lib/push.js';

const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
async function staffOnly(req, env) {
  const u = await requireUser(req, env);
  if (!isStaff(u)) fail(403, '알림은 운영자·관리자만 받을 수 있습니다');
  return u;
}
async function putDoc(env, store, id, data, userId) {
  const t = await stampBase(env);
  await env.DB.prepare(`INSERT INTO docs (store,id,data,deleted,created_by,updated_by,created_at,updated_at) VALUES (?1,?2,?3,0,?4,?4,?5,?5)
    ON CONFLICT(store,id) DO UPDATE SET data=excluded.data, deleted=0, updated_by=excluded.updated_by, updated_at=excluded.updated_at`).bind(store, id, JSON.stringify(data), userId, t).run();
}

// GET /api/push/key → {publicKey}
async function key({ req, env }) {
  await staffOnly(req, env);
  return json({ publicKey: (await vapidKeys(env)).pub });
}

// POST /api/push/subscribe {endpoint, keys:{p256dh, auth}, device}
async function subscribe({ req, env }) {
  const u = await staffOnly(req, env);
  const b = await body(req);
  const ep = String(b.endpoint || '');
  const dev = /^(localhost|127\.0\.0\.1)$/.test(new URL(req.url).hostname); // 시험 서버에서만: 이 PC의 가짜 수신 서버로 암호화 확인
  if (!(/^https:\/\//.test(ep) || (dev && /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(ep))) || !b.keys || !b.keys.p256dh || !b.keys.auth) fail(400, '잘못된 알림 구독입니다');
  await putDoc(env, 'pushsub', await subId(ep), { userId: u.id, endpoint: ep, keys: { p256dh: String(b.keys.p256dh), auth: String(b.keys.auth) }, device: String(b.device || '').slice(0, 80), at: now() }, u.id);
  return json({ ok: true });
}

// POST /api/push/unsubscribe {endpoint}
async function unsubscribe({ req, env }) {
  const u = await requireUser(req, env);
  const b = await body(req);
  await env.DB.prepare("DELETE FROM docs WHERE store='pushsub' AND id=? AND json_extract(data,'$.userId')=?").bind(await subId(String(b.endpoint || '')), u.id).run();
  return json({ ok: true });
}

// GET /api/push/prefs → {prefs, events, devices}
async function getPrefs({ req, env }) {
  const u = await staffOnly(req, env);
  const r = await env.DB.prepare("SELECT data FROM docs WHERE store='pushpref' AND id=?").bind(u.id).first();
  const devices = (await env.DB.prepare("SELECT data FROM docs WHERE store='pushsub' AND json_extract(data,'$.userId')=?").bind(u.id).all()).results.length;
  const events = Object.fromEntries(Object.entries(PUSH_EVENTS).filter(([, e]) => !e.adminOnly || u.role === 'admin'));
  return json({ prefs: cleanPrefs(r && parse(r.data)), events, devices });
}

// POST /api/push/prefs {prefs}
async function setPrefs({ req, env }) {
  const u = await staffOnly(req, env);
  const b = await body(req);
  await putDoc(env, 'pushpref', u.id, cleanPrefs(b.prefs), u.id);
  return json({ ok: true });
}

// POST /api/push/test — 내 기기들로 시험 알림
async function test({ req, env }) {
  const u = await staffOnly(req, env);
  const subs = (await env.DB.prepare("SELECT id, data FROM docs WHERE store='pushsub' AND json_extract(data,'$.userId')=?").bind(u.id).all()).results;
  const pr = cleanPrefs(parse((await env.DB.prepare("SELECT data FROM docs WHERE store='pushpref' AND id=?").bind(u.id).first() || {}).data));
  if (!subs.length) fail(400, '이 계정으로 알림을 받는 기기가 없습니다. 먼저 "이 기기에서 알림 받기"를 켜세요');
  const keys = await vapidKeys(env), origin = new URL(req.url).origin;
  const st = await Promise.all(subs.map((s) => sendPush(env, keys, s, { title: '현장ON 시험 알림', body: `${u.name}님, 알림이 잘 옵니다 🫡`, url: '/', tag: 'test', silent: pr.quiet, sticky: pr.sticky }, origin)));
  return json({ sent: st.filter((x) => x >= 200 && x < 300).length, total: subs.length });
}

export default [
  ['GET', '/api/push/key', key],
  ['POST', '/api/push/subscribe', subscribe],
  ['POST', '/api/push/unsubscribe', unsubscribe],
  ['GET', '/api/push/prefs', getPrefs],
  ['POST', '/api/push/prefs', setPrefs],
  ['POST', '/api/push/test', test],
];
