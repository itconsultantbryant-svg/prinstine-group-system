# How to Create PostgreSQL Database on Render

## Step-by-Step Guide

### Step 1: Go to Render Dashboard
1. Open your browser and go to: **https://dashboard.render.com**
2. Log in to your Render account

### Step 2: Create New PostgreSQL Database
1. Click the **"New +"** button in the top right corner
2. From the dropdown menu, select **"PostgreSQL"**

### Step 3: Configure the Database
Fill in the following details:

- **Name**: `prinstine-db` (or any name you prefer)
- **Database**: `prinstine_db` (or any database name)
- **User**: Leave as default (auto-generated) or choose your own
- **Region**: 
  - Choose the **same region** as your backend service
  - If your backend is in `Oregon`, choose `Oregon`
  - If your backend is in `Ohio`, choose `Ohio`
  - **Important**: Both services should be in the same region for best performance
- **PostgreSQL Version**: 
  - Choose **15** or **16** (latest stable)
- **Plan**: 
  - Select **"Free"** (512 MB RAM, shared CPU)
  - This is perfect for development and small applications

### Step 4: Create the Database
1. Click the **"Create Database"** button at the bottom
2. Wait for provisioning (usually takes 1-2 minutes)
3. You'll see a loading spinner, then it will show "Available" when ready

### Step 5: Get the Connection String
Once the database is created:

1. **Click on your PostgreSQL database** in the dashboard
2. Look for the **"Connections"** section or **"Info"** tab
3. Find **"Internal Database URL"** (NOT External Database URL)
4. It will look like:
   ```
   postgresql://prinstine_user:password123@dpg-abc123def456-a.oregon-postgres.render.com:5432/prinstine_db
   ```
5. **Click the "Copy" button** or manually copy the entire URL

### Step 6: Add to Backend Service
1. Go to your **Backend Web Service** on Render
2. Click on the service name
3. Go to the **"Environment"** tab
4. Click **"Add Environment Variable"**
5. Add:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL you copied
6. Click **"Save Changes"**
7. The service will automatically redeploy

### Step 7: Verify Connection
1. Go to your Backend service **"Logs"** tab
2. Look for:
   - `✓ Connected to PostgreSQL database`
   - `✓ Database time: [timestamp]`
3. If you see errors, check the troubleshooting section below

---

## Troubleshooting

### Can't Find "PostgreSQL" Option?
- Make sure you're logged in
- Try refreshing the page
- Check if you're on the correct dashboard (not a team/organization view)

### Database Creation Fails?
- Check your Render account limits
- Free tier allows 1 PostgreSQL database
- If you already have one, you may need to delete it first or upgrade

### Connection Still Fails?
1. **Verify you used Internal URL** (not External)
2. **Check both services are in same region**
3. **Verify database status is "Available"** (green)
4. **Check backend logs** for specific error messages

### Alternative: Use External PostgreSQL Service
If you can't create PostgreSQL on Render, you can use:
- **Supabase** (free tier): https://supabase.com
- **Railway** (free tier): https://railway.app
- **Neon** (free tier): https://neon.tech

See `DATABASE_MIGRATION_GUIDE.md` for instructions on using external services.

---

## Visual Guide

```
Render Dashboard
├── Click "New +" (top right)
│   └── Select "PostgreSQL"
│       ├── Name: prinstine-db
│       ├── Database: prinstine_db
│       ├── Region: [Same as backend]
│       ├── Version: 15 or 16
│       └── Plan: Free
│           └── Click "Create Database"
│
└── After Creation:
    ├── Click on database name
    ├── Find "Internal Database URL"
    ├── Copy the URL
    └── Add to Backend Service:
        ├── Environment tab
        ├── Add: DATABASE_URL = [paste URL]
        └── Save Changes
```

---

## Quick Checklist

- [ ] Created PostgreSQL database on Render
- [ ] Copied Internal Database URL (not External)
- [ ] Added DATABASE_URL to backend environment variables
- [ ] Both services in same region
- [ ] Backend service redeployed
- [ ] Checked logs for successful connection

---

## Need Help?

If you're still having issues:
1. Check Render's documentation: https://render.com/docs/databases
2. Verify your account has database creation permissions
3. Try creating the database in a different region
4. Contact Render support if database creation option is missing

