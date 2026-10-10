// Operator tools: storage usage, moving old D1 photos to R2, server backups.
import { fail, json } from '../lib/http.js';
import { requireAdmin } from '../lib/session.js';
import { runBackup } from '../lib/storage.js';

const MIGRATE_BATCH = 15;

async function storage({ req, env }) {
  await requireAdmin(req, env);
  const r = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)),0) AS bytes FROM blobs').first();
  const d = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)),0) AS bytes FROM docs WHERE deleted=0').first();
  return json({ r2: !!env.PHOTOS, d1Blobs: r.n, d1BlobBytes: r.bytes, docs: d.n, docBytes: d.bytes });
}

async function migrateBlobs({ req, env }) {
  await requireAdmin(req, env);
  if (!env.PHOTOS) fail(400, 'R2 저장소가 아직 연결되지 않았습니다');
  const rows = (await env.DB.prepare(`SELECT id,mime,data FROM blobs LIMIT ${MIGRATE_BATCH}`).all()).results;
  for (const r of rows) await env.PHOTOS.put(`b/${r.id}`, new Uint8Array(r.data), { httpMetadata: { contentType: r.mime } });
  if (rows.length) await env.DB.prepare('DELETE FROM blobs WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(rows.map((r) => r.id))).run();
  const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM blobs').first();
  return json({ moved: rows.length, remaining: left.n });
}

async function listBackups({ req, env }) {
  await requireAdmin(req, env);
  if (!env.PHOTOS) return json({ backups: [] });
  const list = await env.PHOTOS.list({ prefix: 'backups/' });
  return json({ backups: list.objects.map((o) => ({ name: o.key.slice(8), size: o.size })).sort((a, b) => b.name.localeCompare(a.name)) });
}

async function createBackup({ req, env }) {
  await requireAdmin(req, env);
  if (!env.PHOTOS) fail(400, 'R2 저장소가 연결되지 않았습니다');
  return json({ name: (await runBackup(env, 'manual')).slice(8) });
}

async function downloadBackup({ req, env, params: [name] }) {
  await requireAdmin(req, env);
  const obj = env.PHOTOS && await env.PHOTOS.get('backups/' + name);
  if (!obj) fail(404, '백업이 없습니다');
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="hyeonjangON_backup_${name}"`,
      'cache-control': 'no-store',
    },
  });
}

export default [
  ['GET', '/api/admin/storage', storage],
  ['POST', '/api/admin/migrate-blobs', migrateBlobs],
  ['GET', '/api/admin/backups', listBackups],
  ['POST', '/api/admin/backups', createBackup],
  ['GET', /^\/api\/admin\/backups\/([0-9]{12}-(?:auto|manual)\.json)$/, downloadBackup],
];
