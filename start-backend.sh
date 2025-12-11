#!/bin/bash

# Prinstine Management System - Backend Server Startup Script

echo "🚀 Starting Prinstine Management System Backend Server..."
echo ""

cd "$(dirname "$0")/server"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Creating default .env file..."
    cat > .env << EOF
PORT=5000
NODE_ENV=development
JWT_SECRET=prinstine-super-secret-jwt-key-change-in-production-min-32-chars-please
JWT_EXPIRES_IN=24h
DB_PATH=../database/pms.db
FRONTEND_URL=http://localhost:3000
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@prinstine.com
ENCRYPTION_KEY=prinstine-encryption-key-32-chars!!
EOF
    echo "✅ Created .env file"
    echo ""
fi

# Check if port 5000 is already in use
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 5000 is already in use!"
    echo "   Please stop the existing server or change the PORT in .env"
    echo ""
    read -p "Do you want to kill the existing process? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $(lsof -ti:5000)
        echo "✅ Killed existing process"
        sleep 2
    else
        echo "❌ Exiting..."
        exit 1
    fi
fi

echo "✅ Starting server on port 5000..."
echo "📝 Server logs will appear below:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the server
npm run dev
