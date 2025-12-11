# 🎨 Frontend Deployment Setup Guide

## Quick Setup for Render Static Site

### Step 1: Deploy Frontend on Render

1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Static Site"**
3. Connect your GitHub repository
4. Configure:

**Settings:**
- **Name:** `prinstine-frontend` (or your preferred name)
- **Branch:** `main`
- **Root Directory:** `client`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `build`

**Plan:** Free (always free for static sites)

### Step 2: Add Environment Variable

Go to **"Environment"** tab and add:

```env
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

**Important:**
- Replace `your-backend-url` with your actual backend URL
- Example: If backend is `https://prinstine-backend.onrender.com`, then:
  ```
  REACT_APP_API_URL=https://prinstine-backend.onrender.com/api
  ```
- Make sure to include `/api` at the end
- Use `https://` (not `http://`)

### Step 3: Get Your Backend URL

1. Go to your **Backend Service** on Render
2. Go to **"Settings"** tab
3. Find your service URL (e.g., `https://prinstine-backend.onrender.com`)
4. Copy this URL

### Step 4: Update Frontend Environment Variable

1. Go to **Frontend Service** → **"Environment"** tab
2. Update `REACT_APP_API_URL` with your backend URL + `/api`
3. Save changes
4. Render will automatically redeploy

### Step 5: Update Backend CORS

1. Go to **Backend Service** → **"Environment"** tab
2. Update `FRONTEND_URL` with your frontend URL:
   ```env
   FRONTEND_URL=https://your-frontend-url.onrender.com
   ```
3. Save changes
4. Backend will automatically redeploy

---

## Testing the Connection

### 1. Test Backend API

Open in browser:
```
https://your-backend-url.onrender.com/api/health
```

Should return:
```json
{"status":"ok","timestamp":"2024-..."}
```

### 2. Test Frontend

1. Open your frontend URL in browser
2. Should see the login page
3. Open browser console (F12)
4. Check for any CORS or connection errors

### 3. Test Login

- Email: `admin@prinstine.com`
- Password: `Admin@123`

If login fails, check:
- Browser console for errors
- Network tab to see API requests
- Backend logs on Render

---

## Common Issues & Fixes

### Issue: CORS Error

**Error:** `Access to XMLHttpRequest has been blocked by CORS policy`

**Fix:**
1. Make sure `FRONTEND_URL` in backend matches your frontend URL exactly
2. Include `https://` in the URL
3. No trailing slash
4. Redeploy backend after updating

### Issue: API Connection Failed

**Error:** `Network Error` or `Failed to fetch`

**Fix:**
1. Check `REACT_APP_API_URL` is set correctly
2. Make sure backend is running (check Render dashboard)
3. Test backend health endpoint directly
4. Check backend logs for errors

### Issue: 404 on API Calls

**Error:** `404 Not Found` on API requests

**Fix:**
1. Make sure `REACT_APP_API_URL` ends with `/api`
2. Example: `https://backend.onrender.com/api` ✅
3. NOT: `https://backend.onrender.com` ❌

### Issue: Socket.IO Not Connecting

**Error:** WebSocket connection failed

**Fix:**
1. Socket.IO automatically uses the API URL
2. Make sure backend supports WebSockets (it does)
3. Check backend logs for Socket.IO errors

---

## Environment Variables Checklist

### Backend Variables:
```env
NODE_ENV=production
PORT=10000
JWT_SECRET=your-secret-key
DB_PATH=/opt/render/project/src/database/pms.db
FRONTEND_URL=https://your-frontend-url.onrender.com
# ... other variables
```

### Frontend Variables:
```env
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

---

## URL Format Examples

### Correct Format:
```
Backend: https://prinstine-backend.onrender.com
Frontend: https://prinstine-frontend.onrender.com

REACT_APP_API_URL=https://prinstine-backend.onrender.com/api
FRONTEND_URL=https://prinstine-frontend.onrender.com
```

### Wrong Format:
```
REACT_APP_API_URL=https://prinstine-backend.onrender.com  ❌ (missing /api)
REACT_APP_API_URL=http://prinstine-backend.onrender.com/api  ❌ (http instead of https)
REACT_APP_API_URL=https://prinstine-backend.onrender.com/api/  ❌ (trailing slash)
```

---

## After Deployment

1. ✅ Test backend health endpoint
2. ✅ Test frontend loads
3. ✅ Test login functionality
4. ✅ Check browser console for errors
5. ✅ Verify API calls are working
6. ✅ Test real-time features (notifications)

---

## Quick Reference

**Backend URL Format:**
```
https://[service-name].onrender.com
```

**Frontend API URL:**
```
https://[backend-service-name].onrender.com/api
```

**Backend CORS URL:**
```
https://[frontend-service-name].onrender.com
```

---

**Your frontend should now connect to your backend! 🚀**

