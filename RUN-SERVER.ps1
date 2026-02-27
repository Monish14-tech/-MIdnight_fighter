# Midnight Fighter - Server Launcher
# This script starts the Node.js server with proper directory handling

Write-Host "🎮 MIDNIGHT FIGHTER - SERVER LAUNCHER" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check if we're in the correct directory
if (-not (Test-Path "$scriptDir\server.js")) {
    Write-Host "❌ Error: server.js not found in $scriptDir" -ForegroundColor Red
    Write-Host "Please make sure you're running this script from the game directory." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Node.js is installed
$nodeCheck = node --version 2>$null
if (-not $nodeCheck) {
    Write-Host "❌ Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Node.js version: $nodeCheck" -ForegroundColor Green
Write-Host ""

# Check if .env file exists
if (-not (Test-Path "$scriptDir\.env")) {
    Write-Host "⚠️  Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "You may need to set up MongoDB connection manually" -ForegroundColor Yellow
    Write-Host ""
}

# Check if dependencies are installed
if (-not (Test-Path "$scriptDir\node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install --quiet
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
    Write-Host ""
}

# Start the server
Write-Host "🚀 Starting Midnight Fighter Server..." -ForegroundColor Cyan
Write-Host ""

Set-Location $scriptDir
node server.js

# If server crashes, keep window open
Write-Host ""
Write-Host "⚠️  Server stopped. Press Enter to close..." -ForegroundColor Yellow
Read-Host
