# MongoDB Leaderboard Setup Guide

## Overview
Your Midnight Fighter game now has a global leaderboard system integrated with MongoDB Atlas!

## What's Been Added

### Backend (Node.js + Express + MongoDB)
- **server.js**: Express server with MongoDB connection
- **package.json**: Dependencies configuration
- **API Endpoints**:
  - `GET /api/leaderboard?limit=10` - Fetch top scores
  - `POST /api/score` - Submit a score
  - `GET /api/player/:playerName` - Get player stats

### Frontend
- **leaderboard.js**: LeaderboardManager class for API communication
- **Leaderboard UI**: New screen in the game
- **Player Name System**: Set your pilot name to appear on leaderboard
- **Auto Score Submission**: Scores are automatically submitted when game ends

## Installation & Setup

### 1. Install Node.js
If you don't have Node.js installed:
- Download from: https://nodejs.org/
- Install the LTS version (recommended)

### 2. Install Dependencies
Open a terminal in the game folder and run:
```bash
npm install
```

This will install:
- express (web server)
- mongodb (database driver)
- cors (cross-origin support)

### 3. Start the Server
Simply run the batch file:
```bash
start_server.bat
```

Or manually:
```bash
node server.js
```

The server will start on: http://localhost:8000

## MongoDB Connection

Your MongoDB Atlas connection string is already configured in `server.js`:
```
mongodb+srv://admin:Prasath@20012006@cluster0.lum0no3.mongodb.net/
```

Database Name: `midnight_fighter`
Collection: `leaderboard`

## How to Use

### Setting Your Pilot Name
1. Click "LEADERBOARD" from the main menu
2. Enter your desired pilot name
3. Click "SET NAME"
4. Your name is saved and will be used for all score submissions

### Viewing Leaderboard
- Click "LEADERBOARD" from main menu
- Click "LEADERBOARD" from game over screen
- Click "REFRESH" to reload latest scores
- Your current entry is highlighted in blue

### Score Submission
- Scores are automatically submitted when you die
- Only your highest score is kept
- Your global rank is displayed on the game over screen

## Leaderboard Features

### Player Stats Saved
- Player Name
- Best Score
- Highest Level Reached
- Ship Type Used
- Date Created/Updated

### Top Rankings
- Top 3 players get special colors:
  - 🥇 Rank 1: Gold
  - 🥈 Rank 2: Silver  
  - 🥉 Rank 3: Bronze

### Smart Updates
- Only updates if new score is higher
- Automatically calculates your global rank
- Shows "NEW RECORD!" message for personal bests

## API Testing

You can test the API directly:

### Get Leaderboard
```bash
curl http://localhost:8000/api/leaderboard?limit=10
```

### Submit Score (example)
```bash
curl -X POST http://localhost:8000/api/score \
  -H "Content-Type: application/json" \
  -d '{"playerName":"TestPilot","score":5000,"level":3,"shipType":"fighter"}'
```

### Get Player Stats
```bash
curl http://localhost:8000/api/player/TestPilot
```

## Troubleshooting

### "Cannot connect to MongoDB"
- Check your internet connection
- Verify the MongoDB Atlas cluster is active
- Ensure the connection string is correct

### "npm: command not found"
- Install Node.js from nodejs.org
- Restart your terminal after installation

### Scores not saving
- Check browser console for errors (F12)
- Ensure you've set a pilot name
- Verify the server is running

### Port 8000 already in use
Edit `server.js` and change:
```javascript
const PORT = 8000; // Change to 3000 or another port
```

Also update the API URL in `leaderboard.js`:
```javascript
this.apiUrl = 'http://localhost:8000/api'; // Update port
```

## Security Note

⚠️ **Important**: The MongoDB password is currently hardcoded in `server.js`. For production:

1. Create a `.env` file:
```
MONGODB_URI=your_connection_string_here
PORT=8000
```

2. Install dotenv: `npm install dotenv`

3. Update server.js:
```javascript
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 8000;
```

## File Structure

```
-MIdnight_fighter/
├── server.js            # Backend server
├── package.json         # Dependencies
├── leaderboard.js       # Frontend API manager
├── game.js             # Updated with leaderboard integration
├── index.html          # Updated with leaderboard UI
├── style.css           # Updated with leaderboard styles
├── start_server.bat    # Launch script
└── LEADERBOARD_SETUP.md # This file
```

## Enjoy Your Global Leaderboard! 🎮🚀

Compete with players worldwide and climb to the top!
