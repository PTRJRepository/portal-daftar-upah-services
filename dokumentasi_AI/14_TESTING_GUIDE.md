# Testing Guide - Payroll Daftar Upah

## Overview

Dokumen ini menjelaskan cara melakukan testing pada aplikasi Payroll Daftar Upah, mulai dari unit test hingga integration test.

---

## 1. Testing Strategy

### Types of Testing

| Type | Purpose | Tools |
|------|---------|-------|
| **Unit Test** | Test individual functions | Vitest, Bun Test |
| **Integration Test** | Test API endpoints | Vitest, Postman |
| **E2E Test** | Test user flows | Manual, Cypress (planned) |
| **Performance Test** | Test load and speed | Manual, k6 (planned) |

---

## 2. Backend Testing

### 2.1 Bun Test

Backend menggunakan **Bun Test** untuk unit testing.

#### Run Tests

```bash
cd backend
bun test
```

#### Run Specific Test

```bash
bun test src/services/lemburCalculator.test.ts
```

### 2.2 Writing Unit Tests

#### Test File Structure

```typescript
// lemburCalculator.test.ts
import { describe, test, expect, beforeEach } from "bun:test";
import { LemburCalculator } from "./lemburCalculator";

describe("LemburCalculator", () => {
    let calculator: LemburCalculator;

    beforeEach(() => {
        calculator = LemburCalculator.getInstance();
    });

    test("should calculate tier 1 rate for workday", () => {
        const result = calculator.calculateTierRate("WORKDAY_LONG", 2);
        expect(result.tier1_rate).toBe(1.5);
        expect(result.tier2_rate).toBe(2);
    });

    test("should calculate correct UPJ", () => {
        const payRate = 1500000;
        const upj = (payRate * 30) / 173;
        expect(upj).toBeCloseTo(260116);
    });
});
```

#### Test Patterns

```typescript
// Test success case
test("should return data when valid input", async () => {
    const result = await service.getData("valid-id");
    expect(result).toBeDefined();
    expect(result.id).toBe("valid-id");
});

// Test error case
test("should throw error when invalid input", async () => {
    expect(async () => {
        await service.getData("");
    }).toThrow("Invalid ID");
});

// Test with mock
test("should call database with correct query", async () => {
    const mockDb = {
        query: mock(() => Promise.resolve([{ id: 1 }]))
    };
    
    await service.getData(mockDb);
    
    expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT * FROM table WHERE id = ?",
        [1]
    );
});
```

### 2.3 API Testing

#### Using curl

```bash
# Health check
curl http://localhost:8002/health

# Login
curl -X POST http://localhost:8002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Get divisions
curl http://localhost:8002/payroll/divisions \
  -H "Authorization: Bearer <token>"

# Get payroll data
curl "http://localhost:8002/payroll/report/division-raw-tree?division_code=AB1&month=12&year=2025" \
  -H "Authorization: Bearer <token>"
```

#### Using Postman

1. Import collection (jika ada)
2. Set environment variables:
   - `base_url`: http://localhost:8002
   - `token`: (dari login response)
3. Run requests

---

## 3. Frontend Testing

### 3.1 Vitest

Frontend menggunakan **Vitest** untuk testing.

#### Run Tests

```bash
cd frontend
npm run test
```

#### Run in Watch Mode

```bash
npm run test -- --watch
```

### 3.2 Writing Component Tests

#### Test File Structure

```jsx
// GangFilter.test.jsx
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GangFilter from "./GangFilter";

describe("GangFilter", () => {
    const mockGangs = [
        { gang_code: "H1H", description: "Harvester 1H" },
        { gang_code: "H2H", description: "Harvester 2H" }
    ];

    test("renders all gangs", () => {
        render(
            <GangFilter 
                gangs={mockGangs} 
                value="ALL" 
                onChange={() => {}} 
            />
        );
        
        expect(screen.getByText("SEMUA GANG")).toBeInTheDocument();
        expect(screen.getByText("H1H - Harvester 1H")).toBeInTheDocument();
    });

    test("calls onChange when selection changes", () => {
        const handleChange = vi.fn();
        render(
            <GangFilter 
                gangs={mockGangs} 
                value="ALL" 
                onChange={handleChange} 
            />
        );
        
        screen.getByRole("combobox").change({ target: { value: "H1H" } });
        expect(handleChange).toHaveBeenCalledWith("H1H");
    });

    test("disables when loading", () => {
        render(
            <GangFilter 
                gangs={[]} 
                value="ALL" 
                onChange={() => {}} 
                loading={true} 
            />
        );
        
        expect(screen.getByRole("combobox")).toBeDisabled();
    });
});
```

### 3.3 Testing React Hooks

```jsx
// useCurrentPeriod.test.js
import { describe, test, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCurrentPeriod } from "./useCurrentPeriod";

describe("useCurrentPeriod", () => {
    test("returns current period", async () => {
        const { result } = renderHook(() => useCurrentPeriod());
        
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
        
        expect(result.current.month).toBeDefined();
        expect(result.current.year).toBeDefined();
    });
});
```

### 3.4 Testing Context

```jsx
// AuthContext.test.jsx
import { describe, test, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

describe("AuthContext", () => {
    test("provides auth state", () => {
        function TestComponent() {
            const { isAuthenticated } = useAuth();
            return <div>{isAuthenticated ? "Logged in" : "Not logged in"}</div>;
        }

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        expect(screen.getByText("Not logged in")).toBeInTheDocument();
    });
});
```

---

## 4. Integration Testing

### 4.1 Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Login | Enter credentials, submit | Token returned |
| Load Payroll | Select division, period, load | Data displayed |
| Export Excel | Click export button | File downloaded |
| Filter Gang | Select gang from dropdown | Data filtered |

### 4.2 Manual Testing Checklist

#### Authentication

- [ ] Login dengan credentials valid
- [ ] Login dengan credentials invalid
- [ ] Logout berhasil
- [ ] Token expired handling

#### Payroll Report

- [ ] Data load untuk semua divisi
- [ ] Data load untuk divisi spesifik
- [ ] Filter gang berfungsi
- [ ] Period selection berfungsi
- [ ] Totals kalkulasi benar

#### Export

- [ ] Export Excel berhasil
- [ ] Print preview benar
- [ ] Google Spreadsheet sync berhasil

---

## 5. Performance Testing

### 5.1 Load Testing

#### Manual Load Test

```bash
# Test dengan banyak data
curl "http://localhost:8002/payroll/report/division-raw-tree?division_code=ALL&month=12&year=2025" \
  -H "Authorization: Bearer <token>" \
  -w "Time: %{time_total}s\n"
```

#### Performance Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| API Response Time | < 500ms | curl -w, DevTools |
| Page Load Time | < 3s | Lighthouse |
| Grid Render Time | < 1s | Console timing |
| Memory Usage | < 500MB | DevTools Memory |

### 5.2 Stress Testing

```bash
# Multiple concurrent requests
for i in {1..10}; do
  curl "http://localhost:8002/health" &
done
wait
```

---

## 6. Test Data

### 6.1 Sample Data

#### Test Employee

```json
{
    "nik": "TEST001",
    "nama": "Test Employee",
    "gang_code": "H1H",
    "pay_rate": 150000,
    "beras_rate": 3750
}
```

#### Test Period

```json
{
    "month": 12,
    "year": 2025
}
```

### 6.2 Test Database

Untuk testing, gunakan database development:
- Profile: `SERVER_PROFILE_1`
- Database: `extend_db_ptrj`

---

## 7. Debugging Tests

### 7.1 Debug Mode

```bash
# Vitest debug
npm run test -- --reporter=verbose

# Bun test debug
bun test --verbose
```

### 7.2 Console Logging

```typescript
// In test file
test("debug test", () => {
    console.log("Debug output:", result);
    expect(result).toBeDefined();
});
```

### 7.3 VS Code Debugging

Create `.vscode/launch.json`:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Debug Tests",
            "runtimeExecutable": "npm",
            "runtimeArgs": ["run", "test"],
            "cwd": "${workspaceFolder}/frontend"
        }
    ]
}
```

---

## 8. Continuous Integration

### 8.1 GitHub Actions

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install Backend
        run: cd backend && bun install
      
      - name: Test Backend
        run: cd backend && bun test
      
      - name: Install Frontend
        run: cd frontend && npm install
      
      - name: Test Frontend
        run: cd frontend && npm test
```

---

## 9. Test Coverage

### 9.1 Generate Coverage Report

```bash
# Frontend
cd frontend
npm run test -- --coverage

# Backend
cd backend
bun test --coverage
```

### 9.2 Coverage Goals

| Area | Target Coverage |
|------|-----------------|
| Services | 80% |
| Components | 70% |
| Utils | 90% |
| Overall | 75% |

---

## 10. Testing Best Practices

### Do's

- Write tests before fixing bugs
- Test edge cases
- Keep tests simple and focused
- Use descriptive test names
- Mock external dependencies

### Don'ts

- Test implementation details
- Write flaky tests
- Skip tests when in a hurry
- Ignore failing tests
- Over-mock

---

## 11. Test Maintenance

### Regular Tasks

- [ ] Run full test suite weekly
- [ ] Update test data periodically
- [ ] Remove obsolete tests
- [ ] Refactor slow tests
- [ ] Add tests for new features

### Test Review Checklist

- [ ] Test covers the requirement
- [ ] Test is not flaky
- [ ] Test runs in reasonable time
- [ ] Test has clear assertions
- [ ] Test cleans up after itself

---

## 12. Troubleshooting Tests

### Common Issues

#### Test Fails Intermittently

**Cause:** Race condition, timing issue
**Solution:** Use `waitFor`, add delays, mock timers

#### Test Passes but Code Broken

**Cause:** Test doesn't cover actual usage
**Solution:** Add integration tests, review test coverage

#### Mock Not Working

**Cause:** Wrong mock path, mock not reset
**Solution:** Check import paths, use `beforeEach` to reset

---

## 13. Resources

### Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Testing Library](https://testing-library.com/)

### Tools

- **Postman** - API testing
- **Chrome DevTools** - Frontend debugging
- **Bun Inspector** - Backend debugging

---

*Dokumentasi testing ini dibuat untuk memastikan kualitas dan keandalan aplikasi Payroll Daftar Upah.*