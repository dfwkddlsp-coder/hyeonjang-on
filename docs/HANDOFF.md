# 현장ON — handoff for the next session

Read this with `CLAUDE.md` (the operator's rules) and `README.md` (architecture, commands).
State as of 2026-10-13: APP_VER `2026.10.13-4`, live and pushed to `main`. 시범 운영 is in progress, so
keep changes small and behavior-preserving unless the operator asks for more.

## Save tokens
- Most files are dense (long one-line functions). Don't read whole files: `grep -n` for the function or
  the Korean label shown on screen, then read only those lines (`sed -n A,Bp file | cut -c1-200`).
- Big files: `features/equipment.js` (43 KB), `features/categories.js` (30 KB), `features/vuln.js`,
  `features/settings.js`, `features/registers.js`, `css/app.css` (49 KB). Use the map below to jump in.
- One task per conversation; batch small UI tweaks into one request, one test run, one deploy.

## Where to change what
| Task | Client (`public/js/…`) | Server (`worker/…`) |
|---|---|---|
| Who may do X | `can('key')` checks in the feature file | `lib/perms.js` (`PERMS` list + defaults), `lib/policy.js` (per-store write/read rules) |
| Settings screen layout, ☰ categories | `app/tabs.js` (`SET_CATS`, `setChrome`) | — |
| A settings card | the feature file appends `<section class="st" data-st="<cat>">` in an `R.settings` wrapper; 현장 기준 cards in `features/settings.js` use `data-sc` | — |
| A new shared setting (synced to everyone) | add the key to `SHARED_KEYS` (`core/server.js`) and a default to `DEF` (`core/store.js`) | add the key to a group in `SETTING_GROUPS` (`lib/perms.js`), or non-operators get 403 when saving |
| Roles / per-person permissions UI | `features/perms.js` (설정 → 권한 table, `userPermsUI` in the user dialog) | `routes/perms.js`, stored in `settings/shared.perms` (+ `perms._users[userId]`) |
| Users, invite QR, 가입 신청 | `features/users.js`, `features/join.js` | `routes/users.js`, `routes/join.js` |
| 임시 출입 QR (guest drivers) | `features/guest.js` | `routes/guest.js` |
| Equipment checks, weekly photos, eq forms | `features/equipment.js` (mgr ids `wk-`/`wp-`, driver ids `wkd-`/`wpd-`) | `lib/policy.js` (`syncRowFilter`, eqchecks) |
| 문서함 PDFs, 사진대지, 점검표, categories | `features/categories.js`, `features/site-config.js` | `routes/files.js` |
| Excel import/export | `core/excel.js`, `features/registers.js`, `features/vuln.js` | `routes/docs.js` (`import` flag) |
| Printing (A4) | `core/print.js` | — |
| Phone push | `features/notify.js` | `lib/push.js`, `routes/push.js` |
| 안내 봇, feedback | `features/guide.js` | `routes/guide.js` (Workers AI) |
| Sync, login, API helper, `ME`, `can`, `canDel` | `core/server.js` | `routes/docs.js`, `routes/auth.js` |
| Router, nav, which screens a person sees | `app/nav.js` (`R` view registry, `go`, `VIEW_OK`/`viewOk`) | — |

## Patterns to follow
- **Views:** `R.<view> = (arg) => { V$().innerHTML = … }`. Features extend another file's view by wrapping
  it: `{const f=R.settings;R.settings=(...a)=>{f(...a); …}}`. Load order in `index.html` decides wrap order;
  `app/tabs.js` wraps last.
- **Data:** every record is a JSON doc `{store, id, data}` in D1 `docs`, soft-deleted. Client stores live in
  IndexedDB and go up through the outbox (`save`/`remove` in `core/store.js`). Server stores: `STORES` in
  `lib/policy.js`. Private stores (never synced, never backed up): feedback, aiuse, guestinv, pushkey,
  pushsub, pushpref, joinreq.
- **Permissions:** a new feature gets a new key in `PERMS` (`[key, group, label, defaultRoles, note]`); the
  설정 → 권한 screen picks it up automatically. Check it on the server (`requirePerm` / `P.has`) and in the UI
  (`can`). Fixed in code: operator has everything; only the operator touches operator accounts; nobody raises
  their own permissions.
- **Hard-to-redo records** (photos, signed checklists): save with `saveConfirm` (waits for the server when online,
  throws on rejection so the form stays open) and set `MODAL_GUARD` so back/close asks before losing input.
  Rejected outbox records are never dropped: they go to the device's '저장 실패' box (`kv rejected`, badge) and the
  server logs them in private store `rejectlog` (설정 → 안내 봇·의견·오류, perm `rejects.view`).
- **Settings saves** send the whole shared doc; the server keeps keys the sender didn't include
  (`routes/docs.js`) so older app versions can't wipe newer keys.

## Every change
1. Edit → `npm run check` → `npm test` + `npm run test:push` against local `npm run dev`
   (load `.wrangler/test-admin.env` first; use `set -o pipefail` when piping test output).
2. Bump `APP_VER` (`app/nav.js`). New/renamed file under `public/js` or `public/css` → `index.html`,
   `FILES` in `sw.js`, and bump the cache name `C` in `sw.js`.
3. Ask the operator before deploying. Deploy `npx wrangler deploy`, check APP_VER on the live site
   (can lag ~20 s), then commit and push to `main`.

## Gotchas already hit
- Editing with node string `replace`: `$$` in the replacement turns into `$`. Use `s.replace(a,()=>b)` or
  `split/join`.
- A `//` comment inside a one-line function swallows the rest of the line. Use `/* */` or its own line.
- Sync pages hold 300 docs; tests must use the `syncAll` helper.
- The double-tap guard (`core/ui.js`) must ignore `input,select,textarea,label`, or file pickers don't open.
- Stale `workerd` processes cause `SQLITE_BUSY`: kill only this project's wrangler/workerd and restart dev.
- Browser checks of logged-in screens need the operator to log in (the test password can't be typed by Claude);
  layout can still be checked by injecting markup on the login page.

## Open items
- Operator account security plan (2FA, re-auth for dangerous actions, login log, per-loginId lockout DoS)
  — agreed to do later; details in Claude's memory `security-plan-operator-account`.
- Optional cleanup if a big file keeps getting edited: split `equipment.js` / `categories.js` by screen.
