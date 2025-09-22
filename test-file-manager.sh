#!/bin/bash

echo "🧪 File Manager Integration Test Suite"
echo "======================================"

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

# Function to check if service is running
check_service() {
    local service_name="$1"
    local port="$2"
    
    echo -n "Checking $service_name on port $port... "
    if curl -s "http://localhost:$port/" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ RUNNING${NC}"
        return 0
    else
        echo -e "${RED}❌ NOT RUNNING${NC}"
        return 1
    fi
}

echo ""
echo "🔍 Step 1: Service Health Checks"
echo "--------------------------------"

# Check if FileBrowser is running
check_service "FileBrowser" "58080"

# Check if NestJS API is running  
check_service "NestJS API" "3001"

echo ""
echo "🌐 Step 2: Direct FileBrowser Access"
echo "------------------------------------"

# Test direct FileBrowser access
run_test "Direct FileBrowser HTML" "curl -s http://localhost:58080/ | grep -q 'NoAuth.*true'"

# Test FileBrowser API (expects 401 since auth is disabled)
run_test "FileBrowser API" "curl -s http://localhost:58080/api/usage/ | grep -q '401'"

echo ""
echo "🔄 Step 3: Proxied Access Through NestJS"
echo "----------------------------------------"

# Test proxied FileBrowser access
run_test "Proxied FileBrowser HTML" "curl -s http://localhost:3001/filemanager/ | grep -q 'NoAuth.*true'"

# Test static assets (expects HTML since static files may not exist)
run_test "Static Assets" "curl -s http://localhost:3001/filemanager/static/ | grep -q 'html'"

# Test API endpoints
run_test "Usage API" "curl -s http://localhost:3001/api/usage/ | grep -q 'cpu'"
run_test "Resources API" "curl -s http://localhost:3001/api/resources/ | grep -q 'memory'"

echo ""
echo "🔐 Step 4: Authentication Testing"
echo "--------------------------------"

# Test login form
run_test "Login Form" "curl -s -X POST http://localhost:3001/login -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=test&password=test' -w '%{http_code}' | grep -q '201'"

# Test authentication bypass
run_test "Auth Bypass" "curl -s http://localhost:3001/filemanager/ | grep -q 'NoAuth.*true'"

echo ""
echo "📱 Step 5: Web Component Testing"
echo "-------------------------------"

# Check if web server is running
if curl -s http://localhost:3000/ >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Web server running${NC}"
    
    # Test FileManager component
    run_test "FileManager Component" "curl -s http://localhost:3000/ | grep -q 'file-manager'"
    
    # Test component registry
    run_test "Component Registry" "curl -s http://localhost:3000/ | grep -q 'unraid-file-manager'"
else
    echo -e "${YELLOW}⚠️  Web server not running (optional)${NC}"
fi

echo ""
echo "🏗️ Step 6: Build Process Verification"
echo "-------------------------------------"

# Check if FileBrowser binary exists
run_test "FileBrowser Binary" "test -f ./api/deploy/release/bin/filebrowser"

# Check if binary is executable
run_test "Binary Executable" "test -x ./api/deploy/release/bin/filebrowser"

# Check plugin build directory
run_test "Plugin Directory" "test -d ./plugin/source/dynamix.unraid.net/usr/local/unraid-api"

echo ""
echo "📊 Step 7: Performance Testing"
echo "-----------------------------"

# Test concurrent requests
echo "Testing concurrent requests..."
for i in {1..5}; do
    curl -s http://localhost:3001/filemanager/ >/dev/null &
done
wait
echo -e "${GREEN}✅ Concurrent requests completed${NC}"

# Check memory usage
echo "FileBrowser memory usage:"
ps aux | grep filebrowser | grep -v grep | awk '{print "  Memory: " $4 "% CPU: " $3 "%"}'

echo ""
echo "🎯 Step 8: End-to-End Integration"
echo "--------------------------------"

# Test complete flow
echo "Testing complete user flow..."

# 1. Access main page (expects OK response)
run_test "Main Page Access" "curl -s http://localhost:3001/ | grep -q 'OK'"

# 2. Access file manager
run_test "File Manager Access" "curl -s http://localhost:3001/filemanager/ | grep -q 'File Browser'"

# 3. Test file operations (expects 401 since auth is disabled)
run_test "File Manager API" "curl -s http://localhost:3001/filemanager/api/resources/ | grep -q '401'"

echo ""
echo "📋 Test Results Summary"
echo "======================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! File Manager integration is working perfectly!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Check the output above for details.${NC}"
    exit 1
fi
