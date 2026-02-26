@echo off
setlocal enabledelayedexpansion
cls

echo ========================================
echo MIDNIGHT FIGHTER - SERVER LAUNCHER
echo ========================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [INFO] Installing dependencies (if needed)...
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo [SUCCESS] Server is starting...
echo ========================================
echo.
echo Server will start on: http://localhost:3000
echo Game URL: http://localhost:3000/public/index.html
echo.
echo Do NOT close this window while playing!
echo.

REM Keep-alive loop - restart server if it crashes
set retry_count=0
set max_retries=5

:server_loop
set /a retry_count+=1
echo [%date% %time%] Starting server (attempt !retry_count! of %max_retries%)...
echo.

npx vercel dev

REM If vercel dev exits, check retry count
if !retry_count! LSS %max_retries% (
    echo.
    echo [WARNING] Server stopped unexpectedly. Restarting in 3 seconds...
    timeout /t 3 /nobreak
    goto server_loop
) else (
    echo.
    echo [ERROR] Server failed to start after %max_retries% attempts
    echo Please check:
    echo   1. .env file with MONGO_URI
    echo   2. Internet connection
    echo   3. MongoDB Atlas credentials
    echo.
    pause
    exit /b 1
)

endlocal
pause
