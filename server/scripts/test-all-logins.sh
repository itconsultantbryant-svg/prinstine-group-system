#!/bin/bash

API_URL="http://localhost:5000/api"

echo "========================================"
echo "  LOGIN TESTING FOR ALL USERS"
echo "========================================"
echo ""

# Check if server is running
echo "Checking server status..."
HEALTH=$(curl -s --max-time 3 "${API_URL}/health" 2>&1)
if [[ $? -ne 0 ]] || [[ -z "$HEALTH" ]]; then
    echo "❌ Server is not responding!"
    echo "   Please make sure the backend server is running on port 5000"
    exit 1
fi
echo "✅ Server is running"
echo ""

# Test users
declare -a users=(
    "admin@prinstine.com:Admin@123:Admin:Prince S. Cooper"
    "cmoore@prinstinegroup.org:User@123:DepartmentHead:Christian Moore"
    "sackie@gmail.com:User@123:DepartmentHead:Emma Sackie"
    "eksackie@prinstinegroup.org:User@123:DepartmentHead:Emmanuel Sackie"
    "fwallace@gmail.com:User@123:DepartmentHead:Francess Wallace"
    "jtokpa@prinstinegroup.org:User@123:DepartmentHead:James S. Tokpa"
    "jsieh@prinstinegroup.org:User@123:DepartmentHead:Jamesetta L. Sieh"
    "johnbrown@gmail.com:User@123:DepartmentHead:John Brown"
    "wbuku@prinstinegroup.org:User@123:DepartmentHead:Williams L. Buku"
)

successful=0
failed=0

for user_info in "${users[@]}"; do
    IFS=':' read -r email password role name <<< "$user_info"
    
    echo "=== Testing: $name ($email) ==="
    
    response=$(curl -s -X POST "${API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -H "Origin: http://localhost:3000" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
        --max-time 10 \
        -w "\n%{http_code}")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" == "200" ]] && [[ "$body" == *"token"* ]]; then
        echo "✅ SUCCESS: Login successful"
        token=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        if [[ -n "$token" ]]; then
            echo "   Token: ${token:0:20}..."
        fi
        ((successful++))
    else
        echo "❌ FAILED: HTTP $http_code"
        if [[ "$body" == *"error"* ]]; then
            error=$(echo "$body" | grep -o '"error":"[^"]*' | cut -d'"' -f4)
            echo "   Error: $error"
        else
            echo "   Response: $body"
        fi
        ((failed++))
    fi
    echo ""
    
    sleep 0.5
done

echo "========================================"
echo "  TEST SUMMARY"
echo "========================================"
echo "Total Tests: ${#users[@]}"
echo "✅ Successful: $successful"
echo "❌ Failed: $failed"
echo "========================================"

if [[ $failed -gt 0 ]]; then
    exit 1
fi

