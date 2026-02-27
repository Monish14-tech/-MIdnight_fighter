# Vercel HTTP Polling Deployment Guide

## What's Been Fixed ✅

### 1. **HTTP Polling System**
- Converted from WebSocket (serverless-incompatible) to HTTP polling
- Created `PollingNetplay` class for client-side polling
- Implemented 3 new serverless endpoints for room polling

### 2. **Vercel Serverless Functions**
Created the following endpoints in `/api/rooms/[roomId]/`:
- **`join.js`** - POST endpoint to join polling
- **`state.js`** - GET endpoint to fetch peer state  
- **`sync.js`** - POST endpoint to send state updates

### 3. **Game Integration**
Updated `public/game.js` to:
- Use `PollingNetplay` instead of WebSocket `NetplayClient`
- Call polling endpoints with correct query parameters
- Handle polling-based state synchronization

## How Collaboration Now Works

1. **Host creates room** → POST `/api/rooms/create`
   - Server generates roomID, returns to host
   
2. **Host waits for guest** → GET `/api/rooms/:roomId` (polling every 1 second)
   - Checks if room status changed from 'waiting' to 'full'
   
3. **Guest joins room** → POST `/api/rooms/join`
   - Sets `guestName`, changes status to 'full'
   
4. **Both players initialize polling** → POST `/api/rooms/:roomId/join`
   - Registers in MongoDB polling state
   - Establishes polling client connection
   
5. **Both players start game loop** → Polling every 100ms:
   - **Poll**: GET `/api/rooms/:roomId/state?playerName=...` → get peer's position
   - **Sync**: POST `/api/rooms/:roomId/sync` → send queued position updates
   
## Local Testing (Already Verified ✅)

Run the test script to verify all endpoints:
```bash
node test-polling.js
```

Expected output:
```
🧪 Testing Collaboration Polling System...
1️⃣ Creating collaboration room...
✅ Room created: [roomID]
2️⃣ Checking initial room status...
✅ Room status: waiting
3️⃣ Guest joining room...
✅ Guest joined successfully
4️⃣ Checking room status after guest join...
✅ Room status: full
5️⃣ Host joining polling...
✅ Host joined polling, role: host
6️⃣ Guest joining polling...
✅ Guest joined polling, role: guest
7️⃣ Host syncing state...
✅ Host state synced
8️⃣ Guest fetching peer state...
✅ Guest fetched peer state: {...}
✅ All tests passed!
```

## Vercel Deployment Steps

### 1. **Verify `.env` File** 
✅ Already set up with MongoDB connection string

### 2. **Verify `vercel.json` Configuration**
Current setup correctly routes:
- `/api/(.*)` → Vercel serverless functions
- `/(.*)`  → Static files from `/public`

### 3. **Deploy to Vercel**
```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Deploy from project directory
vercel --prod
```

### 4. **Verify Deployment**
- Test room creation at: `https://m-idnight-fighter.vercel.app/`
- Collaboration endpoints will automatically use Vercel URLs

## Troubleshooting

### Issue: "Cannot POST /api/rooms/:roomId/join"
**Solution**: Endpoints are in `/api/rooms/[roomId]/` folder structure. Restart local server after pulling latest code.

### Issue: "Room not found" during polling
**Solution**: Room TTL is 30 minutes. If testing takes longer, create a new room.

### Issue: Peer state is `null`
**Solution**: This is normal if peer hasn't sent any state yet. Game will sync once both players are actively moving.

### Issue: 404 on Vercel but works locally
**Solution**: 
1. Push latest code changes to GitHub
2. Ensure Vercel automatically deploys (check project settings)
3. Clear browser cache and reload

## Next Steps

1. **Test locally** with two browsers:
   - Open game in Browser 1 (Host)
   - Create collaboration room, share roomID
   - Open game in Browser 2 (Guest on another PC/VM)
   - Join room with roomID
   - Verify both players see each other moving in real-time

2. **Deploy to Vercel** when satisfied with local testing

3. **Monitor performance**:
   - Check browser DevTools Network tab for polling requests
   - Polling frequency: 100ms for state, 50ms for sync
   - Adjust if needed in `public/polling-netplay.js`

## Architecture Comparison

### Before (WebSocket - ❌ Doesn't work on Vercel)
```
Game ←→ WebSocket ←→ Server (port 8000)
                      (requires persistent connection)
```

### After (HTTP Polling - ✅ Works on Vercel)
```
Game: Poll every 100ms  ←→ GET  /api/rooms/:roomId/state
Game: Sync every 50ms   ←→ POST /api/rooms/:roomId/sync
                              ↓
                         Vercel Serverless Functions
                              ↓
                         MongoDB (persists state)
```

## Files Modified

**Frontend**:
- ✅ `public/game.js` - Uses PollingNetplay
- ✅ `public/polling-netplay.js` - HTTP polling client
- ✅ `public/index.html` - No changes needed

**Backend (Local)**:
- ✅ `server.js` - Added polling endpoints for development

**Backend (Vercel - Serverless)**:
- ✅ `api/rooms/[roomId]/join.js` - NEW
- ✅ `api/rooms/[roomId]/state.js` - NEW
- ✅ `api/rooms/[roomId]/sync.js` - NEW
- ✅ `api/rooms/[roomId].js` - Updated with CORS
- ✅ `vercel.json` - Already configured

**Deprecated**:
- ⚠️ `public/netplay.js` - WebSocket (no longer used, can be deleted)
- ⚠️ `server.js` WebSocket code - Still present but unused

## Performance Notes

- **Polling Latency**: ~100ms (imperceptible to player)
- **State Update Frequency**: 50ms sync + 100ms fetch = ~150ms round-trip
- **Network Load**: Minimal (only sends changed state, not full objects)
- **Vercel Limits**: 
  - Free tier: 100 invocations/day sufficient for small playtest
  - Pro tier: Unlimited invocations for production

## Success Criteria ✅

- [x] Room creation works locally
- [x] Guest can join room locally  
- [x] Both players can start polling locally
- [x] State sync works locally
- [x] No WebSocket dependency
- [x] Vercel serverless endpoints configured
- [ ] Test end-to-end on Vercel (next step)
- [ ] Test with two actual players on two devices

---

**Status**: Ready for Vercel deployment
**Last Updated**: $(date)
**Local Server**: http://localhost:8000
**Vercel Deployment**: https://m-idnight-fighter.vercel.app
