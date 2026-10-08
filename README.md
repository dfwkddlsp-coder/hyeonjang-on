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
- First visit to a fresh deployment creates the **operator (운영자)** account.
- The operator registers users in 설정 → 사용자 관리 (ID + initial password; the user changes it at first login).
- Users can view everything and add records. Operator only: delete, void, register Excel import/clear, site settings, user management — enforced in the Worker, not just hidden in the UI.

## Data
Records live in Cloudflare D1; photos and signatures are stored as separate blobs. Each device keeps a cache for offline use — changes are queued and uploaded when back online, and other devices pull changes every 30 s and when reopened.

Never commit real site Excel files or backups (`.gitignore` blocks `*.xlsx`, `*.xls`, `*.json`).

## Layout
- `public/` — the app (static files, served by the Worker's assets binding)
- `worker/index.js` — API: login, users, sync, photos
- `schema.sql` — D1 tables
- `index.html` (repo root) — redirect for the old GitHub Pages address

## Develop / deploy
```
npm install
npm run db:local      # create local D1 tables
npm run dev           # http://localhost:8787
npm run deploy        # requires: npx wrangler login
```
Apply schema changes to the live database with `npx wrangler d1 execute hyeonjang-on-db --remote --file schema.sql`.

## Fonts
Hangul: Pretendard (`public/vendor/fonts`, SIL OFL 1.1). Latin/digits: Chiron GoRound TC (Google Fonts).
