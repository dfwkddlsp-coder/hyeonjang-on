// 휴대폰 달력 구독: 사람마다 비밀 주소(.ics)를 주고, 달력 앱이 주기적으로 읽어 감 (달력 앱은 로그인을 못 함).
// 저장: docs store 'calsub', id = 사용자 id, data = { t: 주소 토큰, duty: 당직자 포함, seen: 달력 앱이 읽어 간 적 있음 } (동기화 안 됨).
// 토큰은 다시 보여 줘야 해서(기기 추가 연결) 평문 저장. 읽기 전용이고, DB를 볼 수 있으면 일정도 이미 볼 수 있음.
// 멈추는 경우: 주소 재발급 · 계정 비활성 · 권한 sched.subscribe 또는 sched.view 꺼짐 · 임시 운전원.
import { body, fail, json, now, uid } from '../lib/http.js';
import { can, requirePerm } from '../lib/perms.js';
import { stampBase } from '../lib/storage.js';
import SCHED_ICS from '../../public/js/core/sched-ics.js';

const STORE = 'calsub';
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const feedUrl = (url, t) => `${url.origin}/api/cal/${t}.ics`;
const notFound = () => new Response('', { status: 404, headers: { 'cache-control': 'no-store' } });

async function requireSubscriber(req, env) {
  const u = await requirePerm(req, env, 'sched.subscribe', '휴대폰 달력 연결 권한이 없습니다');
  if (u.role === 'guest') fail(403, '임시 운전원은 휴대폰 달력을 연결할 수 없습니다');
  return u;
}
const getSub = async (env, userId) => parse((await env.DB.prepare('SELECT data FROM docs WHERE store=? AND id=? AND deleted=0').bind(STORE, userId).first() || {}).data);
async function putSub(env, userId, data, by = userId) {
  const t = await stampBase(env);
  await env.DB.prepare(`INSERT INTO docs (store,id,data,deleted,created_by,updated_by,created_at,updated_at) VALUES (?1,?2,?3,0,?4,?4,?5,?5)
    ON CONFLICT(store,id) DO UPDATE SET data=excluded.data, deleted=0, updated_by=excluded.updated_by, updated_at=excluded.updated_at`).bind(STORE, userId, JSON.stringify(data), by, t).run();
}
const reply = (url, s) => json({ url: feedUrl(url, s.t), duty: !!s.duty, seen: !!s.seen });

// GET /api/cal/status → { seen } : 달력 앱이 실제로 읽어 간 적이 있는지 (버튼 표시용)
async function status({ req, env }) {
  const u = await requireSubscriber(req, env);
  return json({ seen: !!(await getSub(env, u.id) || {}).seen });
}
// POST /api/cal/link { duty? } → 주소가 없으면 만들고 돌려줌
async function link({ req, env, url }) {
  const u = await requireSubscriber(req, env), b = await body(req);
  const cur = await getSub(env, u.id), s = cur || { t: uid(), duty: false, seen: false };
  const next = b.duty === undefined ? s : { ...s, duty: !!b.duty };
  if (!cur || next !== s) await putSub(env, u.id, next);
  return reply(url, next);
}
// POST /api/cal/renew → 새 주소 (옛 주소는 바로 멈춤)
async function renew({ req, env, url }) {
  const u = await requireSubscriber(req, env);
  const s = { t: uid(), duty: !!(await getSub(env, u.id) || {}).duty, seen: false };
  await putSub(env, u.id, s);
  return reply(url, s);
}

/** 지난달 1일 (한국 시각). 달력이 너무 커지지 않게 그 전 일정은 보내지 않음 */
function feedFrom(ms) {
  const k = new Date(ms + 9 * 3600e3), d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 10);
}
// GET /api/cal/<토큰>.ics : 달력 앱용, 로그인 없음
async function feed({ env, params: [token] }) {
  const row = await env.DB.prepare("SELECT id,data FROM docs WHERE store=? AND deleted=0 AND json_extract(data,'$.t')=?").bind(STORE, token).first();
  if (!row) return notFound();
  const u = await env.DB.prepare('SELECT * FROM users WHERE id=? AND active=1').bind(row.id).first();
  if (!u || u.role === 'guest' || !(await can(env, u, 'sched.subscribe')) || !(await can(env, u, 'sched.view'))) return notFound();
  const sub = parse(row.data), from = feedFrom(now());
  const rows = (await env.DB.prepare("SELECT id,data FROM docs WHERE store='schedule' AND deleted=0").all()).results;
  const items = rows.map((r) => ({ ...parse(r.data), id: r.id }))
    .filter((x) => x.date && x.date >= from && (sub.duty || !SCHED_ICS.isDuty(x)))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sub.seen) await putSub(env, row.id, { ...sub, seen: true }, row.id); // 처음 읽어 갈 때 한 번만 기록
  return new Response(SCHED_ICS.buildIcs(items, now(), { name: '현장ON 일정' }), {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-cache', 'x-robots-tag': 'noindex' },
  });
}

export default [
  ['GET', '/api/cal/status', status],
  ['POST', '/api/cal/link', link],
  ['POST', '/api/cal/renew', renew],
  ['GET', /^\/api\/cal\/([a-f0-9]{32})\.ics$/, feed],
];
