# 🚀 Quick Start: Deploy to Render + Vercel

## 5-Minute Deployment Guide

### Prerequisites
- GitHub account
- Render account (https://render.com)
- Vercel account (https://vercel.com)
- MongoDB Atlas account (https://www.mongodb.com/cloud/atlas)

---

## Step 1: MongoDB Atlas Setup (5 min)

1. Create free MongoDB cluster
2. Create database user (remember username/password)
3. Get connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/aquasync
   ```

---

## Step 2: Deploy Backend on Render (5 min)

1. Go to https://render.com → Dashboard
2. Click **"New +"** → **"Web Service"**
3. Select your GitHub repo
4. Fill in:
   - **Name:** `aquasync-backend`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add Environment Variables:
   ```
   NODE_ENV = production
   PORT = 3000
   MONGODB_URI = mongodb+srv://user:pass@cluster.mongodb.net/aquasync
   CORS_ORIGIN = (leave blank for now)
   THINGSPEAK_ENABLED = false
   HARDWARE_ENABLED = false
   ```
6. Click **"Create Web Service"**
7. Wait ~5 minutes for deployment
8. **Copy your Render URL:** `https://aquasync-backend.onrender.com`

---

## Step 3: Deploy Frontend on Vercel (5 min)

1. Go to https://vercel.com → Dashboard
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repo
4. Configure:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add Environment Variables:
   ```
   VITE_API_URL = https://aquasync-backend.onrender.com/api
   VITE_WS_URL = wss://aquasync-backend.onrender.com
   ```
6. Click **"Deploy"**
7. Wait ~2 minutes
8. **Copy your Vercel URL:** `https://your-project.vercel.app`

---

## Step 4: Update Backend CORS (1 min)

1. Go back to Render dashboard
2. Find `aquasync-backend` service
3. Go to Settings → Environment Variables
4. Update `CORS_ORIGIN`:
   ```
   CORS_ORIGIN = https://your-project.vercel.app
   ```
5. Service auto-restarts (wait ~1 min)

---

## ✅ Test Your Deployment

Open your Vercel URL in browser:
- [ ] Dashboard loads
- [ ] Status says "ALL SYSTEMS LIVE"
- [ ] Water quality data visible
- [ ] Disease Risk shows updates every 3s
- [ ] No errors in browser console (F12)

**From browser console:**
```javascript
// Should show URLs
console.log(API_URL)
console.log(WS_URL)

// Test API
fetch('https://aquasync-backend.onrender.com/api/health').then(r => r.json()).then(console.log)

// Test WebSocket
const ws = new WebSocket('wss://aquasync-backend.onrender.com');
ws.onopen = () => console.log('✅ Connected');
```

---

## 🔧 Environment Variables Summary

### Render (Backend)
```
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/aquasync
CORS_ORIGIN=https://your-vercel-domain.vercel.app
THINGSPEAK_ENABLED=false
HARDWARE_ENABLED=false
```

### Vercel (Frontend)
```
VITE_API_URL=https://aquasync-backend.onrender.com/api
VITE_WS_URL=wss://aquasync-backend.onrender.com
```

---

## 📋 Files for Deployment

- `backend/.env.example` - Backend environment template
- `frontend/.env.example` - Frontend environment template
- `.env.production` - Production build variables
- `render.yaml` - Render deployment config
- `frontend/vercel.json` - Vercel build config
- `vercel.json` - Root vercel config (optional)
- `DEPLOYMENT_GUIDE.md` - Detailed guide
- `DEPLOYMENT_CHECKLIST.md` - Full checklist

---

## 🆘 Common Issues

**CORS Error?**
- Update `CORS_ORIGIN` in Render to match Vercel URL
- Redeploy Render service (click Redeploy button)

**WebSocket won't connect?**
- Verify using `wss://` (not `ws://`)
- Check frontend env vars: `console.log(WS_URL)`

**Blank dashboard?**
- Hard refresh: `Ctrl+Shift+R`
- Check console (F12) for errors
- Verify API_URL is correct

**MongoDB connection error?**
- Check connection string in MONGODB_URI
- Whitelist 0.0.0.0/0 in MongoDB Atlas network
- Test locally first

---

## 🎯 What's Deployed

✅ **Backend (Render)**
- Express.js API server
- WebSocket real-time updates
- Disease risk calculation
- Water potability analytics

✅ **Frontend (Vercel)**
- Vue.js dashboard
- Real-time data visualization
- Disease risk alerts
- Irrigation & pump monitoring

✅ **Database (MongoDB Atlas)**
- Sensor data storage
- User preferences
- Historical records

---

## Next Steps

1. Monitor Render logs: Dashboard → Logs
2. Check Vercel deployments: Deployments tab
3. Set up MongoDB backups
4. Enable monitoring alerts
5. Share dashboard URL with team

---

**Deployment Status:** ✅ Ready to Deploy

**backend URL:** https://aquasync-backend.onrender.com
**Frontend URL:** https://_____.vercel.app
**Real-time Updates:** WebSocket → wss://aquasync-backend.onrender.com
