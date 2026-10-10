// User management (operator only).
import { body, fail, json, now, uid } from '../lib/http.js';
import { checkPw, hashPw, newSalt } from '../lib/crypto.js';
import { publicUser, requireAdmin } from '../lib/session.js';
import { ROLES } from '../lib/policy.js';

const userById = (env, id) => env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();

async function list({ req, env }) {
  await requireAdmin(req, env);
  const r = await env.DB.prepare('SELECT * FROM users ORDER BY role, name').all();
  return json({ users: r.results.map(publicUser) });
}

async function create({ req, env }) {
  const a = await requireAdmin(req, env);
  const b = await body(req);
  const loginId = String(b.loginId || '').trim(), name = String(b.name || '').trim();
  if (!/^[A-Za-z0-9._@-]{3,40}$/.test(loginId)) fail(400, '아이디는 영문·숫자 3자 이상 (휴대폰번호 숫자도 가능)');
  if (!name) fail(400, '이름을 입력하세요');
  checkPw(b.password);
  if (await env.DB.prepare('SELECT 1 FROM users WHERE login_id=?').bind(loginId).first()) fail(409, '이미 있는 아이디입니다');
  const salt = newSalt(), id = uid(), t = now();
  await env.DB.prepare('INSERT INTO users (id,login_id,name,org,title,role,pw_hash,pw_salt,must_change,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,1,?,?)')
    .bind(id, loginId, name, String(b.org || ''), String(b.title || ''), ROLES.includes(b.role) ? b.role : 'user', await hashPw(b.password, salt), salt, t, t).run();
  return json({ user: publicUser(await userById(env, id)), by: a.id });
}

// edit profile / role / active; a new password forces a change at next login and ends their sessions
async function update({ req, env, params: [id] }) {
  const a = await requireAdmin(req, env);
  const b = await body(req);
  const u = await userById(env, id);
  if (!u) fail(404, '사용자가 없습니다');
  const role = ROLES.includes(b.role) ? b.role : u.role;
  const active = b.active === undefined ? u.active : (b.active ? 1 : 0);
  if (u.id === a.id && (role !== 'admin' || !active)) fail(400, '본인의 운영자 권한은 해제할 수 없습니다');
  const stmts = [env.DB.prepare('UPDATE users SET name=?, org=?, title=?, role=?, active=?, updated_at=? WHERE id=?')
    .bind(String(b.name ?? u.name).trim() || u.name, String(b.org ?? u.org), String(b.title ?? u.title), role, active, now(), u.id)];
  if (b.password) {
    checkPw(b.password);
    const salt = newSalt();
    stmts.push(env.DB.prepare('UPDATE users SET pw_hash=?, pw_salt=?, must_change=1 WHERE id=?').bind(await hashPw(b.password, salt), salt, u.id));
  }
  if (b.password || !active) stmts.push(env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id));
  await env.DB.batch(stmts);
  return json({ user: publicUser(await userById(env, u.id)) });
}

export default [
  ['GET', '/api/users', list],
  ['POST', '/api/users', create],
  ['POST', /^\/api\/users\/([a-f0-9]+)$/, update],
];
