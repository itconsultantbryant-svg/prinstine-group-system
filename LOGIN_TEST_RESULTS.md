# Login Testing Results

## Server Status
- Backend server should be running on port 5000
- Frontend should be running on port 3000

## Test Users

### Admin User
- **Email**: `admin@prinstine.com`
- **Password**: `Admin@123`
- **Role**: Admin
- **Name**: Prince S. Cooper

### Department Head Users
All department heads use password: `User@123`

1. **Christian Moore**
   - Email: `cmoore@prinstinegroup.org`
   - Password: `User@123`

2. **Emma Sackie**
   - Email: `sackie@gmail.com`
   - Password: `User@123`

3. **Emmanuel Sackie**
   - Email: `eksackie@prinstinegroup.org`
   - Password: `User@123`

4. **Francess Wallace**
   - Email: `fwallace@gmail.com`
   - Password: `User@123`

5. **James S. Tokpa**
   - Email: `jtokpa@prinstinegroup.org`
   - Password: `User@123`

6. **Jamesetta L. Sieh**
   - Email: `jsieh@prinstinegroup.org`
   - Password: `User@123`

7. **John Brown**
   - Email: `johnbrown@gmail.com`
   - Password: `User@123`

8. **Williams L. Buku**
   - Email: `wbuku@prinstinegroup.org`
   - Password: `User@123`

## Testing Instructions

### Manual Testing via Browser
1. Open `http://localhost:3000` in your browser
2. Try logging in with each user above
3. Check browser console for any errors
4. Check backend logs for login attempts

### Testing via Script
Run the test script:
```bash
cd server
./scripts/test-all-logins.sh
```

### Testing via curl
```bash
# Test admin login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prinstine.com","password":"Admin@123"}'

# Test department head login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jsieh@prinstinegroup.org","password":"User@123"}'
```

## Expected Response
Successful login should return:
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

## Troubleshooting

If login fails:
1. Check if backend server is running: `curl http://localhost:5000/api/health`
2. Check backend logs for errors
3. Verify user exists in database
4. Check if user role is Admin or DepartmentHead
5. Verify password is correct
6. Check if account is active

