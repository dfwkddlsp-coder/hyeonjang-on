# 현장ON

> 습관이 된 노력을 실력이라 한다.

Field safety web app (PWA) for construction / manufacturing sites. Built for tablets, works on smartphones and offline.

**Live:** https://hyeonjang-on.lj2.workers.dev (Cloudflare Worker + D1). The old GitHub Pages address redirects there.

## Features
- **삼진아웃제** – 1차 경고 · 2차 교육 · 3차 퇴출. Auto level from history, photos (camera or gallery with consent), violator + inspector signatures, refusal with witness, printable confirmation form.
- **음주측정** – site standard (0.03% 미만 오전 작업중지 / 0.03~0.08% 당일 작업중지·심의 / 2회 적발 영구퇴출) or company policy mode. 측정결과 통지서 with signatures, 적발 알림 message sharing, daily 음주측정관리명부 and weekly 일지 Excel export.
- **관리대장** – 근로자 / 장비 / 취약근로자, imported from the site's existing Excel forms as-is (header names are detected, multi-file merge).
- **취약근로자** – auto tags (고혈압·소음성난청·고령·유소견 D·특검·상담필요), blood-pressure log, signed 건강검진 결과 및 사후상담일지.
- Excel export, A4 one-page printing (auto-fit), backup/restore, PIN lock.

## Roles
- First visit to a fresh deployment creates the **operator (운영자)** account. The operator registers users in 설정 → 사용자 관리 (one by one or many at once; the user changes the initial password at first login).
- **운영자** everything · **관리자** sees everything incl. 취약근로자, no delete/void/settings/users · **사용자** records; 취약근로자 and staff-only categories hidden · **장비운전원** only their own equipment's checks.
- Every rule is enforced in the Worker (`worker/lib/policy.js`), not just hidden in the UI.

## Data
Records live in Cloudflare D1 as JSON documents (`docs` table, soft deletes so devices can sync them). Photos, signatures, PDFs and weekly backups live in R2. Each device keeps an IndexedDB copy for offline use — changes are queued and uploaded when back online, and other devices pull changes every 30 s and when reopened.

Never commit real site Excel files or backups (`.gitignore` blocks `*.xlsx`, `*.xls`, `*.json`).

## Layout
```
public/                 the app (static files served by the Worker's assets binding; no build step)
  index.html            markup + script load order
  css/app.css
  js/core/              util · store (IndexedDB, settings) · rules · excel · ui (modal, signature, photo)
                        · print (A4 pages, printed forms) · server (roles, API, sync, login)
  js/app/               nav (router, view registry R) · tabs · boot
  js/features/          one file per screen: home, strike, alcohol, registers, vuln, equipment,
                        categories (PDF / 사진대지 / 점검표 / 작성 양식), settings, site-config, users
  sw.js                 offline cache (FILES must match index.html — npm run check)
worker/
  index.js              router over the [method, path | RegExp, handler] tables in routes/
  lib/                  http · crypto · session · policy (all permissions) · storage (photos, backups)
  routes/               auth · users · docs (sync / write / delete) · files (PDF, photos) · admin
migrations/             D1 schema changes (wrangler d1 execute --file)
tests/                  check.mjs · api.test.mjs (permissions) · ui-smoke.js (paste into the browser console)
```
`public/js` holds classic scripts that share one global scope and load in the order listed in `index.html`.
Only `core/ui.js`, `app/tabs.js` and `app/boot.js` run code at load time; everything else only defines
functions and constants, so a new screen is one more file in `js/features/` (added to `index.html` and `sw.js`).

## Develop / deploy
```
npm install
npm run db:local      # create local D1 tables
npm run dev           # http://localhost:8787
npm run check         # every script parses; index.html and sw.js list the same files
TEST_ADMIN_ID=… TEST_ADMIN_PW=… npm test   # permission tests against the local server
npm run deploy        # requires: npx wrangler login
```
Apply schema changes to the live database with `npx wrangler d1 execute hyeonjang-on-db --remote --file schema.sql`.

## Fonts
Hangul: Pretendard (`public/vendor/fonts`, SIL OFL 1.1). Latin/digits: Chiron GoRound TC (Google Fonts).
