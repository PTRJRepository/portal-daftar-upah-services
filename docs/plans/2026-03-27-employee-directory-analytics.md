# HR Employee Directory & Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Employee Directory page into an intuitive HR Employee Directory with gang filtering, religion/agama filtering, NIK search, and analytics dashboard showing employee distributions.

**Architecture:** Single new page (`EmployeeDirectoryAnalytics.jsx`) that combines an analytics dashboard (summary cards + charts) with the existing employee directory table. Analytics are computed client-side from the fetched employee list. Gang filter uses the existing `/payroll/employee/available-gangs` endpoint. Backend may need a minor enhancement to support gang_code filter on the `/list` endpoint.

**Tech Stack:** React (frontend), AG Grid (table), CSS-only charts (bar/pie via CSS grid), `fetch` API.

---

## Task 1: Enhance Backend — Add gang_code Filter to Employee List API

**File:** Modify: `backend/src/api/employee.ts:38-67`
**File:** Modify: `backend/src/services/employee/EmployeeRepository.ts` (find `list` method)

**Step 1: Read the EmployeeRepository.list method**

Run: Read the `list` method in `backend/src/services/employee/EmployeeRepository.ts` — find the SQL query and parameter handling.

**Step 2: Add gang_code parameter to list endpoint**

In `backend/src/api/employee.ts`, add `gang_code` to the query params on the `/list` route (around line 38-67):

```typescript
// Around line 38-56, change:
.get("/list", async ({ query, currentUser }) => {
    let division = query.division || undefined;
    let gangCode = query.gang_code || undefined;  // ADD THIS
    const religion = query.religion || undefined;
    const status = query.status || undefined;

    // ... existing Kerani check ...

    const employees = await employeeRepository.list({
        gangCode: gangCode,           // ADD THIS
        division: division,
        religion: religion,
        status: status,
        skip: parseInt(query.skip || "0"),
        limit: parseInt(query.limit || "500")
    });
    return { count: employees.length, data: employees };
}, {
    query: t.Object({
        gang_code: t.Optional(t.String()),  // ADD THIS
        division: t.Optional(t.String()),
        religion: t.Optional(t.String()),
        status: t.Optional(t.String()),
        skip: t.Optional(t.String()),
        limit: t.Optional(t.String())
    })
})
```

**Step 3: Read the repository list method**

Find the `list` method in `EmployeeRepository.ts`. It likely accepts an object with `division`, `religion`, `status` params. Add `gangCode` parameter:

```typescript
// In the list() method signature and SQL query, add:
// 1. Accept gangCode parameter
// 2. Add gang_code filter to WHERE clause if provided
// Example (assuming existing pattern):
async list(opts: {
    gangCode?: string;      // ADD
    division?: string;
    religion?: string;
    status?: string;
    skip?: number;
    limit?: number;
} = {}): Promise<EmployeeInfo[]> {
    // Add gang_code filter near the existing division filter:
    // if (opts.gangCode) {
    //     sql += ` AND e.GangCode = ?`;
    //     params.push(opts.gangCode);
    // }
}
```

**Step 4: Add endpoint to fetch gangs filtered by division**

In `backend/src/api/employee.ts`, enhance the `/available-gangs` endpoint (around line 89-93) to support optional division filter:

```typescript
.get("/available-gangs", async ({ query }) => {
    const division = query.division || undefined;
    const gangs = await employeeRepository.getAvailableGangs(division);
    return { count: gangs.length, gangs };
}, {
    query: t.Object({
        division: t.Optional(t.String())
    })
})
```

**Step 5: Update EmployeeRepository.getAvailableGangs**

In `EmployeeRepository.ts`, add division parameter:

```typescript
async getAvailableGangs(division?: string): Promise<string[]> {
    // If division is provided, filter gangs belonging to that division
    // e.g., for division PG1A, return gangs starting with H or matching the division pattern
}
```

**Step 6: Test the endpoint**

Run: `cd backend && bun run dev`
Test: `curl "http://localhost:8002/payroll/employee/available-gangs?division=PG1A" -H "Authorization: Bearer <token>"`
Verify: Returns list of gang codes for the division.

**Step 7: Commit**

```bash
cd "D:\Gawean Rebinmas\PORTAL_ESTATE\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production"
git add backend/src/api/employee.ts backend/src/services/employee/EmployeeRepository.ts
git commit -m "feat(employee-api): add gang_code filter to list endpoint and division filter to available-gangs"
```

---

## Task 2 (Updated): Full Analytics Dashboard

**Analytics to include:**
- KPI Cards: Total Karyawan, Laki-laki, Perempuan, Aktif, Rata-rata Usia, Rata-rata Masa Kerja
- Bar Charts (6 charts): Distribusi Agama, Distribusi Divisi, Top 10 Gang, Distribusi Gender, Distribusi Range Usia, Distribusi Range Masa Kerja, Distribusi Range Gaji



**File:** Create: `frontend/src/pages/EmployeeDirectoryAnalytics.jsx`

**Step 1: Write the new page component**

Create the full component at `frontend/src/pages/EmployeeDirectoryAnalytics.jsx`. The page has THREE sections:

1. **Header** — Title + description
2. **Analytics Dashboard** — KPI cards + mini bar charts (always visible after first fetch)
3. **Directory Table** — AG Grid with full filters

Key features:
- **Filters (top bar):** Division dropdown → Gang dropdown (populated from API), Religion dropdown, Gender dropdown, Status dropdown, Search input (NIK/Name)
- **Analytics Dashboard (below filters, above table):** Show when data is loaded
  - KPI Cards: Total Employees, By Gender (L/P counts), By Religion count, Active count
  - Bar Charts: Distribution by Division, Distribution by Religion, Distribution by Gang (top 10 gangs)
  - Each chart is CSS-only (no chart library needed — use colored div bars)
- **Employee Table:** AG Grid with columns: NIK (KTP), Emp Code, Nama, Gender, Religion, Status, Gang, Lokasi, Action button ("Lihat Profil HR")

```jsx
// Structure of the component:
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildAppPath } from '../utils/prodModeUtils';
import AgGridWrapper from '../components/common/AgGridWrapper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002';

// --- API Functions ---
async function fetchAvailableGangs(token, division) { /* ... */ }
async function fetchEmployees(token, filters) { /* ... */ }
async function fetchAvailableReligions(token) { /* ... */ }
async function fetchAvailableStatuses(token) { /* ... */ }

// --- Analytics Helpers ---
function computeAnalytics(employees) {
    // Returns: total, byGender, byReligion, byDivision, byGang, byStatus, avgAge, avgSeniority
}

// --- CSS-only Bar Chart Component ---
function BarChart({ data, title, maxItems = 10 }) { /* ... */ }
// Renders: title + list of labeled bars with percentages

// --- Main Page Component ---
export default function EmployeeDirectoryAnalytics() {
    const { token } = useAuth();
    const navigate = useNavigate();

    // State: filters
    const [division, setDivision] = useState('ALL');
    const [gang, setGang] = useState('');
    const [religion, setReligion] = useState('');
    const [gender, setGender] = useState('');
    const [status, setStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // State: options
    const [availableGangs, setAvailableGangs] = useState([]);
    const [availableReligions, setAvailableReligions] = useState([]);
    const [availableStatuses, setAvailableStatuses] = useState([]);

    // State: data
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Computed analytics
    const analytics = useMemo(() => computeAnalytics(employees), [employees]);

    // Load filter options on mount
    useEffect(() => {
        if (!token) return;
        fetchAvailableReligions(token).then(setAvailableReligions);
        fetchAvailableStatuses(token).then(setAvailableStatuses);
    }, [token]);

    // Load gangs when division changes
    useEffect(() => {
        if (!token || division === 'ALL') {
            setAvailableGangs([]);
            setGang('');
            return;
        }
        fetchAvailableGangs(token, division).then(setAvailableGangs);
        setGang('');
    }, [token, division]);

    // Load employees when any filter changes
    useEffect(() => {
        handleFetch();
    }, [division, gang, religion, status]);

    // Manual search trigger
    const handleFetch = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchEmployees(token, { division, gang, religion, status });
            setEmployees(data);
            setHasLoaded(true);
        } catch (e) {
            console.error(e);
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    }, [token, division, gang, religion, status]);

    const handleSearch = useCallback(async () => {
        // If search term is entered, call search endpoint instead
        if (searchTerm.trim().length >= 2) {
            // Use /payroll/employee/search?q=...
            // Then apply client-side filters (gang, religion, gender, status)
        } else {
            handleFetch();
        }
    }, [searchTerm, token, division, gang, religion, status, handleFetch]);

    const handleViewProfile = (nik) => { /* ... open hr-info tab ... */ };

    // Column definitions
    const columnDefs = useMemo(() => [/* ... existing columns ... */], []);

    return (
        <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            {/* Header */}
            <h1>Direktori & Analisis Karyawan</h1>
            <p>Cari dan analisis data karyawan berdasarkan gang, agama, atau NIK.</p>

            {/* Filter Bar */}
            <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                {/* Row 1: Division + Gang + Religion + Gender + Status */}
                {/* Row 2: Search bar + Search button */}
            </div>

            {/* Analytics Dashboard (visible after first load) */}
            {hasLoaded && !loading && employees.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    {/* KPI Cards Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                        <KPICard title="Total Karyawan" value={analytics.total} icon="👥" />
                        <KPICard title="Laki-laki" value={analytics.byGender['L'] || 0} icon="♂️" />
                        <KPICard title="Perempuan" value={analytics.byGender['P'] || 0} icon="♀️" />
                        <KPICard title="Aktif" value={analytics.activeCount} icon="✅" />
                    </div>

                    {/* Charts Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <BarChart data={analytics.byReligion} title="Distribusi Agama" />
                        <BarChart data={analytics.byDivision} title="Distribusi Divisi" />
                        <BarChart data={analytics.topGangs} title="Top 10 Gang" />
                    </div>
                </div>
            )}

            {/* Employee Table */}
            <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                {/* Table content */}
            </div>
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/EmployeeDirectoryAnalytics.jsx
git commit -m "feat: add EmployeeDirectoryAnalytics page with filters and analytics dashboard"
```

---

## Task 3: Add KPI Card & Bar Chart Components

**File:** Create: `frontend/src/components/employee/DirectoryAnalyticsCards.jsx`

**Step 1: Create reusable components**

Create two reusable components:

```jsx
// KPICard: Small stat card with icon, label, value
export function KPICard({ title, value, icon, subtitle }) {
    return (
        <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
        }}>
            <span style={{ fontSize: '2rem' }}>{icon}</span>
            <div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                    {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>{title}</div>
                {subtitle && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{subtitle}</div>}
            </div>
        </div>
    );
}

// BarChart: CSS-only horizontal bar chart
export function BarChart({ data, title, maxItems = 10, color = '#3b82f6' }) {
    // data is an array of { label, value }
    // Sort by value descending, take top maxItems
    // Calculate max value for percentage
    // Render title + list of rows: [label] [=====bar=====] [value] [percentage]
    return (
        <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
        }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.75rem' }}>{title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sortedData.map((item, i) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '80px', fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.label}
                        </span>
                        <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '4px', height: '16px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${(item.value / maxVal) * 100}%`,
                                background: color,
                                height: '100%',
                                borderRadius: '4px',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <span style={{ width: '60px', fontSize: '0.75rem', fontWeight: '600', color: '#334155', textAlign: 'right' }}>
                            {item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/employee/DirectoryAnalyticsCards.jsx
git commit -m "feat: add KPICard and BarChart components for directory analytics"
```

---

## Task 4: Add Route to App.jsx

**File:** Modify: `frontend/src/App.jsx`

**Step 1: Add import**

Around line 21, add:
```jsx
import EmployeeDirectoryAnalytics from './pages/EmployeeDirectoryAnalytics'
```

**Step 2: Add route**

In the DashboardLayout routes section (around line 636), add:
```jsx
<Route path="employee-directory-v2" element={<SummaryReportWrapper component={EmployeeDirectoryAnalytics} />} />
```

**Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add employee-directory-v2 route"
```

---

## Task 5: Test End-to-End

**Step 1: Start backend**

```bash
cd backend && bun run dev
```

**Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

**Step 3: Navigate to the new page**

Open: `http://localhost:5173/employee-directory-v2`

**Step 4: Verify functionality**

1. Page loads with filter bar and empty state
2. Select "PG1A" division → gang dropdown populates
3. Select a gang → click Search → table populates
4. Analytics dashboard appears (KPI cards + 3 bar charts)
5. Filter by Religion → table updates
6. Search by NIK → table updates
7. Click "Lihat Profil HR" → opens in new tab
8. Test with all divisions and combinations

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete employee directory analytics feature"
```

---

## Task 6: Verify and Fix

**Step 1: Check browser console for errors**

**Step 2: Check if gang filter actually filters data (not just UI)**

**Step 3: Verify analytics dashboard shows correct data**

**Step 4: Fix any issues found**

---

## Files to Create/Modify Summary

| Action | File |
|--------|------|
| Modify | `backend/src/api/employee.ts` — add gang_code param to list, division param to available-gangs |
| Modify | `backend/src/services/employee/EmployeeRepository.ts` — add gangCode to list(), division to getAvailableGangs() |
| Create | `frontend/src/pages/EmployeeDirectoryAnalytics.jsx` — full page with analytics + table |
| Create | `frontend/src/components/employee/DirectoryAnalyticsCards.jsx` — KPICard + BarChart components |
| Modify | `frontend/src/App.jsx` — add import + route |
| Test | Manual E2E test |

## Open Questions

1. **What analytics to show beyond the basics?** The plan includes: by agama, by divisi, top gangs, by gender, aktif count. Do you want age distribution or seniority distribution too? (Requires birth_date or join_date from employee data — if available, we can add them)

2. **Should this replace the old `EmployeeDirectoryPage` or coexist?** The plan creates a new route (`/employee-directory-v2`). We can keep both and link from the old page, or remove the old one.

3. **What colors for the bar charts?** Blue (`#3b82f6`) by default. Should we use different colors per chart?
