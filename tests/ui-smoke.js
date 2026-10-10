/* UI smoke test — paste into the browser console on a LOCAL dev server (wrangler dev, localhost:8787)
   while logged in as the operator. Opens every view, settings tab, category and the main forms,
   builds every kind of print page, and reports what rendered plus any errors thrown.
   It never saves, deletes or prints. */
(async () => {
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(location.host)) throw new Error('local dev server only');
  const sl = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { ver: APP_VER, role: ME && ME.role, views: {}, modals: {}, print: {}, errors: [] };
  const errs = [];
  const onErr = (e) => errs.push(String(e.message || e.reason || e));
  addEventListener('error', onErr); addEventListener('unhandledrejection', onErr);
  const text = () => document.querySelector('#view').innerText.replace(/\s+/g, ' ').slice(0, 60);
  const tryIt = async (bucket, name, fn) => {
    try { await fn(); await sl(150); bucket[name] = 'ok'; } catch (e) { bucket[name] = 'ERR ' + e.message; }
  };

  for (const v of ['home', 'strike', 'alcohol', 'workers', 'equip', 'eqcheck', 'vuln', 'records'])
    await tryIt(out.views, v, async () => { go(v); await sl(200); out.views[v + '_text'] = text(); });
  for (const t of setTabs().map((x) => x[0]).filter((x) => x.startsWith('settings:')))
    await tryIt(out.views, t, async () => { go('settings', t.split(':')[1]); await sl(250); });
  for (const c of docCats())
    await tryIt(out.views, 'cat:' + c.name, async () => { go('plans', c.k); await sl(200); });

  const close = () => { if (!document.querySelector('#modal').classList.contains('hidden')) closeModal(); };
  await tryIt(out.modals, 'strikeForm', async () => { go('strike'); strikeForm(); await sl(200); close(); });
  await tryIt(out.modals, 'alcForm', async () => { go('alcohol'); alcForm(); await sl(200); close(); });
  const e0 = eqTargets()[0];
  if (e0) {
    const mon = weekMon(today());
    await tryIt(out.modals, 'eqWeekForm', async () => { eqWeekForm(e0.id, mon); await sl(200); close(); });
    await tryIt(out.modals, 'eqWeekPhotoForm', async () => { eqWeekPhotoForm(e0.id, mon); await sl(200); close(); });
    await tryIt(out.print, 'eqPrintPages', () => { out.print.eqPages = eqPrintPages(e0, mon).length; });
  }
  await tryIt(out.modals, 'eqQuickAdd', async () => { go('eqcheck'); eqQuickAdd(); await sl(200); close(); });
  for (const c of docCats().filter((c) => catType(c) !== 'pdf')) {
    const rs = recsOf(c.k);
    await tryIt(out.print, 'rec:' + c.name, () => { out.print['rec:' + c.name + '_pages'] = recPages(c, rs).length; });
    if (rs[0]) await tryIt(out.modals, 'recView:' + c.name, async () => { recView(c, rs[0]); await sl(150); close(); });
  }
  const v0 = V.find((v) => !v.void), a0 = A.find((a) => !a.void);
  if (v0) await tryIt(out.print, 'docViolation', () => docViolation(v0));
  if (a0) await tryIt(out.print, 'docAlcohol', () => docAlcohol(a0));
  await tryIt(out.print, 'docAlcoholList', () => docAlcoholList(today()));

  go('home'); await sl(200);
  removeEventListener('error', onErr); removeEventListener('unhandledrejection', onErr);
  out.errors = errs;
  out.failed = [...Object.entries(out.views), ...Object.entries(out.modals), ...Object.entries(out.print)]
    .filter(([, v]) => String(v).startsWith('ERR')).map(([k, v]) => k + ': ' + v);
  console.log(out);
  return out;
})();
