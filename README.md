# Prinstine Management System (PMS)

A comprehensive, enterprise-level web-based management system for Prinstine Group of Companies. Built with modern web technologies, featuring role-based access control, real-time notifications, and a clean, responsive UI.

## 🚀 Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for a 5-minute setup guide.

```bash
# Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Start the application
npm run dev
```

**Default Admin Login:**
- Email: `admin@prinstine.com`
- Password: `Admin@123`

⚠️ **Change the admin password immediately after first login!**

## 📋 Tech Stack

### Frontend
- **React 18+** - Modern UI library
- **Bootstrap 5** - Responsive UI framework
- **jQuery** - DOM manipulation and enhancements
- **Axios** - HTTP client for API calls
- **React Router** - Client-side routing
- **Chart.js** - Data visualization
- **Socket.io Client** - Real-time communication

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite3** - Lightweight database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **Socket.io** - WebSocket server
- **Nodemailer** - Email service
- **Express Validator** - Input validation
- **Helmet** - Security headers
- **Rate Limiting** - API protection

## 📁 Project Structure

```
prinstine-management-system/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React Context providers
│   │   ├── hooks/         # Custom React hooks
│   │   └── config/         # Configuration files
│   └── public/            # Static assets
├── server/                # Node.js backend
│   ├── routes/           # API route handlers
│   ├── utils/            # Utility functions
│   ├── config/           # Configuration files
│   └── server.js         # Main server entry point
├── database/             # SQLite database
│   ├── migrations/       # Database schema migrations
│   └── backups/          # Database backup storage
├── README.md             # This file
├── SETUP.md              # Detailed setup instructions
└── QUICKSTART.md        # Quick start guide
```

## ✨ Features

### ✅ Core Features Implemented

- **🔐 Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (RBAC)
  - Password hashing with bcrypt
  - Email verification with OTP
  - Password reset functionality

- **📊 Dashboard**
  - Overview statistics cards
  - Interactive charts (Pie, Bar)
  - Global search functionality
  - Quick links to modules
  - Role-specific dashboards

- **👥 Staff Management** (Admin only)
  - Full CRUD operations
  - Employment type management (Full-time, Part-time, Internship)
  - Performance reviews
  - Leave management
  - Payroll information

- **💼 Client Records Management**
  - Client CRUD operations
  - Service tracking (Consultancy, Microfinance, Lending)
  - Loan management
  - Consultation history
  - Client portal access

- **🤝 Partnership Management**
  - Partner records
  - Partnership types (Affiliate, Sponsor, Collaborator, Vendor)
  - Agreement tracking
  - Status management

- **🎓 Academy Management**
  - Student management
  - Instructor management
  - Course management (Online, In-person, Hybrid)
  - Enrollment tracking
  - Certificate generation and verification
  - Grade management

- **📝 Reports Management**
  - Report submission (Weekly, Bi-weekly, Monthly)
  - Department-based reports
  - Approval workflow
  - Review and comments
  - Status tracking

- **🔔 Notifications System**
  - Real-time notifications via WebSocket
  - In-app notification center
  - Email notifications (when configured)
  - Unread count tracking

- **🔍 Certificate Verification**
  - Public verification endpoint
  - Secure verification codes
  - Certificate details display

### 🎨 UI/UX Features

- **Responsive Design** - Works on desktop, tablet, and mobile
- **Bootstrap 5** - Modern, clean interface
- **Brand Colors** - Primary Blue (#007BFF), Accent Yellow (#FFC107)
- **Bootstrap Icons** - Consistent iconography
- **Smooth Animations** - jQuery-enhanced interactions
- **Loading States** - User-friendly feedback
- **Error Handling** - Clear error messages

### 🔒 Security Features

- Password hashing (bcrypt, 10 rounds)
- JWT token authentication
- Role-based access control
- Input validation and sanitization
- SQL injection protection (parameterized queries)
- CORS configuration
- Rate limiting
- Security headers (Helmet.js)
- Audit logging

## 🎯 Role-Based Access Control

### Admin
- Full system access
- Manage all users and data
- Approve/reject reports
- Create certificates
- System configuration

### Staff
- View and manage clients
- Submit and view own reports
- Limited access to other modules

### Instructor
- Manage courses and students
- Create certificates
- View academy data

### Student
- View own enrollments
- View own certificates
- Limited read-only access

### Client
- View own records
- View consultation history
- Self-service portal

### Partner
- View partnership information
- Limited read-only access

## 📚 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 5 minutes
- **[SETUP.md](./SETUP.md)** - Detailed setup and configuration guide
- **Code Comments** - Comprehensive inline documentation

## 🛠️ Development

### Running Locally

```bash
# Install all dependencies
npm run install-all

# Run both server and client
npm run dev

# Or run separately:
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm start
```

### Environment Variables

See `server/.env.example` and `SETUP.md` for configuration details.

### Database

The database initializes automatically on first server start. Migration files in `database/migrations/` are executed automatically.

## 🚀 Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use PM2 or similar process manager
3. Configure HTTPS
4. Set secure JWT_SECRET and ENCRYPTION_KEY

### Frontend
1. Build: `cd client && npm run build`
2. Serve `build/` folder with nginx/Apache
3. Configure API URL in environment

### Database
- Regular backups recommended
- Consider PostgreSQL for production scale

## 📝 API Documentation

See `SETUP.md` for complete API endpoint documentation.

## 🎨 Brand Colors

- **Primary Blue**: `#007BFF` - Buttons, headers, primary actions
- **Accent Yellow**: `#FFC107` - Highlights, alerts, warnings
- **White**: `#FFFFFF` - Backgrounds, cards
- **Black**: `#000000` - Text, borders

## 🤝 Contributing

1. Follow code style and conventions
2. Add comments for complex logic
3. Test thoroughly before submitting
4. Update documentation as needed

## 📄 License

ISC

## 🆘 Support

For issues or questions:
1. Check `SETUP.md` for troubleshooting
2. Review code comments
3. Check browser console and server logs
4. Verify environment configuration

---

**Built with ❤️ for Prinstine Group of Companies**

# prinstine-management-system
