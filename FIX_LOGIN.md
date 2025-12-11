# Fix Admin Login Issues

## Quick Fix Steps

### Step 1: Ensure Database Directory Exists
```bash
cd /Users/user/Desktop/Prinstine_Group/prinstine-management-system
mkdir -p database
```

### Step 2: Start the Backend Server
The server will automatically create the database and admin user on first start:

```bash
cd server
npm run dev
```

Look for these messages in the console:
- `Connected to SQLite database`
- `Database schema initialized`
- `Seed data loaded`
- `✓ Admin user created successfully: admin@prinstine.com`

### Step 3: If Admin User Doesn't Exist, Create It Manually

Run the admin creation script:

```bash
cd server
node scripts/create-admin.js
```

This will create/reset the admin user with:
- **Email**: `admin@prinstine.com`
- **Password**: `Admin@123`

### Step 4: Verify Login

1. Make sure backend is running on `http://localhost:5000`
2. Open frontend at `http://localhost:3000`
3. Login with:
   - Email: `admin@prinstine.com`
   - Password: `Admin@123`

## Troubleshooting

### Check Backend Logs
When you try to login, check the backend console for:
- `Login attempt for email: admin@prinstine.com`
- `User found: { id: X, email: ..., role: ..., is_active: ... }`
- `Password verification result: true/false`
- `Login successful for user: X`

### Common Issues

1. **Database not created**: Make sure the server started successfully and created `database/pms.db`

2. **Admin user missing**: Run `node server/scripts/create-admin.js`

3. **Password hash mismatch**: The script will regenerate the correct hash

4. **CORS errors**: Make sure backend is running and CORS is configured correctly

5. **Backend not running**: Check if port 5000 is available and server started

## Testing the Login Endpoint Directly

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prinstine.com","password":"Admin@123"}'
```

Expected response:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "admin@prinstine.com",
    "username": "admin",
    "role": "Admin",
    "name": "System Administrator",
    "emailVerified": true
  }
}
```

## Debug Mode

The login route now includes detailed logging. Check the backend console when attempting to login to see:
- Email being searched
- User found/not found
- Password verification result
- Any errors

