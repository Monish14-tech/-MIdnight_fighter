@echo off
echo ========================================
echo MIDNIGHT - Starting Game Server
echo ========================================
echo.
echo Installing dependencies (if needed)...
call npm install
echo.
echo Starting Vercel dev server (serverless functions)...
echo.
echo Server will start on: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "%~dp0"
npx vercel dev

pause
