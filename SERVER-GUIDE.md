# Server Setup Guide

## Are Server & Leaderboard Required?

✅ **YES** - The Node.js server is required for:
- **Leaderboard** - Storing and fetching scores from MongoDB
- **Collaboration** - Creating rooms, joining players, real-time WebSocket sync
- **All API Endpoints** - Game features that sync with database

Both features depend on the same server running at `http://localhost:8000`

## How to Run the Server

### Option 1: Quick Start (Windows - Easiest)
Double-click one of these files in the game directory:
- **`RUN-SERVER.bat`** - Simple batch launcher (recommended for most users)
- **`RUN-SERVER.ps1`** - PowerShell launcher (requires enabling execution)

Both will:
1. Check if Node.js is installed
2. Install dependencies if needed
3. Start the server
4. Keep the window open if it crashes

### Option 2: Terminal Command
Open PowerShell in the game directory and run:
```powershell
npm start
```

### Option 3: Full Node Command
```powershell
node server.js
```

## What Happens When Server Runs

When you see this output, the server is ready:
```
🎮 MIDNIGHT FIGHTER - Starting server...
🔄 Connecting to MongoDB Atlas...
✅ Connected to MongoDB Atlas successfully!

=========================================
🚀 MIDNIGHT FIGHTER - Server Running
=========================================
🎉 Game URL: http://localhost:8000
📡 API: http://localhost:8000/api/leaderboard
🔌 WS: ws://localhost:8000/ws
=========================================
```

## Game Access

Once server is running, open your browser:
- **Game**: `http://localhost:8000`
- **Features available**:
  - Single player mode ✅
  - Leaderboard (saving & viewing scores) ✅
  - Collaboration (creating & joining rooms) ✅

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Node not found" | Install Node.js from nodejs.org |
| "Cannot find .env" | Check MongoDB connection string in .env file |
| "Port 8000 already in use" | Close other servers or use different port |
| "Failed to connect MongoDB" | Check internet & MongoDB Atlas credentials |

## Keep Server Running

Once started, keep this window/terminal open while playing. The server must stay running for:
- Score submissions ✅
- Room creation/joining ✅
- Real-time collaboration ✅

---

**Don't stop the server!** Just keep it running in the background while you play.
