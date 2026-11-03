@echo off
chcp 65001 >nul
rem 시험용 사이트 2단계: 시험용 D1에 표(schema.sql)를 만들고 시험용 Worker를 배포한다.
rem 대상은 --env staging (hyeonjang-on-staging) 뿐. 실제 현장 사이트·DB는 바뀌지 않는다. 다시 실행해도 안전.
cd /d "%~dp0.."
findstr /c:"STAGING_DB_ID" wrangler.toml >nul && (
  echo wrangler.toml 에 database_id 가 아직 없습니다. staging-1-create.cmd 결과를 먼저 넣으세요.
  pause & exit /b 1
)
echo [1/3] 점검 (npm run check)
call npm.cmd run check || (pause & exit /b 1)
echo [2/3] 시험용 D1에 표 만들기 (이미 있으면 그대로 둠)
call npx.cmd wrangler d1 execute hyeonjang-on-staging-db --remote --env staging --file schema.sql || (pause & exit /b 1)
echo [3/3] 시험용 Worker 배포
call npx.cmd wrangler deploy --env staging || (pause & exit /b 1)
echo.
echo 끝. 바로 https://hyeonjang-on-staging.lj2.workers.dev 를 열어 시험용 운영자 계정을 만드세요
echo (처음 들어온 사람이 운영자가 되므로 배포 직후 바로). 실제 현장 비밀번호는 쓰지 마세요.
pause
