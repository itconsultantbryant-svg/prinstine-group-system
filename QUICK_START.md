# 🚀 QUICK START - Fix "Cannot Connect to Server" Error

## The Problem
You're seeing: `ERR_CONNECTION_REFUSED` or `Cannot connect to server`

**This means the backend server is NOT running.**

## ✅ Solution: Start the Backend Server

### Step 1: Open a NEW Terminal Window

**Important:** Keep this terminal window open - don't close it!

### Step 2: Navigate to Server Directory
```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system/server
```

### Step 3: Start the Server
```bash
npm run dev
```

### Step 4: Wait for This Message
You should see:
```
Connected to SQLite database
SQLite database
Database schema initialized
Seed data loaded
✓ Admin user created successfully: admin@prinstine.com
Server running on port 5000
```

### Step 5: Keep the terminal window should show the server running. **DO NOT CLOSE THIS TERMINAL.**

### Step 6: Try Login Again
Go back to your browser at `http://localhost:3000` and try logging in:
- Email: `admin@prinstine.com`
- Password: `Admin@123`

## 🎯 Alternative: Use the Startup Script

If you prefer, you can use the startup script:

```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system
./start-backend.sh
```

## ⚠️ Important Notes

1. **Keep the server terminal open** - Closing it stops the server
2. **The server must run continuously** - It's not a one-time command
3. **You need TWO terminals:**
   - Terminal 1: Backend server (port 5000)
   - Terminal 2: Frontend (port 3000) - if not already running

## 🔍 Check if Server is Running

In a new terminal, run:
```bash
curl http://localhost:5000/api/dashboard/stats
```

If you get a response (even an error), the server is running.
If you get "Connection refused", the server is NOT running.

## 🆘 Still Having Issues?

1. Make sure you're in the correct directory: `server/`
2. Make sure dependencies are installed: `npm install`
3. Check for errors in the server terminal
4. Make sure port 5000 is not used by another application

