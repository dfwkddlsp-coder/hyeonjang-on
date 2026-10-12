// 가입 신청(초대 QR): 계정 없는 사람이 이름·휴대폰·업체·직종·비밀번호로 신청 → 운영자가 권한을 정해 승인하면 그 비밀번호로 로그인.
// 신청은 docs 'joinreq'(동기화·백업 안 함, 비밀번호는 해시만). 운영자가 설정에서 "가입 신청 받기"를 끄면 막힘.
import { body, fail, json, now, uid } from '../lib/http.js';
import { requireAdmin } from '../lib/session.js';
import { checkPw, hashPw, newSalt } from '../lib/crypto.js';
import { stampBase } from '../lib/storage.js';
import { notify } from '../lib/push.js';

const MAX_PENDING = 100; // 아무나 신청할 수 있으므로 쌓이는 수를 제한
const ROLE_OK = ['user', 'driver', 'manager'];
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const digits = (s) => String(s || '').replace(/\D/g, '');

async function joinOpen(env) {
  const r = await env.DB.prepare("SELECT data FROM docs WHERE store='settings' AND id='shared' AND deleted=0").first();
  return (parse(r && r.data) || {}).joinOpen !== false;
}

// GET /api/join/open → {open}
async function isOpen({ env }) { return json({ open: await joinOpen(env) }); }

// POST /api/join/request {name, phone, company, job, want, password}
async function request({ req, env, ctx }) {
  if (!(await joinOpen(env))) fail(403, '지금은 가입 신청을 받지 않습니다. 현장 운영자에게 문의하세요');
  const b = await body(req);
  const name = String(b.name || '').trim().slice(0, 30), phone = digits(b.phone);
  const company = String(b.company || '').trim().slice(0, 40), job = String(b.job || '').trim().slice(0, 30);
  const want = b.want === 'driver' ? 'driver' : 'user';
  if (!name) fail(400, '이름을 입력하세요');
  if (!/^01\d{8,9}$/.test(phone)) fail(400, '휴대폰 번호를 정확히 입력하세요 (아이디로 씁니다)');
  if (!company) fail(400, '소속 업체를 입력하세요');
  checkPw(b.password);
  if (await env.DB.prepare('SELECT 1 FROM users WHERE login_id=?').bind(phone).first()) fail(409, '이미 이 번호로 만든 계정이 있습니다. 로그인해 주세요 (비밀번호를 잊었으면 운영자에게)');
  const pend = (await env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE store='joinreq' AND deleted=0").first()).n;
  if (pend >= MAX_PENDING) fail(429, '신청이 너무 많이 쌓여 있습니다. 운영자에게 문의하세요');
  const salt = newSalt(), t = await stampBase(env);
  const data = { name, phone, company, job, want, salt, hash: await hashPw(b.password, salt), at: now() };
  // 같은 번호로 다시 신청하면 덮어씀 (id = 번호)
  await env.DB.prepare(`INSERT INTO docs (store,id,data,deleted,created_at,updated_at) VALUES ('joinreq',?1,?2,0,?3,?3)
    ON CONFLICT(store,id) DO UPDATE SET data=excluded.data, deleted=0, updated_at=excluded.updated_at`).bind(phone, JSON.stringify(data), t).run();
  if (ctx) ctx.waitUntil(notify(env, new URL(req.url).origin, 'joinreq', null, { title: '가입 신청', body: `${name} (${company}${job ? ' · ' + job : ''}) — ${want === 'driver' ? '장비운전원' : '사용자'}로 신청`, url: '/' }).catch(() => {}));
  return json({ ok: true });
}

// GET /api/join/requests — 운영자
async function list({ req, env }) {
  await requireAdmin(req, env);
  const r = await env.DB.prepare("SELECT id, data FROM docs WHERE store='joinreq' AND deleted=0 ORDER BY created_at").all();
  return json({ items: r.results.map((x) => { const d = parse(x.data) || {}; return { id: x.id, name: d.name, phone: d.phone, company: d.company, job: d.job, want: d.want, at: d.at }; }) });
}

// POST /api/join/requests/<번호> {action:'approve'|'reject', role}
async function decide({ req, env, params: [id] }) {
  await requireAdmin(req, env);
  const b = await body(req);
  const row = await env.DB.prepare("SELECT data FROM docs WHERE store='joinreq' AND id=? AND deleted=0").bind(id).first();
  if (!row) fail(404, '없는 신청입니다');
  const d = parse(row.data);
  const drop = env.DB.prepare("DELETE FROM docs WHERE store='joinreq' AND id=?").bind(id);
  if (b.action !== 'approve') { await drop.run(); return json({ ok: true }); }
  if (await env.DB.prepare('SELECT 1 FROM users WHERE login_id=?').bind(d.phone).first()) { await drop.run(); fail(409, '이미 이 번호로 만든 계정이 있습니다'); }
  const role = ROLE_OK.includes(b.role) ? b.role : d.want, t = now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id,login_id,name,org,title,role,pw_hash,pw_salt,must_change,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,1,?,?)')
      .bind(uid(), d.phone, d.name, d.company || '', d.job || '', role, d.hash, d.salt, t, t),
    drop,
  ]);
  return json({ ok: true });
}

export default [
  ['GET', '/api/join/open', isOpen],
  ['POST', '/api/join/request', request],
  ['GET', '/api/join/requests', list],
  ['POST', /^\/api\/join\/requests\/(01\d{8,9})$/, decide],
];
