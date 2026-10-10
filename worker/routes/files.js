// Binary files: 문서함 PDFs (R2 'f/<id>') and photos/signatures (R2 'b/<id>' or D1 blobs).
import { fail, json, uid } from '../lib/http.js';
import { requireAdmin, requireUser } from '../lib/session.js';
import { checkFileAccess } from '../lib/policy.js';

const PDF_MAX = 30 * 1024 * 1024;
const IMMUTABLE = 'private, max-age=31536000, immutable';

// POST /api/admin/files (body = the PDF) → {id,size}
async function uploadPdf({ req, env }) {
  await requireAdmin(req, env);
  if (!env.PHOTOS) fail(400, 'R2 저장소가 연결되지 않았습니다');
  if (!/^application\/pdf/.test(req.headers.get('content-type') || '')) fail(400, 'PDF 파일만 올릴 수 있습니다');
  // stream straight into R2: buffering a big PDF in the Worker blows the free-plan CPU limit
  const len = Number(req.headers.get('content-length') || 0);
  if (!len || !req.body) fail(400, '빈 파일입니다');
  if (len > PDF_MAX) fail(413, 'PDF는 30MB까지 올릴 수 있습니다');
  const id = uid(), key = `f/${id}`;
  await env.PHOTOS.put(key, req.body.pipeThrough(new FixedLengthStream(len)), { httpMetadata: { contentType: 'application/pdf' } });
  const head = await env.PHOTOS.get(key, { range: { offset: 0, length: 5 } });
  if (!head || (await head.text()) !== '%PDF-') { await env.PHOTOS.delete(key); fail(400, 'PDF 파일이 아닙니다'); }
  return json({ id, size: len });
}

// GET /api/file/<id>?n=<title>
async function getPdf({ req, env, url, params: [id] }) {
  await checkFileAccess(env, await requireUser(req, env), id);
  const obj = env.PHOTOS && await env.PHOTOS.get(`f/${id}`);
  if (!obj) fail(404, '파일이 없습니다');
  const name = (url.searchParams.get('n') || '현장운영안').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 80);
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(name.endsWith('.pdf') ? name : name + '.pdf')}`,
      'cache-control': 'private, max-age=3600',
    },
  });
}

// GET /api/blob/<id> — photo or signature
async function getBlob({ req, env, params: [id] }) {
  await requireUser(req, env);
  if (env.PHOTOS) {
    const obj = await env.PHOTOS.get(`b/${id}`);
    if (obj) return new Response(obj.body, { headers: { 'content-type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg', 'cache-control': IMMUTABLE } });
  }
  const r = await env.DB.prepare('SELECT mime,data FROM blobs WHERE id=?').bind(id).first();
  if (!r) fail(404, '없음');
  return new Response(new Uint8Array(r.data), { headers: { 'content-type': r.mime, 'cache-control': IMMUTABLE } });
}

export default [
  ['POST', '/api/admin/files', uploadPdf],
  ['GET', /^\/api\/file\/([a-f0-9]+)$/, getPdf],
  ['GET', /^\/api\/blob\/([a-f0-9]+)$/, getBlob],
];
