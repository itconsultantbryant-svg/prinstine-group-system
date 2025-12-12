# Database Migration Guide: SQLite to PostgreSQL

## Problem
On Render's free tier, the filesystem is **ephemeral** - all data is lost when the service restarts or redeploys. SQLite stores data in a file, which gets wiped.

## Solution: PostgreSQL Database

PostgreSQL on Render's free tier provides **persistent storage** that survives restarts and redeploys.

---

## Option 1: PostgreSQL on Render (Recommended - Free Tier)

### Step 1: Create PostgreSQL Database on Render

**If you don't see "PostgreSQL" option:**
- Make sure you're logged in to Render
- Refresh the page
- Check you're on the main dashboard (not a team view)
- Free tier allows 1 PostgreSQL database - if you have one, delete it first or upgrade

**To create the database:**

1. Go to your Render dashboard: https://dashboard.render.com
2. Click **"New +"** button (top right corner)
3. From the dropdown, select **"PostgreSQL"**
   - If you don't see this option, see troubleshooting below
4. Configure:
   - **Name**: `prinstine-db` (or your preferred name)
   - **Database**: `prinstine_db`
   - **User**: Leave as default (auto-generated)
   - **Region**: **IMPORTANT** - Choose the **SAME region** as your backend service
     - If backend is in Oregon, choose Oregon
     - If backend is in Ohio, choose Ohio
   - **PostgreSQL Version**: 15 or 16 (latest stable)
   - **Plan**: **Free** (512 MB RAM, shared CPU)
5. Click **"Create Database"**
6. Wait for it to provision (1-2 minutes)
7. Status will show "Available" when ready

**See `CREATE_POSTGRESQL_ON_RENDER.md` for detailed step-by-step guide with screenshots.**

### Step 2: Get Connection String

After creation, you'll see:
- **Internal Database URL**: `postgresql://user:password@host:5432/database`
- **External Database URL**: (for local development)

**Copy the Internal Database URL** - you'll need it for environment variables.

### Step 3: Add Environment Variable to Backend Service

1. Go to your **Backend Web Service** on Render
2. Click **"Environment"** tab
3. Add new environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL from Step 2
4. Click **"Save Changes"**

### Step 4: Update Backend Code

The code has been updated to support PostgreSQL. The system will automatically:
- Use PostgreSQL if `DATABASE_URL` is set
- Fall back to SQLite if not set (for local development)

---

## Option 2: External PostgreSQL Services (Alternative)

If you prefer external services, these offer free PostgreSQL:

### A. Supabase (Recommended Alternative)
- **Free Tier**: 500 MB database, unlimited projects
- **Setup**: 
  1. Go to https://supabase.com
  2. Create account → New Project
  3. Copy connection string from Settings → Database
  4. Use as `DATABASE_URL` environment variable

### B. Railway
- **Free Tier**: $5 credit/month
- **Setup**: 
  1. Go to https://railway.app
  2. New Project → Add PostgreSQL
  3. Copy connection string from Variables tab

### C. Neon
- **Free Tier**: 3 GB storage
- **Setup**: 
  1. Go to https://neon.tech
  2. Create project
  3. Copy connection string

---

## Migration Steps

### Automatic Migration (Recommended)

The updated code will automatically:
1. Detect PostgreSQL connection
2. Create all tables on first startup
3. Run all migrations automatically

### Manual Migration (If needed)

If you have existing SQLite data:

1. **Export SQLite data**:
   ```bash
   sqlite3 database/pms.db .dump > backup.sql
   ```

2. **Convert SQLite to PostgreSQL**:
   - Use online converter: https://www.rebasedata.com/convert-sqlite-to-postgresql-online
   - Or use `pgloader` tool

3. **Import to PostgreSQL**:
   ```bash
   psql $DATABASE_URL < converted_backup.sql
   ```

---

## File Storage (Uploads)

For file uploads (images, documents), you also need persistent storage:

### Option 1: Cloudinary (Recommended - Free Tier)
- **Free Tier**: 25 GB storage, 25 GB bandwidth/month
- **Setup**:
  1. Sign up at https://cloudinary.com
  2. Get API credentials
  3. Add to environment variables:
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_API_KEY`
     - `CLOUDINARY_API_SECRET`

### Option 2: AWS S3 (Free Tier)
- **Free Tier**: 5 GB storage, 20,000 GET requests/month
- **Setup**: Create S3 bucket, get credentials

### Option 3: Render Static Site (For public files)
- Upload files to a separate static site on Render
- Store file URLs in database

---

## Environment Variables Summary

Add these to your Render backend service:

```env
# Database (Required)
DATABASE_URL=postgresql://user:password@host:5432/database

# File Storage (Optional - for uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Or for S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
AWS_REGION=us-east-1
```

---

## Testing the Migration

After deployment:

1. **Check logs** for: `Connected to PostgreSQL database`
2. **Verify tables created**: Check Render PostgreSQL dashboard → Data tab
3. **Test functionality**: Create a user, add data, restart service
4. **Verify persistence**: Data should remain after restart

---

## Rollback Plan

If you need to rollback to SQLite:
1. Remove `DATABASE_URL` environment variable
2. Redeploy service
3. System will automatically use SQLite

---

## Support

If you encounter issues:
1. Check Render logs for database connection errors
2. Verify `DATABASE_URL` is correct
3. Ensure PostgreSQL service is running
4. Check firewall/network settings

