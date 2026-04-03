# Struktur Frontend Daftar Upah

## Tech Stack
- **React 18** + **Vite 5**
- **AG Grid Enterprise** (sebagian halaman menggunakan Custom Payroll Table)
- **Axios** untuk HTTP
- **React Context** untuk state management (bukan Redux)
- **CSS Custom** untuk styling (bukan Tailwind/MUI)

## Struktur Direktori

```
frontend/src/
├── pages/                 # Halaman-halaman aplikasi (.jsx)
│   ├── DashboardHome.jsx      # Landing page dengan cards
│   ├── LoginPage.jsx          # Halaman login
│   ├── MainPage.jsx           # Halaman utama daftar upah dengan filter gang/bulan/tahun
│   ├── LockedMainPage.jsx     # View publik tanpa auth ketat
│   ├── PayrollAnalysisPage.jsx # Laporan analisis per komponen
│   ├── EmployeeDetailPage.jsx  # Detail karyawan individual
│   ├── SummaryReportPage.jsx   # Summary per divisi
│   ├── AnalysisReportPage.jsx  # Laporan analisis
│   ├── AggregationSeederPage.jsx # Manajemen seeding aggregation
│   ├── SpreadsheetSyncPage.jsx # Sync ke Google Spreadsheet
│   └── [lainya]...
├── components/
│   ├── CustomPayrollTable.jsx  # Tabel kustom payroll (bukan AG Grid native)
│   ├── AgGridWrapper.jsx      # Wrapper AG Grid
│   ├── common/
│   │   ├── LoadingScreen.jsx
│   │   ├── SelectionStatusBar.jsx
│   │   ├── TableContextMenu.jsx
│   │   └── TestModePanel.jsx
│   └── ...
├── services/              # API client dengan Axios
│   └── lockedDivisionService.js
├── context/
│   ├── AuthContext.jsx
│   ├── HeaderContext.jsx
│   └── ReportContext.jsx
├── hooks/
│   ├── useCurrentPeriod.js
│   └── usePayrollStream.js   # Hook SSE streaming
└── utils/
    ├── PayrollAggregator.js    # Client-side aggregation
    ├── exportPayrollToExcel.js
    └── prodModeUtils.js
```

## State Management

Menggunakan **React Context** (bukan Redux):

| Context | Fungsi |
|---------|--------|
| `AuthContext` | Auth state, user info, login/logout |
| `HeaderContext` | Column definitions AG Grid |
| `GangFilterContext` | Filter gang selection |

## Pages Utama

| Page | Route | Keterangan |
|------|-------|------------|
| Dashboard | `/` | Landing page dengan cards navigasi |
| MainPage | `/payroll` | Daftar upah utama dengan CustomPayrollTable |
| PayrollAnalysis | `/comprehensive` | Analisis per komponen (LEMBUR, PREMI, dll) |
| EmployeeDetail | `/employee/:nik` | Detail individual karyawan |
| SummaryReport | `/summary` | Summary per divisi |
| LockedMainPage | `/locked` | View publik (relaxed auth) |

## CustomPayrollTable

`CustomPayrollTable.jsx` adalah komponen utama untuk menampilkan data payroll. Menggunakan:
- CSS-based table rendering (bukan AG Grid native row renderer)
- Hierarchical column headers (multi-level)
- Sticky columns (NO, EMP CODE, NAMA di kiri)
- Gang headers + gang totals + grand total rows
- Progressive rendering via SSE streaming
- Edit mode untuk manual adjustment
