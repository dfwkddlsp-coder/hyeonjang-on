// 임시 출입 QR: 관리자·운영자가 QR을 띄우면 정해진 시간 동안 여러 명이 찍고 들어옴 (교육장 등).
// 들어온 사람은 '임시 운전원'(guest) 계정이 하나씩 생기고, 그날 자정(한국시간)까지 본인 장비 추가·점검·사진만 가능.
// QR(초대)은 docs 'guestinv'에 두되 동기화하지 않음. id = 토큰의 SHA-256 (토큰 자체는 저장 안 함).
import { body, fail, json, now, uid } from '../lib/http.js';
import { requireUser, startSession, publicUser } from '../lib/session.js';
import { isStaff } from '../lib/policy.js';
import { hashPw, newSalt, sha256 } from '../lib/crypto.js';
import { stampBase } from '../lib/storage.js';
import { notify } from '../lib/push.js';

const DAY = 864e5, KST = 9 * 3600e3;
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const kstMidnight = () => Math.floor((now() + KST) / DAY) * DAY + DAY - KST;
/** 이 QR로 들어온 사람: login_id = g<초대 앞 10자>_<무작위> */
const prefixOf = (id) => 'g' + id.slice(0, 10) + '_';

async function getInvite(env, id) {
  const r = await env.DB.prepare("SELECT data FROM docs WHERE store='guestinv' AND id=? AND deleted=0").bind(id).first();
  return r ? parse(r.data) : null;
}
async function putInvite(env, id, data, userId) {
  const t = await stampBase(env);
  await env.DB.prepare(`INSERT INTO docs (store,id,data,deleted,created_by,updated_by,created_at,updated_at) VALUES ('guestinv',?1,?2,0,?3,?3,?4,?4)
    ON CONFLICT(store,id) DO UPDATE SET data=excluded.data, updated_by=excluded.updated_by, updated_at=excluded.updated_at`).bind(id, JSON.stringify(data), userId, t).run();
}
// POST /api/guest/invite {minutes} → {token, id, exp} — 관리자·운영자
async function createInvite({ req, env }) {
  const u = await requireUser(req, env);
  if (!isStaff(u)) fail(403, '임시 출입 QR은 관리자·운영자만 만들 수 있습니다');
  const b = await body(req);
  const minutes = Math.min(180, Math.max(5, Math.round(+b.minutes || 30)));
  const token = uid() + uid(); // 64자 무작위
  const id = await sha256(token);
  const exp = Math.min(now() + minutes * 60e3, kstMidnight());
  await putInvite(env, id, { by: u.id, byName: u.name, at: now(), exp, closed: false }, u.id);
  return json({ token, id, exp });
}

// GET /api/guest/invite/<id> → {exp, closed, joined:[…]} — 관리자·운영자 (QR 화면의 들어온 사람 명단)
async function inviteStatus({ req, env, params: [id] }) {
  const u = await requireUser(req, env);
  const inv = await getInvite(env, id);
  if (!inv) fail(404, '없는 QR입니다');
  if (!isStaff(u)) fail(403, '권한이 없습니다');
  return json({ exp: inv.exp, closed: !!inv.closed, joined: await joinedList(env, id) });
}
/** 이 QR로 들어온 사람 (LIKE의 _ 는 한 글자 와일드카드라 이스케이프) */
const joinedList = async (env, id) => (await env.DB.prepare("SELECT name, org, created_at FROM users WHERE role='guest' AND login_id LIKE ? ESCAPE '\\' ORDER BY created_at")
  .bind(prefixOf(id).replace(/_/g, '\\_') + '%').all()).results.map((x) => ({ name: x.name, org: x.org, at: x.created_at }));

// POST /api/guest/invite/<id>/close — QR 닫기 (더는 못 들어옴, 이미 들어온 사람은 자정까지)
async function closeInvite({ req, env, params: [id] }) {
  const u = await requireUser(req, env);
  if (!isStaff(u)) fail(403, '권한이 없습니다');
  const inv = await getInvite(env, id);
  if (!inv) fail(404, '없는 QR입니다');
  inv.closed = true;
  await putInvite(env, id, inv, u.id);
  return json({ ok: true });
}

// POST /api/guest/join {token, name, phone, company} → 임시 운전원 계정 + 자정까지 세션
async function join({ req, env, ctx }) {
  const b = await body(req);
  const id = await sha256(String(b.token || ''));
  const inv = await getInvite(env, id);
  if (!inv || inv.closed || inv.exp < now()) fail(403, '사용할 수 없는 QR입니다. 관리자에게 새 QR을 받아 주세요');
  const name = String(b.name || '').trim().slice(0, 30), phone = String(b.phone || '').replace(/[^\d-]/g, '').slice(0, 20), company = String(b.company || '').trim().slice(0, 40);
  if (!name) fail(400, '이름을 입력하세요');
  if (phone.replace(/\D/g, '').length < 10) fail(400, '연락처(휴대폰 번호)를 입력하세요');
  const userId = uid(), salt = newSalt(), t = now();
  await env.DB.prepare('INSERT INTO users (id,login_id,name,org,title,role,pw_hash,pw_salt,must_change,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,1,?,?)')
    .bind(userId, prefixOf(id) + uid().slice(0, 8), name, company, phone, 'guest', await hashPw(uid() + uid(), salt), salt, t, t).run(); // 비밀번호는 아무도 모름 → QR로만 들어옴
  const cookie = await startSession(env, userId, req, kstMidnight());
  const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first();
  if (ctx) ctx.waitUntil(notify(env, new URL(req.url).origin, 'guestjoin', null, { title: '임시 출입', body: `${name}${company ? ` (${company})` : ''} 님이 QR로 들어왔습니다`, url: '/' }).catch(() => {}));
  return json({ user: publicUser(u) }, 200, { 'set-cookie': cookie });
}

export default [
  ['POST', '/api/guest/invite', createInvite],
  ['GET', /^\/api\/guest\/invite\/([a-f0-9]{64})$/, inviteStatus],
  ['POST', /^\/api\/guest\/invite\/([a-f0-9]{64})\/close$/, closeInvite],
  ['POST', '/api/guest/join', join],
];
