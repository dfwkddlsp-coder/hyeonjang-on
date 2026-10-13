// 사용자 관리: 권한 설정의 '사용자 관리'(set.users). 코드로 고정: 운영자 계정을 만들거나 고치는 것은 운영자만,
// 운영자가 아닌 사람은 자기 권한을 바꿀 수 없음.
import { body, fail, json, now, uid } from '../lib/http.js';
import { checkPw, hashPw, newSalt } from '../lib/crypto.js';
import { publicUser } from '../lib/session.js';
import { requirePerm } from '../lib/perms.js';
const requireAdmin = (req, env) => requirePerm(req, env, 'set.users', '사용자 관리 권한이 없습니다');
import { ROLES } from '../lib/policy.js';
const SETTABLE = ROLES.filter((r) => r !== 'guest'); // 임시 운전원은 QR로만 생김

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
  if (b.role === 'admin' && a.role !== 'admin') fail(403, '운영자 계정은 운영자만 만들 수 있습니다');
  if (await env.DB.prepare('SELECT 1 FROM users WHERE login_id=?').bind(loginId).first()) fail(409, '이미 있는 아이디입니다');
  const salt = newSalt(), id = uid(), t = now();
  await env.DB.prepare('INSERT INTO users (id,login_id,name,org,title,role,pw_hash,pw_salt,must_change,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,1,?,?)')
    .bind(id, loginId, name, String(b.org || ''), String(b.title || ''), SETTABLE.includes(b.role) ? b.role : 'user', await hashPw(b.password, salt), salt, t, t).run();
  return json({ user: publicUser(await userById(env, id)), by: a.id });
}

// edit profile / role / active; a new password forces a change at next login and ends their sessions
async function update({ req, env, params: [id] }) {
  const a = await requireAdmin(req, env);
  const b = await body(req);
  const u = await userById(env, id);
  if (!u) fail(404, '사용자가 없습니다');
  if (a.role !== 'admin') {
    if (u.role === 'admin') fail(403, '운영자 계정은 운영자만 고칠 수 있습니다');
    if (b.role === 'admin') fail(403, '운영자 권한은 운영자만 줄 수 있습니다');
    if (u.id === a.id && b.role && b.role !== u.role) fail(403, '자기 권한은 바꿀 수 없습니다');
  }
  const role = SETTABLE.includes(b.role) ? b.role : u.role;
  const active = b.active === undefined ? u.active : (b.active ? 1 : 0);
  if (u.id === a.id && a.role === 'admin' && (role !== 'admin' || !active)) fail(400, '본인의 운영자 권한은 해제할 수 없습니다');
  if (u.id === a.id && !active) fail(400, '자기 계정은 정지할 수 없습니다');
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
