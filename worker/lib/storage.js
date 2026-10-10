// Photos/signatures (R2 'b/<id>', falling back to the D1 blobs table), change stamps and backups.
import { fail, now, uid } from './http.js';

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE = 1_900_000;

/** Replace every data: image URL inside a document with /api/blob/<id>, storing the bytes. */
export async function extractBlobs(env, value, userId, stmts) {
  if (typeof value === 'string') {
    const m = value.length > 200 && value.match(DATA_URL);
    if (!m) return value;
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    if (bytes.length > MAX_IMAGE) fail(413, '사진이 너무 큽니다');
    const id = uid();
    if (env.PHOTOS) {
      await env.PHOTOS.put(`b/${id}`, bytes, { httpMetadata: { contentType: m[1] }, customMetadata: { by: String(userId || ''), at: String(now()) } });
    } else {
      stmts.push(env.DB.prepare('INSERT INTO blobs (id,mime,data,created_by,created_at) VALUES (?,?,?,?,?)').bind(id, m[1], bytes, userId, now()));
    }
    return `/api/blob/${id}`;
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => extractBlobs(env, v, userId, stmts)));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await extractBlobs(env, v, userId, stmts);
    return out;
  }
  return value;
}

/** Monotonically increasing change stamps so sync paging never skips or loops. */
export async function stampBase(env) {
  const r = await env.DB.prepare('SELECT MAX(updated_at) AS m FROM docs').first();
  return Math.max(now(), (r && r.m ? r.m : 0) + 1);
}

/* ---------- backups: all live records as one JSON in R2 backups/ (photos already live in R2) ---------- */
const BACKUP_KEEP = 12; // automatic backups kept; manual ones are never pruned

export async function runBackup(env, kind) {
  if (!env.PHOTOS) return null;
  const rows = (await env.DB.prepare('SELECT store,id,data FROM docs WHERE deleted=0').all()).results;
  const users = (await env.DB.prepare('SELECT id,login_id,name,org,title,role,active,created_at FROM users').all()).results;
  const at = new Date(now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16); // KST
  const out = { app: 'fieldsafety', v: 2, source: 'server', at, users };
  for (const r of rows) {
    const d = JSON.parse(r.data);
    if (r.store === 'settings') { out.settings = d; continue; }
    (out[r.store] = out[r.store] || []).push({ ...d, id: r.id });
  }
  const key = `backups/${at.replace(/[-: ]/g, '').slice(0, 12)}-${kind}.json`;
  await env.PHOTOS.put(key, JSON.stringify(out), { httpMetadata: { contentType: 'application/json' } });
  const list = await env.PHOTOS.list({ prefix: 'backups/' });
  const autos = list.objects.map((o) => o.key).filter((k) => k.endsWith('-auto.json')).sort();
  for (const k of autos.slice(0, Math.max(0, autos.length - BACKUP_KEEP))) await env.PHOTOS.delete(k);
  return key;
}
