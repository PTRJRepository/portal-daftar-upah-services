# Struktur Frontend - Payroll Daftar Upah

## Overview

Frontend dibangun menggunakan **React 18** + **Vite** + **AG Grid Enterprise**. Aplikasi menggunakan pola **Context API** untuk state management dan **React Router** untuk routing.

---

## 1. Struktur Folder Frontend

```
frontend/
|-- src/
|   |-- main.jsx              # Entry point
|   |-- App.jsx               # Root component
|   |
|   |-- components/           # Reusable Components
|   |   |-- AggregationSeederModal.jsx
|   |   |-- CellInspector.jsx
|   |   |-- CostHKComparisonReport.jsx
|   |   |-- CostPerTonAnalysis.jsx
|   |   |-- CustomPayrollTable.jsx
|   |   |-- LegacyPayrollGrid.jsx
|   |   |-- PayslipCard.jsx
|   |   |-- SalaryRangeModal.jsx
|   |   |-- SummaryWagesReport.jsx
|   |   |-- TunjanganDisplay.jsx
|   |   |
|   |   |-- common/           # Common/Shared Components
|   |   |   |-- AgGridWrapper.jsx
|   |   |   |-- ComponentMetadataViewer.jsx
|   |   |   |-- DivisionTabs.jsx
|   |   |   |-- GangCardGrid.jsx
|   |   |   |-- GangFilter.jsx
|   |   |   |-- HierHeaderGroup.jsx
|   |   |   |-- LoadingScreen.jsx
|   |   |   |-- Modal.jsx
|   |   |   |-- MonthPicker.jsx
|   |   |   |-- MonthSelector.jsx
|   |   |   |-- PrintModeSelector.jsx
|   |   |   |-- ReportToolbar.jsx
|   |   |   |-- SelectedCellStatusBar.jsx
|   |   |   |-- SelectionStats.jsx
|   |   |   |-- SelectionStatusBar.jsx
|   |   |   |-- SummaryActionBar.jsx
|   |   |   |-- SummaryKPICards.jsx
|   |   |   |-- TableContextMenu.jsx
|   |   |   |-- TestModePanel.jsx
|   |   |
|   |   |-- dashboard/        # Dashboard Components
|   |   |   |-- GangComparisonChart.jsx
|   |   |   |-- GangCostBreakdownChart.jsx
|   |   |   |-- GangDetailModal.jsx
|   |   |   |-- GangTrendChart.jsx
|   |   |   |-- KPICard.jsx
|   |   |   |-- PremiCompositionChart.jsx
|   |   |   |-- TopBottomPerformersCard.jsx
|   |   |
|   |   |-- employee/         # Employee Components
|   |   |   |-- EmployeeDetailPage.jsx
|   |   |
|   |   |-- layout/           # Layout Components
|   |       |-- DashboardLayout.jsx
|   |
|   |-- context/              # React Context Providers
|   |   |-- AuthContext.jsx
|   |   |-- GangFilterContext.jsx
|   |   |-- HeaderContext.jsx
|   |   |-- ReportContext.jsx
|   |
|   |-- hooks/                # Custom React Hooks
|   |   |-- useCurrentPeriod.js
|   |
|   |-- layouts/              # Layout Templates
|   |   |-- DashboardLayout.jsx
|   |
|   |-- pages/                # Page Components
|   |   |-- AggregationSeederPage.jsx
|   |   |-- AnalysisReportPage.jsx
|   |   |-- ComponentMetadataTestPage.jsx
|   |   |-- DashboardHome.jsx
|   |   |-- DivisionDetailCard.jsx
|   |   |-- EmployeeDetailRoute.jsx
|   |   |-- Employees.jsx
|   |   |-- ExecutivePayrollPage.jsx
|   |   |-- GangComparisonReportPage.jsx
|   |   |-- HighEarnerReportPage.jsx
|   |   |-- ImpactReportPage.jsx
|   |   |-- LockedMainPage.jsx
|   |   |-- LoginPage.jsx
|   |   |-- MainPage.jsx
|   |   |-- onlyIJLReportPages.jsx
|   |   |-- PayrollAnalysisPage.jsx
|   |   |-- PayslipPrintPage.jsx
|   |   |-- Report.jsx
|   |   |-- SalaryRangeDetailPage.jsx
|   |   |-- SpreadsheetSyncPage.jsx
|   |   |-- SummaryReportPage.jsx
|   |   |-- WagesSummaryIJLPage.jsx
|   |   |-- WagesSummaryRebinmasPage.jsx
|   |
|   |-- services/             # API Client Services
|   |   |-- aggregationEngine.js
|   |   |-- aggregationSeederService.js
|   |   |-- authService.js
|   |   |-- cookieService.js
|   |   |-- costHKService.js
|   |   |-- employeeDetailService.js
|   |   |-- employeeService.js
|   |   |-- gangFilterService.js
|   |   |-- gangService.js
|   |   |-- headerService.js
|   |   |-- historyService.js
|   |   |-- lockedDivisionService.js
|   |   |-- payrollService.js
|   |   |-- payslipService.js
|   |   |-- summaryReportService.js
|   |   |-- validationService.js
|   |
|   |-- styles/               # CSS Stylesheets
|   |   |-- ag-grid-professional.css
|   |   |-- aggregation-seeder.css
|   |   |-- analysis-report-print.css
|   |   |-- animations.css
|   |   |-- cost-hk-report.css
|   |   |-- CustomPayrollTable.css
|   |   |-- dashboard-modern.css
|   |   |-- financial-summary.css
|   |   |-- gang-report-print.css
|   |   |-- impact-report.css
|   |   |-- payslip-print.css
|   |   |-- print-optimization.css
|   |   |-- print-overrides.css
|   |   |-- report.css
|   |   |-- summary-report.css
|   |   |-- summary-wages-print.css
|   |   |-- theme.css
|   |   |-- wages-summary-professional.css
|   |   |-- wages-summary-rebinmas.css
|   |
|   |-- utils/                # Utility Functions
|       |-- aggregationUtils.js
|       |-- exportPayrollToExcel.js
|       |-- FormulaRegistry.js
|       |-- httpSetup.js
|       |-- PayrollAggregator.js
|       |-- pdfGenerator.js
|       |-- printOptimizer.js
|       |-- prodModeUtils.js
|
|-- __tests__/               # Test Files
|   |-- expandCollapse.test.jsx
|   |-- hierarchy.test.js
|
|-- index.html               # HTML Entry
|-- vite.config.js           # Vite Config
|-- package.json             # Dependencies
```

---

## 2. Entry Point (main.jsx)

### Kode

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/theme.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

## 3. Root Component (App.jsx)

### Struktur

```jsx
export default function App() {
  const basename = getBasePath(); // '/upah' in proxy mode

  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <ReportProvider>
          <AppInner />
        </ReportProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppInner() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen isLoading={true} message="Menyiapkan sistem..." />;
  }

  return (
    <Suspense fallback={<LoadingScreen isLoading={true} message="Memuat halaman..." />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="operational" element={<OperationalReportWrapper />} />
          <Route path="summary" element={<SummaryReportPage />} />
          {/* ... more routes */}
        </Route>
      </Routes>
    </Suspense>
  );
}
```

### Route Table

| Path | Component | Description |
|------|-----------|-------------|
| `/login` | LoginPage | Halaman login |
| `/` | DashboardHome | Dashboard utama |
| `/operational` | CustomPayrollTable | Tabel payroll |
| `/summary` | SummaryReportPage | Ringkasan |
| `/comprehensive` | PayrollAnalysisPage | Analisis payroll |
| `/employee/detail` | EmployeeDetailRoute | Detail karyawan |
| `/payslip-print` | PayslipPrintPage | Cetak slip |

---

## 4. Context Providers

### AuthContext.jsx

**Fungsi:** Mengelola state autentikasi

```jsx
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check token on mount
  useEffect(() => {
    const savedToken = Cookies.get('token');
    if (savedToken) {
      verifyToken(savedToken).then(user => {
        setUser(user);
        setToken(savedToken);
      });
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await authService.login(username, password);
    setToken(response.token);
    setUser(response.user);
    Cookies.set('token', response.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    Cookies.remove('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### ReportContext.jsx

**Fungsi:** Mengelola state filter laporan

```jsx
export function ReportProvider({ children }) {
  const [division, setDivision] = useState('ALL');
  const [gang, setGang] = useState('ALL');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [gangs, setGangs] = useState([]);
  const [gangLoading, setGangLoading] = useState(false);

  // Fetch gangs when division changes
  useEffect(() => {
    if (division) {
      setGangLoading(true);
      gangService.fetchGangs(division).then(setGangs).finally(() => setGangLoading(false));
    }
  }, [division]);

  return (
    <ReportContext.Provider value={{
      division, setDivision,
      gang, setGang,
      month, setMonth,
      year, setYear,
      gangs, gangLoading
    }}>
      {children}
    </ReportContext.Provider>
  );
}
```

### GangFilterContext.jsx

**Fungsi:** Mengelola filter gang yang lebih kompleks

---

## 5. Layout Component

### DashboardLayout.jsx

**Struktur:**

```jsx
export default function DashboardLayout() {
  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <img src="/images/logo.webp" alt="Logo" />
        </div>
        <nav className="nav-menu">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/operational">Operational Report</NavLink>
          <NavLink to="/summary">Summary Report</NavLink>
          <NavLink to="/comprehensive">Payroll Analysis</NavLink>
          {/* ... more links */}
        </nav>
        <div className="user-info">
          <span>{user?.username}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet /> {/* Page content rendered here */}
      </main>
    </div>
  );
}
```

---

## 6. Page Components

### DashboardHome.jsx

**Fungsi:** Halaman utama dengan KPI cards dan quick links

```jsx
export default function DashboardHome() {
  const { token } = useAuth();
  const [kpiData, setKpiData] = useState(null);

  useEffect(() => {
    dashboardService.getKPI().then(setKpiData);
  }, [token]);

  return (
    <div className="dashboard-home">
      <h1>Dashboard</h1>
      
      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard title="Total Karyawan" value={kpiData?.total_employees} />
        <KPICard title="Total HK" value={kpiData?.total_hk} />
        <KPICard title="Total Upah" value={kpiData?.total_upah} format="currency" />
      </div>

      {/* Quick Links */}
      <div className="quick-links">
        <Link to="/operational" className="card">Operational Report</Link>
        <Link to="/summary" className="card">Summary Report</Link>
        <Link to="/comprehensive" className="card">Payroll Analysis</Link>
      </div>
    </div>
  );
}
```

### PayrollAnalysisPage.jsx

**Fungsi:** Halaman analisis payroll dengan filter dan breakdown

```jsx
export default function PayrollAnalysisPage() {
  const { division, gang, month, year } = useReport();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('SEMUA');

  useEffect(() => {
    payrollService.getDivisionRawTree(division, month, year).then(setData);
  }, [division, gang, month, year]);

  // Filter data based on tab
  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.gangs.flatMap(g => g.employees).filter(emp => {
      if (activeTab === 'LEMBUR') return emp.lembur_jumlah > 0;
      if (activeTab === 'PREMI') return emp.total_premi > 0;
      return true;
    });
  }, [data, activeTab]);

  return (
    <div className="payroll-analysis">
      {/* Filter Bar */}
      <div className="filter-bar">
        <MonthPicker month={month} year={year} onChange={...} />
        <GangFilter division={division} value={gang} onChange={...} />
      </div>

      {/* KPI Cards */}
      <SummaryKPICards data={data?.grand_total} />

      {/* Tabs */}
      <div className="tabs">
        <button onClick={() => setActiveTab('SEMUA')}>SEMUA</button>
        <button onClick={() => setActiveTab('LEMBUR')}>LEMBUR</button>
        <button onClick={() => setActiveTab('PREMI')}>PREMI</button>
      </div>

      {/* Table */}
      <CustomPayrollTable data={filteredData} />

      {/* Actions */}
      <div className="actions">
        <button onClick={handleExport}>Export Excel</button>
        <button onClick={handlePrint}>Print</button>
      </div>
    </div>
  );
}
```

### EmployeeDetailPage.jsx

**Fungsi:** Detail karyawan dengan breakdown per komponen

```jsx
export default function EmployeeDetailPage() {
  const { nik, month, year } = useParams();
  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    employeeDetailService.getDetail(nik, month, year).then(setEmployee);
  }, [nik, month, year]);

  return (
    <div className="employee-detail">
      {/* Header */}
      <div className="header">
        <h1>{employee?.nama}</h1>
        <span>{employee?.nik}</span>
        <span>{employee?.gang_code}</span>
      </div>

      {/* KPI Cards */}
      <div className="kpi-row">
        <KPICard title="HK" value={employee?.jumlah_hk} />
        <KPICard title="Gaji Pokok" value={employee?.gaji_pokok} format="currency" />
        <KPICard title="Upah Bersih" value={employee?.upah_bersih} format="currency" />
      </div>

      {/* Tabs */}
      <Tabs>
        <Tab label="Overview">
          <OverviewTab employee={employee} />
        </Tab>
        <Tab label="Lembur">
          <LemburTab records={employee?.lembur_records} />
        </Tab>
        <Tab label="Premi">
          <PremiTab premi={employee} />
        </Tab>
        <Tab label="Potongan">
          <PotonganTab potongan={employee} />
        </Tab>
      </Tabs>
    </div>
  );
}
```

---

## 7. Common Components

### AgGridWrapper.jsx

**Fungsi:** Wrapper untuk AG Grid dengan tema default

```jsx
export default function AgGridWrapper({ children, height = '100%', theme = 'ag-theme-alpine' }) {
  return (
    <div className={`ag-grid-wrapper ${theme}`} style={{ height, width: '100%' }}>
      {children}
    </div>
  );
}
```

### GangFilter.jsx

**Fungsi:** Dropdown filter gang

```jsx
export default function GangFilter({ division, value, onChange, gangs, loading }) {
  return (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
    >
      <option value="ALL">SEMUA GANG</option>
      {gangs.map(g => (
        <option key={g.gang_code} value={g.gang_code}>
          {g.gang_code} - {g.description}
        </option>
      ))}
    </select>
  );
}
```

### MonthPicker.jsx

**Fungsi:** Selector bulan dan tahun

```jsx
export default function MonthPicker({ month, year, onChange }) {
  return (
    <div className="month-picker">
      <select value={month} onChange={(e) => onChange(parseInt(e.target.value), year)}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
          <option key={m} value={m}>{getMonthName(m)}</option>
        ))}
      </select>
      <select value={year} onChange={(e) => onChange(month, parseInt(e.target.value))}>
        {Array.from({ length: 5 }, (_, i) => year - 2 + i).map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
```

### LoadingScreen.jsx

**Fungsi:** Loading overlay

```jsx
export default function LoadingScreen({ isLoading, message = "Loading..." }) {
  if (!isLoading) return null;
  
  return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
}
```

---

## 8. Services (API Clients)

### Struktur Service

```javascript
// Base URL dari environment
const API_BASE = import.meta.env.VITE_API_BASE || '';

// Axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Request interceptor untuk token
api.interceptors.request.use(config => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### payrollService.js

```javascript
export const payrollService = {
  // Get divisions
  async getDivisions() {
    const response = await api.get('/payroll/divisions');
    return response.data;
  },

  // Get gangs by division
  async getGangs(division) {
    const response = await api.get('/payroll/gangs', { params: { division } });
    return response.data;
  },

  // Get payroll data
  async getDivisionRawTree(division, month, year) {
    const response = await api.get('/payroll/report/division-raw-tree', {
      params: { division_code: division, month, year }
    });
    return response.data;
  },

  // Get employee detail
  async getEmployeeDetail(nik, month, year) {
    const response = await api.get(`/payroll/employee/${nik}/detail`, {
      params: { month, year }
    });
    return response.data;
  },
};
```

### authService.js

```javascript
export const authService = {
  async login(username, password) {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  async verifyToken(token) {
    const response = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
};
```

---

## 9. Custom Hooks

### useCurrentPeriod.js

```javascript
export function useCurrentPeriod() {
  const [period, setPeriod] = useState({ month: null, year: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payroll/current-period')
      .then(res => setPeriod(res.data))
      .finally(() => setLoading(false));
  }, []);

  return { ...period, loading };
}
```

---

## 10. Utility Functions

### exportPayrollToExcel.js

```javascript
export async function exportPayrollToExcel(data, filename) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payroll');

  // Add headers
  worksheet.columns = generateColumns(data);

  // Add rows
  data.forEach(row => worksheet.addRow(row));

  // Generate file
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${filename}.xlsx`);
}
```

### printOptimizer.js

```javascript
export function optimizeForPrint() {
  // Add print class to body
  document.body.classList.add('print-mode');

  // Optimize AG Grid
  const grids = document.querySelectorAll('.ag-root');
  grids.forEach(grid => {
    grid.style.height = 'auto';
  });

  // Return cleanup function
  return () => {
    document.body.classList.remove('print-mode');
  };
}
```

---

## 11. Styling

### CSS Structure

| File | Purpose |
|------|---------|
| `theme.css` | Global theme variables |
| `dashboard-modern.css` | Dashboard layout styles |
| `ag-grid-professional.css` | AG Grid custom theme |
| `print-optimization.css` | Print media queries |
| `report.css` | Report page styles |

### Theme Variables

```css
:root {
  --primary-color: #3b82f6;
  --secondary-color: #64748b;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --danger-color: #ef4444;
  
  --bg-primary: #ffffff;
  --bg-secondary: #f1f5f9;
  
  --text-primary: #0f172a;
  --text-secondary: #475569;
  
  --border-radius: 8px;
  --shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

---

## 12. AG Grid Configuration

### Column Definitions

```javascript
const columnDefs = [
  {
    headerName: 'INFORMASI KARYAWAN',
    children: [
      { field: 'nik', headerName: 'NIK', pinned: 'left', width: 100 },
      { field: 'nama', headerName: 'NAMA', pinned: 'left', width: 200 },
      { field: 'gang_code', headerName: 'GANG', width: 80 },
    ]
  },
  {
    headerName: 'ABSENSI',
    children: [
      { field: 'jumlah_hk', headerName: 'HK', width: 60, type: 'numeric' },
      { field: 'hari_kerja', headerName: 'HARI KERJA', width: 100 },
    ]
  },
  // ... more column groups
];

const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
};
```

### Grid Features

```jsx
<AgGridReact
  columnDefs={columnDefs}
  rowData={data}
  defaultColDef={defaultColDef}
  rowSelection="multiple"
  enableRangeSelection={true}
  enableCharts={true}
  sideBar={true}
  statusBar={{ statusPanels: [...] }}
  onGridReady={onGridReady}
  onSelectionChanged={onSelectionChanged}
/>
```

---

## 13. Performance Optimizations

### Lazy Loading

```jsx
// Pages are lazy loaded
const DashboardHome = lazy(() => import('./pages/DashboardHome'));
const SummaryReportPage = lazy(() => import('./pages/SummaryReportPage'));
```

### Memoization

```jsx
// Memoize expensive calculations
const filteredData = useMemo(() => {
  return data.filter(/* ... */);
}, [data, filters]);

// Memoize callbacks
const handleExport = useCallback(() => {
  exportToExcel(data);
}, [data]);
```

### Virtual Scrolling

AG Grid menggunakan virtual scrolling secara default untuk menangani dataset besar.

---

## 14. Testing

### Unit Tests

```bash
npm run test
```

### Test Example

```jsx
// GangFilter.test.jsx
describe('GangFilter', () => {
  it('renders all gangs', () => {
    const gangs = [{ gang_code: 'H1H', description: 'Harvester' }];
    render(<GangFilter gangs={gangs} value="ALL" onChange={() => {}} />);
    
    expect(screen.getByText('SEMUA GANG')).toBeInTheDocument();
    expect(screen.getByText('H1H - Harvester')).toBeInTheDocument();
  });
});
```

---

**Selanjutnya:** Baca [05_DATABASE_GUIDE.md](./05_DATABASE_GUIDE.md) untuk memahami struktur database.