// 현장ON API — Cloudflare Worker + D1 (+ R2 for photos, PDFs and backups).
// Static app files are served from ./public by the assets binding; everything under /api/ lands here.
//
//   lib/http.js     errors, JSON responses
//   lib/crypto.js   password hashing
//   lib/session.js  login cookie, current user
//   lib/policy.js   roles and every permission rule
//   lib/storage.js  photo extraction, change stamps, backups
//   routes/*.js     [method, path | RegExp, handler] tables (guide.js: 안내 봇 AI, 운영자에게 의견)
import { HttpError, fail, json } from './lib/http.js';
import { runBackup } from './lib/storage.js';
import auth from './routes/auth.js';
import users from './routes/users.js';
import docs from './routes/docs.js';
import files from './routes/files.js';
import admin from './routes/admin.js';
import guide from './routes/guide.js';
import guest from './routes/guest.js';
import push from './routes/push.js';

const ROUTES = [...auth, ...users, ...docs, ...files, ...admin, ...guide, ...guest, ...push];

function match(method, path) {
  for (const [m, p, handler] of ROUTES) {
    if (m !== method) continue;
    if (typeof p === 'string') { if (p === path) return { handler, params: [] }; continue; }
    const r = path.match(p);
    if (r) return { handler, params: r.slice(1) };
  }
  return null;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      const hit = match(req.method, url.pathname.replace(/\/+$/, ''));
      if (!hit) fail(404, '없는 주소');
      return await hit.handler({ req, env, url, params: hit.params, ctx });
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
