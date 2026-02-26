#!/usr/bin/env pwsh

<#
    MIDNIGHT FIGHTER - Server Starter (PowerShell)
    This script starts the Vercel dev server with auto-restart capability
    Usage: .\start-server.ps1
#>

$ErrorActionPreference = "Continue"
$MAX_RETRIES = 5
$RETRY_DELAY = 3

function Write-Log {
    param(
        [string]$Type,
        [string]$Message
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $colors = @{
        'INFO'    = 'Cyan'
        'SUCCESS' = 'Green'
        'ERROR'   = 'Red'
        'WARNING' = 'Yellow'
        'RESTART' = 'Magenta'
    }
    
    $prefix = @{
        'INFO'    = '[ℹ️ INFO]'
        'SUCCESS' = '[✅ SUCCESS]'
        'ERROR'   = '[❌ ERROR]'
        'WARNING' = '[⚠️ WARNING]'
        'RESTART' = '[🔄 RESTART]'
    }[$Type]
    
    $color = $colors[$Type]
    
    Write-Host "$prefix $timestamp - $Message" -ForegroundColor $color
}

function Check-NodeInstalled {
    try {
        $version = node --version 2>$null
        Write-Log 'SUCCESS' "Node.js found: $version"
        return $true
    } catch {
        Write-Log 'ERROR' "Node.js is not installed or not in PATH"
        return $false
    }
}

function Install-Dependencies {
    Write-Log 'INFO' "Installing dependencies..."
    
    & npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log 'SUCCESS' "Dependencies installed successfully"
        return $true
    } else {
        Write-Log 'ERROR' "Failed to install dependencies (exit code: $LASTEXITCODE)"
        return $false
    }
}

function Start-VercelServer {
    Write-Log 'INFO' "Starting Vercel dev server..."
    
    & npx vercel dev
    
    return $LASTEXITCODE -eq 0
}

# Main script
Clear-Host
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                        ║" -ForegroundColor Cyan
Write-Host "║     MIDNIGHT FIGHTER - POWERSHELL SERVER STARTER       ║" -ForegroundColor Cyan
Write-Host "║                                                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check if Node.js is installed
if (-not (Check-NodeInstalled)) {
    Write-Log 'ERROR' "Please install Node.js from https://nodejs.org"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check and install dependencies
if (-not (Test-Path "node_modules")) {
    if (-not (Install-Dependencies)) {
        Write-Log 'ERROR' "Cannot proceed without dependencies"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Start server with retry logic
$retryCount = 0

while ($retryCount -lt $MAX_RETRIES) {
    $retryCount++
    
    if ($retryCount -gt 1) {
        Write-Log 'RESTART' "Attempting restart ($retryCount/$MAX_RETRIES)..."
    } else {
        Write-Log 'INFO' "Starting server..."
    }
    
    Write-Log 'SUCCESS' "Server running on http://localhost:3000"
    Write-Log 'INFO' "Game URL: http://localhost:3000/public/index.html"
    Write-Log 'WARNING' "Keep this window open while playing!"
    
    Start-VercelServer
    
    if ($retryCount -lt $MAX_RETRIES) {
        Write-Log 'WARNING' "Server stopped. Retrying in $RETRY_DELAY seconds..."
        Start-Sleep -Seconds $RETRY_DELAY
    }
}

Write-Log 'ERROR' "Server failed to start after $MAX_RETRIES attempts"
Write-Log 'INFO' "Please check your .env file and MongoDB credentials"

Read-Host "Press Enter to exit"
exit 1
