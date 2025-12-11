# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies  
cd client && npm install && cd ..
```

### Step 2: Configure Environment

The server `.env` file is already configured with default values. For production, update:
- `JWT_SECRET` - Use a strong random string
- `ENCRYPTION_KEY` - Use a 32-character random string
- Email settings if you want email features

### Step 3: Start the Application

```bash
# From root directory - starts both server and client
npm run dev
```

Or run separately:

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm start
```

### Step 4: Login

1. Open browser: `http://localhost:3000`
2. Login with:
   - **Email:** `admin@prinstine.com`
   - **Password:** `Admin@123`
3. **IMPORTANT:** Change password immediately!

## 📋 Default Credentials

**Admin Account:**
- Email: `admin@prinstine.com`
- Password: `Admin@123`

⚠️ **Change this password immediately after first login!**

## 🎯 What's Included

### ✅ Core Features
- **Authentication System** - Login, Register, Password Reset
- **Dashboard** - Overview with statistics and charts
- **Staff Management** - Full CRUD operations
- **Client Management** - Client records and consultations
- **Partnership Management** - Partner tracking
- **Academy Management** - Students, Instructors, Courses
- **Reports Management** - Submit and review reports
- **Certificate Verification** - Public verification endpoint
- **Notifications** - Real-time notification system
- **Global Search** - Search across all entities

### 🎨 UI Features
- Responsive Bootstrap 5 design
- Brand colors (Blue #007BFF, Yellow #FFC107)
- Modern, clean interface
- Mobile-friendly
- Bootstrap Icons

### 🔒 Security Features
- JWT authentication
- Password hashing (bcrypt)
- Role-based access control
- Input validation
- SQL injection protection
- Rate limiting
- Security headers

## 📁 Project Structure

```
prinstine-management-system/
├── client/          # React frontend
├── server/          # Node.js backend
├── database/        # SQLite database & migrations
└── README.md        # Full documentation
```

## 🛠️ Common Commands

```bash
# Development
npm run dev              # Run both server and client

# Server only
cd server
npm run dev             # Start backend server
npm start              # Start in production mode

# Client only
cd client
npm start              # Start React dev server
npm run build          # Build for production

# Database
# Database auto-initializes on first server start
```

## 🔧 Troubleshooting

**Port already in use?**
- Change PORT in `server/.env`
- Or kill the process: `lsof -ti:5000 | xargs kill`

**Module not found?**
```bash
cd server && npm install
cd ../client && npm install
```

**Database issues?**
- Delete `database/pms.db` and restart server
- Database will be recreated automatically

**CORS errors?**
- Ensure `FRONTEND_URL` in `server/.env` matches your frontend URL

## 📚 Next Steps

1. **Change Admin Password** - First thing after login!
2. **Configure Email** - Update SMTP settings in `.env` for email features
3. **Add Staff** - Start adding staff members
4. **Add Clients** - Begin client management
5. **Customize** - Adjust colors, branding, and features as needed

## 📖 Full Documentation

See `SETUP.md` for detailed setup instructions and `README.md` for complete documentation.

## 🆘 Need Help?

- Check `SETUP.md` for detailed instructions
- Review code comments for implementation details
- Check browser console and server logs for errors

---

**Built with:** React, Node.js, Express, SQLite, Bootstrap 5, jQuery

