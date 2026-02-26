#!/usr/bin/env node

/**
 * MIDNIGHT FIGHTER - Server Process Manager
 * This script starts and monitors the Vercel dev server
 * Automatically restarts on crash with retry logic
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_RETRIES = 5;
const RETRY_DELAY = 3000; // 3 seconds
const SERVER_PORT = 3000;
const SERVER_NAME = 'Midnight Fighter Dev Server';

let retryCount = 0;
let serverProcess = null;

function log(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
        'INFO': '[ℹ️ INFO]',
        'SUCCESS': '[✅ SUCCESS]',
        'ERROR': '[❌ ERROR]',
        'WARNING': '[⚠️ WARNING]',
        'RESTART': '[🔄 RESTART]'
    }[type] || '[LOG]';
    
    console.log(`${prefix} ${timestamp} - ${message}`);
}

function checkNodeModules() {
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        log('WARNING', 'node_modules not found. Installing dependencies...');
        const npmInstall = spawn('npm', ['install'], { cwd: __dirname });
        
        return new Promise((resolve) => {
            npmInstall.on('close', (code) => {
                if (code === 0) {
                    log('SUCCESS', 'Dependencies installed successfully');
                    resolve(true);
                } else {
                    log('ERROR', 'Failed to install dependencies');
                    resolve(false);
                }
            });
        });
    }
    return Promise.resolve(true);
}

function startServer() {
    return new Promise((resolve) => {
        log('INFO', `Starting ${SERVER_NAME}...`);
        
        serverProcess = spawn('npx', ['vercel', 'dev'], {
            cwd: __dirname,
            stdio: 'inherit',
            shell: true
        });

        serverProcess.on('error', (error) => {
            log('ERROR', `Failed to start server: ${error.message}`);
            resolve(false);
        });

        serverProcess.on('close', (code) => {
            if (code === 0) {
                log('INFO', 'Server closed normally');
            } else {
                log('WARNING', `Server exited with code ${code}`);
            }
            resolve(code === 0);
        });

        // Give server time to start
        setTimeout(() => {
            log('SUCCESS', `${SERVER_NAME} is running on http://localhost:${SERVER_PORT}`);
            log('INFO', 'Game available at: http://localhost:3000/public/index.html');
            resolve(true);
        }, 2000);
    });
}

async function main() {
    console.clear();
    
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║                                                       ║');
    console.log('║        MIDNIGHT FIGHTER - DEV SERVER MANAGER          ║');
    console.log('║                                                       ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    
    // Check dependencies
    const depsOk = await checkNodeModules();
    if (!depsOk) {
        log('ERROR', 'Cannot proceed without dependencies. Exiting.');
        process.exit(1);
    }

    // Start server loop with retry logic
    while (retryCount < MAX_RETRIES) {
        retryCount++;
        
        if (retryCount > 1) {
            log('RESTART', `Attempting restart (${retryCount}/${MAX_RETRIES})...`);
        }
        
        const success = await startServer();
        
        if (success && retryCount === 1) {
            log('SUCCESS', 'Server running successfully. Keep this window open!');
            log('INFO', 'Close this window to stop the server.');
            // Server is running, just wait
            return;
        }
        
        if (retryCount < MAX_RETRIES) {
            log('INFO', `Retrying in ${RETRY_DELAY / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }

    log('ERROR', `Failed to start server after ${MAX_RETRIES} attempts`);
    log('INFO', 'Please check:');
    log('INFO', '  1. .env file exists with MONGO_URI');
    log('INFO', '  2. Internet connection is working');
    log('INFO', '  3. Node.js and npm are properly installed');
    
    process.exit(1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    log('INFO', 'Shutting down server...');
    if (serverProcess) {
        serverProcess.kill();
    }
    process.exit(0);
});

main().catch(error => {
    log('ERROR', error.message);
    process.exit(1);
});
