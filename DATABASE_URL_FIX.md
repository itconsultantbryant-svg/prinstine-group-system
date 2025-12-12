# Fix DATABASE_URL Error: "getaddrinfo ENOTFOUND base"

## Problem
You're seeing this error:
```
PostgreSQL connection error: getaddrinfo ENOTFOUND base
Error code: ENOTFOUND
hostname: 'base'
```

This means your `DATABASE_URL` environment variable is **malformed or incomplete**.

## Solution: Fix Your DATABASE_URL

### Step 1: Get the Correct URL from Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click on your PostgreSQL Database** (not the backend service)
3. **Look for "Connections" section** or scroll down to find connection info
4. **Find "Internal Database URL"** (NOT External Database URL)
5. **Copy the ENTIRE URL** - it should look like:
   ```
   postgresql://prinstine_user:abc123xyz@dpg-abc123def456-a.oregon-postgres.render.com:5432/prinstine_db
   ```

### Step 2: Verify the URL Format

Your `DATABASE_URL` must have ALL these parts:

✅ **Correct Format:**
```
postgresql://[username]:[password]@[hostname]:5432/[database_name]
```

**Example:**
```
postgresql://prinstine_user:mySecurePassword123@dpg-abc123def456-a.oregon-postgres.render.com:5432/prinstine_db
```

### Step 3: Check Each Component

Break down your URL and verify:

1. **Protocol**: Must start with `postgresql://` or `postgres://`
2. **Username**: Should be something like `prinstine_user` or `prinstine_db_user`
3. **Password**: Long random string (don't worry about remembering it)
4. **Hostname**: Should be like `dpg-xxxxx-a.region-postgres.render.com`
   - ❌ NOT an IP address like `2a05:d016:...`
   - ❌ NOT just "base" or a short word
   - ✅ Should be a full domain name
5. **Port**: Should be `:5432`
6. **Database**: Should be like `prinstine_db` or similar

### Step 4: Update Environment Variable

1. **Go to your Backend Web Service** on Render
2. **Click "Environment" tab**
3. **Find `DATABASE_URL`** variable
4. **Click to edit it**
5. **Paste the COMPLETE Internal Database URL** you copied
6. **Make sure there are no spaces** before or after
7. **Click "Save Changes"**
8. **Service will auto-redeploy**

### Step 5: Verify After Deployment

Check the logs for:
- ✅ `✓ DATABASE_URL format validated`
- ✅ `✓ Connected to PostgreSQL database`
- ✅ `✓ Database time: [timestamp]`

If you still see errors, check the troubleshooting section below.

---

## Common Mistakes

### ❌ Mistake 1: Incomplete URL
```
postgresql://user:pass@base
```
**Problem**: Missing hostname, port, and database name
**Fix**: Copy the complete URL from Render

### ❌ Mistake 2: Using External URL
```
postgresql://user:pass@[2a05:d016:571:a426:...]:5432/db
```
**Problem**: IPv6 address won't work
**Fix**: Use Internal Database URL (has hostname, not IP)

### ❌ Mistake 3: Truncated URL
```
postgresql://user:pass@dpg-abc123
```
**Problem**: URL was cut off
**Fix**: Copy the entire URL, including `/database_name` at the end

### ❌ Mistake 4: Wrong Variable Name
- Using `POSTGRES_URL` instead of `DATABASE_URL`
- Using `DB_URL` instead of `DATABASE_URL`
**Fix**: Must be exactly `DATABASE_URL`

### ❌ Mistake 5: Extra Spaces or Characters
```
DATABASE_URL = postgresql://...  (has spaces)
```
**Problem**: Spaces break the URL
**Fix**: No spaces before or after the URL

---

## Quick Checklist

Before redeploying, verify:

- [ ] Copied from "Internal Database URL" (not External)
- [ ] URL starts with `postgresql://`
- [ ] URL has a proper hostname (not "base" or IP address)
- [ ] URL includes `:5432` port
- [ ] URL ends with `/database_name`
- [ ] No spaces in the environment variable value
- [ ] Variable name is exactly `DATABASE_URL`
- [ ] Both services (backend and database) are in the same region

---

## Still Having Issues?

### Option 1: Remove DATABASE_URL Temporarily
If you need the system to start immediately:
1. Remove the `DATABASE_URL` environment variable
2. System will use SQLite (data won't persist, but system will work)
3. Fix the URL and add it back later

### Option 2: Use External PostgreSQL Service
If Render PostgreSQL isn't working, try:
- **Supabase**: https://supabase.com (free tier)
- **Railway**: https://railway.app (free tier)
- **Neon**: https://neon.tech (free tier)

See `DATABASE_MIGRATION_GUIDE.md` for instructions.

### Option 3: Check Render Support
- Verify your account has database access
- Check if there are any service limits
- Contact Render support if database creation is failing

---

## Example of Correct DATABASE_URL

```
postgresql://prinstine_db_user:AbC123XyZ456@dpg-abc123def456-a.oregon-postgres.render.com:5432/prinstine_db_abc1
```

Notice:
- ✅ Starts with `postgresql://`
- ✅ Has username and password
- ✅ Has full hostname (not IP, not "base")
- ✅ Has port `:5432`
- ✅ Has database name at the end

