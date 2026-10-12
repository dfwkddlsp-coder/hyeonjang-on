// Record sync: every record type is a JSON document in `docs`; deletes are soft so devices can sync them.
import { body, fail, json } from '../lib/http.js';
import { requireUser } from '../lib/session.js';
import { STORES, checkUpdate, checkWrite, isStaff, syncRowFilter, syncStoreFilter } from '../lib/policy.js';
import { extractBlobs, stampBase } from '../lib/storage.js';
import { notify } from '../lib/push.js';

const SYNC_PAGE = 300;
const MAX_BATCH = 500;
const CHUNK_BYTES = 1_500_000; // per upsert statement
const MAX_STATEMENTS = 40; // free-plan D1 allows ~50 queries per request

// GET /api/sync?since=<updatedAt> → changes after `since`, oldest first, paged
async function sync({ req, env, url }) {
  const u = await requireUser(req, env);
  const since = Number(url.searchParams.get('since') || 0);
  const r = await env.DB.prepare(`SELECT store,id,data,deleted,updated_at FROM docs WHERE updated_at>? ${await syncStoreFilter(env, u)} ORDER BY updated_at LIMIT ?`)
    .bind(since, SYNC_PAGE + 1).all();
  const rows = r.results.slice(0, SYNC_PAGE);
  const visible = rows.filter(await syncRowFilter(env, u));
  return json({
    docs: visible.map((d) => ({ store: d.store, id: d.id, deleted: !!d.deleted, updatedAt: d.updated_at, data: d.deleted ? null : JSON.parse(d.data) })),
    cursor: rows.length ? rows[rows.length - 1].updated_at : since, // advance past hidden rows too
    more: r.results.length > SYNC_PAGE,
  });
}

// POST /api/docs {docs:[{store,id,data}], import?, remove?:{store,ids}, replaceStores? (legacy)}
async function write({ req, env, ctx }) {
  const u = await requireUser(req, env);
  const b = await body(req);
  const docs = Array.isArray(b.docs) ? b.docs : [];
  const replace = Array.isArray(b.replaceStores) ? b.replaceStores : [];
  const remove = b.remove && Array.isArray(b.remove.ids) && b.remove.ids.length ? b.remove : null;
  if (!docs.length && !replace.length && !remove) return json({ saved: [] });
  if (docs.length > MAX_BATCH || (remove && remove.ids.length > MAX_BATCH)) fail(413, '한 번에 500건까지 보낼 수 있습니다');
  await checkWrite(env, u, docs, { replace, remove, isImport: !!b.import });

  // Everything below is set-based: one lookup for all previous versions, one upsert per chunk, one insert per photo.
  const prevRows = docs.length ? (await env.DB.prepare(
    `SELECT d.store, d.id, d.data, d.deleted, d.created_by FROM docs d JOIN json_each(?) j
       ON d.store = json_extract(j.value,'$.s') AND d.id = json_extract(j.value,'$.i')`
  ).bind(JSON.stringify(docs.map((d) => ({ s: d.store, i: d.id })))).all()).results : [];
  const prev = new Map(prevRows.map((r) => [r.store + '|' + r.id, r.deleted ? null : JSON.parse(r.data)]));
  const prevBy = new Map(prevRows.map((r) => [r.store + '|' + r.id, r.created_by]));

  const blobStmts = [], stmts = [];
  let ts = await stampBase(env);
  for (const s of replace) stmts.push(env.DB.prepare('UPDATE docs SET deleted=1, data=\'{}\', updated_at=?, updated_by=? WHERE store=? AND deleted=0').bind(ts++, u.id, s));
  if (remove) { // one statement, but a distinct stamp per row so sync paging never splits a group
    const marks = remove.ids.map((i) => ({ i, t: ts++ }));
    stmts.push(env.DB.prepare(`UPDATE docs SET deleted=1, data='{}', updated_by=?1,
        updated_at=(SELECT json_extract(value,'$.t') FROM json_each(?3) WHERE json_extract(value,'$.i')=docs.id)
      WHERE store=?2 AND deleted=0 AND id IN (SELECT json_extract(value,'$.i') FROM json_each(?3))`).bind(u.id, remove.store, JSON.stringify(marks)));
  }

  const saved = [], rows = [];
  for (const d of docs) {
    const old = prev.get(d.store + '|' + d.id) || null;
    checkUpdate(u, d, old, prevBy.get(d.store + '|' + d.id));
    const data = await extractBlobs(env, d.data, u.id, blobStmts);
    data._by = old && old._by ? old._by : u.name; // who first recorded it
    const t = ts++;
    rows.push({ s: d.store, i: d.id, d: JSON.stringify(data), t });
    saved.push({ store: d.store, id: d.id, data, updatedAt: t, deleted: false });
  }
  const UPSERT = `INSERT INTO docs (store,id,data,deleted,created_by,updated_by,created_at,updated_at)
    SELECT json_extract(value,'$.s'), json_extract(value,'$.i'), json_extract(value,'$.d'), 0, ?1, ?1, json_extract(value,'$.t'), json_extract(value,'$.t')
    FROM json_each(?2) WHERE true
    ON CONFLICT(store,id) DO UPDATE SET data=excluded.data, deleted=0, updated_by=excluded.updated_by, updated_at=excluded.updated_at`;
  let chunk = [], size = 0;
  const flush = () => { if (chunk.length) stmts.push(env.DB.prepare(UPSERT).bind(u.id, JSON.stringify(chunk))); chunk = []; size = 0; };
  for (const r of rows) { if (size + r.d.length > CHUNK_BYTES) flush(); chunk.push(r); size += r.d.length; }
  flush();
  if (blobStmts.length + stmts.length > MAX_STATEMENTS) fail(413, '사진이 너무 많습니다. 나눠서 저장하세요');
  await env.DB.batch([...blobStmts, ...stmts]); // one transaction
  const msgs = pushMessages(u, docs, prev);
  if (msgs.length && ctx) ctx.waitUntil(Promise.all(msgs.map(([ev, m]) => notify(env, new URL(req.url).origin, ev, u, m))).catch((e) => console.error('notify', e)));
  return json({ saved });
}

/* 폰 알림으로 보낼 일: 새 삼진아웃 적발, 새 음주 적발(정상 아님), 장비 주간 점검표 저장. 한 번에 많이 오면(엑셀·오프라인 묶음) 종류별 3건 + 요약 */
function pushMessages(u, docs, prev) {
  const by = {};
  const add = (ev, m) => (by[ev] = by[ev] || []).push(m);
  for (const d of docs) {
    const x = d.data, isNew = !prev.get(d.store + '|' + d.id);
    if (d.store === 'violations' && isNew && !x.void)
      add('violation', { title: `삼진아웃 ${x.level || ''}차 적발`, body: `${x.name || ''} (${x.company || ''}) · ${x.type || ''} — ${u.name}`, url: '/' });
    if (d.store === 'alcohol' && isNew && x.judge && x.judge !== '정상')
      add('alcohol', { title: `음주 ${x.judge}`, body: `${x.name || ''} (${x.company || ''}) ${x.refused ? '측정 거부' : (+x.value || 0).toFixed(3) + '%'} — ${u.name}`, url: '/' });
    if (d.store === 'eqchecks' && x.kind === 'week') {
      const bad = Object.values(x.marks || {}).some((a) => (a || []).includes('X'));
      add('eqcheck', { title: `${x.track === 'drv' ? '운전원' : '관리자'} 장비점검 · ${x.type || ''}${x.plate ? `(${x.plate})` : ''}`, body: `${u.name} 저장${bad ? ' · ⚠ 부적합 있음' : ''}`, url: '/' });
    }
  }
  const out = [];
  for (const [ev, list] of Object.entries(by)) {
    list.slice(0, 3).forEach((m) => out.push([ev, m]));
    if (list.length > 3) out.push([ev, { title: list[0].title.split(' ')[0] + ' 외', body: `${list.length - 3}건 더 — ${u.name}`, url: '/' }]);
  }
  return out;
}

// POST /api/docs/delete {store,id} — 운영자는 전부, 그 밖에는 본인이 쓴 기록만. 장비는 관리자도 (그 장비의 점검 기록도 함께)
async function remove({ req, env }) {
  const u = await requireUser(req, env);
  const b = await body(req);
  if (!STORES.has(b.store) || b.store === 'settings' || !b.id) fail(400, '잘못된 요청');
  if (u.role !== 'admin') { // 본인이 쓴 기록은 본인이 지움. 장비는 관리자도 (잘못 추가한 장비 정리)
    const r = await env.DB.prepare('SELECT created_by FROM docs WHERE store=? AND id=? AND deleted=0').bind(b.store, b.id).first();
    if (!r) fail(404, '없는 기록입니다');
    if (r.created_by !== u.id && !(b.store === 'equipment' && isStaff(u)))
      fail(403, b.store === 'equipment' ? '장비는 추가한 사람과 관리자·운영자만 삭제할 수 있습니다' : '본인이 쓴 기록만 삭제할 수 있습니다');
  }
  if (b.store === 'plans' && env.PHOTOS) { // 문서함 PDF도 함께 지움
    const r = await env.DB.prepare("SELECT data FROM docs WHERE store='plans' AND id=?").bind(b.id).first();
    let f = ''; try { f = r ? JSON.parse(r.data).fileId : ''; } catch {}
    if (/^[a-f0-9]+$/.test(f || '')) await env.PHOTOS.delete(`f/${f}`);
  }
  let t = await stampBase(env);
  const stmts = [env.DB.prepare('UPDATE docs SET deleted=1, data=\'{}\', updated_at=?, updated_by=? WHERE store=? AND id=?').bind(t, u.id, b.store, b.id)];
  if (b.store === 'equipment') { // 그 장비의 점검표·사진 기록도 (기록마다 다른 시각 → 동기화 페이지가 나뉘어도 빠지지 않음)
    const ck = (await env.DB.prepare("SELECT id FROM docs WHERE store='eqchecks' AND deleted=0 AND json_extract(data,'$.equipId')=?").bind(b.id).all()).results;
    for (const c of ck) stmts.push(env.DB.prepare("UPDATE docs SET deleted=1, data='{}', updated_at=?, updated_by=? WHERE store='eqchecks' AND id=?").bind(++t, u.id, c.id));
  }
  await env.DB.batch(stmts);
  return json({ ok: true, updatedAt: t });
}

export default [
  ['GET', '/api/sync', sync],
  ['POST', '/api/docs', write],
  ['POST', '/api/docs/delete', remove],
];
