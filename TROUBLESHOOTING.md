# Troubleshooting Guide

## Backend Server Not Starting

### Issue: "Cannot connect to server. Please make sure the backend server is running on port 5000."

### Solution Steps:

#### 1. Check if Server is Running
```bash
# Check if port 5000 is in use
lsof -ti:5000

# Or check for node processes
ps aux | grep node
```

#### 2. Start the Backend Server

**Option A: Using the startup script**
```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system
./start-backend.sh
```

**Option B: Manual start**
```bash
cd server
npm run dev
```

**Option C: Start both frontend and backend**
```bash
npm run dev
```

#### 3. Verify Server Started Successfully

You should see output like:
```
Connected to SQLite database
Database already initialized
Server running on port 5000
```

#### 4. Test Server Connection
```bash
# Test if server responds
curl http://localhost:5000/api/dashboard/stats
```

If you get a response (even an error), the server is running.

### Common Issues

#### Port 5000 Already in Use
```bash
# Kill the process using port 5000
lsof -ti:5000 | xargs kill -9

# Then restart the server
cd server && npm run dev
```

#### Missing Dependencies
```bash
cd server
npm install
```

#### Missing .env File
The server will work without .env, but for production you should create one:
```bash
cd server
cat > .env << EOF
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key-here-min-32-chars
JWT_EXPIRES_IN=24h
DB_PATH=../database/pms.db
FRONTEND_URL=http://localhost:3000
EOF
```

#### Database Issues
The database is automatically created on first run. If you have issues:
```bash
# Remove old database (backup first!)
rm database/pms.db

# Restart server - it will recreate the database
cd server && npm run dev
```

### Admin Login Credentials

**Default Admin:**
- Email: `admin@prinstine.com`
- Password: `Admin@123`

If admin login fails:
1. Make sure backend server is running
2. Check browser console for errors
3. Verify database exists and has admin user
4. Try creating admin manually:
   ```bash
   cd server
   node scripts/create-admin.js
   ```

### Still Having Issues?

1. Check server logs in the terminal where you started it
2. Check browser console (F12) for frontend errors
3. Verify both frontend (port 3000) and backend (port 5000) are running
4. Make sure you're accessing `http://localhost:3000` (not 5000)

