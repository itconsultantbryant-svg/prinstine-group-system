# Prinstine Management System - Setup Guide

## Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- SQLite3 (usually comes with Node.js)

## Installation Steps

### 1. Install Dependencies

```bash
# Install root dependencies (concurrently for running both servers)
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

#### Server Configuration

Edit `server/.env` file:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=24h
DB_PATH=../database/pms.db
FRONTEND_URL=http://localhost:3000
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@prinstine.com
ENCRYPTION_KEY=prinstine-encryption-key-32-chars!!
```

**Important:** Change the JWT_SECRET and ENCRYPTION_KEY to secure random strings in production.

#### Client Configuration (Optional)

Create `client/.env` if you need to change the API URL:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

### 3. Initialize Database

The database will be automatically initialized when you start the server for the first time. The migration files in `database/migrations/` will be executed.

**Default Admin Credentials:**
- Email: `admin@prinstine.com`
- Password: `Admin@123`

**⚠️ IMPORTANT:** Change the default admin password immediately after first login!

### 4. Start the Application

#### Option 1: Run Both Server and Client Together

From the root directory:

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend React app on `http://localhost:3000`

#### Option 2: Run Separately

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

### 5. Access the Application

1. Open your browser and navigate to `http://localhost:3000`
2. Login with the default admin credentials
3. Change the admin password immediately
4. Start configuring your system!

## Project Structure

```
prinstine-management-system/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context providers
│   │   ├── hooks/         # Custom hooks
│   │   └── config/        # Configuration files
│   └── public/            # Static assets
├── server/                # Node.js backend
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   ├── config/           # Configuration
│   └── server.js         # Main server file
├── database/             # SQLite database
│   ├── migrations/       # Database migration files
│   └── backups/          # Database backups
└── README.md
```

## Features

### ✅ Implemented

- ✅ Authentication & Authorization (JWT, Role-based access)
- ✅ Dashboard with statistics and charts
- ✅ Staff Management (CRUD operations)
- ✅ Client Records Management
- ✅ Partnership Management
- ✅ Academy Management (Students, Instructors, Courses)
- ✅ Reports Management
- ✅ Certificate Verification (Public endpoint)
- ✅ Notifications System
- ✅ Global Search
- ✅ Responsive UI with Bootstrap 5

### 🔄 To Be Enhanced

- Real-time WebSocket notifications (infrastructure ready)
- Email integration (configure SMTP settings)
- PDF/Excel export (libraries installed, needs implementation)
- Marketing Plans module (database ready, UI pending)
- Calendar integration
- Internal messaging system
- Advanced analytics

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-email` - Verify email with OTP
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/change-password` - Change password (authenticated)

### Staff Management
- `GET /api/staff` - Get all staff (Admin only)
- `GET /api/staff/:id` - Get staff member
- `POST /api/staff` - Create staff (Admin only)
- `PUT /api/staff/:id` - Update staff (Admin only)
- `DELETE /api/staff/:id` - Delete staff (Admin only)

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get client
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client

### Partners
- `GET /api/partners` - Get all partners
- `GET /api/partners/:id` - Get partner
- `POST /api/partners` - Create partner (Admin only)
- `PUT /api/partners/:id` - Update partner (Admin only)

### Academy
- `GET /api/academy/students` - Get all students
- `GET /api/academy/courses` - Get all courses
- `GET /api/academy/certificates/verify/:code` - Verify certificate (public)

### Reports
- `GET /api/reports` - Get all reports
- `POST /api/reports` - Create report
- `PUT /api/reports/:id/review` - Review report (Admin only)

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/search?q=query` - Global search

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read

## Role-Based Access Control

### Admin
- Full access to all modules
- Can manage staff, clients, partners
- Can approve/reject reports
- Can create certificates

### Staff
- View and manage clients
- Submit and view own reports
- Limited access to other modules

### Instructor
- Manage courses and students
- View academy data
- Create certificates

### Student
- View own enrollments
- View own certificates
- Limited read-only access

### Client
- View own records
- View consultation history

### Partner
- View partnership information
- Limited read-only access

## Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT-based authentication
- ✅ Role-based access control
- ✅ Input validation
- ✅ SQL injection protection (parameterized queries)
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Helmet.js security headers

## Troubleshooting

### Database Issues

If the database doesn't initialize:
1. Check that the `database/` folder exists
2. Ensure SQLite3 is installed
3. Check file permissions

### Port Already in Use

If port 5000 or 3000 is already in use:
1. Change PORT in `server/.env`
2. Or kill the process using the port

### Module Not Found Errors

Run:
```bash
cd server && npm install
cd ../client && npm install
```

### CORS Errors

Ensure `FRONTEND_URL` in `server/.env` matches your frontend URL.

## Production Deployment

### Backend

1. Set `NODE_ENV=production` in `.env`
2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server/server.js --name pms-server
   ```

### Frontend

1. Build the React app:
   ```bash
   cd client
   npm run build
   ```
2. Serve the `build/` folder using a web server (nginx, Apache, etc.)

### Database

- Regular backups: Copy `database/pms.db` to `database/backups/`
- Consider migrating to PostgreSQL for production

## Support

For issues or questions, please refer to the code comments or create an issue in the repository.

## License

ISC

