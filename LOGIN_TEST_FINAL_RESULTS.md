# Prinstine Group Management System - Login Test Results

## Server Configuration
- **Backend Port**: 3006 (changed from 5000)
- **Frontend Port**: 3000
- **Backend URL**: http://localhost:3006
- **Frontend URL**: http://localhost:3000

## Test Results Summary

### ✅ Admin Login - SUCCESS
- **Email**: `admin@prinstine.com`
- **Password**: `Admin@123`
- **Role**: Admin
- **Name**: Prince S. Cooper
- **Status**: ✅ Working

### ✅ Department Head Logins - SUCCESS
All department heads use password: `DeptHead@123`

1. **Christian Moore** - ✅ Working
   - Email: `cmoore@prinstinegroup.org`
   - Password: `DeptHead@123`

2. **Emma Sackie** - ✅ Working
   - Email: `sackie@gmail.com`
   - Password: `DeptHead@123`

3. **Emmanuel Sackie** - ✅ Working
   - Email: `eksackie@prinstinegroup.org`
   - Password: `DeptHead@123`

4. **Francess Wallace** - ✅ Working
   - Email: `fwallace@gmail.com`
   - Password: `DeptHead@123`

5. **James S. Tokpa** - ✅ Working
   - Email: `jtokpa@prinstinegroup.org`
   - Password: `DeptHead@123`

6. **Jamesetta L. Sieh** - ✅ Working
   - Email: `jsieh@prinstinegroup.org`
   - Password: `DeptHead@123`

7. **John Brown** - ✅ Working
   - Email: `johnbrown@gmail.com`
   - Password: `DeptHead@123`

8. **Williams L. Buku** - ✅ Working
   - Email: `wbuku@prinstinegroup.org`
   - Password: `DeptHead@123`

## Port Changes Made

### Backend (server.js)
- Changed default port from 5000 to 3006
- Updated `.env` file: `PORT=3006`

### Frontend Configuration
- Updated `client/src/config/api.js`: API URL now points to `http://localhost:3006/api`
- Updated `client/src/config/socket.js`: Socket URL now points to `http://localhost:3006`
- Updated `client/src/context/AuthContext.js`: Error message updated to mention port 3006

### Server Routes
- Updated `server/routes/notifications.js`: Base URL changed to port 3006
- Updated `server/routes/upload.js`: Base URL changed to port 3006

## Testing Commands

### Test Health Endpoint
```bash
curl http://localhost:3006/api/health
```

### Test Admin Login
```bash
curl -X POST http://localhost:3006/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prinstine.com","password":"Admin@123"}'
```

### Test Department Head Login
```bash
curl -X POST http://localhost:3006/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jsieh@prinstinegroup.org","password":"DeptHead@123"}'
```

### Run Comprehensive Test
```bash
cd server
./scripts/test-logins-comprehensive.sh
```

## Important Notes

1. **Port Change**: The system now runs on port 3006 instead of 5000
2. **Department Head Passwords**: All department heads use `DeptHead@123` (not `User@123`)
3. **Admin Password**: Admin uses `Admin@123`
4. **Login Access**: Only Admin and DepartmentHead roles can log in

## Next Steps

1. Start backend: `cd server && npm run dev`
2. Start frontend: `cd client && npm start`
3. Access system at: http://localhost:3000
4. Login with any of the credentials above

