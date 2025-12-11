# 🚀 Deployment Guide - Prinstine Management System

## Best Platform Recommendations

### 🥇 **Option 1: Render (RECOMMENDED - Best Balance)**

**Why Render:**
- ✅ Free tier available
- ✅ Automatic Git deployment
- ✅ Supports both frontend and backend
- ✅ Built-in PostgreSQL database (better than SQLite for production)
- ✅ Persistent file storage
- ✅ Easy SSL/HTTPS setup
- ✅ Environment variables management
- ✅ Great for Node.js apps

**Pricing:** Free tier available, then $7/month for web service + $7/month for database

**Deployment Steps:**
1. Go to [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a **Web Service** for backend:
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
   - Environment: Node
   - Add environment variables (see below)
4. Create a **PostgreSQL Database** (free tier available)
5. Create a **Static Site** for frontend:
   - Build Command: `cd client && npm install && npm run build`
   - Publish Directory: `client/build`

---

### 🥈 **Option 2: Railway (Easiest Setup)**

**Why Railway:**
- ✅ Very easy setup
- ✅ Automatic Git deployment
- ✅ Supports SQLite (your current database)
- ✅ Persistent storage
- ✅ One-click deploy
- ✅ Free $5 credit monthly

**Pricing:** $5/month after free credit

**Deployment Steps:**
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway auto-detects Node.js
5. Set environment variables
6. Deploy!

---

### 🥉 **Option 3: DigitalOcean App Platform**

**Why DigitalOcean:**
- ✅ Reliable and scalable
- ✅ Good documentation
- ✅ Supports PostgreSQL
- ✅ Managed databases
- ✅ CDN for static files

**Pricing:** $5/month for basic app + $15/month for database

---

### 🎯 **Option 4: Vercel (Frontend) + Railway/Render (Backend)**

**Why This Combo:**
- ✅ Vercel is best-in-class for React apps
- ✅ Free tier for frontend
- ✅ Automatic deployments
- ✅ Global CDN
- ✅ Backend on Railway/Render

**Pricing:** Free for frontend, $5-7/month for backend

---

## Required Environment Variables

Create these in your hosting platform's environment variables section:

### Backend Environment Variables:
```env
NODE_ENV=production
PORT=3006
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long-change-this
JWT_EXPIRES_IN=24h
DB_PATH=/path/to/database/pms.db
FRONTEND_URL=https://your-frontend-url.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@prinstine.com
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

### Frontend Environment Variables:
```env
REACT_APP_API_URL=https://your-backend-url.com/api
```

---

## Database Considerations

### Option A: Keep SQLite (Simpler)
- ✅ Works on Railway, Render, Fly.io
- ✅ No additional database service needed
- ⚠️ Limited scalability
- ⚠️ Not ideal for high-traffic production

### Option B: Migrate to PostgreSQL (Recommended for Production)
- ✅ Better for production
- ✅ More scalable
- ✅ Better concurrent access
- ✅ Available on Render, DigitalOcean, Railway
- ⚠️ Requires migration script

**If using PostgreSQL, you'll need to:**
1. Install `pg` package: `npm install pg`
2. Update database connection in `server/config/database.js`
3. Run migrations on PostgreSQL instead of SQLite

---

## File Storage Options

### Option 1: Local Storage (Current)
- Files stored in `uploads/` folder
- Works on platforms with persistent storage (Railway, Render)
- ⚠️ Files lost if server restarts (on some platforms)

### Option 2: Cloud Storage (Recommended)
- **AWS S3** - Most popular
- **Cloudinary** - Great for images
- **DigitalOcean Spaces** - S3-compatible, cheaper
- **Backblaze B2** - Very affordable

**Benefits:**
- ✅ Files persist across deployments
- ✅ Better performance
- ✅ Scalable
- ✅ CDN support

---

## Step-by-Step: Deploy to Render (Recommended)

### 1. Prepare Your Repository
```bash
# Make sure everything is committed
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Create Backend Service on Render
1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name:** prinstine-backend
   - **Environment:** Node
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Plan:** Free (or paid for better performance)

### 3. Add Environment Variables
In Render dashboard, add all environment variables listed above.

### 4. Create PostgreSQL Database (Optional but Recommended)
1. Click "New" → "PostgreSQL"
2. Choose free tier
3. Copy the connection string
4. Update your database config to use PostgreSQL

### 5. Create Frontend Static Site
1. Click "New" → "Static Site"
2. Connect same GitHub repository
3. Configure:
   - **Build Command:** `cd client && npm install && npm run build`
   - **Publish Directory:** `client/build`
   - **Environment Variables:**
     - `REACT_APP_API_URL=https://your-backend-url.onrender.com/api`

### 6. Update CORS Settings
In your backend `.env` or environment variables:
```
FRONTEND_URL=https://your-frontend-url.onrender.com
```

---

## Step-by-Step: Deploy to Railway (Easiest)

### 1. Deploy Backend
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway auto-detects it's a Node.js app
5. Set root directory to `server`
6. Add environment variables
7. Deploy!

### 2. Deploy Frontend
1. Add another service in same project
2. Set root directory to `client`
3. Set build command: `npm install && npm run build`
4. Set start command: `npx serve -s build`
5. Add environment variable: `REACT_APP_API_URL`

---

## Important Notes

### 1. Database Paths
For production, use absolute paths or environment-specific paths:
```env
DB_PATH=/app/database/pms.db  # For Render/Railway
```

### 2. File Uploads
- Make sure `uploads/` folder has write permissions
- Consider using cloud storage for production

### 3. Socket.IO
- Works on all recommended platforms
- Make sure WebSocket support is enabled

### 4. HTTPS
- All recommended platforms provide free SSL certificates
- Make sure `FRONTEND_URL` uses `https://`

### 5. Build Process
- Frontend needs to be built: `cd client && npm run build`
- Backend runs directly: `cd server && npm start`

---

## Quick Comparison

| Platform | Ease | Cost | SQLite | PostgreSQL | Best For |
|----------|------|------|--------|------------|----------|
| **Render** | ⭐⭐⭐⭐ | $7-14/mo | ✅ | ✅ | Best overall |
| **Railway** | ⭐⭐⭐⭐⭐ | $5/mo | ✅ | ✅ | Easiest setup |
| **DigitalOcean** | ⭐⭐⭐ | $20/mo | ❌ | ✅ | Enterprise |
| **Vercel+Render** | ⭐⭐⭐⭐ | $7/mo | ❌ | ✅ | Best performance |

---

## Recommended Setup for Production

**Best Choice: Render**
- Backend: Web Service ($7/month)
- Database: PostgreSQL ($7/month) - or use SQLite for free
- Frontend: Static Site (Free)
- **Total: $7-14/month**

**Alternative: Railway**
- Backend + Frontend: $5/month
- Database: Included (SQLite) or add PostgreSQL
- **Total: $5/month**

---

## Need Help?

1. Check platform-specific documentation
2. Review error logs in platform dashboard
3. Test locally first: `npm run build` and `npm start`
4. Verify environment variables are set correctly

---

**Ready to deploy? Start with Render or Railway - both are excellent choices!** 🚀

