// 현장ON API — Cloudflare Worker + D1.
// Static app files are served from ./public by the assets binding; everything under /api/ lands here.
//
// Roles: 'admin' (운영자) manages users, shared settings, register imports, deletes and voids.
//        'user' can read everything and create/update records.

const STORES = new Set(['workers', 'equipment', 'violations', 'alcohol', 'vuln', 'eqchecks', 'plans', 'settings']);
const PDF_MAX = 30 * 1024 * 1024; // 현장 운영안 PDF 한 파일 최대 크기
const REGISTER_STORES = new Set(['workers', 'equipment', 'vuln']);
const SESSION_DAYS = 30;
const PBKDF2_ITER = 20000; // keeps login under the free-plan CPU budget
const MAX_FAILS = 5, LOCK_MS = 10 * 60 * 1000;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await route(req, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: '서버 오류' }, 500);
    }
  },
  // 매주 월요일 03:00(한국시간) 자동 백업 → R2 backups/
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBackup(env, 'auto'));
  },
};

/* ---------- backups: all live records (photos already live in R2) ---------- */
const BACKUP_KEEP = 12;
async function runBackup(env, kind) {
  if (!env.PHOTOS) return null;
  const rows = (await env.DB.prepare('SELECT store,id,data FROM docs WHERE deleted=0').all()).results;
  const users = (await env.DB.prepare('SELECT id,login_id,name,org,title,role,active,created_at FROM users').all()).results;
  const out = { app: 'fieldsafety', v: 2, source: 'server', at: new Date(now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16), users };
  for (const r of rows) {
    const d = JSON.parse(r.data);
    if (r.store === 'settings') { out.settings = d; continue; }
    (out[r.store] = out[r.store] || []).push({ ...d, id: r.id });
  }
  const stamp = out.at.replace(/[-: ]/g, '').slice(0, 12);
  const key = `backups/${stamp}-${kind}.json`;
  await env.PHOTOS.put(key, JSON.stringify(out), { httpMetadata: { contentType: 'application/json' } });
  // 자동 백업은 최근 ${BACKUP_KEEP}개만 보관 (수동 백업은 지우지 않음)
  const list = await env.PHOTOS.list({ prefix: 'backups/' });
  const autos = list.objects.map((o) => o.key).filter((k) => k.endsWith('-auto.json')).sort();
  for (const k of autos.slice(0, Math.max(0, autos.length - BACKUP_KEEP))) await env.PHOTOS.delete(k);
  return key;
}

/* 권한: admin 운영자(전부) · manager 관리자(전체 열람·등록, 삭제/설정/사용자관리 불가) · user 사용자 */
const ROLES = ['admin', 'manager', 'user'];

/* 취약근로자(건강정보) 열람 범위: 운영자·관리자만(기본) 또는 전체 — 현장 설정 vulnScope */
async function vulnAllowed(env, u) {
  if (u.role === 'admin' || u.role === 'manager') return true;
  const r = await env.DB.prepare("SELECT data FROM docs WHERE store='settings' AND id='shared' AND deleted=0").first();
  try { return !!r && JSON.parse(r.data).vulnScope === 'all'; } catch { return false; }
}

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const now = () => Date.now();
const uid = () => crypto.randomUUID().replace(/-/g, '');

async function body(req) {
  try { return await req.json(); } catch { fail(400, '잘못된 요청'); }
}

/* ---------- crypto ---------- */
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hashPw(pw, saltB64) {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return b64(bits);
}
const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function checkPw(pw) {
  if (typeof pw !== 'string' || pw.length < 6) fail(400, '비밀번호는 6자 이상이어야 합니다');
}

/* ---------- sessions ---------- */
function cookieToken(req) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)hs=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
async function startSession(env, userId, req) {
  const raw = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const exp = now() + SESSION_DAYS * 864e5;
  await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .bind(await sha256(raw), userId, exp, now()).run();
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `hs=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}
async function currentUser(req, env) {
  const t = cookieToken(req);
  if (!t) return null;
  const row = await env.DB.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1'
  ).bind(await sha256(t), now()).first();
  return row || null;
}
async function requireUser(req, env, { allowMustChange = false } = {}) {
  const u = await currentUser(req, env);
  if (!u) fail(401, '로그인이 필요합니다');
  if (u.must_change && !allowMustChange) fail(403, '비밀번호를 먼저 변경하세요');
  return u;
}
async function requireAdmin(req, env) {
  const u = await requireUser(req, env);
  if (u.role !== 'admin') fail(403, '운영자만 할 수 있습니다');
  return u;
}
const publicUser = (u) => u && ({
  id: u.id, loginId: u.login_id, name: u.name, org: u.org, title: u.title, role: u.role,
  mustChange: !!u.must_change, active: !!u.active, sig: u.sig_blob ? `/api/blob/${u.sig_blob}` : '',
});

/* ---------- blobs: pull data: URLs out of documents ---------- */
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
async function extractBlobs(env, value, userId, stmts) {
  if (typeof value === 'string') {
    const m = value.length > 200 && value.match(DATA_URL);
    if (!m) return value;
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    if (bytes.length > 1_900_000) fail(413, '사진이 너무 큽니다');
    const id = uid();
    if (env.PHOTOS) {
      // R2: 사진·서명 원본 보관 (D1 500MB 한도와 무관)
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

/* monotonically increasing change stamps so sync paging never skips or loops */
async function stampBase(env) {
  const r = await env.DB.prepare('SELECT MAX(updated_at) AS m FROM docs').first();
  return Math.max(now(), (r && r.m ? r.m : 0) + 1);
}

/* ---------- routes ---------- */
async function route(req, env, url) {
  const p = url.pathname.replace(/\/+$/, '');
  const M = req.method;

  if (p === '/api/status' && M === 'GET') {
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    const u = await currentUser(req, env);
    return json({ setupNeeded: !n.n, user: publicUser(u), time: now() });
  }

  // first run only: create the operator account
  if (p === '/api/setup' && M === 'POST') {
    const b = await body(req);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    if (n.n) fail(409, '이미 운영자가 등록되어 있습니다');
    const loginId = String(b.loginId || '').trim(), name = String(b.name || '').trim();
    if (!loginId || !name) fail(400, '아이디와 이름을 입력하세요');
    checkPw(b.password);
    const salt = newSalt(), id = uid(), t = now();
    await env.DB.prepare('INSERT INTO users (id,login_id,name,org,title,role,pw_hash,pw_salt,must_change,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,1,?,?)')
      .bind(id, loginId, name, String(b.org || ''), String(b.title || ''), 'admin', await hashPw(b.password, salt), salt, t, t).run();
    const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
    return json({ user: publicUser(u) }, 200, { 'set-cookie': await startSession(env, id, req) });
  }

  if (p === '/api/login' && M === 'POST') {
    const b = await body(req);
    const loginId = String(b.loginId || '').trim();
    const lf = await env.DB.prepare('SELECT * FROM login_fail WHERE login_id=?').bind(loginId).first();
    if (lf && lf.locked_until > now()) fail(429, '로그인 시도가 너무 많습니다. 10분 후 다시 시도하세요');
    const u = await env.DB.prepare('SELECT * FROM users WHERE login_id=? AND active=1').bind(loginId).first();
    const ok = u && safeEq(await hashPw(String(b.password || ''), u.pw_salt), u.pw_hash);
    if (!ok) {
      const c = (lf ? lf.count : 0) + 1;
      await env.DB.prepare('INSERT INTO login_fail (login_id,count,locked_until) VALUES (?,?,?) ON CONFLICT(login_id) DO UPDATE SET count=excluded.count, locked_until=excluded.locked_until')
        .bind(loginId, c >= MAX_FAILS ? 0 : c, c >= MAX_FAILS ? now() + LOCK_MS : 0).run();
      fail(401, '아이디 또는 비밀번호가 맞지 않습니다');
    }
    await env.DB.prepare('DELETE FROM login_fail WHERE login_id=?').bind(loginId).run();
    return json({ user: publicUser(u) }, 200, { 'set-cookie': await startSession(env, u.id, req) });
  }

  if (p === '/api/logout' && M === 'POST') {
    const t = cookieToken(req);
    if (t) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(t)).run();
    return json({ ok: true }, 200, { 'set-cookie': 'hs=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
  }

  if (p === '/api/me/password' && M === 'POST') {
    const u = await requireUser(req, env, { allowMustChange: true });
    const b = await body(req);
    if (!safeEq(await hashPw(String(b.current || ''), u.pw_salt), u.pw_hash)) fail(400, '현재 비밀번호가 맞지 않습니다');
    checkPw(b.next);
    if (b.next === b.current) fail(400, '새 비밀번호가 이전과 같습니다');
    const salt = newSalt();
    await env.DB.prepare('UPDATE users SET pw_hash=?, pw_salt=?, must_change=0, updated_at=? WHERE id=?').bind(await hashPw(b.next, salt), salt, now(), u.id).run();
    const fresh = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
    return json({ user: publicUser(fresh) });
  }

  if (p === '/api/me' && M === 'POST') {
    const u = await requireUser(req, env);
    const b = await body(req);
    const stmts = [];
    let sig = u.sig_blob;
    if (typeof b.sig === 'string') {
      if (!b.sig) sig = null;
      else { const ref = await extractBlobs(env, b.sig, u.id, stmts); sig = ref.startsWith('/api/blob/') ? ref.slice(10) : sig; }
    }
    stmts.push(env.DB.prepare('UPDATE users SET name=?, org=?, title=?, sig_blob=?, updated_at=? WHERE id=?')
      .bind(String(b.name ?? u.name).trim() || u.name, String(b.org ?? u.org), String(b.title ?? u.title), sig, now(), u.id));
    await env.DB.batch(stmts);
    const fresh = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
    return json({ user: publicUser(fresh) });
  }

  /* --- user management (admin) --- */
  if (p === '/api/users' && M === 'GET') {
    await requireAdmin(req, env);
    const r = await env.DB.prepare('SELECT * FROM users ORDER BY role, name').all();
    return json({ users: r.results.map(publicUser) });
  }
  if (p === '/api/users' && M === 'POST') {
    const a = await requireAdmin(req, env);
    const b = await body(req);
    const loginId = String(b.loginId || '').trim(), name = String(b.name || '').trim();
    if (!/^[A-Za-z0-9._@-]{3,40}$/.test(loginId)) fail(400, '아이디는 영문·숫자 3자 이상 (휴대폰번호 숫자도 가능)');
    if (!name) fail(400, '이름을 입력하세요');
    checkPw(b.password);
    const exists = await env.DB.prepare('SELECT 1 FROM users WHERE login_id=?').bind(loginId).first();
    if (exists) fail(409, '이미 있는 아이디입니다');
    const salt = newSalt(), id = uid(), t = now();
    await env.DB.prepare('INSERT INTO users (id,login_id,name,org,title,role,pw_hash,pw_salt,must_change,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,1,?,?)')
      .bind(id, loginId, name, String(b.org || ''), String(b.title || ''), ROLES.includes(b.role) ? b.role : 'user', await hashPw(b.password, salt), salt, t, t).run();
    return json({ user: publicUser(await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first()), by: a.id });
  }
  let m;
  if ((m = p.match(/^\/api\/users\/([a-f0-9]+)$/)) && M === 'POST') {
    const a = await requireAdmin(req, env);
    const b = await body(req);
    const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(m[1]).first();
    if (!u) fail(404, '사용자가 없습니다');
    const role = ROLES.includes(b.role) ? b.role : u.role;
    const active = b.active === undefined ? u.active : (b.active ? 1 : 0);
    if (u.id === a.id && (role !== 'admin' || !active)) fail(400, '본인의 운영자 권한은 해제할 수 없습니다');
    const stmts = [env.DB.prepare('UPDATE users SET name=?, org=?, title=?, role=?, active=?, updated_at=? WHERE id=?')
      .bind(String(b.name ?? u.name).trim() || u.name, String(b.org ?? u.org), String(b.title ?? u.title), role, active, now(), u.id)];
    if (b.password) {
      checkPw(b.password);
      const salt = newSalt();
      stmts.push(env.DB.prepare('UPDATE users SET pw_hash=?, pw_salt=?, must_change=1 WHERE id=?').bind(await hashPw(b.password, salt), salt, u.id));
    }
    if (b.password || !active) stmts.push(env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id));
    await env.DB.batch(stmts);
    return json({ user: publicUser(await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first()) });
  }

  /* --- data sync --- */
  if (p === '/api/sync' && M === 'GET') {
    const su = await requireUser(req, env);
    const hideVuln = !(await vulnAllowed(env, su));
    const since = Number(url.searchParams.get('since') || 0);
    const LIMIT = 300;
    const r = await env.DB.prepare(`SELECT store,id,data,deleted,updated_at,created_by,updated_by FROM docs WHERE updated_at>? ${hideVuln ? "AND store<>'vuln'" : ''} ORDER BY updated_at LIMIT ?`).bind(since, LIMIT + 1).all();
    const rows = r.results.slice(0, LIMIT);
    return json({
      docs: rows.map((d) => ({ store: d.store, id: d.id, deleted: !!d.deleted, updatedAt: d.updated_at, data: d.deleted ? null : JSON.parse(d.data) })),
      cursor: rows.length ? rows[rows.length - 1].updated_at : since,
      more: r.results.length > LIMIT,
    });
  }

  if (p === '/api/docs' && M === 'POST') {
    const u = await requireUser(req, env);
    const b = await body(req);
    const docs = Array.isArray(b.docs) ? b.docs : [];
    const replace = Array.isArray(b.replaceStores) ? b.replaceStores : [];
    if (!docs.length && !replace.length) return json({ saved: [] });
    if (docs.length > 500) fail(413, '한 번에 500건까지 보낼 수 있습니다');
    if ((b.import || replace.length) && u.role !== 'admin') fail(403, '대장 엑셀 업로드는 운영자만 할 수 있습니다');
    for (const s of replace) if (!REGISTER_STORES.has(s)) fail(400, '교체할 수 없는 대장입니다');

    for (const d of docs) {
      if (!STORES.has(d.store) || typeof d.id !== 'string' || !d.id || !d.data || typeof d.data !== 'object') fail(400, '잘못된 기록');
      if (d.store === 'settings' && u.role !== 'admin') fail(403, '현장 설정은 운영자만 바꿀 수 있습니다');
      if (d.store === 'plans' && u.role !== 'admin') fail(403, '현장 운영안은 운영자만 올릴 수 있습니다');
    }
    if (u.role !== 'admin' && docs.some((d) => d.store === 'vuln') && !(await vulnAllowed(env, u))) fail(403, '취약근로자 정보는 운영자·관리자만 다룰 수 있습니다');
    for (const d of docs) {
    }

    // Free-plan D1 allows ~50 queries per request, so everything below is set-based:
    // one lookup for all previous versions, one upsert per ~1.5 MB of JSON, one insert per photo.
    const prevRows = docs.length ? (await env.DB.prepare(
      `SELECT d.store, d.id, d.data, d.deleted FROM docs d JOIN json_each(?) j
         ON d.store = json_extract(j.value,'$.s') AND d.id = json_extract(j.value,'$.i')`
    ).bind(JSON.stringify(docs.map((d) => ({ s: d.store, i: d.id })))).all()).results : [];
    const prev = new Map(prevRows.map((r) => [r.store + '|' + r.id, r.deleted ? null : JSON.parse(r.data)]));

    const blobStmts = [];
    let ts = await stampBase(env);
    const stmts = [];
    for (const s of replace) stmts.push(env.DB.prepare('UPDATE docs SET deleted=1, data=\'{}\', updated_at=?, updated_by=? WHERE store=? AND deleted=0').bind(ts++, u.id, s));

    const saved = [], rows = [];
    for (const d of docs) {
      const old = prev.get(d.store + '|' + d.id) || null;
      if (u.role !== 'admin' && (d.store === 'violations' || d.store === 'alcohol')) {
        if (!!(old && old.void) !== !!d.data.void) fail(403, '무효 처리는 운영자만 할 수 있습니다');
      }
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
    for (const r of rows) { if (size + r.d.length > 1_500_000) flush(); chunk.push(r); size += r.d.length; }
    flush();
    if (blobStmts.length + stmts.length > 40) fail(413, '사진이 너무 많습니다. 나눠서 저장하세요');
    await env.DB.batch([...blobStmts, ...stmts]); // one transaction
    return json({ saved });
  }

  if (p === '/api/docs/delete' && M === 'POST') {
    const u = await requireAdmin(req, env);
    const b = await body(req);
    if (!STORES.has(b.store) || b.store === 'settings' || !b.id) fail(400, '잘못된 요청');
    if (b.store === 'plans' && env.PHOTOS) { // 운영안 문서를 지우면 PDF 파일도 지움
      const r = await env.DB.prepare("SELECT data FROM docs WHERE store='plans' AND id=?").bind(b.id).first();
      let f = ''; try { f = r ? JSON.parse(r.data).fileId : ''; } catch {}
      if (/^[a-f0-9]+$/.test(f || '')) await env.PHOTOS.delete(`f/${f}`);
    }
    const t = await stampBase(env);
    await env.DB.prepare('UPDATE docs SET deleted=1, data=\'{}\', updated_at=?, updated_by=? WHERE store=? AND id=?').bind(t, u.id, b.store, b.id).run();
    return json({ ok: true, updatedAt: t });
  }

  /* --- 현장 운영안 PDF: 운영자 업로드, 로그인한 모든 사용자 열람 --- */
  if (p === '/api/admin/files' && M === 'POST') {
    await requireAdmin(req, env);
    if (!env.PHOTOS) fail(400, 'R2 저장소가 연결되지 않았습니다');
    if (!/^application\/pdf/.test(req.headers.get('content-type') || '')) fail(400, 'PDF 파일만 올릴 수 있습니다');
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) fail(400, '빈 파일입니다');
    if (buf.byteLength > PDF_MAX) fail(413, 'PDF는 30MB까지 올릴 수 있습니다');
    if (new TextDecoder().decode(new Uint8Array(buf, 0, 5)) !== '%PDF-') fail(400, 'PDF 파일이 아닙니다');
    const id = uid();
    await env.PHOTOS.put(`f/${id}`, buf, { httpMetadata: { contentType: 'application/pdf' } });
    return json({ id, size: buf.byteLength });
  }
  if ((m = p.match(/^\/api\/file\/([a-f0-9]+)$/)) && M === 'GET') {
    await requireUser(req, env);
    const obj = env.PHOTOS && await env.PHOTOS.get(`f/${m[1]}`);
    if (!obj) fail(404, '파일이 없습니다');
    const name = (url.searchParams.get('n') || '현장운영안').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 80);
    return new Response(obj.body, { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(name.endsWith('.pdf') ? name : name + '.pdf')}`, 'cache-control': 'private, max-age=3600' } });
  }

  if ((m = p.match(/^\/api\/blob\/([a-f0-9]+)$/)) && M === 'GET') {
    await requireUser(req, env);
    const cacheHdr = 'private, max-age=31536000, immutable';
    if (env.PHOTOS) {
      const obj = await env.PHOTOS.get(`b/${m[1]}`);
      if (obj) return new Response(obj.body, { headers: { 'content-type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg', 'cache-control': cacheHdr } });
    }
    const r = await env.DB.prepare('SELECT mime,data FROM blobs WHERE id=?').bind(m[1]).first();
    if (!r) fail(404, '없음');
    return new Response(new Uint8Array(r.data), { headers: { 'content-type': r.mime, 'cache-control': cacheHdr } });
  }

  /* --- storage (admin): how much is still inside D1, and move it to R2 in small batches --- */
  if (p === '/api/admin/storage' && M === 'GET') {
    await requireAdmin(req, env);
    const r = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)),0) AS bytes FROM blobs').first();
    const d = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)),0) AS bytes FROM docs WHERE deleted=0').first();
    return json({ r2: !!env.PHOTOS, d1Blobs: r.n, d1BlobBytes: r.bytes, docs: d.n, docBytes: d.bytes });
  }
  if (p === '/api/admin/migrate-blobs' && M === 'POST') {
    await requireAdmin(req, env);
    if (!env.PHOTOS) fail(400, 'R2 저장소가 아직 연결되지 않았습니다');
    const rows = (await env.DB.prepare('SELECT id,mime,data FROM blobs LIMIT 15').all()).results;
    for (const r of rows) await env.PHOTOS.put(`b/${r.id}`, new Uint8Array(r.data), { httpMetadata: { contentType: r.mime } });
    if (rows.length) await env.DB.prepare('DELETE FROM blobs WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(rows.map((r) => r.id))).run();
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM blobs').first();
    return json({ moved: rows.length, remaining: left.n });
  }

  if (p === '/api/admin/backups' && M === 'GET') {
    await requireAdmin(req, env);
    if (!env.PHOTOS) return json({ backups: [] });
    const list = await env.PHOTOS.list({ prefix: 'backups/' });
    return json({ backups: list.objects.map((o) => ({ name: o.key.slice(8), size: o.size })).sort((a, b) => b.name.localeCompare(a.name)) });
  }
  if (p === '/api/admin/backups' && M === 'POST') {
    await requireAdmin(req, env);
    if (!env.PHOTOS) fail(400, 'R2 저장소가 연결되지 않았습니다');
    const key = await runBackup(env, 'manual');
    return json({ name: key.slice(8) });
  }
  if ((m = p.match(/^\/api\/admin\/backups\/([0-9]{12}-(?:auto|manual)\.json)$/)) && M === 'GET') {
    await requireAdmin(req, env);
    const obj = env.PHOTOS && await env.PHOTOS.get('backups/' + m[1]);
    if (!obj) fail(404, '백업이 없습니다');
    return new Response(obj.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="hyeonjangON_backup_${m[1]}"`, 'cache-control': 'no-store' } });
  }

  fail(404, '없는 주소');
}
