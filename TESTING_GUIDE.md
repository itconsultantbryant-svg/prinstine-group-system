# 🧪 System Testing Guide

## Pre-Deployment Testing Checklist

### 1. Authentication & Authorization Tests

#### Login Tests:
```bash
# Test valid login
POST /api/auth/login
{
  "email": "admin@prinstine.com",
  "password": "Admin@123"
}

# Test invalid credentials
POST /api/auth/login
{
  "email": "admin@prinstine.com",
  "password": "wrongpassword"
}

# Test non-existent user
POST /api/auth/login
{
  "email": "nonexistent@test.com",
  "password": "password"
}
```

#### Token Validation:
```bash
# Test protected route without token
GET /api/dashboard/stats
# Expected: 401 Unauthorized

# Test with invalid token
GET /api/dashboard/stats
Headers: Authorization: Bearer invalid_token
# Expected: 403 Forbidden

# Test with valid token
GET /api/dashboard/stats
Headers: Authorization: Bearer <valid_token>
# Expected: 200 OK with stats
```

### 2. Role-Based Access Control Tests

#### Admin Access:
```bash
# Admin should access all routes
GET /api/users
GET /api/staff
GET /api/clients
GET /api/departments
GET /api/dashboard/stats
# All should return 200 OK
```

#### Department Head Access:
```bash
# Department Head should access:
GET /api/departments (own department)
GET /api/staff (own department staff)
GET /api/department-reports (own department)
# Should return 200 OK

# Department Head should NOT access:
GET /api/users (all users)
# Should return 403 Forbidden
```

#### Staff Access:
```bash
# Staff should access:
GET /api/staff/:id (own record)
GET /api/progress-reports (own reports)
# Should return 200 OK

# Staff should NOT access:
GET /api/users
GET /api/staff (all staff)
# Should return 403 Forbidden
```

### 3. Database Error Handling Tests

#### Missing Tables:
```bash
# If tables don't exist, should return empty arrays, not 500 errors
GET /api/dashboard/stats
# Expected: 200 OK with empty stats

GET /api/clients
# Expected: 200 OK with empty array

GET /api/staff
# Expected: 200 OK with empty array
```

#### Missing Records:
```bash
# Non-existent record should return 404
GET /api/clients/99999
# Expected: 404 Not Found

GET /api/staff/99999
# Expected: 404 Not Found
```

### 4. Approval Workflow Tests

#### Department Report Approval:
```bash
# 1. Staff creates report
POST /api/department-reports
{
  "department_id": 1,
  "report_type": "Monthly",
  "content": "Test report"
}
# Expected: 201 Created, status: "Draft"

# 2. Staff submits report
PUT /api/department-reports/:id/submit
# Expected: 200 OK, status: "Pending_DeptHead"

# 3. Department Head approves
PUT /api/department-reports/:id/approve
{
  "action": "approve",
  "comments": "Approved"
}
# Expected: 200 OK, status: "Pending_Admin"

# 4. Admin approves
PUT /api/department-reports/:id/approve
{
  "action": "approve",
  "comments": "Final approval"
}
# Expected: 200 OK, status: "Admin_Approved"
```

#### Requisition Approval:
```bash
# 1. User creates requisition
POST /api/requisitions
{
  "request_type": "office_supplies",
  "materials": "Paper",
  "cost": "50"
}
# Expected: 201 Created, status: "Pending_DeptHead"

# 2. Department Head approves
PUT /api/requisitions/:id/review
{
  "action": "approve",
  "comments": "Approved"
}
# Expected: 200 OK, status: "Pending_Admin"

# 3. Admin approves
PUT /api/requisitions/:id/review
{
  "action": "approve",
  "comments": "Final approval"
}
# Expected: 200 OK, status: "Admin_Approved"
```

### 5. Data Validation Tests

#### Invalid Input:
```bash
# Invalid email
POST /api/users
{
  "email": "invalid-email",
  "name": "Test User"
}
# Expected: 400 Bad Request with validation errors

# Missing required fields
POST /api/clients
{
  "name": "Test Client"
}
# Expected: 400 Bad Request (email required)

# Invalid role
POST /api/users
{
  "email": "test@test.com",
  "name": "Test",
  "role": "InvalidRole"
}
# Expected: 400 Bad Request
```

### 6. File Upload Tests

#### Valid Upload:
```bash
POST /api/requisitions
Content-Type: multipart/form-data
{
  "request_type": "office_supplies",
  "document": <file>
}
# Expected: 201 Created with file path
```

#### Invalid File Type:
```bash
POST /api/requisitions
Content-Type: multipart/form-data
{
  "request_type": "office_supplies",
  "document": <executable_file>
}
# Expected: 400 Bad Request (Invalid file type)
```

### 7. Real-Time Features Tests

#### Socket.IO Connection:
```javascript
// Test socket connection
const socket = io('http://localhost:3006');
socket.on('connect', () => {
  console.log('Connected');
  socket.emit('authenticate', userId);
});
```

#### Notifications:
```bash
# Create notification
POST /api/notifications
{
  "user_id": 1,
  "message": "Test notification"
}
# Expected: Notification sent via socket.io
```

## Production Testing

### After Deployment:

1. **Check Health Endpoint:**
   ```bash
   GET https://your-backend-url.onrender.com/api/health
   # Expected: 200 OK
   ```

2. **Test Login:**
   ```bash
   POST https://your-backend-url.onrender.com/api/auth/login
   {
     "email": "admin@prinstine.com",
     "password": "Admin@123"
   }
   # Expected: 200 OK with token
   ```

3. **Test Dashboard:**
   ```bash
   GET https://your-backend-url.onrender.com/api/dashboard/stats
   Headers: Authorization: Bearer <token>
   # Expected: 200 OK (even if empty)
   ```

4. **Check Logs:**
   - Verify no 500 errors
   - Check for migration messages
   - Verify table creation logs

## Common Issues & Solutions

### Issue: 500 Errors on All Routes
**Solution**: Check if database migrations ran. Look for "Database schema initialized" in logs.

### Issue: Empty Dashboard
**Solution**: Normal if tables don't exist yet. Check logs for migration status.

### Issue: Permission Denied (403)
**Solution**: Verify user role and route permissions. Check `requireRole()` middleware.

### Issue: Authentication Failed (401)
**Solution**: Check token expiration and JWT_SECRET configuration.

## Automated Testing Script

Run this script to test all critical endpoints:

```bash
#!/bin/bash
BASE_URL="https://your-backend-url.onrender.com/api"

# Test health
echo "Testing health endpoint..."
curl -X GET "$BASE_URL/health"

# Test login
echo "Testing login..."
TOKEN=$(curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prinstine.com","password":"Admin@123"}' \
  | jq -r '.token')

# Test protected routes
echo "Testing dashboard..."
curl -X GET "$BASE_URL/dashboard/stats" \
  -H "Authorization: Bearer $TOKEN"

echo "Testing clients..."
curl -X GET "$BASE_URL/clients" \
  -H "Authorization: Bearer $TOKEN"

echo "Testing staff..."
curl -X GET "$BASE_URL/staff" \
  -H "Authorization: Bearer $TOKEN"
```

---

**System is ready for production testing!** ✅

