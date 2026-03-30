@echo off
REM =============================================================
REM  ExeGuard – Build & Package for cPanel (Windows)
REM =============================================================

IF NOT EXIST ".env.local" (
    echo [ERROR] Chua co .env.local !
    echo Tao file .env.local va dien:
    echo.
    echo NEXT_PUBLIC_API_URL=https://your-app.up.railway.app/api
    echo NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_key
    echo.
    pause
    exit /b 1
)

echo [OK] Doc .env.local
echo.

echo [1/4] npm install...
call npm install
if %errorlevel% neq 0 ( echo FAILED & pause & exit /b 1 )

echo [2/4] npm run build...
call npm run build
if %errorlevel% neq 0 ( echo FAILED & pause & exit /b 1 )

echo [3/4] Copy static + public vao standalone...
xcopy /E /I /Y ".next\static"  ".next\standalone\.next\static"
xcopy /E /I /Y "public"        ".next\standalone\public"
if exist ".env.local" copy ".env.local" ".next\standalone\.env.local"
copy "cpanel-start.js" ".next\standalone\cpanel-start.js"

echo [4/4] Tao exeguard-cpanel.zip...
powershell -command "Compress-Archive -Path '.next\standalone\*' -DestinationPath 'exeguard-cpanel.zip' -Force"

echo.
echo ============================================================
echo XONG! File: exeguard-cpanel.zip
echo.
echo Upload len cPanel:
echo 1. File Manager upload exeguard-cpanel.zip vao ~/exeguard/
echo 2. Extract tai cho
echo 3. Node.js Selector:
echo    - App root: exeguard/
echo    - Startup file: server.js
echo    - Node version: 18.x hoac 20.x
echo 4. Env: HOSTNAME=0.0.0.0  NODE_ENV=production
echo 5. Nhan START
echo ============================================================
pause
