// Status, first-run setup, login/logout and the signed-in user's own profile.
import { body, fail, json, now, uid } from '../lib/http.js';
import { checkPw, hashPw, newSalt, safeEq, sha256 } from '../lib/crypto.js';
import {
  CLEAR_COOKIE, cookieToken, currentUser, publicUser, renewSession, requireUser, startSession,
} from '../lib/session.js';
import { extractBlobs } from '../lib/storage.js';

const MAX_FAILS = 5, LOCK_MS = 10 * 60 * 1000;
const userById = (env, id) => env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();

async function status({ req, env }) {
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  const u = await currentUser(req, env);
  const cookie = await renewSession(env, req, u);
  return json({ setupNeeded: !n.n, user: publicUser(u), time: now() }, 200, cookie ? { 'set-cookie': cookie } : {});
}

// first run only: create the operator account
async function setup({ req, env }) {
  const b = await body(req);
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  if (n.n) fail(409, '이미 운영자가 등록되어 있습니다');
  const loginId = String(b.loginId || '').trim(), name = String(b.name || '').trim();
  if (!loginId || !name) fail(400, '아이디와 이름을 입력하세요');
  checkPw(b.password);
  const salt = newSalt(), id = uid(), t = now();
  await env.DB.prepare('INSERT INTO users (id,login_id,name,org,title,role,pw_hash,pw_salt,must_change,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,1,?,?)')
    .bind(id, loginId, name, String(b.org || ''), String(b.title || ''), 'admin', await hashPw(b.password, salt), salt, t, t).run();
  return json({ user: publicUser(await userById(env, id)) }, 200, { 'set-cookie': await startSession(env, id, req) });
}

async function login({ req, env }) {
  const b = await body(req);
  const loginId = String(b.loginId || '').trim();
  const lf = await env.DB.prepare('SELECT * FROM login_fail WHERE login_id=?').bind(loginId).first();
  if (lf && lf.locked_until > now()) fail(429, '로그인 시도가 너무 많습니다. 10분 후 다시 시도하세요');
  const u = await env.DB.prepare('SELECT * FROM users WHERE login_id=? AND active=1').bind(loginId).first();
  const ok = u && safeEq(await hashPw(String(b.password || ''), u.pw_salt), u.pw_hash);
  if (!ok) {
    const c = (lf ? lf.count : 0) + 1;
    await env.DB.prepare('INSERT INTO login_fail (login_id,count,locked_until) VALUES (?,?,?) ON CONFLICT(login_id) DO UPDATE SET count=excluded.count, locked_until=excluded.locked_until')
      .bind(loginId, c >= MAX_FAILS ? 0 : c, c >= MAX_FAILS ? now() + LOCK_MS : 0).run();
    fail(401, '아이디 또는 비밀번호가 맞지 않습니다');
  }
  await env.DB.prepare('DELETE FROM login_fail WHERE login_id=?').bind(loginId).run();
  return json({ user: publicUser(u) }, 200, { 'set-cookie': await startSession(env, u.id, req) });
}

async function logout({ req, env }) {
  const t = cookieToken(req);
  if (t) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(t)).run();
  return json({ ok: true }, 200, { 'set-cookie': CLEAR_COOKIE });
}

async function changePassword({ req, env }) {
  const u = await requireUser(req, env, { allowMustChange: true });
  const b = await body(req);
  if (!safeEq(await hashPw(String(b.current || ''), u.pw_salt), u.pw_hash)) fail(400, '현재 비밀번호가 맞지 않습니다');
  checkPw(b.next);
  if (b.next === b.current) fail(400, '새 비밀번호가 이전과 같습니다');
  const salt = newSalt();
  await env.DB.prepare('UPDATE users SET pw_hash=?, pw_salt=?, must_change=0, updated_at=? WHERE id=?').bind(await hashPw(b.next, salt), salt, now(), u.id).run();
  return json({ user: publicUser(await userById(env, u.id)) });
}

// own name / org / title / signature
async function updateMe({ req, env }) {
  const u = await requireUser(req, env);
  const b = await body(req);
  const stmts = [];
  let sig = u.sig_blob;
  if (typeof b.sig === 'string') {
    if (!b.sig) sig = null;
    else { const ref = await extractBlobs(env, b.sig, u.id, stmts); sig = ref.startsWith('/api/blob/') ? ref.slice(10) : sig; }
  }
  stmts.push(env.DB.prepare('UPDATE users SET name=?, org=?, title=?, sig_blob=?, updated_at=? WHERE id=?')
    .bind(String(b.name ?? u.name).trim() || u.name, String(b.org ?? u.org), String(b.title ?? u.title), sig, now(), u.id));
  await env.DB.batch(stmts);
  return json({ user: publicUser(await userById(env, u.id)) });
}

export default [
  ['GET', '/api/status', status],
  ['POST', '/api/setup', setup],
  ['POST', '/api/login', login],
  ['POST', '/api/logout', logout],
  ['POST', '/api/me/password', changePassword],
  ['POST', '/api/me', updateMe],
];
