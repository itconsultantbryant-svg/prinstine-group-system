# 🆓 Render Free Tier Deployment Guide

## ✅ Yes, Your System Can Deploy on Render Free Tier!

Your Prinstine Management System can be deployed on Render's free tier with some considerations.

---

## What's Included in Render Free Tier

### ✅ Free Services Available:
1. **Web Service (Backend)** - Free tier available
2. **Static Site (Frontend)** - Always free, no limits
3. **PostgreSQL Database** - Free tier available (90 days, then $7/month)

### ⚠️ Free Tier Limitations:

**Web Service (Backend):**
- ✅ 750 hours/month free (enough for 24/7 operation)
- ⚠️ **Spins down after 15 minutes of inactivity**
- ⚠️ First request after spin-down takes ~30-50 seconds (cold start)
- ✅ Automatic HTTPS/SSL
- ✅ Environment variables
- ✅ Persistent disk storage (512 MB)

**Static Site (Frontend):**
- ✅ Always free
- ✅ No spin-down
- ✅ Automatic HTTPS/SSL
- ✅ CDN included
- ✅ Unlimited bandwidth

**PostgreSQL Database:**
- ✅ Free for 90 days
- ⚠️ Then $7/month (or use SQLite for free)

---

## Deployment Strategy for Free Tier

### Option 1: Use SQLite (Completely Free Forever)
- ✅ Backend: Free tier web service
- ✅ Frontend: Free static site
- ✅ Database: SQLite (included, no extra cost)
- ⚠️ Backend spins down after 15 min inactivity

### Option 2: Use PostgreSQL (Free for 90 Days)
- ✅ Backend: Free tier web service
- ✅ Frontend: Free static site
- ✅ Database: PostgreSQL free tier (90 days)
- ⚠️ Then $7/month for database
- ⚠️ Backend spins down after 15 min inactivity

---

## Step-by-Step: Deploy to Render Free Tier

### Step 1: Sign Up for Render

1. Go to [render.com](https://render.com)
2. Click **"Get Started for Free"**
3. Sign up with GitHub (recommended)
4. Verify your email

---

### Step 2: Deploy Backend (Web Service)

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `samsonbryant/prinstine-management-system`
3. Configure the service:

**Basic Settings:**
- **Name:** `prinstine-backend`
- **Region:** Choose closest to you
- **Branch:** `main`
- **Root Directory:** `server`
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

**Plan:**
- Select **"Free"** plan

4. Click **"Create Web Service"**

### Step 3: Add Backend Environment Variables

Go to **"Environment"** tab and add:

```env
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-this
JWT_EXPIRES_IN=24h
DB_PATH=/opt/render/project/src/database/pms.db
FRONTEND_URL=https://your-frontend-url.onrender.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@prinstine.com
ENCRYPTION_KEY=your-32-character-encryption-key-here
```

**Important Notes:**
- Render uses port `10000` by default (or check what Render assigns)
- Database path: `/opt/render/project/src/database/pms.db`
- `FRONTEND_URL` will be updated after frontend deployment

### Step 4: Get Backend URL

1. Go to **"Settings"** tab
2. Scroll to **"Custom Domain"** section
3. You'll see: `https://prinstine-backend.onrender.com` (or similar)
4. Copy this URL - this is your backend URL

---

### Step 5: Deploy Frontend (Static Site)

1. Click **"New +"** → **"Static Site"**
2. Connect same GitHub repository
3. Configure:

**Basic Settings:**
- **Name:** `prinstine-frontend`
- **Branch:** `main`
- **Root Directory:** `client`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `build`

**Plan:**
- **"Free"** (always free for static sites)

4. Click **"Create Static Site"**

### Step 6: Add Frontend Environment Variables

Go to **"Environment"** tab and add:

```env
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

Replace `your-backend-url` with your actual backend URL from Step 4.

### Step 7: Get Frontend URL

1. Go to **"Settings"** tab
2. You'll see: `https://prinstine-frontend.onrender.com` (or similar)
3. Copy this URL

### Step 8: Update Backend CORS

Go back to **Backend Service** → **"Environment"** tab:

Update `FRONTEND_URL`:
```env
FRONTEND_URL=https://your-frontend-url.onrender.com
```

Replace with your actual frontend URL.

---

## Important: Database Path for Render

Render's free tier provides persistent disk storage. Use this path:

```env
DB_PATH=/opt/render/project/src/database/pms.db
```

**OR** use the project root relative path:
```env
DB_PATH=./database/pms.db
```

Make sure the `database` folder exists in your `server` directory or create it.

---

## Handling Spin-Down (Free Tier Limitation)

### The Problem:
- Backend spins down after 15 minutes of no requests
- First request after spin-down takes 30-50 seconds

### Solutions:

#### Option 1: Use a Ping Service (Recommended)
Use a free service to ping your backend every 10 minutes:

**Free Ping Services:**
- [UptimeRobot](https://uptimerobot.com) - Free tier: 50 monitors
- [Cron-job.org](https://cron-job.org) - Free tier available
- [Pingdom](https://www.pingdom.com) - Free tier available

**Setup:**
1. Sign up for UptimeRobot (or similar)
2. Add monitor:
   - URL: `https://your-backend-url.onrender.com/api/health`
   - Interval: 5 minutes
3. This keeps your backend "awake"

#### Option 2: Accept the Spin-Down
- First user after inactivity waits 30-50 seconds
- Subsequent requests are fast
- No cost, but slower first load

#### Option 3: Upgrade to Paid ($7/month)
- No spin-down
- Always responsive
- Better performance

---

## File Uploads on Free Tier

### Current Setup (Works on Free Tier):
- Files stored in `uploads/` folder
- Render provides 512 MB persistent disk
- Files persist across deployments

### For Production (Consider Later):
- Use cloud storage (AWS S3, Cloudinary)
- Better for large files
- More reliable

---

## Database Options on Free Tier

### Option A: SQLite (Recommended for Free Tier)
- ✅ Completely free forever
- ✅ No time limits
- ✅ Works with your current code
- ✅ Persistent storage on Render
- ⚠️ Limited to single instance (fine for small-medium apps)

**Setup:**
- Use environment variable: `DB_PATH=/opt/render/project/src/database/pms.db`
- Database auto-creates on first run
- All migrations run automatically

### Option B: PostgreSQL (Free for 90 Days)
1. Click **"New +"** → **"PostgreSQL"**
2. Select **"Free"** plan
3. Copy connection string
4. Update your database config to use PostgreSQL
5. ⚠️ After 90 days: $7/month or migrate to SQLite

---

## Complete Environment Variables Checklist

### Backend Variables:
```env
NODE_ENV=production
PORT=10000
JWT_SECRET=change-this-to-32-plus-random-characters
JWT_EXPIRES_IN=24h
DB_PATH=/opt/render/project/src/database/pms.db
FRONTEND_URL=https://prinstine-frontend.onrender.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@prinstine.com
ENCRYPTION_KEY=change-this-to-32-characters
```

### Frontend Variables:
```env
REACT_APP_API_URL=https://prinstine-backend.onrender.com/api
```

---

## Deployment Steps Summary

1. ✅ Sign up at render.com
2. ✅ Create Web Service (backend) - Free tier
3. ✅ Add backend environment variables
4. ✅ Create Static Site (frontend) - Free
5. ✅ Add frontend environment variable
6. ✅ Update CORS in backend
7. ✅ Set up ping service (optional, to prevent spin-down)
8. ✅ Test deployment

---

## Cost Breakdown

### Free Tier (Current):
- **Backend:** $0/month (with spin-down)
- **Frontend:** $0/month (always free)
- **Database (SQLite):** $0/month (included)
- **Total: $0/month** ✅

### If You Want No Spin-Down:
- **Backend:** $7/month (Starter plan)
- **Frontend:** $0/month (always free)
- **Database (SQLite):** $0/month
- **Total: $7/month**

### If You Want PostgreSQL:
- **Backend:** $0/month (free tier) or $7/month (no spin-down)
- **Frontend:** $0/month
- **Database:** $0/month (90 days), then $7/month
- **Total: $0-14/month**

---

## Testing Your Deployment

### 1. Test Backend Health:
```
https://your-backend-url.onrender.com/api/health
```
Should return: `{"status":"ok","timestamp":"..."}`

### 2. Test Frontend:
- Open frontend URL in browser
- Should see login page

### 3. Test Login:
- Email: `admin@prinstine.com`
- Password: `Admin@123`

### 4. Test Database:
- Create a user or report
- Verify it's saved
- Check backend logs

---

## Troubleshooting Free Tier Issues

### Backend Takes Long to Load

**Problem:** Backend spun down (15 min inactivity)

**Solutions:**
1. Set up ping service (UptimeRobot)
2. Wait 30-50 seconds for first load
3. Upgrade to paid plan ($7/month)

### Database Not Persisting

**Problem:** Database path incorrect

**Fix:**
- Use: `DB_PATH=/opt/render/project/src/database/pms.db`
- Or: `DB_PATH=./database/pms.db`
- Make sure `database` folder exists

### CORS Errors

**Problem:** Frontend URL not set correctly

**Fix:**
- Update `FRONTEND_URL` in backend environment variables
- Use full URL with `https://`
- No trailing slash

### Build Fails

**Problem:** Missing dependencies or build errors

**Fix:**
- Check build logs in Render dashboard
- Verify `package.json` has all dependencies
- Check Node.js version compatibility

---

## Recommended Setup for Free Tier

### Best Configuration:
1. **Backend:** Free tier web service
2. **Frontend:** Free static site
3. **Database:** SQLite (free forever)
4. **Ping Service:** UptimeRobot (free) - keeps backend awake
5. **Total Cost: $0/month** ✅

### If You Need Better Performance:
1. **Backend:** Starter plan ($7/month) - no spin-down
2. **Frontend:** Free static site
3. **Database:** SQLite (free)
4. **Total Cost: $7/month**

---

## Advantages of Render Free Tier

✅ **Completely Free** (with SQLite)  
✅ **Automatic HTTPS/SSL**  
✅ **Easy Git Deployment**  
✅ **Automatic Deploys** on git push  
✅ **Environment Variables** management  
✅ **Persistent Storage** (512 MB)  
✅ **No Credit Card Required** for free tier  

---

## Limitations to Be Aware Of

⚠️ **Backend Spin-Down:** 15 min inactivity = 30-50 sec cold start  
⚠️ **Disk Space:** 512 MB (usually enough)  
⚠️ **No Custom Domains** on free tier (subdomain only)  
⚠️ **Limited Resources:** May be slower than paid plans  

---

## Next Steps

1. ✅ Follow deployment steps above
2. ✅ Set up UptimeRobot ping service (optional)
3. ✅ Test all functionality
4. ✅ Monitor usage and performance
5. ✅ Upgrade to paid if needed ($7/month for no spin-down)

---

## Quick Start Commands

After deployment, your URLs will be:
- **Backend:** `https://prinstine-backend.onrender.com`
- **Frontend:** `https://prinstine-frontend.onrender.com`

**Test Backend:**
```bash
curl https://prinstine-backend.onrender.com/api/health
```

**Test Frontend:**
- Open in browser: `https://prinstine-frontend.onrender.com`
- Login with: `admin@prinstine.com` / `Admin@123`

---

**Your system can absolutely run on Render's free tier! 🎉**

The main consideration is the backend spin-down, which can be solved with a free ping service or by accepting the 30-50 second first load time.

