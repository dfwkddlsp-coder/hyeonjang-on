# 현장ON

> 습관이 된 노력을 실력이라 한다.

Offline-first web app (PWA) for construction / manufacturing sites. Built for tablets, works on smartphones.

## Features
- **삼진아웃제** – 1차 경고 · 2차 교육 · 3차 퇴출. Auto level from history, photos, violator + inspector signatures, refusal with witness, printable confirmation form.
- **음주측정** – site standard (0.03% 미만 오전 작업중지 / 0.03~0.08% 당일 작업중지·심의 / 2회 적발 영구퇴출) or company policy mode. 측정결과 통지서 with signatures, 적발 알림 message sharing, daily 음주측정관리명부 and weekly 일지 Excel export.
- **취약근로자** – import 유소견자 사후관리 명단 (multi-row items per person, all company sheets). Auto tags (고혈압·소음성난청·고령·유소견 D·특검·상담필요), blood-pressure log, signed 건강검진 결과 및 사후상담일지.
- **근로자 관리대장** – import the site's 신규근로자 관리대장 Excel as-is (header names are detected, multi-file merge).
- **장비 관리대장** – import 장비 전담 관리자 지정서 as-is; search, expiry warnings for inspection / insurance.
- Excel export, A4 one-page printing (auto-fit), JSON backup/restore, PIN lock.

## Run locally
```
npx http-server . -p 8765
```
Open http://localhost:8765.

## Deploy (GitHub Pages)
Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `(root)`.
Open the Pages URL on a tablet or phone and use "홈 화면에 추가" to install.

## Data
All records are stored only on each device (IndexedDB) — nothing is sent to a server. Use 기록 → 전체 백업 regularly.
Planned: shared server with admin-registered users and admin-only delete.

Never commit real site Excel files or backups (`.gitignore` blocks `*.xlsx`, `*.xls`, `*.json`).
