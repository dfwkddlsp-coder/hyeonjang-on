// 폰 알림 암호화·서명 확인 — LOCAL `npm run dev`에서만. 이 PC에 가짜 푸시 수신 서버를 띄우고,
// 서버가 보낸 알림을 RFC 8291 그대로 풀어 내용과 VAPID 서명(ES256)을 확인한다. 실제 폰은 쓰지 않음.
//   TEST_ADMIN_ID=... TEST_ADMIN_PW=... node tests/push-check.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';

const BASE = process.env.TEST_BASE || 'http://localhost:8787';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('local dev server only');
const b64u = (b) => Buffer.from(b).toString('base64url');
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

const client = () => { let ck = ''; return async (p, b) => {
  const r = await fetch(`${BASE}/api/${p}`, { method: b === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', cookie: ck }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0];
  return { s: r.status, j: await r.json().catch(() => null) };
}; };

// 가짜 수신 서버
const got = [];
const srv = http.createServer((req, res) => { const parts = []; req.on('data', (c) => parts.push(c)); req.on('end', () => { got.push({ headers: req.headers, body: Buffer.concat(parts), path: req.url }); res.writeHead(201); res.end(); }); });
await new Promise((r) => srv.listen(8799, '127.0.0.1', r));

function device(name) { // 폰 하나 흉내: 받는 쪽 키와 auth 비밀값
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { name, ecdh, auth, sub: { endpoint: `http://127.0.0.1:8799/${name}`, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } } };
}
function open(dev, msg) { // RFC 8291 / 8188 풀기
  const b = msg.body, salt = b.subarray(0, 16), idlen = b[20], asPub = b.subarray(21, 21 + idlen), ct = b.subarray(21 + idlen);
  const shared = dev.ecdh.computeSecret(asPub);
  const ikm = hkdf(dev.auth, shared, Buffer.concat([Buffer.from('WebPush: info\0'), dev.ecdh.getPublicKey(), asPub]), 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(pt[pt.length - 1], 2, 'last-record delimiter');
  return JSON.parse(pt.subarray(0, pt.length - 1).toString());
}
function checkVapid(msg) {
  const m = msg.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/); assert.ok(m, 'vapid header');
  const [h, p, sig] = m[1].split('.');
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(Buffer.from(m[2], 'base64url').subarray(1, 33)), y: b64u(Buffer.from(m[2], 'base64url').subarray(33)) }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')), 'ES256 signature');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  assert.equal(claims.aud, 'http://127.0.0.1:8799');
  assert.equal(msg.headers['content-encoding'], 'aes128gcm');
}
const wait = async (n) => { for (let i = 0; i < 40 && got.length < n; i++) await new Promise((r) => setTimeout(r, 100)); };

const A = client();
assert.equal((await A('login', { loginId: process.env.TEST_ADMIN_ID, password: process.env.TEST_ADMIN_PW })).s, 200);
const dev = device('admin');
try {
  assert.ok((await A('push/key')).j.publicKey, 'public key');
  assert.equal((await A('push/subscribe', { ...dev.sub, device: 'test' })).s, 200);
  // 1) 시험 알림
  assert.equal((await A('push/test', {})).j.sent, 1);
  await wait(1); const t = got.shift(); checkVapid(t);
  const tp = open(dev, t); assert.match(tp.title, /시험 알림/); assert.equal(tp.silent, false);
  // 조용히 받기·누를 때까지 남기기가 알림에 실려 감
  const p0 = (await A('push/prefs')).j.prefs; await A('push/prefs', { prefs: { ...p0, quiet: true, sticky: true } });
  await A('push/test', {}); await wait(1); const q = open(dev, got.shift());
  assert.equal(q.silent, true); assert.equal(q.sticky, true);
  await A('push/prefs', { prefs: { ...p0, quiet: false, sticky: false } });
  // 2) 다른 사람이 적발 등록 → 운영자에게 알림 (임시 출입으로 들어온 사람은 적발 못 하므로, 사용자 계정 대신 관리자 쪽 설정으로 확인)
  const prefs = (await A('push/prefs')).j.prefs; prefs.events.feedback.on = true; prefs.events.feedback.from.guest = true;
  assert.equal((await A('push/prefs', { prefs })).s, 200);
  const inv = (await A('guest/invite', { minutes: 10 })).j; const G = client();
  await G('guest/join', { token: inv.token, name: '알림시험', phone: '010-3333-1111' });
  await wait(1); assert.match(open(dev, got.shift()).body, /알림시험/, 'guest join push');
  await G('feedback', { kind: '기타', text: '알림 시험 의견' });
  await wait(1); assert.match(open(dev, got.shift()).body, /알림 시험 의견/, 'feedback push');
  // 3) 끄면 안 옴
  prefs.events.feedback.on = false; await A('push/prefs', { prefs });
  await G('feedback', { kind: '기타', text: '안 와야 함' }); await new Promise((r) => setTimeout(r, 1500));
  assert.equal(got.length, 0, 'no push when off');
  prefs.events.feedback.on = true; await A('push/prefs', { prefs });
  await A(`users/${(await G('status')).j.user.id}`, { active: false });
  // 4) 사용자가 삼진아웃 적발·장비 점검표 저장 → 알림 (부적합 표시)
  const tag = String(Date.now() % 1e7), U = client();
  const nu = (await A('users', { loginId: 'pu' + tag, name: '알림사용자', password: 'init-pass-9' })).j.user;
  await U('login', { loginId: 'pu' + tag, password: 'init-pass-9' }); await U('me/password', { current: 'init-pass-9', next: 'next-pass-9' });
  const vid = 'pv' + tag, wid = `wk-pe${tag}-2026-10-12`;
  await U('docs', { docs: [{ store: 'violations', id: vid, data: { id: vid, name: '홍길동', company: '가나', type: '안전모 미착용', level: 1 } }] });
  await wait(1); assert.match(open(dev, got.shift()).title, /삼진아웃 1차 적발/, 'violation push');
  await U('docs', { docs: [{ store: 'eqchecks', id: wid, data: { id: wid, kind: 'week', track: 'mgr', equipId: 'pe' + tag, type: '굴착기', plate: '11가1111', marks: { a: ['X'] } } }] });
  await wait(1); const eq = open(dev, got.shift()); assert.match(eq.title, /관리자 장비점검/); assert.match(eq.body, /부적합/, 'eqcheck push');
  await A('docs/delete', { store: 'violations', id: vid }); await A('docs/delete', { store: 'eqchecks', id: wid });
  await A(`users/${nu.id}`, { active: false });
  console.log('ok — 시험·임시 출입·의견·삼진아웃·장비점검 알림을 받아 풀었고, 서명이 맞고, 끄면 안 옴');

} finally {
  await A('push/unsubscribe', { endpoint: dev.sub.endpoint });
  srv.close();
}
