# 현장ON — notes for Claude

Field safety PWA for one construction site (제일건설 인천검단 AA25). The person you work with is the
site's safety manager and the app's **operator (운영자)**; they speak Korean — answer in Korean.
Live: https://hyeonjang-on.lj2.workers.dev (Cloudflare Worker `hyeonjang-on`, D1 `hyeonjang-on-db`,
R2 `hyeonjang-on-photos`). Architecture and commands: see README.md.

## The operator's rules (the spec — keep them true)
1. 장비운전원 (driver): only 장비점검, only their own equipment (matched by 운전원 연락처 = login phone).
   Cannot register, edit or delete anything else.
2. 사용자 (user): view and register everything except 취약근로자.
3. 관리자 (manager): view and register everything except settings; can see 취약근로자.
4. Settings: everyone sees only 내 정보; the operator sees all settings.
5. 운영자 (admin) runs everything; deletes, voids, users and backups are operator only.
6. Photos can be added by anyone; **files** (register Excel uploads, PDF documents) only by manager and operator.
7. Multi-photo pick fills the next slots; fixed-slot photo lists (장비 주간 사진) stay one at a time.
8. 사진대지: the writer picks 4 photos per cell or 1 photo per cell (2 cells per page), editable later.
9. Must work on phone, tablet and desktop (no horizontal overflow at 375 / 768 / 1280 px).
10. Tapping the 현장ON logo goes home.
Also: re-uploading a register Excel must never break links or wipe data — unchanged rows stay untouched,
"맞추기" marks missing equipment 반출 / workers removed / 취약근로자 퇴사, never hard deletes.
Every permission is enforced in `worker/lib/policy.js`, not only hidden in the UI.

## Working agreements
- Anything the operator can change in the app (layout, categories, forms, checklist items, users) belongs in
  the app's settings, not in code. Build features so they don't need to ask for small changes.
- **Test only against local `npm run dev` (localhost:8787)**, never against the live site.
  Guard scripts with a localhost check. `npm run check` before every deploy; `npm test` (needs a local
  operator account in TEST_ADMIN_ID / TEST_ADMIN_PW) after any API or permission change.
- Bump `APP_VER` in `public/js/app/nav.js` with every app change; when you add or rename a file under
  `public/js` or `public/css`, add it to `index.html` and to `FILES` in `public/sw.js` (`npm run check` verifies).
- Schema changes go in `migrations/NNNN_*.sql` and `schema.sql`; the operator runs remote D1 changes
  themselves (prepare a small .cmd/.ps1 and explain what it does and what could go wrong first).
- Never commit real site data: Excel registers, backups, phone numbers, passwords (`.gitignore` blocks
  `*.xlsx`, `*.xls`, `*.csv`, `*.json`). Generated account SQL lives only in the gitignored `.wrangler/`.
- Deploy: `npx wrangler deploy` (on Windows PowerShell use `npx.cmd`). Commit and push to `main` after deploying.
- Windows: PowerShell blocks `npx.ps1` → use `npx.cmd`. `wrangler d1 export --remote` fails with an auth error
  on this account's OAuth login; back up with `wrangler d1 execute --remote --json --command "SELECT ..."` instead.
