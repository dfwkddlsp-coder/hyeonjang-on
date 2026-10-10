// Login sessions: an HttpOnly cookie holding a random token; the DB keeps only its hash.
import { fail, now } from './http.js';
import { b64, sha256 } from './crypto.js';

export const SESSION_DAYS = 180; // 자동 로그인: 앱을 열 때마다 다시 180일로 연장
const DAY = 864e5;

export function cookieToken(req) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)hs=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export function sessionCookie(token, req) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `hs=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}
export const CLEAR_COOKIE = 'hs=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

export async function startSession(env, userId, req) {
  const raw = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .bind(await sha256(raw), userId, now() + SESSION_DAYS * DAY, now()).run();
  return sessionCookie(raw, req);
}

/** Push the expiry back to a full SESSION_DAYS once a day; returns a Set-Cookie header or null. */
export async function renewSession(env, req, user) {
  if (!user || user.s_exp - now() >= (SESSION_DAYS - 1) * DAY) return null;
  const t = cookieToken(req);
  await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=?').bind(now() + SESSION_DAYS * DAY, await sha256(t)).run();
  return sessionCookie(t, req);
}

export async function currentUser(req, env) {
  const t = cookieToken(req);
  if (!t) return null;
  const row = await env.DB.prepare(
    'SELECT u.*, s.expires_at AS s_exp FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1'
  ).bind(await sha256(t), now()).first();
  return row || null;
}

export async function requireUser(req, env, { allowMustChange = false } = {}) {
  const u = await currentUser(req, env);
  if (!u) fail(401, '로그인이 필요합니다');
  if (u.must_change && !allowMustChange) fail(403, '비밀번호를 먼저 변경하세요');
  return u;
}

export async function requireAdmin(req, env) {
  const u = await requireUser(req, env);
  if (u.role !== 'admin') fail(403, '운영자만 할 수 있습니다');
  return u;
}

/** The user fields the app may see (never the password hash). */
export const publicUser = (u) => u && ({
  id: u.id, loginId: u.login_id, name: u.name, org: u.org, title: u.title, role: u.role,
  mustChange: !!u.must_change, active: !!u.active, sig: u.sig_blob ? `/api/blob/${u.sig_blob}` : '',
});
