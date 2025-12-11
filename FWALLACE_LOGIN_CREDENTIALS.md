# Login Credentials for fwallace@prinstinegroup.org

## ✅ User Setup Complete

The user account has been created/updated in the database and is ready for login.

## Login Credentials

- **Email**: `fwallace@prinstinegroup.org`
- **Password**: `User@123`
- **Role**: DepartmentHead
- **Name**: Francess Wallace
- **User ID**: 18
- **Status**: Active ✅
- **Email Verified**: Yes ✅

## ✅ Password Verification Test

The password has been verified successfully in the database. The account is ready to use.

## Testing the Login

### Option 1: Via Web Interface (Recommended)
1. Start the server:
   ```bash
   cd server
   npm start
   ```

2. Start the frontend (in a new terminal):
   ```bash
   cd client
   npm start
   ```

3. Open your browser and navigate to: `http://localhost:3000`
4. Enter the credentials:
   - Email: `fwallace@prinstinegroup.org`
   - Password: `User@123`

### Option 2: Via API (curl)
1. Make sure the server is running on port 5000
2. Run:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"fwallace@prinstinegroup.org","password":"User@123"}'
   ```

### Option 3: Test Script (Database-level)
Test password verification without server:
```bash
cd server
node scripts/test-fwallace-password.js
```

### Option 4: Test Script (API-level)
Test login via API (requires server running):
```bash
cd server
node scripts/test-fwallace-login.js
```

## Account Details

- The email was updated from `fwallace@gmail.com` to `fwallace@prinstinegroup.org`
- The account maintains DepartmentHead role with full access
- Password is set to the default: `User@123`
- Account is active and email verified

## Notes

- This account is referenced in the Academy routes as the Academy Head
- The user has DepartmentHead permissions and can log in to the system
- It's recommended to change the password after first login

