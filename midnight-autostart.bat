@echo off
REM ========================================
REM MIDNIGHT FIGHTER - Auto-Start Server
REM ========================================
REM Place this file in:
REM C:\Users\%USERNAME%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
REM
REM This will automatically start the game server when Windows boots
REM ========================================

setlocal enabledelayedexpansion

REM Get the path to the Midnight Fighter directory
REM Assumes this file is in the startup folder and the game is in Documents
set GAME_DIR=C:\Users\%USERNAME%\Documents\midnightgame\-MIdnight_fighter

REM Check if game directory exists
if not exist "%GAME_DIR%" (
    set GAME_DIR=C:\Users\%USERNAME%\Documents\MIdnight_fighter
)

if not exist "%GAME_DIR%" (
    exit /b 1
)

REM Start the server in a hidden window
cd /d "%GAME_DIR%"

REM Run the improved batch file
call start_server.bat

exit /b 0
