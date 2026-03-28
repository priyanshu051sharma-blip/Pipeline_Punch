# AquaSync Deployment Guide - Render + Vercel

This guide walks through deploying the backend to Render and frontend to Vercel.

## Prerequisites

- GitHub account with repository pushed
- Render account (https://render.com)
- Vercel account (https://vercel.com)
- MongoDB Atlas account for production database (https://www.mongodb.com/cloud/atlas)

---

## Part 1: Backend Deployment on Render

### Step 1: Prepare Backend Environment

The backend URL will be: **https://aquasync-backend.onrender.com**

### Step 2: Create MongoDB Atlas Database

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Create database user (note username/password)
4. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/aquasync`
5. Whitelist Render IP in Network Access

### Step 3: Deploy on Render

1. Go to https://render.com (sign up with GitHub)
2. Click **New +** → **Web Service**
3. Select your GitHub repository
4. Fill in details:
   - **Name:** `aquasync-backend`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Runtime:** Node
   - **Plan:** Free (or $7/month for always-on)
5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=3000
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/aquasync
   CORS_ORIGIN=https://your-vercel-domain.vercel.app
   THINGSPEAK_ENABLED=false
   HARDWARE_ENABLED=false
   ```
6. Click **Create Web Service**
7. Wait for deployment to complete
8. **Note the URL:** Should appear as `https://aquasync-backend.onrender.com`

### Verify Backend is Live

```bash
# Test health endpoint
curl https://aquasync-backend.onrender.com/api/dashboard
```

---

## Part 2: Frontend Deployment on Vercel

### Step 1: Update Frontend Environment

1. Go to https://vercel.com (sign up with GitHub)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. **Root Directory:** Select `frontend`
5. **Framework Preset:** `Vite`
6. **Build Command:** `npm run build`
7. **Output Directory:** `dist`

### Step 2: Add Environment Variables

In Vercel project settings, go to **Settings** → **Environment Variables**:

```
VITE_API_URL: https://aquasync-backend.onrender.com/api
VITE_WS_URL: wss://aquasync-backend.onrender.com
```

**Scope:** Production

### Step 3: Deploy

1. Click **Deploy**
2. Vercel builds and deploys automatically
3. Your frontend URL: `https://your-project-name.vercel.app`

---

## Part 3: Verify Deployment

### Test API Connection

```bash
# From browser console
const response = await fetch('https://aquasync-backend.onrender.com/api/dashboard');
const data = await response.json();
console.log(data);
```

### Test WebSocket

```bash
# From browser console
const ws = new WebSocket('wss://aquasync-backend.onrender.com');
ws.onopen = () => console.log('WebSocket connected!');
ws.onerror = (err) => console.log('WebSocket error:', err);
```

### Health Check

- Backend Health: `https://aquasync-backend.onrender.com/api/health`
- Frontend: Visit `https://your-domain.vercel.app`
- Connection Status: Should show "ALL SYSTEMS LIVE"

---

## Troubleshooting

### Backend not responding

1. Check Render logs: Dashboard → service → Logs
2. Verify MongoDB connection: `MONGODB_URI` is correctly set
3. Check CORS: `CORS_ORIGIN` must match Vercel domain
4. Restart service: Dashboard → Redeploy

### WebSocket connection fails

1. Ensure `wss://` is used (not `ws://`)
2. Check firewall/proxy (some networks block WebSocket)
3. Verify backend URL in browser console: `console.log(WS_URL)`
4. Check browser Network tab for WebSocket upgrade request

### Frontend not updating data

1. Check browser console for API errors
2. Verify `VITE_API_URL` in Vercel is correct
3. Redeploy frontend to apply env changes
4. Clear browser cache (`Ctrl+Shift+Delete`)

### MongoDB connection errors

1. Check Atlas network access whitelist
2. Verify credentials in `MONGODB_URI`
3. Try connecting from MongoDB Compass to test string
4. Enable `0.0.0.0/0` temporarily to debug (then restrict)

---

## Local Development (Using Production Backend)

To test against production backend locally:

```bash
# Frontend
cd frontend
VITE_API_URL=https://aquasync-backend.onrender.com/api \
VITE_WS_URL=wss://aquasync-backend.onrender.com \
npm run dev
```

---

## Environment Variables Summary

### Backend (Render)
| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Required |
| `PORT` | `3000` | Render assigns this |
| `MONGODB_URI` | MongoDB URL | From Atlas |
| `CORS_ORIGIN` | Vercel domain | Allows frontend requests |
| `THINGSPEAK_ENABLED` | `false` | Optional integration |
| `HARDWARE_ENABLED` | `false` | Optional hardware |

### Frontend (Vercel)
| Variable | Value | Production Value |
|----------|-------|-------------------|
| `VITE_API_URL` | `http://localhost:3000/api` | `https://aquasync-backend.onrender.com/api` |
| `VITE_WS_URL` | `ws://localhost:3000` | `wss://aquasync-backend.onrender.com` |

---

## Next Steps

1. ✅ Set up MongoDB Atlas
2. ✅ Deploy backend on Render
3. ✅ Deploy frontend on Vercel
4. ✅ Update CORS_ORIGIN with Vercel domain
5. ✅ Test API and WebSocket connections
6. ✅ Monitor Render and Vercel logs

## Support

For issues:
- **Render Docs:** https://docs.render.com
- **Vercel Docs:** https://vercel.com/docs
- **MongoDB Docs:** https://docs.mongodb.com
