// API permission tests — run against a LOCAL `npm run dev` (wrangler dev on :8787), never the live site.
//   TEST_ADMIN_ID=... TEST_ADMIN_PW=... node tests/api.test.mjs
// Creates throwaway users and records, checks every role rule, then deletes / disables what it made.
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE || 'http://localhost:8787';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('local dev server only');
const ADMIN = { loginId: process.env.TEST_ADMIN_ID, password: process.env.TEST_ADMIN_PW };
if (!ADMIN.loginId || !ADMIN.password) throw new Error('set TEST_ADMIN_ID and TEST_ADMIN_PW (a local operator account)');

const client = () => {
  let cookie = '';
  return async (path, payload, type) => {
    const raw = type && type !== 'application/json';
    const r = await fetch(`${BASE}/api/${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: { 'content-type': type || 'application/json', cookie },
      body: payload === undefined ? undefined : raw ? payload : JSON.stringify(payload),
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = text; }
    return { s: r.status, j, h: r.headers };
  };
};

const tag = String(Date.now() % 1e7);
const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message]); }
};
const cleanup = [];

const A = client();
assert.equal((await A('login', ADMIN)).s, 200, 'admin login');

async function makeUser(role, loginId, name) {
  const c = await A('users', { loginId, name, password: 'init-pass-9' });
  assert.equal(c.s, 200, 'create user ' + role);
  if (role !== 'user') assert.equal((await A(`users/${c.j.user.id}`, { role })).j.user.role, role);
  cleanup.push(() => A(`users/${c.j.user.id}`, { active: false }));
  const U = client();
  await U('login', { loginId, password: 'init-pass-9' });
  assert.equal((await U('me/password', { current: 'init-pass-9', next: 'next-pass-9' })).s, 200);
  return U;
}
const doc = (store, id, data = {}) => ({ store, id, data: { id, ...data } });
const del = (store, id) => cleanup.push(() => A('docs/delete', { store, id }));

const phone = '0109' + tag.padStart(7, '0').slice(-7);
const U = await makeUser('user', 'u' + tag, '일반테스트');
const M = await makeUser('manager', 'm' + tag, '관리자테스트');
const eqMine = 'eqm' + tag, eqOther = 'eqo' + tag;
assert.equal((await A('docs', { docs: [
  doc('equipment', eqMine, { type: '굴착기', operator: '운전테스트', phone: phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') }),
  doc('equipment', eqOther, { type: '크레인', operator: '다른사람', phone: '010-0000-0000' }),
] })).s, 200);
del('equipment', eqMine); del('equipment', eqOther);
const D = await makeUser('driver', phone, '운전테스트');

await test('status renews nothing for a fresh session', async () => {
  const r = await U('status');
  assert.equal(r.s, 200);
  assert.equal(r.h.get('set-cookie'), null);
});
await test('no login → 401', async () => assert.equal((await client()('sync?since=0')).s, 401));
await test('unknown route → 404', async () => assert.equal((await A('nope')).s, 404));

await test('user cannot read or write 취약근로자 (default scope)', async () => {
  const id = 'vu' + tag;
  assert.equal((await A('docs', { docs: [doc('vuln', id, { name: 'x' })] })).s, 200); del('vuln', id);
  assert.equal((await U('sync?since=0')).j.docs.some((d) => d.id === id), false);
  assert.equal((await U('docs', { docs: [doc('vuln', id + 'u')] })).s, 403);
  assert.equal((await M('sync?since=0')).j.docs.some((d) => d.id === id), true);
});
await test('only the operator changes settings, deletes, voids, imports', async () => {
  assert.equal((await M('docs', { docs: [doc('settings', 'shared', { site: 'x' })] })).s, 403);
  const id = 'v' + tag;
  assert.equal((await U('docs', { docs: [doc('violations', id, { name: 'x' })] })).s, 200); del('violations', id);
  assert.equal((await M('docs', { docs: [doc('violations', id, { name: 'x', void: { reason: 'x' } })] })).s, 403);
  assert.equal((await M('docs/delete', { store: 'violations', id })).s, 403);
  assert.equal((await M('docs', { import: true, docs: [doc('workers', 'w' + tag)] })).s, 403);
  assert.equal((await M('users')).s, 403);
  assert.equal((await M('admin/backups')).s, 403);
});
await test('staff-only records are hidden from plain users', async () => {
  const id = 'rs' + tag;
  assert.equal((await A('docs', { docs: [doc('records', id, { cat: 'x', scope: 'staff' })] })).s, 200); del('records', id);
  assert.equal((await U('sync?since=0')).j.docs.some((d) => d.id === id), false);
  assert.equal((await M('sync?since=0')).j.docs.some((d) => d.id === id), true);
  assert.equal((await U('docs', { docs: [doc('records', id + 'u', { scope: 'staff' })] })).s, 403);
  const ok = 'ra' + tag;
  assert.equal((await U('docs', { docs: [doc('records', ok, { scope: 'all' })] })).s, 200); del('records', ok);
});
await test('driver sees and checks only their own equipment', async () => {
  const live = (await D('sync?since=0')).j.docs.filter((d) => !d.deleted);
  assert.deepEqual([...new Set(live.map((d) => d.store))].filter((s) => s !== 'settings'), ['equipment']);
  assert.deepEqual(live.filter((d) => d.store === 'equipment').map((d) => d.id), [eqMine]);
  const wk = 'wk' + tag;
  assert.equal((await D('docs', { docs: [doc('eqchecks', wk, { equipId: eqMine })] })).s, 200); del('eqchecks', wk);
  assert.equal((await D('docs', { docs: [doc('eqchecks', wk + 'o', { equipId: eqOther })] })).s, 403);
  assert.equal((await D('docs', { docs: [doc('violations', 'dv' + tag)] })).s, 403);
});
await test('PDF upload: operator only, real PDFs only, staff files hidden from users', async () => {
  const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
  assert.equal((await M('admin/files', pdf, 'application/pdf')).s, 403);
  assert.equal((await A('admin/files', Buffer.from('hello'), 'application/pdf')).s, 400);
  const up = await A('admin/files', pdf, 'application/pdf');
  assert.equal(up.s, 200);
  const id = 'pl' + tag;
  assert.equal((await A('docs', { docs: [doc('plans', id, { fileId: up.j.id, scope: 'staff', title: 't' })] })).s, 200);
  assert.equal((await U(`file/${up.j.id}`)).s, 403);
  assert.equal((await M(`file/${up.j.id}`)).s, 200);
  assert.equal((await D(`file/${up.j.id}`)).s, 403);
  assert.equal((await A('docs/delete', { store: 'plans', id })).s, 200);
  assert.equal((await M(`file/${up.j.id}`)).s, 404, 'file removed with its entry');
});
await test('backups: create, list, download without password hashes', async () => {
  const c = await A('admin/backups', {});
  assert.equal(c.s, 200);
  const l = await A('admin/backups');
  assert.ok(l.j.backups.some((b) => b.name === c.j.name));
  const d = await A(`admin/backups/${c.j.name}`);
  assert.equal(d.s, 200);
  assert.ok(!JSON.stringify(d.j).includes('pw_hash'));
});

for (const f of cleanup.reverse()) await f();
for (const r of results) console.log(r.join('  '));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
