# AquaSync Deployment Checklist - Render + Vercel

## Pre-Deployment Setup

### 1. Backend Preparation (Render)
- [ ] MongoDB Atlas account created (https://www.mongodb.com/cloud/atlas)
- [ ] MongoDB cluster created and connection string obtained
- [ ] Database user created with strong password
- [ ] Network access whitelist updated (add Render IPs)
- [ ] Backend `.env` file configured locally with `MONGODB_URI`
- [ ] Local testing: `cd backend && npm install && npm start`
- [ ] Health endpoint verified: `curl http://localhost:3000/api/health`

### 2. Frontend Preparation (Vercel)
- [ ] Frontend environment variables properly configured
- [ ] `frontend/.env.example` shows correct Render backend URL
- [ ] Local testing: `cd frontend && npm run build && npm run preview`
- [ ] Build completes without errors

### 3. Git Repository
- [ ] All files committed: `git add .`
- [ ] Commit message clear: `git commit -m "Ready for production deployment"`
- [ ] Changes pushed to main: `git push origin main`
- [ ] GitHub repository is public/accessible

---

## Deployment: Backend on Render

### Step 1: Render Account Setup
- [ ] Render account created (https://render.com)
- [ ] Connected to GitHub
- [ ] Authorized GitHub access

### Step 2: MongoDB Atlas Setup
- [ ] Go to MongoDB Atlas dashboard
- [ ] Network Access → Add IP Address → `0.0.0.0/0` (for testing) or Render IP
- [ ] Copy connection string: `mongodb+srv://user:pass@cluster.mongodb.net/aquasync`
- [ ] Replace `<username>`, `<password>`, `<cluster-name>` in string

### Step 3: Create Render Web Service
- [ ] Log in to Render dashboard
- [ ] Click "New +" → "Web Service"
- [ ] Select GitHub repository
- [ ] Configure settings:
  - [ ] **Service Name:** `aquasync-backend`
  - [ ] **Root Directory:** `backend`
  - [ ] **Runtime:** Node
  - [ ] **Build Command:** `npm install`
  - [ ] **Start Command:** `npm start`
  - [ ] **Instance Type:** Free (auto-pauses) or Starter ($7/mo for always-on)

### Step 4: Add Environment Variables (Render)
Add these in Render dashboard under Environment:

```
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/aquasync
CORS_ORIGIN=https://your-frontend-domain.vercel.app
THINGSPEAK_ENABLED=false
HARDWARE_ENABLED=false
```

- [ ] All environment variables added
- [ ] `MONGODB_URI` has correct credentials
- [ ] `CORS_ORIGIN` left blank for now (update after Vercel deployment)

### Step 5: Deploy Backend
- [ ] Click "Create Web Service"
- [ ] Wait for build to complete (5-10 minutes)
- [ ] Check logs for errors (Logs tab)
- [ ] Service shows "Live" status
- [ ] Note the URL: `https://aquasync-backend.onrender.com`

### Step 6: Verify Backend Health
- [ ] Test health endpoint: `curl https://aquasync-backend.onrender.com/api/health`
- [ ] Expected response: `{"status":"healthy","timestamp":"...","uptime":...,"environment":"production"}`
- [ ] Check Render logs for WebSocket connections
- [ ] Note backend URL for frontend setup

---

## Deployment: Frontend on Vercel

### Step 1: Vercel Account Setup
- [ ] Vercel account created (https://vercel.com)
- [ ] Connected to GitHub
- [ ] Authorized GitHub access

### Step 2: Import Project
- [ ] Log in to Vercel dashboard
- [ ] Click "Add New" → "Project"
- [ ] Import your GitHub repository
- [ ] Vercel auto-detects framework as Vite

### Step 3: Configure Build Settings
- [ ] **Project Name:** `aquasync-dashboard` (or preferred name)
- [ ] **Root Directory:** Select `frontend`
- [ ] **Framework Preset:** Vite
- [ ] **Build Command:** `npm run build`
- [ ] **Output Directory:** `dist`

### Step 4: Add Environment Variables (Vercel)
- [ ] Go to Settings → Environment Variables
- [ ] Add new variables:
  - [ ] **Key:** `VITE_API_URL` → **Value:** `https://aquasync-backend.onrender.com/api`
  - [ ] **Key:** `VITE_WS_URL` → **Value:** `wss://aquasync-backend.onrender.com`
- [ ] Set **Environments:** Production + Preview + Development

### Step 5: Deploy Frontend
- [ ] Click "Deploy"
- [ ] Wait for build (2-3 minutes)
- [ ] Deployment successful message appears
- [ ] Visit Vercel URL: `https://your-project.vercel.app`
- [ ] Check for console errors (F12 → Console)

### Step 6: Verify Frontend Connection
- [ ] Dashboard loads without errors
- [ ] Check browser console (F12 → Console):
  ```javascript
  // Should show Render URL
  console.log(API_URL)
  console.log(WS_URL)
  ```
- [ ] WebSocket should connect ("ALL SYSTEMS LIVE" status)
- [ ] Data should refresh automatically (3-second intervals)

---

## Post-Deployment Verification

### Test API Connectivity
```bash
# From browser console
const res = await fetch('https://aquasync-backend.onrender.com/api/dashboard');
const data = await res.json();
console.table(data.waterQuality);
```

- [ ] API responds with water quality data
- [ ] CORS error does NOT occur
- [ ] Data includes current sensor readings

### Test WebSocket
```bash
# From browser console
const ws = new WebSocket('wss://aquasync-backend.onrender.com');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (e) => console.log('❌ WebSocket error:', e);
ws.onmessage = (e) => console.log('📨 Message:', JSON.parse(e.data));
setTimeout(() => ws.close(), 5000);
```

- [ ] WebSocket connects successfully
- [ ] Real-time data updates received
- [ ] No SSL certificate errors

### Test Disease Risk Detection
- [ ] Dashboard loads Water Potability Intelligence section
- [ ] Disease Risk badge appears (should show "High" currently)
- [ ] Disease conditions listed (check for "Low Mineral Water Exposure")
- [ ] Recommendations displayed below conditions

### Test Data Refresh
- [ ] Wait 3-5 seconds and watch potability scores update
- [ ] Water quality parameters change in real-time
- [ ] No connection errors in console
- [ ] Page doesn't freeze or lag

---

## Backend Render Configuration Updates

### Update CORS Origin (After Vercel Deployment)
1. Note your Vercel URL: `https://your-project-name.vercel.app`
2. Go to Render dashboard → aquasync-backend service
3. Settings → Environment Variables
4. Update `CORS_ORIGIN`: `https://your-project-name.vercel.app`
5. Service automatically redeploys (wait ~2 min)
6. Test again from frontend

---

## Troubleshooting Checklist

### Backend Issues

**Port Error on Render**
- [ ] Check if service is already running
- [ ] Restart service: Dashboard → Redeploy
- [ ] Check PORT is set to 3000

**MongoDB Connection Failed**
- [ ] Verify `MONGODB_URI` in Render environment
- [ ] Check MongoDB Atlas network whitelist
- [ ] Test connection string locally: `mongosh "mongodb+srv://..."`
- [ ] Verify credentials (username/password)

**CORS Error in Frontend Console**
```
Access-Control-Allow-Origin header missing
```
- [ ] Update `CORS_ORIGIN` in Render to match Vercel domain
- [ ] Redeploy Render service
- [ ] Hard refresh frontend (Ctrl+Shift+R)
- [ ] Check exact Vercel URL matches

**WebSocket Connection Failed**
- [ ] Ensure using `wss://` (not `ws://`)
- [ ] Check frontend environment variables: `console.log(WS_URL)`
- [ ] Check Render WebSocket server is running: `curl https://aquasync-backend.onrender.com/api/health`
- [ ] Some networks/proxies block WebSocket: test from mobile hotspot

### Frontend Issues

**Blank Dashboard**
- [ ] Check browser console (F12) for errors
- [ ] Verify VITE_API_URL and VITE_WS_URL in Settings
- [ ] Hard refresh page (Ctrl+Shift+R)
- [ ] Clear browser cache: DevTools → Settings → Clear site data

**API calls return 404**
- [ ] Check if backend URL is correct: `console.log(API_URL)`
- [ ] Test endpoint manually: `curl https://aquasync-backend.onrender.com/api/dashboard`
- [ ] Verify backend service is running (check Render status)

**Data Not Updating**
- [ ] WebSocket should be connected ("ALL SYSTEMS LIVE")
- [ ] Check Network tab: see WebSocket upgrade request?
- [ ] Check console for `loadPotabilityData` errors
- [ ] Verify polling interval is 3s: Frontend code at line ~70

---

## Success Indicators

✅ **Everything Working When:**
1. Frontend loads at Vercel URL without errors
2. Connection status shows "ALL SYSTEMS LIVE"
3. Water quality data displays and updates every 3-5 seconds
4. Disease Risk shows conditions and updates dynamically
5. Browser console has no CORS or WebSocket errors
6. API responds to manual fetch calls
7. Render backend runs continuously without restarting

---

## Maintenance & Monitoring

### Weekly
- [ ] Check Render logs for errors
- [ ] Verify Vercel deployment status
- [ ] Confirm data is updating (no stale readings)

### Monthly
- [ ] Review MongoDB quota usage
- [ ] Monitor Render billing
- [ ] Test WebSocket stability with real-time data

### Production Best Practices
- [ ] Keep dependencies updated: `npm outdated`
- [ ] Monitor error logs regularly
- [ ] Set up alerts for service restarts
- [ ] Back up MongoDB regularly
- [ ] Test disaster recovery procedures

---

## Support Links

- **Render Docs:** https://docs.render.com
- **Vercel Docs:** https://vercel.com/docs
- **MongoDB Atlas:** https://docs.atlas.mongodb.com
- **Vite Build Troubleshooting:** https://vitejs.dev/guide/troubleshooting.html
- **Node.js on Render:** https://docs.render.com/nodejs

---

**Deployment Date:** _______________  
**Backend URL:** https://aquasync-backend.onrender.com  
**Frontend URL:** https://_____________________.vercel.app  
**MongoDB URI:** _____________________ (keep confidential!)
