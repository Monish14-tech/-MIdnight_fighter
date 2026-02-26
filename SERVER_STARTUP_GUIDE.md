# Server Startup Guide - MIDNIGHT FIGHTER

## Quick Start

The **easiest way** to start the server is:

### Option 1: Simple Batch File (Recommended)
1. Double-click: **`start_server.bat`**
2. Wait for the message: "Server running on http://localhost:3000"
3. Keep the window open while playing
4. The server will **automatically restart** if it crashes

### Option 2: PowerShell Script
1. Right-click **`start_server.ps1`**
2. Select "Run with PowerShell"
3. If you see an error about execution policy, run PowerShell as admin and run:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Option 3: Node.js Script
1. Open Command Prompt or PowerShell in the game folder
2. Run:
   ```bash
   node start-server.js
   ```

### Option 4: Command Line (Manual)
1. Open Command Prompt or PowerShell in the game folder
2. Run:
   ```bash
   npx vercel dev
   ```

---

## Auto-Start on Windows Boot (Optional)

To make the server start automatically when Windows boots:

### Step 1: Create Startup Shortcut
1. Right-click `start_server.bat`
2. Select "Create shortcut"
3. Rename the shortcut to: `Midnight Fighter Server`

### Step 2: Move to Startup Folder
1. Press: **Windows Key + R**
2. Type: `shell:startup`
3. Press **Enter**
4. Drag the shortcut into the opened folder

### Step 3: Computer will now:
- Start the server automatically when Windows boots
- You can still close the window anytime to stop the server
- Use `start_server.bat` to manually start when needed

---

## Accessing the Game

After the server starts, open your browser and go to:
- **Game**: http://localhost:3000/public/index.html
- **Leaderboard**: http://localhost:3000/public/leaderboard.html

---

## Troubleshooting

### Problem: "Node.js is not installed"
**Solution**: Download and install from https://nodejs.org/ (get the LTS version)

### Problem: Server starts but game won't load
**Solution**: Check that the address is:
- ✅ `http://localhost:3000/public/index.html`
- ❌ NOT `http://localhost:8000`
- ❌ NOT `http://localhost/index.html`

### Problem: "npm install" fails
**Solution**:
1. Make sure you have internet connection
2. Delete `node_modules` folder and `package-lock.json` file
3. Run batch file again (it will reinstall dependencies)

### Problem: Server keeps crashing
**Solution**: 
1. Check your `.env` file - make sure `MONGO_URI` is correct
2. Check your internet connection (needed for MongoDB)
3. Verify your MongoDB credentials are valid
4. Try running the PowerShell version for more detailed error messages

### Problem: Port 3000 is already in use
**Solution**: 
1. Close other applications using port 3000
2. Or change the server port in the `vercel.json` file

### Problem: Leaderboard shows "No scores yet"
**Solution**: 
1. Server must be running first
2. Make sure you set a pilot name in the leaderboard
3. Play a game and die to submit a score

---

## What Each Script Does

| File | Purpose | Recommendation |
|------|---------|-----------------|
| `start_server.bat` | Simple batch file with auto-restart | ✅ Easiest, use this |
| `start_server.ps1` | PowerShell version with colored output | Better error messages |
| `start-server.js` | Node.js process manager | For advanced users |
| `midnight-autostart.bat` | Auto-start on Windows boot | Optional convenience |

---

## Server Requirements

- ✅ Node.js installed (https://nodejs.org)
- ✅ Internet connection (for MongoDB)
- ✅ Port 3000 available
- ✅ Valid `.env` file with `MONGO_URI`

---

## Port Information

The development server runs on:
- **Port 3000** - Vercel dev server (where you access the game)
- **Not port 8000** - That was the old Express server

---

## Keep the Server Running

**Important**: You must keep one of these programs running while playing:
- Command prompt window with `start_server.bat`
- PowerShell window running the script
- Or set it up to auto-start on boot

When you close the window, the server stops and the game won't work.

---

## Questions or Issues?

Check the error messages carefully - they usually tell you what's wrong!

Common solutions:
1. Restart the server (close and run again)
2. Check internet connection
3. Verify Node.js is installed: `node --version`
4. Check `.env` file exists with correct `MONGO_URI`
