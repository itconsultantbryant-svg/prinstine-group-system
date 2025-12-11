# 🚂 Railway Deployment Guide - Step by Step

## Prerequisites
- GitHub account with your repository pushed
- Railway account (sign up at [railway.app](https://railway.app))

---

## Step 1: Prepare Your Repository

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

---

## Step 2: Sign Up / Login to Railway

1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"** or **"Login"**
3. Sign up with GitHub (recommended) - this connects your GitHub account

---

## Step 3: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository: `samsonbryant/prinstine-management-system`
4. Railway will create a new project

---

## Step 4: Deploy Backend Service

### 4.1 Configure Backend Service

Railway will auto-detect your project. You need to configure it:

1. Click on the service that was created
2. Go to **"Settings"** tab
3. Configure the following:

**Root Directory:**
```
server
```

**Build Command:**
```
npm install
```

**Start Command:**
```
npm start
```

### 4.2 Add Environment Variables

Go to **"Variables"** tab and add these:

```env
NODE_ENV=production
PORT=3006
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-this-in-production
JWT_EXPIRES_IN=24h
DB_PATH=/app/database/pms.db
FRONTEND_URL=https://your-frontend-url.up.railway.app
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@prinstine.com
ENCRYPTION_KEY=your-32-character-encryption-key-here-change-this
```

**Important Notes:**
- Replace `JWT_SECRET` with a long random string (minimum 32 characters)
- Replace `ENCRYPTION_KEY` with a 32-character random string
- Replace `EMAIL_USER` and `EMAIL_PASS` with your email credentials
- `FRONTEND_URL` will be updated after frontend deployment

### 4.3 Get Backend URL

1. Go to **"Settings"** tab
2. Scroll to **"Domains"** section
3. Click **"Generate Domain"** (or use the default one)
4. Copy the URL (e.g., `https://prinstine-backend-production.up.railway.app`)
5. This is your backend URL - save it!

---

## Step 5: Deploy Frontend Service

### 5.1 Add New Service

1. In your Railway project, click **"+ New"**
2. Select **"GitHub Repo"**
3. Choose the same repository: `samsonbryant/prinstine-management-system`

### 5.2 Configure Frontend Service

Go to **"Settings"** tab:

**Root Directory:**
```
client
```

**Build Command:**
```
npm install && npm run build
```

**Start Command:**
```
npx serve -s build -l 3000
```

**OR use this alternative (if serve doesn't work):**
```
npm install -g serve && serve -s build -l 3000
```

### 5.3 Add Frontend Environment Variables

Go to **"Variables"** tab and add:

```env
REACT_APP_API_URL=https://your-backend-url.up.railway.app/api
```

**Replace `your-backend-url` with the actual backend URL from Step 4.3**

### 5.4 Get Frontend URL

1. Go to **"Settings"** tab
2. Scroll to **"Domains"** section
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `https://prinstine-frontend-production.up.railway.app`)

### 5.5 Update Backend CORS

Go back to your **Backend Service** → **"Variables"** tab:

Update `FRONTEND_URL`:
```env
FRONTEND_URL=https://your-frontend-url.up.railway.app
```

Replace with your actual frontend URL from Step 5.4.

---

## Step 6: Install Serve Package (For Frontend)

The frontend needs a package to serve the built files. Update `client/package.json`:

Add to `dependencies`:
```json
"serve": "^14.2.1"
```

Or Railway will install it automatically with the start command.

---

## Step 7: Verify Deployment

### 7.1 Check Backend

1. Go to backend service → **"Deployments"** tab
2. Wait for deployment to complete (green checkmark)
3. Click on the deployment to see logs
4. You should see: `Server running on port 3006`

### 7.2 Test Backend API

Open in browser or use curl:
```
https://your-backend-url.up.railway.app/api/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### 7.3 Check Frontend

1. Go to frontend service → **"Deployments"** tab
2. Wait for deployment to complete
3. Open the frontend URL in browser
4. You should see the login page

### 7.4 Test Login

- Email: `admin@prinstine.com`
- Password: `Admin@123`

---

## Step 8: Database Setup

Railway provides persistent storage, so your SQLite database will persist.

The database will be automatically created when the backend starts for the first time.

**Database Location:**
- The database file will be at: `/app/database/pms.db`
- Railway's persistent storage keeps this file across deployments

---

## Step 9: File Uploads Setup

### Option 1: Use Railway's Persistent Storage (Current Setup)

The `uploads/` folder will persist on Railway. Make sure the path is correct:

In your backend, files are saved to:
```
/uploads/
```

This works with Railway's persistent storage.

### Option 2: Use Cloud Storage (Recommended for Production)

For better reliability, consider using:
- **AWS S3**
- **Cloudinary** (for images)
- **DigitalOcean Spaces**

---

## Step 10: Custom Domain (Optional)

### For Backend:
1. Go to backend service → **"Settings"** → **"Domains"**
2. Click **"Custom Domain"**
3. Add your domain (e.g., `api.prinstinegroup.org`)
4. Follow DNS configuration instructions

### For Frontend:
1. Go to frontend service → **"Settings"** → **"Domains"**
2. Click **"Custom Domain"**
3. Add your domain (e.g., `app.prinstinegroup.org`)
4. Follow DNS configuration instructions

---

## Troubleshooting

### Backend Won't Start

**Check logs:**
1. Go to backend service → **"Deployments"** tab
2. Click on the latest deployment
3. Check for errors

**Common issues:**
- Missing environment variables
- Wrong root directory (should be `server`)
- Port conflict (Railway sets PORT automatically, use `process.env.PORT`)

### Frontend Shows Blank Page

**Check:**
1. Frontend build completed successfully
2. `REACT_APP_API_URL` is set correctly
3. Backend is accessible
4. Check browser console for errors

### Database Not Working

**Verify:**
1. Database path is correct: `/app/database/pms.db`
2. Railway has persistent storage enabled (it does by default)
3. Check backend logs for database connection errors

### CORS Errors

**Fix:**
1. Update `FRONTEND_URL` in backend environment variables
2. Make sure it matches your actual frontend URL
3. Include `https://` in the URL

### Socket.IO Not Working

**Check:**
1. Railway supports WebSockets by default
2. Make sure Socket.IO is configured correctly
3. Check that both frontend and backend URLs use `https://`

---

## Railway Pricing

**Free Tier:**
- $5 credit per month
- Perfect for testing and small projects

**Hobby Plan:**
- $5/month per service
- More resources
- Better performance

**For your setup:**
- Backend: $5/month
- Frontend: $5/month
- **Total: $10/month** (or use free tier if within limits)

---

## Environment Variables Checklist

### Backend Variables:
- [ ] `NODE_ENV=production`
- [ ] `PORT=3006` (or use Railway's auto PORT)
- [ ] `JWT_SECRET` (32+ characters, random)
- [ ] `JWT_EXPIRES_IN=24h`
- [ ] `DB_PATH=/app/database/pms.db`
- [ ] `FRONTEND_URL` (your frontend Railway URL)
- [ ] `EMAIL_HOST`
- [ ] `EMAIL_PORT`
- [ ] `EMAIL_USER`
- [ ] `EMAIL_PASS`
- [ ] `EMAIL_FROM`
- [ ] `ENCRYPTION_KEY` (32 characters)

### Frontend Variables:
- [ ] `REACT_APP_API_URL` (your backend Railway URL + `/api`)

---

## Quick Reference Commands

### Update Environment Variables:
1. Go to service → **"Variables"** tab
2. Click **"+ New Variable"**
3. Add variable and value
4. Service will automatically redeploy

### View Logs:
1. Go to service → **"Deployments"** tab
2. Click on deployment
3. View real-time logs

### Redeploy:
1. Go to service → **"Deployments"** tab
2. Click **"Redeploy"** on latest deployment

### Connect Custom Domain:
1. Go to service → **"Settings"** → **"Domains"**
2. Click **"Custom Domain"**
3. Follow DNS setup instructions

---

## Post-Deployment Checklist

- [ ] Backend is running (check health endpoint)
- [ ] Frontend is accessible
- [ ] Can login with admin credentials
- [ ] Database is created (check logs)
- [ ] File uploads work
- [ ] Real-time features work (Socket.IO)
- [ ] Environment variables are set correctly
- [ ] CORS is configured properly
- [ ] HTTPS is working (Railway provides this automatically)

---

## Need Help?

1. Check Railway logs for errors
2. Verify all environment variables are set
3. Test API endpoints directly
4. Check Railway documentation: [docs.railway.app](https://docs.railway.app)

---

**Your system should now be live on Railway! 🚀**

