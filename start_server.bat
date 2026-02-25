@echo off
echo ========================================
echo MIDNIGHT - Starting Game Server
echo ========================================
echo.
echo Installing dependencies (if needed)...
call npm install
echo.
echo Server will start on: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "%~dp0"
node server.js

pause
