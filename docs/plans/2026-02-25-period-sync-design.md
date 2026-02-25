# Period Selection Synchronization Design

**Date:** 2026-02-25
**Status:** Approved

## Problem Statement

Period selection (month/year) is not synchronized across pages:
- Dashboard uses API-based period from `useCurrentPeriod` hook (no persistence)
- TaxReportPage has its own localStorage (`tax_report_month`, `tax_report_year`)
- User's period selection on dashboard is not remembered across sessions
- Pages do not share period state

## Requirements

1. Dashboard period should be persisted to localStorage
2. All pages should share the same period (global sync)
3. Changing period on ANY page updates ALL pages

## Solution: Centralized Period Management via ReportContext

### Architecture

Enhance `useCurrentPeriod` hook with localStorage persistence, making it the single source of truth. `ReportContext` already wraps the entire app, so all pages using `useReport()` will automatically sync.

### localStorage Keys

```
report_period_month  - Shared period month (1-12)
report_period_year   - Shared period year (YYYY)
```

### Data Flow

#### Initialization (App Load)
```
1. useCurrentPeriod hook mounts
2. Check localStorage for 'report_period_month' and 'report_period_year'
3. If found → Use stored values
4. If not found → Call API /api/current-period
5. API result → Save to localStorage for future sessions
```

#### Period Change (User Action)
```
1. User selects new month/year on ANY page
2. setMonth() or setYear() called via useReport()
3. useCurrentPeriod updates state AND saves to localStorage
4. All pages using useReport() re-render with new period
5. Next app load: Restored from localStorage
```

## Implementation Changes

### File 1: `frontend/src/hooks/useCurrentPeriod.js`

**Add localStorage persistence:**

```javascript
// localStorage keys
const STORAGE_KEYS = {
  MONTH: 'report_period_month',
  YEAR: 'report_period_year'
};

// Initialize from localStorage or current date
const [month, setMonthState] = useState(() => {
  const stored = localStorage.getItem(STORAGE_KEYS.MONTH);
  return stored ? parseInt(stored) : new Date().getMonth() + 1;
});

const [year, setYearState] = useState(() => {
  const stored = localStorage.getItem(STORAGE_KEYS.YEAR);
  return stored ? parseInt(stored) : new Date().getFullYear();
});

// Create persisting wrappers
const setMonth = useCallback((val) => {
  setMonthState(val);
  localStorage.setItem(STORAGE_KEYS.MONTH, JSON.stringify(val));
}, []);

const setYear = useCallback((val) => {
  setYearState(val);
  localStorage.setItem(STORAGE_KEYS.YEAR, JSON.stringify(val));
}, []);

// Return wrapped setters
return { month, year, setMonth, setYear, ... }
```

### File 2: `frontend/src/pages/TaxReportPage.jsx`

**Remove duplicate localStorage logic, use shared context:**

**Remove:**
- `STORAGE_KEYS` constant (lines 11-17)
- `loadFromStorage` and `saveToStorage` functions (lines 20-36)
- localStorage-based state initialization
- localStorage persistence useEffect

**Add:**
```javascript
const { month, setMonth, year, setYear } = useReport();
```

**Replace:**
- `selectedMonth` → `month`
- `selectedYear` → `year`
- `setSelectedMonth` → `setMonth`
- `setSelectedYear` → `setYear`

## Benefits

1. **Single Source of Truth**: All pages use `ReportContext` for period
2. **Persistence**: User's period selection remembered across sessions
3. **Auto-Sync**: Changes propagate to all pages automatically
4. **Simplified Code**: Remove duplicate localStorage logic from TaxReportPage

## Testing Checklist

- [ ] Change period on Dashboard → persists after page refresh
- [ ] Change period on TaxReport → Dashboard shows same period
- [ ] Change period on any page → all pages reflect new period
- [ ] Fresh session (no localStorage) → uses API current period
- [ ] Existing localStorage → uses stored values on load
