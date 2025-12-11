# How to Start the Server and Fix Login

## Step-by-Step Instructions

### 1. Start the Backend Server

Open a terminal and run:

```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system/server
npm run dev
```

**What to look for:**
- `Connected to SQLite database` ✓
- `Database schema initialized` ✓
- `Seed data loaded` ✓
- `✓ Admin user created successfully: admin@prinstine.com` ✓
- `Server running on port 5000` ✓

### 2. If Admin User Wasn't Created

If you don't see the admin user creation message, run:

```bash
cd server
node scripts/create-admin.js
```

This will create/reset the admin user.

### 3. Start the Frontend (in another terminal)

```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system/client
npm start
```

The browser should open automatically at `http://localhost:3000`

### 4. Login

Use these credentials:
- **Email**: `admin@prinstine.com`
- **Password**: `Admin@123`

## Troubleshooting

### Backend Not Starting?

1. Check if port 5000 is in use:
   ```bash
   lsof -ti:5000
   ```
   If something is running, kill it:
   ```bash
   kill -9 $(lsof -ti:5000)
   ```

2. Check for errors in the console
3. Make sure all dependencies are installed:
   ```bash
   cd server
   npm install
   ```

### Database Not Creating?

1. Check if database directory exists:
   ```bash
   ls -la database/
   ```

2. Check file permissions:
   ```bash
   chmod 755 database/
   ```

### Login Still Failing?

1. Check backend console for login attempt logs
2. Verify admin user exists:
   ```bash
   cd server
   node -e "const db = require('./config/database'); (async () => { await db.connect(); const user = await db.get('SELECT * FROM users WHERE email = ?', ['admin@prinstine.com']); console.log(user ? 'Admin found' : 'Admin NOT found'); await db.close(); })();"
   ```

3. Test login endpoint directly:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@prinstine.com","password":"Admin@123"}'
   ```

## Expected Behavior

When you click "Sign In":
1. Frontend sends request to `http://localhost:5000/api/auth/login`
2. Backend logs: `Login attempt for email: admin@prinstine.com`
3. Backend logs: `User found: { id: 1, email: ..., role: Admin, is_active: 1 }`
4. Backend logs: `Password verification result: true`
5. Backend logs: `Login successful for user: 1`
6. Frontend receives token and user data
7. You're redirected to dashboard

If any step fails, check the console logs for details.

