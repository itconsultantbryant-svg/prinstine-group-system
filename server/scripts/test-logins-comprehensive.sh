#!/bin/bash

API_URL="http://localhost:3006/api"

echo "========================================"
echo "  COMPREHENSIVE LOGIN TESTING"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "Step 1: Checking server status..."
HEALTH=$(curl -s --max-time 3 "${API_URL}/health" 2>&1)
if [[ $? -ne 0 ]] || [[ -z "$HEALTH" ]] || [[ "$HEALTH" != *"ok"* ]]; then
    echo -e "${RED}❌ Server is not responding!${NC}"
    echo "   Please make sure the backend server is running on port 3006"
    exit 1
fi
echo -e "${GREEN}✅ Server is running and responding${NC}"
echo ""

# Test users: email:password:role:name
declare -a users=(
    "admin@prinstine.com:Admin@123:Admin:Prince S. Cooper"
    "cmoore@prinstinegroup.org:DeptHead@123:DepartmentHead:Christian Moore"
    "sackie@gmail.com:DeptHead@123:DepartmentHead:Emma Sackie"
    "eksackie@prinstinegroup.org:DeptHead@123:DepartmentHead:Emmanuel Sackie"
    "fwallace@gmail.com:DeptHead@123:DepartmentHead:Francess Wallace"
    "jtokpa@prinstinegroup.org:DeptHead@123:DepartmentHead:James S. Tokpa"
    "jsieh@prinstinegroup.org:DeptHead@123:DepartmentHead:Jamesetta L. Sieh"
    "johnbrown@gmail.com:DeptHead@123:DepartmentHead:John Brown"
    "wbuku@prinstinegroup.org:DeptHead@123:DepartmentHead:Williams L. Buku"
)

successful=0
failed=0
failed_users=()

echo "Step 2: Testing login for all users..."
echo ""

for user_info in "${users[@]}"; do
    IFS=':' read -r email password role name <<< "$user_info"
    
    echo "Testing: $name"
    echo "  Email: $email"
    echo "  Role: $role"
    
    response=$(curl -s -X POST "${API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -H "Origin: http://localhost:3000" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
        --max-time 10 \
        -w "\n%{http_code}")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" == "200" ]] && [[ "$body" == *"token"* ]]; then
        echo -e "  ${GREEN}✅ SUCCESS: Login successful${NC}"
        token=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        user_role=$(echo "$body" | grep -o '"role":"[^"]*' | cut -d'"' -f4)
        user_name=$(echo "$body" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
        if [[ -n "$token" ]]; then
            echo "  Token: ${token:0:30}..."
        fi
        if [[ -n "$user_role" ]]; then
            echo "  User Role: $user_role"
        fi
        if [[ -n "$user_name" ]]; then
            echo "  User Name: $user_name"
        fi
        ((successful++))
    else
        echo -e "  ${RED}❌ FAILED: HTTP $http_code${NC}"
        if [[ "$body" == *"error"* ]]; then
            error=$(echo "$body" | grep -o '"error":"[^"]*' | cut -d'"' -f4)
            echo "  Error: $error"
        else
            echo "  Response: ${body:0:100}..."
        fi
        ((failed++))
        failed_users+=("$name ($email)")
    fi
    echo ""
    
    sleep 0.3
done

# Summary
echo "========================================"
echo "  TEST SUMMARY"
echo "========================================"
echo "Total Tests: ${#users[@]}"
echo -e "${GREEN}✅ Successful: $successful${NC}"
echo -e "${RED}❌ Failed: $failed${NC}"
echo "========================================"
echo ""

if [[ $failed -gt 0 ]]; then
    echo -e "${YELLOW}Failed Logins:${NC}"
    for failed_user in "${failed_users[@]}"; do
        echo "  - $failed_user"
    done
    echo ""
    exit 1
else
    echo -e "${GREEN}All login tests passed!${NC}"
    exit 0
fi

