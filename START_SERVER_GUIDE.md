# How to Start the Backend Server

## Quick Start

### Option 1: Using the Startup Script (Recommended)
```bash
./start-backend.sh
```

### Option 2: Manual Start
```bash
cd server
npm run dev
```

### Option 3: Start Both Frontend and Backend Together
```bash
npm run dev
```

## Verify Server is Running

After starting the server, you should see:
```
Connected to SQLite database
Server running on port 5000
```

## Troubleshooting

### Port 5000 Already in Use
If you get an error that port 5000 is already in use:

**On macOS/Linux:**
```bash
# Find and kill the process
lsof -ti:5000 | xargs kill -9
```

**On Windows:**
```bash
# Find the process
netstat -ano | findstr :5000
# Kill it (replace PID with the actual process ID)
taskkill /PID <PID> /F
```

### Server Won't Start
1. Check if Node.js is installed:
   ```bash
   node --version
   ```
   Should be v16 or higher.

2. Install dependencies:
   ```bash
   cd server
   npm install
   ```

3. Check for errors in the console output

### Database Issues
The database will be automatically created in `database/pms.db` when the server starts for the first time.

### Default Admin Credentials
- **Email:** `admin@prinstine.com`
- **Password:** `Admin@123`

⚠️ **Important:** Change the default password after first login!

## Environment Variables

The server uses a `.env` file in the `server/` directory. If it doesn't exist, it will be created automatically with default values.

Key variables:
- `PORT` - Server port (default: 5000)
- `JWT_SECRET` - Secret key for JWT tokens
- `DB_PATH` - Path to SQLite database
- `FRONTEND_URL` - Frontend URL for CORS

## Next Steps

1. Start the backend server (this file)
2. Start the frontend (in another terminal):
   ```bash
   cd client
   npm start
   ```
3. Open browser to `http://localhost:3000`
4. Login with admin credentials

