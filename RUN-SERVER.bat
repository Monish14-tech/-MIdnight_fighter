@echo off
REM Midnight Fighter - Server Launcher (Batch)
REM This script starts the Node.js server

title Midnight Fighter Server
cls

echo.
echo ====================================
echo  MIDNIGHT FIGHTER - SERVER
echo ====================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not found in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if server.js exists
if not exist "server.js" (
    echo ERROR: server.js not found
    echo Make sure you run this from the game directory
    echo.
    pause
    exit /b 1
)

REM Check if .env exists
if not exist ".env" (
    echo WARNING: .env file not found
    echo Database connection may fail
    echo.
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install --quiet
    echo.
)

REM Start the server
echo Starting server...
echo.
node server.js

REM Keep window open on exit
echo.
echo Server stopped. Press any key to close...
pause >nul
exit /b 0
