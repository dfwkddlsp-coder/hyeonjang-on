// 안내 봇(안전온)과 운영자에게 의견 보내기.
// 의견(feedback)과 AI 사용 횟수(aiuse)는 docs 표에 두지만 동기화하지 않음 — 운영자만 이 API로 봄.
import { body, fail, json, now, uid } from '../lib/http.js';
import { requireUser } from '../lib/session.js';
import { requirePerm } from '../lib/perms.js';
const requireAdmin = (req, env) => requirePerm(req, env, 'feedback.view', '받은 의견을 볼 권한이 없습니다');
import { extractBlobs, stampBase } from '../lib/storage.js';
import { notify } from '../lib/push.js';

const KINDS = ['불편해요', '오류 같아요', '이런 기능 있으면', '기타', '봇이 모른 질문'];
const AI_PER_DAY = 30; // 1인당 하루 AI 질문 수
// 현장 전체 하루 AI 질문 수 (설정 → 안내·의견에서 0~500). Workers AI 무료 사용량(하루 10,000 Neuron, UTC 0시 = 한국 오전 9시에 다시 채워짐) 안에
// 머물도록 질문 1개 ≈ 15~20 Neuron 기준으로 최대 500. 이 수는 무료 사용량과 같은 UTC 하루로 셈
const SITE_DEFAULT = 300, SITE_MAX = 500;
// 한국어로 빠르게(약 1.5초) 답하는 Workers AI 공개 모델 (2026-10 비교). 앞의 것이 실패하면 다음 것으로
const AI_MODELS = ['@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'];
const UNKNOWN = '[모름]';
const ROLE_KO = { admin: '운영자', manager: '관리자', user: '사용자', driver: '장비운전원' };

const kstDay = () => new Date(now() + 9 * 3600e3).toISOString().slice(0, 10);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

async function putDoc(env, store, id, data, userId) {
  const t = await stampBase(env);
  await env.DB.prepare(`INSERT INTO docs (store,id,data,deleted,created_by,updated_by,created_at,updated_at) VALUES (?1,?2,?3,0,?4,?4,?5,?5)
    ON CONFLICT(store,id) DO UPDATE SET data=excluded.data, deleted=0, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
    .bind(store, id, JSON.stringify(data), userId, t).run();
}

async function saveFeedback(env, u, kind, text, photos = []) {
  const stmts = [];
  const data = { kind, text, photos: await extractBlobs(env, photos, u.id, stmts), at: now(), byId: u.id, by: u.name, org: u.org || '', role: u.role, status: 'new', memo: '' };
  if (stmts.length) await env.DB.batch(stmts);
  await putDoc(env, 'feedback', uid(), data, u.id);
}

// POST /api/feedback {kind,text,photos:[dataURL]} — 누구나 (장비운전원 포함)
async function sendFeedback({ req, env, ctx }) {
  const u = await requireUser(req, env);
  const b = await body(req);
  const text = String(b.text || '').trim();
  if (!text) fail(400, '내용을 입력하세요');
  if (text.length > 2000) fail(400, '내용은 2000자까지 보낼 수 있습니다');
  const photos = (Array.isArray(b.photos) ? b.photos : []).filter((p) => typeof p === 'string').slice(0, 3);
  const kind = KINDS.includes(b.kind) ? b.kind : '기타';
  await saveFeedback(env, u, kind, text, photos);
  if (ctx) ctx.waitUntil(notify(env, new URL(req.url).origin, 'feedback', u, { title: `새 의견 · ${kind}`, body: `${u.name}: ${text.slice(0, 80)}`, url: '/' }).catch(() => {}));
  return json({ ok: true });
}

// GET /api/feedback[?count=1] — 운영자: 받은 의견 목록 / 새 의견 수
async function listFeedback({ req, env, url }) {
  await requireAdmin(req, env);
  if (url.searchParams.get('count')) {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE store='feedback' AND deleted=0 AND json_extract(data,'$.status')='new'").first();
    return json({ new: r.n });
  }
  const r = await env.DB.prepare("SELECT id,data FROM docs WHERE store='feedback' AND deleted=0 ORDER BY created_at DESC LIMIT 200").all();
  return json({ items: r.results.map((x) => ({ id: x.id, ...parse(x.data) })) });
}

// POST /api/feedback/<id> {status?,memo?} — 운영자: 확인함 표시·메모
async function markFeedback({ req, env, params: [id] }) {
  const u = await requireAdmin(req, env);
  const b = await body(req);
  const row = await env.DB.prepare("SELECT data FROM docs WHERE store='feedback' AND id=? AND deleted=0").bind(id).first();
  if (!row) fail(404, '없는 의견입니다');
  const d = parse(row.data) || {};
  if (b.status === 'new' || b.status === 'done') d.status = b.status;
  if (typeof b.memo === 'string') d.memo = b.memo.slice(0, 1000);
  await putDoc(env, 'feedback', id, d, u.id);
  return json({ ok: true });
}

/* 설정 → 현장 기준에 있는 삼진아웃·음주 기준을 AI가 함께 참고하도록 글로 바꿈 */
function siteFacts(s) {
  const out = [], f3 = (v) => Number(v).toFixed(3);
  if (Array.isArray(s.levels)) out.push('삼진아웃 기준' + (s.periodMonths ? ` (최근 ${s.periodMonths}개월 누적)` : ' (공사 기간 전체 누적)') + ':\n' +
    s.levels.map((l, i) => `${i + 1}차(${l.name}, ${l.sticker} 스티커): ${String(l.act || '').replace(/\n/g, ', ')}`).join('\n'));
  const a = s.alc;
  if (a && s.alcMode === 'policy') out.push(`음주측정 기준(회사 지침): 혈중알코올 ${f3(a.retest)}% 이상이면 재측정, 재측정에서도 ${f3(a.retest)}% 이상이면 음주상태로 작업금지, ${f3(a.stop)}% 이상이면 작업금지·귀가. 측정 거부는 출입통제·작업배제.`);
  else if (a) out.push(`음주측정 기준(현장 기준): ${f3(a.detect)}% 이상이면 적발. ${f3(a.day)}% 미만은 오전 작업중지, ${f3(a.day)}% 이상은 당일 작업중지·심의. 음주 적발 ${a.outCount}회면 영구퇴출.`);
  return out.join('\n\n');
}

// POST /api/guide/ask {q, history:[{q,a}]} → {answer, unknown}
async function ask({ req, env }) {
  const u = await requireUser(req, env);
  if (!env.AI) fail(400, 'AI가 연결되어 있지 않습니다');
  const b = await body(req);
  const q = String(b.q || '').trim().slice(0, 300);
  if (!q) fail(400, '질문을 입력하세요');
  const set = parse((await env.DB.prepare("SELECT data FROM docs WHERE store='settings' AND id='shared' AND deleted=0").first() || {}).data) || {};
  // 운영자가 아직 안내 봇 설정을 저장한 적이 없으면 앱이 보낸 기본 안내문(b.guide: 질문·답·안내문만)을 씀. 횟수 제한은 서버 기본값
  const g = set.guide || (b.guide && typeof b.guide === 'object' ? { aiText: b.guide.aiText, faqs: b.guide.faqs } : {});
  if (g.aiOn === false) fail(403, '운영자가 AI 답변을 꺼 두었습니다');

  const siteMax = Math.max(0, Math.min(SITE_MAX, Number.isFinite(+g.aiDay) && g.aiDay !== '' ? +g.aiDay : SITE_DEFAULT));
  const siteId = `site|${new Date(now()).toISOString().slice(0, 10)}`;
  const site = parse((await env.DB.prepare("SELECT data FROM docs WHERE store='aiuse' AND id=?").bind(siteId).first() || {}).data) || { n: 0 };
  if (site.n >= siteMax) fail(429, '오늘 현장 전체 AI 질문이 모두 소진됐어요(한국시간 오전 9시에 다시 채워짐). 위의 버튼이나 의견 보내기를 이용해 주세요');
  const useId = `${u.id}|${kstDay()}`;
  const used = parse((await env.DB.prepare("SELECT data FROM docs WHERE store='aiuse' AND id=?").bind(useId).first() || {}).data) || { n: 0 };
  if (used.n >= AI_PER_DAY) fail(429, `AI 질문은 하루 ${AI_PER_DAY}번까지입니다. 내일 다시 물어봐 주세요`);
  await putDoc(env, 'aiuse', useId, { n: used.n + 1 }, u.id);
  await putDoc(env, 'aiuse', siteId, { n: site.n + 1 }, u.id);

  const faqs = (Array.isArray(g.faqs) ? g.faqs : []).filter((f) => f && f.q && f.a && (u.role !== 'driver' || f.drv));
  const guideText = [String(g.aiText || ''), siteFacts(set),...faqs.map((f) => `Q. ${f.q}\nA. ${f.a}`)].filter(Boolean).join('\n\n').slice(0, 12000);
  const system = `너는 건설현장 안전관리 앱 '현장ON'의 안내 도우미 '안전온'이다. 질문한 사람은 이 현장의 ${ROLE_KO[u.role] || '사용자'}이다.
규칙:
- 아래 [안내문]에 있는 내용만 근거로, 한국어 존댓말로 짧고 친절하게(3~5문장) 답한다.
- [안내문]에 답이 없거나 확실하지 않으면 지어내지 말고, 맨 앞에 ${UNKNOWN} 을 붙인 뒤 "잘 모르겠어요. '운영자에게 의견 보내기'로 물어봐 주세요."라고 답한다.
- 앱 사용법·현장 안전 규칙과 관계없는 질문, 다른 사람의 개인정보를 묻는 질문에는 정중히 답하지 않는다.
[안내문]
${guideText || '(안내문 없음)'}`;
  const history = (Array.isArray(b.history) ? b.history : []).slice(-3)
    .flatMap((h) => [{ role: 'user', content: String(h.q || '').slice(0, 300) }, { role: 'assistant', content: String(h.a || '').slice(0, 800) }]);
  const messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: q }];

  let answer = '';
  for (const model of AI_MODELS) {
    try {
      const r = await env.AI.run(model, { messages, max_tokens: 400, temperature: 0.2 });
      const msg = r && r.choices && r.choices[0] && r.choices[0].message; // 모델마다 응답 모양이 다름
      answer = String((r && (typeof r.response === 'string' ? r.response : msg && msg.content)) || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (answer) break;
    } catch (e) { console.error('AI', model, e && e.message); }
  }
  if (!answer) fail(502, 'AI가 지금 답하지 못합니다. 잠시 후 다시 해 주세요');
  const unknown = answer.includes(UNKNOWN);
  answer = answer.replaceAll(UNKNOWN, '').trim();
  if (unknown) await saveFeedback(env, u, '봇이 모른 질문', q);
  return json({ answer, unknown, left: AI_PER_DAY - used.n - 1 });
}

export default [
  ['POST', '/api/feedback', sendFeedback],
  ['GET', '/api/feedback', listFeedback],
  ['POST', /^\/api\/feedback\/([a-f0-9]+)$/, markFeedback],
  ['POST', '/api/guide/ask', ask],
];
