@echo off
chcp 65001 >nul
rem 시험용 사이트 1단계: Cloudflare에 시험용 D1(DB)과 R2(사진 저장소)를 새로 만든다.
rem 실제 현장 hyeonjang-on-db / hyeonjang-on-photos 는 건드리지 않는다. 한 번만 실행.
cd /d "%~dp0.."
echo [1/2] 시험용 D1 만들기: hyeonjang-on-staging-db
call npx.cmd wrangler d1 create hyeonjang-on-staging-db
echo.
echo [2/2] 시험용 R2 만들기: hyeonjang-on-staging-photos
call npx.cmd wrangler r2 bucket create hyeonjang-on-staging-photos
echo.
echo 위에 나온 database_id (긴 영문·숫자) 를 Claude에게 알려 주거나,
echo wrangler.toml 의 STAGING_DB_ID 자리에 직접 붙여 넣은 뒤 staging-2-deploy.cmd 를 실행하세요.
pause
