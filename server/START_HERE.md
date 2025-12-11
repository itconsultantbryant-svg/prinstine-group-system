# 🚨 START THE SERVER HERE

## To Fix "Cannot Connect to Server" Error:

### Run this command in THIS directory:

```bash
npm run dev
```

### What You Should See:

```
> pms-server@1.0.0 dev
> nodemon server.js

[nodemon] 2.0.22
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js
[nodemon] starting `node server.js`
Connected to SQLite database
Database schema initialized
Seed data loaded
✓ Admin user created successfully: admin@prinstine.com
Server running on port 5000
```

### ⚠️ IMPORTANT:
- **DO NOT CLOSE THIS TERMINAL** - The server must keep running
- Keep this terminal window open while using the application
- To stop the server, press `Ctrl+C` in this terminal

### ✅ Once You See "Server running on port 5000":
1. Go to your browser
2. Navigate to `http://localhost:3000`
3. Login with:
   - Email: `admin@prinstine.com`
   - Password: `Admin@123`

### 🔍 Troubleshooting:

**If you see errors:**
- Make sure you ran `npm install` first
- Check that port 5000 is not already in use
- Look at the error messages in the terminal

**If port 5000 is in use:**
```bash
lsof -ti:5000 | xargs kill -9
npm run dev
```

