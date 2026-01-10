---
tags: [AI-Context, Recall, Test-Mode, Authentication, Payroll-System]
project: Daftar Upah Reporting System
date: 2025-11-17
type: project-context
---

# 2025-11-17 - AI Context: Test Mode Setup and Authentication Fix

## Project Overview
**Daftar Upah Reporting System** - Payroll reporting application for PT Rebinmas with Excel and HTML output generation.

## Current Session: Test Mode Authentication Setup

### Problem Identified
- Frontend showing `Cannot read properties of null (reading 'divisions')` error at App.jsx:210
- 401 errors when making requests to backend in test mode
- Login page still appearing despite test mode configuration

### Solutions Implemented

#### 1. Fixed Null Divisions Error
- **File**: `frontend/src/App.jsx`
- **Issue**: User object was null when component tried to access `user.divisions`
- **Solution**: Added loading screen for test mode while user is being initialized
- **Code**: Added conditional rendering for `TEST_MODE && !user` state

#### 2. Enhanced Test Token Management
- **File**: `backend/token.json`
- **Update**: Created permanent test token with project-specific identifier
- **Token**: `permanent-testing-token-2025-rebinmas-daftar-upah`
- **Purpose**: Eliminates 401 errors in test mode

#### 3. Improved AuthContext Auto-Login
- **File**: `frontend/src/context/AuthContext.jsx`
- **Enhancements**:
  - Added fallback mechanism if `/auth/test-token` endpoint fails
  - Set initial loading state to `true` in test mode
  - Modified `isAuthenticated` logic to use `!!user` in test mode instead of `!!token`
  - Added detailed logging for debugging

#### 4. HTTP Setup Token Injection
- **File**: `frontend/src/utils/httpSetup.js`
- **Features**: Already well-configured with:
  - Automatic token injection for all requests
  - 401 retry mechanism with test token
  - LocalStorage persistence

#### 5. Backend Test Token Endpoint
- **File**: `backend/app/api/auth.py`
- **Endpoint**: `GET /auth/test-token`
- **Function**: Returns permanent test token with "never" expiration
- **Status**: ✅ Working correctly

### Current Architecture

#### Frontend Configuration
- **Test Mode Detection**: `VITE_DEV_MODE=true` or `DEV_MODE=true`
- **Default User**: Admin with access to all divisions
- **Divisions**: PG1A, PG1B, PG2A, PG2B, DME, ARA, ARB1, ARB2, INFRA, AREC, IJL, STF-OFFICE, SECURITY
- **Auto-Defaults**: Month=2025-05, Division=ARB2, Gang=H1H (searched automatically)

#### Backend Configuration
- **Test Mode**: `TEST_MODE=true` environment variable
- **Token File**: `backend/token.json` with permanent token
- **Auth Bypass**: Automatic user injection in test mode
- **Database**: MSSQL connection to db_ptrj

### Development Workflow

#### Starting the Application
1. **Backend**: `cd backend && python main.py` (runs on http://localhost:8000)
2. **Frontend**: `cd frontend && npm run dev:test` (runs on http://localhost:5175)
3. **Alternative Frontend**: `npx vite --port 5175 --mode test`

#### Test Mode Features
- ✅ Auto-login as admin user
- ✅ No authentication required
- ✅ Permanent test token injection
- ✅ Default values for quick testing
- ✅ Gang and month selection UI
- ✅ Bypass of login screen

### Key Files Modified
1. `frontend/src/App.jsx` - Added loading screen for test mode
2. `frontend/src/context/AuthContext.jsx` - Enhanced auto-login logic
3. `backend/token.json` - Updated with project-specific token

### Next Session Recommendations
1. Test the complete workflow: gang selection → month selection → report generation
2. Verify performance with large datasets
3. Test Excel and HTML output generation
4. Validate data accuracy against reference reports
5. Consider adding more test scenarios for different divisions and gangs

### Development Commands Reference
```bash
# Backend
cd backend && python main.py

# Frontend (Test Mode)
cd frontend && npm run dev:test
# Alternative:
npx vite --port 5175 --mode test

# Test Token Endpoint
curl -X GET http://localhost:8000/auth/test-token

# Environment Variables
TEST_MODE=true
VITE_DEV_MODE=true
DEFAULT_GANG=H1H
DEFAULT_MONTH=5
DEFAULT_YEAR=2025
```

## Related Notes
- [[2025-11-17-AI-Context-Project-Architecture]] - Main project architecture
- [[Template-Engine-Documentation]] - Excel and HTML templating system
- [[Database-Configuration]] - MSSQL setup and queries