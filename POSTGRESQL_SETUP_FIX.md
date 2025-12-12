# PostgreSQL Connection Fix for Render

## Problem
You're getting `ENETUNREACH` or connection errors when trying to connect to PostgreSQL.

## Solution: Use the INTERNAL Database URL

On Render, you **MUST** use the **Internal Database URL**, not the External URL.

### How to Get the Correct URL:

1. **Go to your PostgreSQL database** on Render dashboard
2. **Look for "Internal Database URL"** (NOT External Database URL)
3. **Copy the Internal URL** - it should look like:
   ```
   postgresql://user:password@dpg-xxxxx-a.oregon-postgres.render.com:5432/dbname
   ```
   OR
   ```
   postgresql://user:password@hostname.internal:5432/dbname
   ```

### Common Mistakes:

❌ **WRONG**: Using External Database URL (has IPv6 address like `2a05:d016:...`)
❌ **WRONG**: Using localhost or 127.0.0.1
❌ **WRONG**: Using IP addresses directly

✅ **CORRECT**: Using Internal Database URL with hostname

### Steps to Fix:

1. **Go to Render Dashboard** → Your PostgreSQL Database
2. **Find "Internal Database URL"** in the Info section
3. **Copy the entire URL**
4. **Go to your Backend Web Service** → Environment tab
5. **Update `DATABASE_URL`** with the Internal URL
6. **Save and Redeploy**

### Verify the URL Format:

The Internal URL should:
- ✅ Start with `postgresql://`
- ✅ Have a hostname (not IP address)
- ✅ End with `:5432/database_name`
- ✅ NOT contain IPv6 addresses like `[2a05:...]`
- ✅ NOT say "External" anywhere

### Example Internal URL:
```
postgresql://prinstine_user:abc123xyz@dpg-abc123def456-a.oregon-postgres.render.com:5432/prinstine_db
```

### After Fixing:

1. The backend will automatically reconnect
2. All tables will be created on first startup
3. Data will persist across restarts

### Still Having Issues?

If you still get connection errors:
1. Verify both services are in the **same region**
2. Check that PostgreSQL service is **running** (green status)
3. Verify the `DATABASE_URL` environment variable is set correctly
4. Check backend logs for more detailed error messages

