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
/* 동기화는 한 번에 300건씩 → 시험 서버에 기록이 쌓여도 전부 받아서 확인 */
const syncAll = async (c) => { let since = 0, more = true; const docs = [];
  while (more) { const r = await c('sync?since=' + since); if (r.s !== 200) return r; docs.push(...r.j.docs); since = r.j.cursor; more = r.j.more; }
  return { s: 200, j: { docs } }; };

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

await test('취약근로자: manager and operator only', async () => {
  const id = 'vu' + tag;
  assert.equal((await A('docs', { docs: [doc('vuln', id, { name: 'x' })] })).s, 200); del('vuln', id);
  assert.equal((await syncAll(U)).j.docs.some((d) => d.id === id), false);
  assert.equal((await U('docs', { docs: [doc('vuln', id + 'u')] })).s, 403);
  assert.equal((await syncAll(M)).j.docs.some((d) => d.id === id), true);
});
await test('only the operator changes settings, deletes, voids, users, backups', async () => {
  assert.equal((await M('docs', { docs: [doc('settings', 'shared', { site: 'x' })] })).s, 403);
  const id = 'v' + tag;
  assert.equal((await U('docs', { docs: [doc('violations', id, { name: 'x' })] })).s, 200); del('violations', id);
  assert.equal((await M('docs', { docs: [doc('violations', id, { name: 'x', void: { reason: 'x' } })] })).s, 403);
  assert.equal((await M('docs/delete', { store: 'violations', id })).s, 403);
  assert.equal((await M('users')).s, 403);
  assert.equal((await M('admin/backups')).s, 403);
});
await test('register Excel uploads: manager and operator only', async () => {
  assert.equal((await U('docs', { import: true, docs: [doc('workers', 'wu' + tag)] })).s, 403);
  assert.equal((await D('docs', { import: true, docs: [doc('workers', 'wd' + tag)] })).s, 403);
  assert.equal((await M('docs', { import: true, docs: [doc('workers', 'wm' + tag)] })).s, 200); del('workers', 'wm' + tag);
  assert.equal((await U('docs', { import: true, docs: [], remove: { store: 'workers', ids: ['x'] } })).s, 403);
});
await test('register upload can drop listed entries only, others untouched', async () => {
  const keep = 'wk' + tag + 'k', drop = 'wk' + tag + 'd';
  assert.equal((await A('docs', { import: true, docs: [doc('workers', keep, { name: 'a' }), doc('workers', drop, { name: 'b' })] })).s, 200);
  del('workers', keep);
  assert.equal((await A('docs', { import: true, docs: [], remove: { store: 'violations', ids: [drop] } })).s, 400);
  assert.equal((await A('docs', { import: true, docs: [], remove: { store: 'workers', ids: [drop] } })).s, 200);
  const live = (await syncAll(A)).j.docs;
  assert.equal(live.find((d) => d.id === drop).deleted, true);
  assert.equal(live.find((d) => d.id === keep).deleted, false);
});
await test('staff-only records are hidden from plain users', async () => {
  const id = 'rs' + tag;
  assert.equal((await A('docs', { docs: [doc('records', id, { cat: 'x', scope: 'staff' })] })).s, 200); del('records', id);
  assert.equal((await syncAll(U)).j.docs.some((d) => d.id === id), false);
  assert.equal((await syncAll(M)).j.docs.some((d) => d.id === id), true);
  assert.equal((await U('docs', { docs: [doc('records', id + 'u', { scope: 'staff' })] })).s, 403);
  const ok = 'ra' + tag;
  assert.equal((await U('docs', { docs: [doc('records', ok, { scope: 'all' })] })).s, 200); del('records', ok);
});
await test('only the writer (or operator) edits a record; edu / follow / links stay shared', async () => {
  const v = 'vo' + tag, a = 'ao' + tag;
  const vd = { name: '홍길동', type: '안전모', level: 2, edu: { done: false } }, ad = { name: '홍길동', value: 0.04, follow: '' };
  assert.equal((await U('docs', { docs: [doc('violations', v, vd), doc('alcohol', a, ad)] })).s, 200); del('violations', v); del('alcohol', a);
  assert.equal((await U('docs', { docs: [doc('violations', v, { ...vd, place: '1동' })] })).s, 200, 'writer edits own');
  assert.equal((await M('docs', { docs: [doc('violations', v, { ...vd, place: '2동' })] })).s, 403, 'manager edits other');
  assert.equal((await M('docs', { docs: [doc('violations', v, { ...vd, place: '1동', edu: { done: true, by: 'M' } })] })).s, 200, 'edu is shared');
  assert.equal((await M('docs', { docs: [doc('alcohol', a, { ...ad, follow: '재측정 → 정상', linkedViolation: v })] })).s, 200, 'follow/link shared');
  assert.equal((await M('docs', { docs: [doc('alcohol', a, { ...ad, value: 0.01 })] })).s, 403, 'value is not');
  assert.equal((await A('docs', { docs: [doc('violations', v, { ...vd, place: '3동' })] })).s, 200, 'operator edits any');
});

await test('feedback: anyone sends, only the operator reads; never synced', async () => {
  const t = '의견테스트' + tag;
  assert.equal((await U('feedback', { kind: '불편해요', text: t })).s, 200);
  assert.equal((await D('feedback', { kind: '오류 같아요', text: t + 'd' })).s, 200, 'driver can send');
  assert.equal((await U('feedback', { text: '' })).s, 400);
  assert.equal((await U('feedback')).s, 403, 'user cannot read');
  assert.equal((await M('feedback?count=1')).s, 403, 'manager cannot read');
  const list = (await A('feedback')).j.items;
  const mine = list.find((x) => x.text === t);
  assert.ok(mine && mine.status === 'new' && mine.by === '일반테스트');
  assert.equal((await A('feedback/' + mine.id, { status: 'done', memo: 'ok' })).s, 200);
  assert.equal((await A('feedback')).j.items.find((x) => x.id === mine.id).status, 'done');
  assert.equal((await syncAll(A)).j.docs.some((d) => d.store === 'feedback' || d.store === 'aiuse'), false);
  assert.equal((await U('docs', { docs: [doc('feedback', 'fx' + tag, { text: 'x' })] })).s, 400, 'not writable through docs');
});

await test('driver sees and checks only their own equipment', async () => {
  const live = (await syncAll(D)).j.docs.filter((d) => !d.deleted);
  assert.deepEqual([...new Set(live.map((d) => d.store))].filter((s) => s !== 'settings'), ['equipment']);
  assert.deepEqual(live.filter((d) => d.store === 'equipment').map((d) => d.id), [eqMine]);
  const wk = 'wkd-' + tag;
  assert.equal((await D('docs', { docs: [doc('eqchecks', wk, { equipId: eqMine })] })).s, 200); del('eqchecks', wk);
  assert.equal((await D('docs', { docs: [doc('eqchecks', wk + 'o', { equipId: eqOther })] })).s, 403);
  assert.equal((await D('docs', { docs: [doc('eqchecks', 'wk-' + tag, { equipId: eqMine })] })).s, 403, 'driver writes only the driver check');
  assert.equal((await A('docs', { docs: [doc('eqchecks', 'wk-m' + tag, { equipId: eqMine })] })).s, 200); del('eqchecks', 'wk-m' + tag);
  assert.equal((await syncAll(D)).j.docs.some((d) => d.id === 'wk-m' + tag && !d.deleted), false, 'manager check is not sent to the driver');
  assert.equal((await A('docs', { docs: [doc('eqchecks', 'wkd-a' + tag, { equipId: eqMine })] })).s, 403, 'staff cannot write the driver check');
  assert.equal((await D('docs', { docs: [doc('violations', 'dv' + tag)] })).s, 403);
});
await test('임시 출입 QR: staff opens it, many join until closed, guests touch only their own equipment', async () => {
  assert.equal((await U('guest/invite', { minutes: 30 })).s, 403, 'plain user cannot open a QR');
  const inv = (await M('guest/invite', { minutes: 30 })).j;
  assert.ok(inv.token && inv.id);
  const G = client(), G2 = client();
  const j = await G('guest/join', { token: inv.token, name: '임시테스트', phone: '010-1234-5678', company: '임시중기' });
  assert.equal(j.s, 200);
  assert.equal(j.j.user.role, 'guest');
  const age = +(j.h.get('set-cookie').match(/Max-Age=(\d+)/) || [])[1];
  assert.ok(age > 0 && age <= 86400, 'session ends by midnight');
  cleanup.push(() => A(`users/${j.j.user.id}`, { active: false }));
  const j2 = await G2('guest/join', { token: inv.token, name: '임시둘', phone: '010-9999-0000' });
  assert.equal(j2.s, 200, 'same QR works for a second person');
  cleanup.push(() => A(`users/${j2.j.user.id}`, { active: false }));
  assert.equal((await G2('guest/join', { token: inv.token, name: '', phone: '010-9999-0000' })).s, 400);
  const eqG = 'eqg' + tag, ckG = 'wkd-g' + tag;
  assert.equal((await G('docs', { docs: [doc('equipment', eqG, { type: '지게차', operator: '임시테스트' }), doc('eqchecks', ckG, { equipId: eqG, kind: 'week' })] })).s, 200, 'adds own equipment and checks it');
  del('equipment', eqG); del('eqchecks', ckG);
  assert.equal((await G('docs', { docs: [doc('eqchecks', 'wkd-x' + tag, { equipId: eqOther })] })).s, 403, 'cannot check other equipment');
  assert.equal((await G('docs', { docs: [doc('equipment', eqOther, { type: '바꿈' })] })).s, 403, 'cannot edit other equipment');
  assert.equal((await G2('docs', { docs: [doc('equipment', eqG, { type: '바꿈' })] })).s, 403, 'another guest cannot edit it either');
  assert.equal((await G('docs', { docs: [doc('workers', 'wg' + tag, { name: 'x' })] })).s, 403, 'no registers');
  const seen = (await syncAll(G)).j.docs.filter((d) => d.store === 'equipment' && !d.deleted).map((d) => d.id); // 지운 기록은 id만 오는 표시라 제외
  assert.deepEqual(seen, [eqG], 'sees only own equipment');
  assert.equal((await G('users')).s, 403);
  const st = (await M('guest/invite/' + inv.id)).j;
  assert.deepEqual(st.joined.map((x) => x.name).sort(), ['임시둘', '임시테스트']);
  assert.equal((await M('guest/invite/' + inv.id + '/close', {})).s, 200);
  assert.equal((await client()('guest/join', { token: inv.token, name: '늦음', phone: '010-1111-1111' })).s, 403, 'closed QR');
  assert.equal((await client()('guest/join', { token: 'nope', name: 'x', phone: '010-1111-1111' })).s, 403, 'bad token');
  assert.equal((await G2('docs/delete', { store: 'equipment', id: eqG })).s, 403, 'another guest cannot delete it');
  assert.equal((await G('docs/delete', { store: 'equipment', id: eqG })).s, 200, 'guest deletes own equipment');
  const byHand = (await A('users', { loginId: 'gx' + tag, name: 'x', password: 'init-pass-9', role: 'guest' })).j.user;
  cleanup.push(() => A(`users/${byHand.id}`, { active: false }));
  assert.equal(byHand.role, 'user', 'guest role cannot be given by hand');
});

await test('폰 알림: only manager and operator subscribe and set preferences', async () => {
  assert.equal((await U('push/key')).s, 403);
  assert.equal((await D('push/prefs')).s, 403);
  assert.equal((await M('push/key')).s, 200);
  const ev = (await M('push/prefs')).j.events;
  assert.ok(ev.eqcheck && !ev.feedback, 'manager has no 새 의견 (operator only)');
  assert.ok((await A('push/prefs')).j.events.feedback);
  assert.equal((await M('push/subscribe', { endpoint: 'ftp://x', keys: { p256dh: 'a', auth: 'b' } })).s, 400);
  assert.equal((await syncAll(A)).j.docs.some((d) => /^push/.test(d.store)), false, 'push data never synced');
});

await test('equipment delete: whoever added it, manager and operator; checks go with it', async () => {
  const eu = 'eqdu' + tag, ea = 'eqda' + tag, ck = 'wk-' + eu + '-2026-10-12';
  assert.equal((await U('docs', { docs: [doc('equipment', eu, { type: '지게차' }), doc('eqchecks', ck, { equipId: eu, kind: 'week' })] })).s, 200);
  assert.equal((await A('docs', { docs: [doc('equipment', ea, { type: '크레인' })] })).s, 200); del('equipment', ea);
  assert.equal((await U('docs/delete', { store: 'equipment', id: ea })).s, 403, 'user cannot delete equipment added by someone else');
  assert.equal((await D('docs/delete', { store: 'equipment', id: eqMine })).s, 403, 'driver cannot delete');
  const vv = 'vdel' + tag;
  assert.equal((await M('docs', { docs: [doc('violations', vv, { name: 'x', level: 1 })] })).s, 200);
  assert.equal((await U('docs/delete', { store: 'violations', id: vv })).s, 403, 'cannot delete someone else’s violation');
  assert.equal((await M('docs/delete', { store: 'violations', id: vv })).s, 200, 'writer deletes own violation');
  assert.equal((await U('docs/delete', { store: 'equipment', id: eu })).s, 200, 'adder deletes own equipment');
  const after = (await syncAll(A)).j.docs;
  assert.equal(after.some((d) => d.id === ck && !d.deleted), false, 'its checks are deleted too');
  assert.equal((await M('docs/delete', { store: 'equipment', id: ea })).s, 200, 'manager deletes any equipment');
});

await test('category records (사진대지 등): the writer or the operator deletes', async () => {
  const r1 = 'rc' + tag;
  assert.equal((await U('docs', { docs: [doc('records', r1, { cat: 'x', scope: 'all', type: 'photo', byId: 'u' })] })).s, 200);
  assert.equal((await M('docs/delete', { store: 'records', id: r1 })).s, 403, 'manager cannot delete another person’s record');
  assert.equal((await U('docs/delete', { store: 'records', id: r1 })).s, 200, 'writer deletes own record');
  const r2 = 'rd' + tag;
  assert.equal((await M('docs', { docs: [doc('records', r2, { cat: 'x', scope: 'all', type: 'photo' })] })).s, 200);
  assert.equal((await A('docs/delete', { store: 'records', id: r2 })).s, 200, 'operator deletes any');
});

await test('PDF upload: manager and operator only, real PDFs only, staff files hidden from users', async () => {
  const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
  assert.equal((await U('admin/files', pdf, 'application/pdf')).s, 403);
  assert.equal((await D('admin/files', pdf, 'application/pdf')).s, 403);
  assert.equal((await M('admin/files', pdf, 'application/pdf')).s, 200);
  assert.equal((await U('docs', { docs: [doc('plans', 'pu' + tag, { title: 'x' })] })).s, 403);
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
