# Quick Fix: Backend Server Not Running

## The Problem
Frontend shows: "Cannot connect to server. Please make sure the backend server is running on port 5000."

## Solution: Start the Backend Server

### Option 1: Start Backend Only (Recommended)

Open a **new terminal window** and run:

```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system/server
npm run dev
```

**What you should see:**
```
Connected to SQLite database
Database schema initialized
Seed data loaded
✓ Admin user created successfully: admin@prinstine.com
Server running on port 5000
```

### Option 2: Start Both Backend and Frontend Together

From the project root:

```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system
npm run dev
```

This starts both servers, but you'll see output from both mixed together.

## Verify Server is Running

### Check 1: Health Endpoint
```bash
curl http://localhost:5000/api/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### Check 2: Port Check
```bash
lsof -ti:5000
```

If it returns a number, the server is running.

### Check 3: Browser
Open: `http://localhost:5000/api/health`

Should show JSON response.

## Common Issues

### Port 5000 Already in Use
If port 5000 is taken by another process:

```bash
# Find what's using port 5000
lsof -ti:5000

# Kill it (replace PID with the number from above)
kill -9 PID

# Or kill all node processes (be careful!)
pkill -f node
```

### Server Crashes on Start
1. Check for syntax errors in `server/routes/auth.js` (fixed)
2. Make sure database directory exists:
   ```bash
   mkdir -p database
   ```
3. Check node_modules are installed:
   ```bash
   cd server
   npm install
   ```

### Database Errors
If you see database errors:
1. Delete the database file and let it recreate:
   ```bash
   rm database/pms.db
   ```
2. Restart the server

## Once Server is Running

1. **Backend** should be accessible at: `http://localhost:5000`
2. **Frontend** should be accessible at: `http://localhost:3000`
3. **Login** with:
   - Email: `admin@prinstine.com`
   - Password: `Admin@123`

## Keep Server Running

**Important**: Keep the terminal window with the backend server open. If you close it, the server stops.

To run in background (optional):
```bash
cd server
nohup npm run dev > server.log 2>&1 &
```

Then check logs with:
```bash
tail -f server.log
```

