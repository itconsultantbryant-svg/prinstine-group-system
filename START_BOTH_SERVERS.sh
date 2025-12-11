#!/bin/bash

# Prinstine Management System - Start Both Servers

echo "🚀 Starting Prinstine Management System..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$(dirname "$0")"

# Check if dependencies are installed
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server && npm install && cd ..
    echo ""
fi

if [ ! -d "client/node_modules" ]; then
    echo "📦 Installing client dependencies..."
    cd client && npm install && cd ..
    echo ""
fi

# Check if port 5000 is in use
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 5000 is already in use!"
    echo "   Killing existing process..."
    kill -9 $(lsof -ti:5000) 2>/dev/null
    sleep 2
fi

# Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 3000 is already in use!"
    echo "   Killing existing process..."
    kill -9 $(lsof -ti:3000) 2>/dev/null
    sleep 2
fi

echo "✅ Starting both servers..."
echo ""
echo "📝 Server logs will appear below:"
echo "   - Backend: http://localhost:5000"
echo "   - Frontend: http://localhost:3000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Press Ctrl+C to stop both servers"
echo ""

# Start both servers using concurrently
npm run dev

