# Fix Leaderboard on Vercel - Environment Variables Setup

## Problem
The leaderboard shows "No scores yet" because the Vercel app doesn't have the MongoDB connection string (MONGO_URI) configured.

## Solution: Set Environment Variables on Vercel

### Step 1: Get Your MongoDB Connection String

If you don't have it yet:

1. Go to: https://www.mongodb.com/cloud/atlas
2. Sign in to your account
3. Click on your **Cluster**
4. Click **CONNECT** button
5. Select **Drivers**
6. Copy the connection string (looks like):
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. **Replace "password" with your actual database password**
8. Keep this string handy

### Step 2: Set Environment Variable on Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Click on your project: **m-idnight-fighter**
3. Go to **Settings** tab
4. Click **Environment Variables** (left sidebar)
5. Click **Add New** or **+ New**

#### Fill in the fields:

| Field | Value |
|-------|-------|
| **Name** | `MONGO_URI` |
| **Value** | Your MongoDB connection string |
| **Environments** | Check: ✓ Production ✓ Preview ✓ Development |

**Example:**
```
MONGO_URI = mongodb+srv://myusername:mypassword@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
```

6. Click **Save**

### Step 3: Redeploy Your App

After setting the environment variable:

#### Option A: Automatic (Recommended)
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **Redeploy** (three dots menu)
4. Click **Redeploy**

#### Option B: Push to GitHub
If your repo is connected:
1. Make a small change and push to GitHub
2. Vercel automatically redeploys

#### Option C: CLI
```bash
vercel --prod
```

### Step 4: Verify It Works

1. Wait 30-60 seconds for deployment
2. Go to: https://m-idnight-fighter.vercel.app/
3. Open browser DevTools (F12) → Console
4. Play a game, die, and check if score submits
5. Go to Leaderboard and click REFRESH

---

## Common Issues & Fixes

### Issue: Still shows "No scores yet"
**Check:**
1. Did you add `MONGO_URI` to Vercel settings? ✓
2. Did you click **Save**? ✓
3. Did you redeploy after adding it? ✓
4. Is the connection string correct? ✓ (no typos)

**Fix:**
- Check your connection string has:
  - No extra spaces
  - Your real username (not "username")
  - Your real password (not "password")
  - No missing `?` or other characters

### Issue: "MONGO_URI is not set" error
**Cause:** Environment variable not added to Vercel

**Fix:**
1. Go to Vercel Settings
2. Add `MONGO_URI` with your MongoDB string
3. Redeploy

### Issue: MongoDB Connection Error
**Cause:** Wrong credentials or IP whitelist

**Fix:**
1. Check username and password in MongoDB Atlas
2. Go to MongoDB Atlas → Network Access
3. Add IP: `0.0.0.0/0` (allows all IPs)
4. Try again

---

## MongoDB Atlas Setup (If Needed)

If you don't have MongoDB Atlas:

1. Go to: https://www.mongodb.com/cloud/atlas
2. Click **Sign Up Free**
3. Create an account
4. Create a new **Project** → **Cluster** (select Free tier)
5. Create a user with username/password
6. Get connection string from **CONNECT** button
7. Use that string in Vercel (replace password)

---

## Vercel Settings Checklist

- [ ] Logged into Vercel dashboard
- [ ] Found project: m-idnight-fighter
- [ ] Went to Settings → Environment Variables
- [ ] Added `MONGO_URI` with MongoDB connection string
- [ ] Clicked **Save**
- [ ] Redeployed the app
- [ ] Waited 1 minute for new deployment
- [ ] Game loads at https://m-idnight-fighter.vercel.app/
- [ ] Play game, set name, die to submit score
- [ ] Score appears in leaderboard

---

## Need More Help?

### Check Vercel Logs
1. Go to **Deployments** tab
2. Click the latest deployment
3. Check **Logs** for error messages

### Test Locally First
Before changing Vercel:
1. Create `.env` file locally with MONGO_URI
2. Run: `npm install && npx vercel dev`
3. Test leaderboard at http://localhost:3000
4. Make sure it works locally, then deploy

---

**Once environment variable is set correctly, leaderboard will work! 🎮**
