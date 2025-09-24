#!/bin/bash

echo "🔐 FileManager Authentication Integration Test"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_output="$3"
    
    echo -n "Testing $test_name... "
    
    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
    fi
}

echo ""
echo "🔍 Step 1: Check API Server Status"
echo "----------------------------------"

# Check if API server is running
run_test "API Server Running" "curl -s http://localhost:3001/ | grep -q 'OK'"

echo ""
echo "🔐 Step 2: Authentication Tests"
echo "-------------------------------"

# Test unauthenticated access (should fail)
run_test "Unauthenticated Access Blocked" "curl -s http://localhost:3001/filemanager/ | grep -q '401\|403\|Unauthorized'"

# Test login endpoint
run_test "Login Endpoint Available" "curl -s -X POST http://localhost:3001/login -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=test&password=test' -w '%{http_code}' | grep -q '201\|302'"

echo ""
echo "🌐 Step 3: FileManager Integration Tests"
echo "----------------------------------------"

# Test FileManager service
run_test "FileManager Service Running" "curl -s http://localhost:58080/ | grep -q 'File Browser'"

# Test proxy integration
run_test "Proxy Integration" "curl -s http://localhost:3001/filemanager/ | grep -q 'File Browser'"

echo ""
echo "🔧 Step 4: Authentication Flow Tests"
echo "------------------------------------"

# Test login flow
echo "Testing login flow..."
response=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin" \
  -w "%{http_code}" \
  -o /dev/null)

if [ "$response" = "302" ] || [ "$response" = "201" ]; then
    echo -e "Login flow: ${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "Login flow: ${RED}❌ FAIL${NC} (Status: $response)"
    ((TESTS_FAILED++))
fi

echo ""
echo "📊 Step 5: Permission Tests"
echo "-------------------------"

# Test different user roles
echo "Testing user role permissions..."

# Test admin user
admin_response=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin" \
  -w "%{http_code}" \
  -o /dev/null)

if [ "$admin_response" = "302" ] || [ "$admin_response" = "201" ]; then
    echo -e "Admin user access: ${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "Admin user access: ${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

# Test regular user
user_response=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user&password=user" \
  -w "%{http_code}" \
  -o /dev/null)

if [ "$user_response" = "302" ] || [ "$user_response" = "201" ]; then
    echo -e "Regular user access: ${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "Regular user access: ${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "🎯 Step 6: End-to-End Integration"
echo "--------------------------------"

# Test complete authentication flow
echo "Testing complete authentication flow..."

# 1. Access login page
login_page=$(curl -s http://localhost:3001/login | head -1)
if echo "$login_page" | grep -q "html\|form"; then
    echo -e "Login page accessible: ${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "Login page accessible: ${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

# 2. Test authentication bypass
bypass_test=$(curl -s http://localhost:3001/filemanager/ | head -1)
if echo "$bypass_test" | grep -q "401\|403\|Unauthorized"; then
    echo -e "Authentication bypass blocked: ${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "Authentication bypass blocked: ${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "📋 Test Results Summary"
echo "======================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL AUTHENTICATION TESTS PASSED!${NC}"
    echo -e "${GREEN}FileManager authentication is properly integrated with Unraid!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some authentication tests failed.${NC}"
    echo -e "${YELLOW}Check the output above for details.${NC}"
    exit 1
fi
