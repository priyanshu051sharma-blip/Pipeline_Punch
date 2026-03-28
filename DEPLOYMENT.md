# AquaSync Deployment Guide

## Overview
- **Backend**: Deployed on Render (Node.js + Express + WebSocket)
- **Frontend**: Deployed on Vercel (Vite + Vue.js)
- **Database**: MongoDB Atlas (Cloud)

---

## Prerequisites

1. **Render Account**: https://render.com
2. **Vercel Account**: https://vercel.com (connected to GitHub)
3. **MongoDB Atlas Account**: https://www.mongodb.com/cloud/atlas
4. **GitHub Repository**: Push changes from your local repo

---

## Step 1: Set Up MongoDB Atlas

1. Visit https://www.mongodb.com/cloud/atlas
2. Create a free MongoDB cluster
3. Create a database user and note the credentials
4. Whitelist Render IPs (0.0.0.0/0 for simplicity, or use Render's static IP)
5. Copy connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/aquasync?retryWrites=true&w=majority
   ```

---

## Step 2: Deploy Backend on Render

### Option A: Using YAML (render.yaml)
1. Push your repo to GitHub with `render.yaml` at root
2. Go to https://render.com/dashboard
3. Click "New +"  → "Blueprint"
4. Connect your GitHub repo
5. Select `render.yaml` and deploy
6. Add environment variables in Render dashboard

### Option B: Manual Setup
1. Go to https://render.com/dashboard
2. Click "New +"  → "Web Service"
3. Connect your GitHub repo
4. **Settings:**
   - Name: `aquasync-backend`
   - Environment: `Node`
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
   - Plan: Free (auto-pauses) or Starter ($7/mo for always-on)

5. **Add Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/aquasync?retryWrites=true&w=majority
   CORS_ORIGIN=https://aquasync-dashboard.vercel.app
   THINGSPEAK_ENABLED=false
   HARDWARE_ENABLED=false
   ```

6. Click "Create Web Service"
7. Wait for deployment to complete
8. **After deployment, note your Render URL**: e.g., `https://aquasync-backend.onrender.com`

### Test Backend Health
```
https://aquasync-backend.onrender.com/api/health
```
Should return:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-29T...",
  "uptime": 123.45,
  "environment": "production"
}
```

---

## Step 3: Deploy Frontend on Vercel

### Setup
1. Go to https://vercel.com/dashboard
2. Click "Add New"  → "Project"
3. Import your GitHub repo
4. **Project Settings:**
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

5. **Environment Variables:**
   ```
   VITE_API_URL=https://aquasync-backend.onrender.com/api
   VITE_WS_URL=wss://aquasync-backend.onrender.com
   ```

6. Click "Deploy"
7. Wait for deployment to complete
8. **Note your Vercel URL**: e.g., `https://aquasync-dashboard.vercel.app`

---

## Step 4: Update Backend CORS

After getting your Vercel URL:

1. Go to Render dashboard
2. Select `aquasync-backend` service
3. Go to "Environment" section
4. Update `CORS_ORIGIN`:
   ```
   https://aquasync-dashboard.vercel.app
   ```
5. Click "Save Changes" (triggers redeploy)

---

## Step 5: Verify Deployment

### Check Health
```bash
curl https://aquasync-backend.onrender.com/api/health
```

### Test Frontend
1. Visit your Vercel URL: `https://aquasync-dashboard.vercel.app`
2. Open browser DevTools (F12)
3. Check Console tab - should show:
   ```
   WebSocket connected
   ```
4. Check Network tab - requests to backend should show:
   ```
   https://aquasync-backend.onrender.com/api/dashboard
   ```

---

## Important Notes

### WebSocket Issues
- Use `wss://` (WebSocket Secure) in production
- Frontend must use environment variables:
  ```javascript
  const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
  ws = new WebSocket(WS_URL);
  ```

### Render Free Plan Auto-Sleep
- Free Render services auto-pause after 15 minutes of inactivity
- To prevent: Upgrade to Starter Plan ($7/mo) or keep a monitoring service
- Add a cron job to ping `/api/health` every 10 minutes

### MongoDB Atlas
- Ensure IP whitelist includes Render's outgoing IPs
- Use connection pooling for production
- Monitor Atlas dashboard for connection limits

### Vercel Deployment
- Automatic deploys on push to `main` (configurable)
- All commits trigger new builds
- Rollback available from Deployment History
- Live preview URL available for each PR

---

## Deployment Checklist

### Backend (Render)
- [ ] MongoDB Atlas cluster created and credentials saved
- [ ] Render service created with correct Start Command
- [ ] Environment variables set (NODE_ENV, MONGODB_URI, CORS_ORIGIN)
- [ ] `/api/health` endpoint responds with 200 OK
- [ ] WebSocket connection works (test in browser console)

### Frontend (Vercel)
- [ ] GitHub repo connected to Vercel
- [ ] Environment variables set (VITE_API_URL, VITE_WS_URL)
- [ ] Build succeeds without errors
- [ ] Website loads and connects to backend
- [ ] WebSocket shows "ALL SYSTEMS LIVE" in status

### Testing
- [ ] Dashboard renders with data
- [ ] Water Potability Intelligence shows disease risk
- [ ] Real-time updates work (3-second refresh)
- [ ] All API endpoints accessible from frontend
- [ ] No CORS errors in console

---

## Troubleshooting

### CORS Errors
```
Access to XMLHttpRequest at 'https://...' from origin 'https://...'
```
**Fix**: Update `CORS_ORIGIN` in Render environment variables

### WebSocket Connection Failed
```
WebSocket is closed before the connection is established
```
**Fix**: 
1. Check `VITE_WS_URL` in Vercel environment
2. Ensure `wss://` protocol is used
3. Verify backend is running on Render

### Build Failed on Vercel
```
npm run build failed
```
**Fix**:
1. Check build logs in Render UI
2. Ensure `frontend/package.json` has all dependencies
3. Run `npm install` locally to verify

### Render Service Crashes
1. Check Render logs: Service → Logs
2. Look for error messages
3. Common issues: MongoDB not accessible, missing env vars

---

## Local Development

### Setup
```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with local MongoDB
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Environment Files (Local)
**backend/.env**:
```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/aquasync
CORS_ORIGIN=http://localhost:5173
THINGSPEAK_ENABLED=false
```

**frontend/.env.local**:
```
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

---

## Monitoring in Production

### Render Dashboard
- Real-time logs under Service → Logs
- CPU/memory usage under Service → Metrics
- Recent deploys under Service → Deploys

### Vercel Dashboard
- Build history under Deployments
- Function performance under Analytics
- Environment variable audit log

### Health Checks
```bash
# Monitor backend health
watch -n 10 'curl -s https://aquasync-backend.onrender.com/api/health | jq'
```

---

## Rollback Procedure

### Frontend (Vercel)
1. Go to Vercel Dashboard → Deployments
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

### Backend (Render)
1. Go to Render Dashboard → Service → Deploys
2. Find previous successful build
3. Click "..." → "Redeploy"

---

## Next Steps

1. **Set up monitoring**: Uptime Robot, Better Uptime, or Vercel Analytics
2. **Configure CI/CD**: Add pre-deployment tests
3. **Enable logging**: Sentry, LogRocket for error tracking
4. **Scale database**: Upgrade MongoDB tier if needed
5. **Custom domain**: Point your domain to Vercel and update CORS

---

## Support

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com
- **Express + WebSocket**: https://expressjs.com, https://github.com/websockets/ws

---

**Last Updated**: March 29, 2026
**Status**: Production Ready
