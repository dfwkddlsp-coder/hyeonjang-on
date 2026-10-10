// Record sync: every record type is a JSON document in `docs`; deletes are soft so devices can sync them.
import { body, fail, json } from '../lib/http.js';
import { requireAdmin, requireUser } from '../lib/session.js';
import { STORES, checkUpdate, checkWrite, syncRowFilter, syncStoreFilter } from '../lib/policy.js';
import { extractBlobs, stampBase } from '../lib/storage.js';

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

// POST /api/docs {docs:[{store,id,data}], import?, replaceStores?}
async function write({ req, env }) {
  const u = await requireUser(req, env);
  const b = await body(req);
  const docs = Array.isArray(b.docs) ? b.docs : [];
  const replace = Array.isArray(b.replaceStores) ? b.replaceStores : [];
  if (!docs.length && !replace.length) return json({ saved: [] });
  if (docs.length > MAX_BATCH) fail(413, '한 번에 500건까지 보낼 수 있습니다');
  await checkWrite(env, u, docs, { replace, isImport: !!b.import });

  // Everything below is set-based: one lookup for all previous versions, one upsert per chunk, one insert per photo.
  const prevRows = docs.length ? (await env.DB.prepare(
    `SELECT d.store, d.id, d.data, d.deleted FROM docs d JOIN json_each(?) j
       ON d.store = json_extract(j.value,'$.s') AND d.id = json_extract(j.value,'$.i')`
  ).bind(JSON.stringify(docs.map((d) => ({ s: d.store, i: d.id })))).all()).results : [];
  const prev = new Map(prevRows.map((r) => [r.store + '|' + r.id, r.deleted ? null : JSON.parse(r.data)]));

  const blobStmts = [], stmts = [];
  let ts = await stampBase(env);
  for (const s of replace) stmts.push(env.DB.prepare('UPDATE docs SET deleted=1, data=\'{}\', updated_at=?, updated_by=? WHERE store=? AND deleted=0').bind(ts++, u.id, s));

  const saved = [], rows = [];
  for (const d of docs) {
    const old = prev.get(d.store + '|' + d.id) || null;
    checkUpdate(u, d, old);
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
  return json({ saved });
}

// POST /api/docs/delete {store,id} — operator only
async function remove({ req, env }) {
  const u = await requireAdmin(req, env);
  const b = await body(req);
  if (!STORES.has(b.store) || b.store === 'settings' || !b.id) fail(400, '잘못된 요청');
  if (b.store === 'plans' && env.PHOTOS) { // 문서함 PDF도 함께 지움
    const r = await env.DB.prepare("SELECT data FROM docs WHERE store='plans' AND id=?").bind(b.id).first();
    let f = ''; try { f = r ? JSON.parse(r.data).fileId : ''; } catch {}
    if (/^[a-f0-9]+$/.test(f || '')) await env.PHOTOS.delete(`f/${f}`);
  }
  const t = await stampBase(env);
  await env.DB.prepare('UPDATE docs SET deleted=1, data=\'{}\', updated_at=?, updated_by=? WHERE store=? AND id=?').bind(t, u.id, b.store, b.id).run();
  return json({ ok: true, updatedAt: t });
}

export default [
  ['GET', '/api/sync', sync],
  ['POST', '/api/docs', write],
  ['POST', '/api/docs/delete', remove],
];
