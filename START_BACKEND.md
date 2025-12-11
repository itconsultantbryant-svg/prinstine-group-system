# How to Start the Backend Server

## Quick Start

### Option 1: Use the Startup Script (Easiest)

```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system
./start-backend.sh
```

### Option 2: Manual Start

```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system/server
npm run dev
```

## What You Should See

When the server starts successfully, you'll see:

```
Email configuration not found. Email features will be disabled.
Created database directory: /path/to/database
Connected to SQLite database: /path/to/database/pms.db
Database schema initialized
Seed data loaded
✓ Admin user created successfully: admin@prinstine.com
Server running on port 5000
Environment: development
```

## Verify Server is Running

Open a new terminal and run:

```bash
curl http://localhost:5000/api/health
```

You should see:
```json
{"status":"ok","timestamp":"2024-..."}
```

Or open in your browser: `http://localhost:5000/api/health`

## Once Server is Running

1. ✅ Backend is accessible at: `http://localhost:5000`
2. ✅ Frontend can now connect (refresh your browser)
3. ✅ Login with:
   - **Email**: `admin@prinstine.com`
   - **Password**: `Admin@123`

## Important Notes

- **Keep the terminal window open** - Closing it stops the server
- The server must be running for the frontend to work
- If you see errors, check the console output

## Troubleshooting

### Port 5000 Already in Use
```bash
# Find what's using port 5000
lsof -ti:5000

# Kill it
kill -9 $(lsof -ti:5000)
```

### Database Errors
The script automatically creates the database directory. If you still see errors:
```bash
mkdir -p database
chmod 755 database
```

### Dependencies Not Installed
```bash
cd server
npm install
```

## Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

