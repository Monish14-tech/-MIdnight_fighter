# 🎮 MIDNIGHT FIGHTER - Complete Setup Guide

## ⚡ Quick Start (5 minutes)

### 1️⃣ Install Node.js
- Download from: https://nodejs.org/ (LTS version)
- Install and restart your computer

### 2️⃣ Set Up MongoDB Database
The game leaderboard needs a MongoDB database. **Choose one:**

#### **Option A: Cloud (Recommended for beginners)**
1. Go to: https://www.mongodb.com/cloud/atlas
2. Sign up (it's free)
3. Create a cluster (free tier)
4. Get your connection string
5. Create a `.env` file in this folder with:
   ```
   MONGO_URI=mongodb+srv://username:password@your-cluster.mongodb.net/midnight_fighter?retryWrites=true&w=majority
   ```

#### **Option B: Local MongoDB**
1. Download: https://www.mongodb.com/try/download/community
2. Install MongoDB
3. Create `.env` file with:
   ```
   MONGO_URI=mongodb://localhost:27017/midnight_fighter
   ```

### 3️⃣ Start the Server
**Double-click**: `start_server.bat`

Wait for message: `Server running on http://localhost:3000`

### 4️⃣ Play the Game
Open browser: `http://localhost:3000/public/index.html`

---

## 📋 Detailed Setup Steps

### Step 1: Install Node.js
1. Go to https://nodejs.org/
2. Download the **LTS version** (recommended)
3. Run the installer
4. Follow the installation wizard
5. **Restart your computer**
6. Verify installation:
   - Open Command Prompt
   - Type: `node --version`
   - Should show version number like `v18.12.0`

### Step 2: Create .env File (Database Configuration)

1. **Option A - MongoDB Atlas (Cloud - FREE)**
   
   a. Go to https://www.mongodb.com/cloud/atlas and sign up
   
   b. Create a free cluster
   
   c. Get your connection string:
      - Click "Connect"
      - Choose "Drivers"
      - Copy the connection string
      - It looks like: `mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   
   d. Replace USERNAME and PASSWORD with your database credentials
   
   e. Replace database name to: `midnight_fighter` at the end

2. **Option B - Local MongoDB**
   
   a. Install MongoDB Community Edition
   
   b. Start MongoDB service
   
   c. Use: `mongodb://localhost:27017/midnight_fighter`

3. **Create the .env file:**
   
   a. Open Notepad in this folder
   
   b. Paste your connection string:
      ```
      MONGO_URI=your_connection_string_here
      ```
   
   c. Save as: `.env` (important: no .txt extension!)

### Step 3: Install Dependencies

Run this command in a Command Prompt in this folder:
```bash
npm install
```

It will install all required packages (might take a minute).

### Step 4: Start the Server

**Choose ONE method:**

#### Method 1️⃣ - Simple (Recommended)
- **Double-click**: `start_server.bat`
- Wait for: `Server running on http://localhost:3000`

#### Method 2️⃣ - PowerShell (Detailed errors)
- Right-click `start_server.ps1`
- Select "Run with PowerShell"

#### Method 3️⃣ - Command Line (Manual)
- Open Command Prompt in this folder
- Type: `npx vercel dev`

### Step 5: Open the Game

In your browser, go to:
```
http://localhost:3000/public/index.html
```

---

## 🎯 What Happens When Server Runs

✅ **Console shows:**
```
[INFO] Starting server...
[SUCCESS] Server running on http://localhost:3000
[INFO] Game available at: http://localhost:3000/public/index.html
[WARNING] Keep this window open while playing!
```

✅ **The game loads** at the URL above

✅ **Leaderboard works** and scores are saved to MongoDB

---

## ❌ Common Problems & Fixes

### Problem: "MONGO_URI is not set"
**Cause**: Missing or wrong `.env` file

**Fix**:
1. Make sure `.env` file exists in this folder
2. First line must be: `MONGO_URI=your_connection_string`
3. No quotes needed
4. Save as `.env` not `.env.txt`
5. Restart server

### Problem: "Cannot find module 'mongodb'"
**Cause**: Dependencies not installed

**Fix**:
```bash
npm install
```

### Problem: "Node.js is not installed"
**Cause**: Node.js missing from PATH

**Fix**:
1. Download from https://nodejs.org/
2. Install LTS version
3. **Restart computer**
4. Check: `node --version`

### Problem: Server starts but game won't load
**Cause**: Wrong URL or port issue

**Fix**: 
- Make sure URL is: `http://localhost:3000/public/index.html`
- Check if another app uses port 3000
- Restart server

### Problem: "Database Connection Error"
**Cause**: Wrong MongoDB URI

**Fix**:
1. Check `.env` file has correct MONGO_URI
2. Verify username and password
3. Check cluster name
4. Test on MongoDB Atlas directly

### Problem: Server crashes immediately
**Cause**: Database connection failed

**Fix**:
1. Check internet connection (MongoDB Atlas needs internet)
2. Verify MONGO_URI format
3. Make sure database credentials are correct
4. Try local MongoDB if using cloud

---

## 🔧 Optional: Auto-Start on Windows Boot

To automatically start the server when Windows starts:

1. Right-click `start_server.bat`
2. Create Shortcut
3. Press `Windows Key + R`
4. Type: `shell:startup`
5. Drag shortcut into that folder
6. Reboot and server starts automatically

---

## 📁 File Structure

```
MIdnight_fighter/
├── start_server.bat          ← Use THIS to start
├── start_server.ps1          ← Alternative: PowerShell version
├── start-server.js           ← Alternative: Node.js version
├── .env                      ← CREATE THIS with MONGO_URI
├── .env.example              ← Template (copy and modify)
├── package.json              ← Dependencies list
├── vercel.json               ← Serverless configuration
├── api/
│   ├── _db.js               ← Database connection
│   ├── leaderboard.js       ← Get scores endpoint
│   └── score.js             ← Submit score endpoint
└── public/
    ├── index.html           ← Main game
    ├── leaderboard.html     ← Leaderboard page
    ├── game.js              ← Game logic
    └── ...
```

---

## ✅ Checklist

Before playing, make sure:

- [ ] Node.js installed (`node --version` works)
- [ ] `.env` file created with MONGO_URI
- [ ] `npm install` ran successfully
- [ ] `start_server.bat` shows "Server running"
- [ ] Browser can open `http://localhost:3000/public/index.html`
- [ ] Leaderboard page opens and shows "No scores yet"
- [ ] You can play the game
- [ ] Server window stays open while playing

---

## 🚀 You're Ready!

Once all checks pass, you're all set! 

Just remember:
- **Keep the server window open** while playing
- To stop: Close the command prompt window
- To restart: Double-click `start_server.bat` again

**Have fun! 🎮**
