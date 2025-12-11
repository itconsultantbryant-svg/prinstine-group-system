#!/bin/bash

echo "🔍 Checking Server Status..."
echo ""

# Check Backend (port 5000)
if lsof -ti:5000 >/dev/null 2>&1; then
    echo "✅ Backend Server: RUNNING on port 5000"
    curl -s http://localhost:5000/api/dashboard/stats >/dev/null 2>&1 && echo "   Status: Responding" || echo "   Status: Not responding"
else
    echo "❌ Backend Server: NOT RUNNING"
fi

echo ""

# Check Frontend (port 3000)
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "✅ Frontend Server: RUNNING on port 3000"
    curl -s http://localhost:3000 >/dev/null 2>&1 && echo "   Status: Responding" || echo "   Status: Not responding"
else
    echo "❌ Frontend Server: NOT RUNNING"
fi

echo ""
echo "📝 To view server logs: tail -f /tmp/pms-both-servers.log"
echo "🛑 To stop servers: pkill -f 'node.*server.js|react-scripts|concurrently'"

