#!/bin/bash

# Integration Test Script for Unified Payroll Component Architecture
# Tests the new API endpoints with component metadata
#
# Usage: ./test-component-api.sh [token]
#
# If token is not provided, will try to get one from login

set -e

# Configuration
BASE_URL="${API_BASE_URL:-http://localhost:8002}"
DIVISION="${TEST_DIVISION:-AB1}"
GANG="${TEST_GANG:-H1H}"
MONTH="${TEST_MONTH:-12}"
YEAR="${TEST_YEAR:-2025}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() {
    echo -e "${2}[$(date +'%H:%M:%S')]${NC} $1"
}

log_success() {
    log "$1" "$GREEN"
}

log_error() {
    log "$1" "$RED"
}

log_info() {
    log "$1" "$BLUE"
}

log_section() {
    echo -e "\n${CYAN}========================================${NC}"
    log "$1" "$CYAN"
    echo -e "${CYAN}========================================${NC}\n"
}

# Get token if not provided
get_token() {
    if [ -z "$1" ]; then
        log_info "No token provided, attempting to login..."
        response=$(curl -s -X POST "${BASE_URL}/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"username":"admin","password":"admin123"}')

        token=$(echo "$response" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

        if [ -z "$token" ]; then
            log_error "Failed to get token. Please provide token as argument: $0 <token>"
            exit 1
        fi

        log_success "Login successful, token acquired"
        echo "$token"
    else
        echo "$1"
    fi
}

# Test API endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local token=$3

    log_info "Testing: $name"
    log_info "URL: $url"

    response=$(curl -s -w "\n%{http_code}" -X GET "$url" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" -eq 200 ]; then
        log_success "$name: OK (200)"
        echo "$body" | head -c 200
        echo "..."
    else
        log_error "$name: FAILED ($http_code)"
        echo "$body"
        return 1
    fi
}

# Main execution
main() {
    log_section "Unified Payroll Component Architecture - API Integration Tests"
    log_info "Base URL: $BASE_URL"
    log_info "Test Division: $DIVISION"
    log_info "Test Gang: $GANG"
    log_info "Test Period: $MONTH/$YEAR"

    # Get token
    TOKEN=$(get_token "$1")

    # Test 1: Component Registry
    log_section "Test 1: Component Registry"
    test_endpoint "Component Registry" \
        "${BASE_URL}/payroll/components/registry" \
        "$TOKEN"

    # Test 2: Payroll with Components
    log_section "Test 2: Payroll with Components"
    test_endpoint "Payroll with Components" \
        "${BASE_URL}/payroll/report-with-components?division=${DIVISION}&gang_code=${GANG}&month=${MONTH}&year=${YEAR}" \
        "$TOKEN"

    # Test 3: Employee Components (get first employee from payroll data)
    log_section "Test 3: Employee Components"

    # First, get employee list
    log_info "Getting employee list..."
    employees_response=$(curl -s -X GET \
        "${BASE_URL}/payroll/report?division=${DIVISION}&gang_code=${GANG}&month=${MONTH}&year=${YEAR}&limit=1" \
        -H "Authorization: Bearer $TOKEN")

    # Try to extract first employee NIK (simple grep approach)
    first_emp_nik=$(echo "$employees_response" | grep -o '"nik":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$first_emp_nik" ]; then
        log_info "Testing employee components for: $first_emp_nik"
        test_endpoint "Employee Components" \
            "${BASE_URL}/payroll/employee/${first_emp_nik}/components?month=${MONTH}&year=${YEAR}&division=${DIVISION}" \
            "$TOKEN"
    else
        log_error "Could not extract employee NIK from response"
    fi

    # Test 4: Standard Payroll Report (ensure backward compatibility)
    log_section "Test 4: Backward Compatibility"
    test_endpoint "Standard Payroll Report" \
        "${BASE_URL}/payroll/report?division=${DIVISION}&gang_code=${GANG}&month=${MONTH}&year=${YEAR}" \
        "$TOKEN"

    # Test 5: Headers endpoint
    log_section "Test 5: Headers Endpoint"
    test_endpoint "Headers Endpoint" \
        "${BASE_URL}/payroll/headers?month=${MONTH}&year=${YEAR}&gang_code=${GANG}" \
        "$TOKEN"

    log_section "All Tests Complete"
    log_success "Integration tests finished"
}

# Run main
main "$@"
