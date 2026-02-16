# Struktur Proyek

## Overview

Proyek ini menggunakan struktur **monorepo** dengan dua aplikasi utama:
- **Backend**: Bun + Elysia.js (TypeScript)
- **Frontend**: React + Vite + AG Grid Enterprise

---

## Root Directory Structure

```
refactor_production/
|-- backend/                    # Backend application (Bun + Elysia)
|-- frontend/                   # Frontend application (React + Vite)
|-- Additional_services/        # Python utility services
|-- assets/                     # Static assets (images, etc.)
|-- integrasi/                  # Integration scripts (Google Spreadsheet)
|-- prompt/                     # AI prompt files
|-- .claude/                    # Claude AI configuration
|-- .gitignore                  # Git ignore rules
|-- CLAUDE.md                   # Claude Code guidance file
|-- docker-compose.yml          # Docker configuration
|-- package.json                # Root package.json for scripts
|-- all_tables.txt              # Database tables reference
|-- columns.json                # Column configuration
|-- data_output.txt             # Data output reference
|-- employee_columns.txt        # Employee table columns
|-- gangln_columns.txt          # Gang table columns
|-- harvester_columns.txt       # Harvester table columns
|-- inspection_results.txt      # Inspection results
|-- token.txt                   # API token storage
|-- verify_api.ts               # API verification script
|-- cookies.txt                 # Cookie storage
|-- backend_python.zip          # Python backend archive
```

---

## Backend Structure

```
backend/
|-- src/
|   |-- index.ts                    # Main entry point - Elysia server
|   |-- config.ts                   # Environment configuration
|   |-- test.ts                     # Test file
|   |-- output.txt                  # Debug output
|   |-- verify_fix.ts               # Verification script
|   |-- verify_friday.ts            # Friday overtime verification
|   |-- verify_gang_mapping.ts      # Gang mapping verification
|   |-- verify_profile_fix.ts       # Profile fix verification
|   |
|   |-- api/                        # API Route Handlers
|   |   |-- aggregationSeederRoutes.ts  # Aggregation seeding endpoints
|   |   |-- auth.ts                     # Authentication routes
|   |   |-- dashboardRoutes.ts          # Dashboard endpoints
|   |   |-- devConfig.ts                # Development config routes
|   |   |-- employee.ts                 # Employee detail routes
|   |   |-- employeeEstate.ts           # Job title/estate routes
|   |   |-- historyRoutes.ts            # History endpoints
|   |   |-- payroll.ts                  # Main payroll routes
|   |   |-- reports.ts                  # Report routes
|   |   |-- spreadsheetRoutes.ts        # Google Spreadsheet sync routes
|   |   |-- summary.ts                  # Summary report routes
|   |   |-- tunjangan.ts                # Allowance routes
|   |   |-- users.ts                    # User management routes
|   |
|   |-- db/                         # Database Layer
|   |   |-- client.ts                   # SQL Gateway client
|   |
|   |-- services/                   # Business Logic Layer
|   |   |-- aggregationService.ts       # Aggregation logic
|   |   |-- appsScriptService.ts        # Google Apps Script integration
|   |   |-- authService.ts              # Authentication logic
|   |   |-- cacheService.ts             # Caching logic
|   |   |-- currentPeriodService.ts     # Period management
|   |   |-- dashboardService.ts         # Dashboard data logic
|   |   |-- dataExtractorService.ts     # Main data extraction
|   |   |-- deductionAdjustmentService.ts # Deduction adjustments
|   |   |-- divisionDefinition.ts       # Division hierarchies
|   |   |-- employeeDetailService.ts    # Employee detail logic
|   |   |-- employeeEstateService.ts    # Job title/estate logic
|   |   |-- employeeRepository.ts       # Employee data repository
|   |   |-- gangService.ts              # Gang/division logic
|   |   |-- harvesterService.ts         # Harvester data logic
|   |   |-- headerService.ts            # AG Grid header generation
|   |   |-- historyDatabaseService.ts   # History database operations
|   |   |-- historySeederService.ts     # History seeding logic
|   |   |-- lemburCalculator.ts         # Overtime calculation
|   |   |-- luasAreaService.ts          # Area calculation
|   |   |-- payrollDataService.ts       # Payroll data operations
|   |   |-- payrollService.ts           # Payroll calculation
|   |   |-- pph21TerService.ts          # PPH21 TER calculation
|   |   |-- reportService.ts            # Report generation
|   |   |-- summaryService.ts           # Summary aggregation
|   |   |-- thumbprintService.ts        # Thumbprint data management
|   |   |-- tunjanganService.ts         # Allowance calculation
|   |   |
|   |   |-- payroll/                    # Modular payroll components
|   |       |-- index.ts                   # Component exports
|   |       |-- BasePayrollComponentService.ts  # Base class
|   |       |-- PayrollComponentRegistry.ts     # Component registry
|   |       |-- components/
|   |           |-- LemburService.ts        # Lembur component
|   |           |-- PotonganService.ts     # Potongan component
|   |           |-- Pph21TerService.ts     # PPH21 component
|   |           |-- PremiService.ts        # Premi component
|   |           |-- TunjanganService.ts    # Tunjangan component
|   |
|   |-- scripts/                    # Utility Scripts
|   |   |-- add_kinerja_column.ts
|   |   |-- add_missing_column.ts
|   |   |-- analyze_attendance.ts
|   |   |-- check_*.ts                  # Various check scripts
|   |   |-- debug_*.ts                  # Debug scripts
|   |   |-- find_*.ts                   # Find/lookup scripts
|   |   |-- seed_*.ts                   # Database seeding scripts
|   |   |-- verify_*.ts                 # Verification scripts
|   |   |-- get_token.ts                # Token generation
|   |   |-- list_tables.ts              # Table listing
|   |   |-- test-component-integration.ts
|   |   |-- trigger_seeder_direct.ts
|   |
|   |-- types/                      # TypeScript Type Definitions
|       |-- harvest.ts                 # Harvester types
|       |-- user.ts                    # User types
|       |-- payroll/
|           |-- BasePayrollTypes.ts      # Base payroll types
|           |-- PayrollComponent.ts       # Component types
|
|-- data/                           # Data Files
|   |-- area_produktif.json            # Productive area data
|   |-- deduction_adjustments.json     # Deduction adjustments
|   |-- payrate.json                   # Pay rate data
|   |-- thumbprint_data.json           # Thumbprint data
|   |-- upah_bersih_adjustments.json   # Wage adjustments
|
|-- keys/                            # SSL/Authentication Keys
|   |-- private.pem                    # Private key
|   |-- public.pem                     # Public key
|   |-- ssl.key                        # SSL key
|
|-- query/                           # SQL Query Files
|   |-- get_cuti_sakit.sql
|   |-- get_cuti_tahunan.sql
|   |-- get_detail_emp_each_gang.sql
|   |-- get_emp_gang_by_divisi_detailed.sql
|   |-- get_empcode_gangcode_by_divisi.sql
|   |-- get_HK_nasional_holiday.sql
|   |-- get_total_HK.sql
|   |-- test.sql
|   |
|   |-- absen/                         # Attendance queries
|   |-- absensi/                        # Attendance detail queries
|   |   |-- ketidakhadiran/               # Absence queries
|   |-- analisis/                       # Analysis queries
|   |-- Gang/                           # Gang queries
|   |-- headers/                        # Header generation queries
|   |-- JobCode/                        # Job code queries
|   |-- potongan/                       # Deduction queries
|   |-- Tunjangan/                      # Allowance queries
|
|-- bun.lock                         # Bun lockfile
|-- package.json                     # Backend dependencies
|-- tsconfig.json                    # TypeScript configuration
|-- tsconfig.tsbuildinfo             # TypeScript build info
|
|-- *.json                           # Debug/test output files
|-- *.txt                            # Log files
|-- *.log                            # Debug logs
```

---

## Frontend Structure

```
frontend/
|-- src/
|   |-- main.jsx                     # React entry point
|   |-- App.jsx                      # Main App component with routing
|   |
|   |-- components/                  # Reusable Components
|   |   |-- AggregationSeederModal.jsx  # Aggregation modal
|   |   |-- CellInspector.jsx           # Cell detail inspector
|   |   |-- CostHKComparisonReport.jsx  # Cost/HK comparison
|   |   |-- CostPerTonAnalysis.jsx      # Cost per ton analysis
|   |   |-- CustomPayrollTable.jsx      # Custom payroll table
|   |   |-- LegacyPayrollGrid.jsx       # Legacy AG Grid wrapper
|   |   |-- PayslipCard.jsx             # Payslip card component
|   |   |-- SalaryRangeModal.jsx        # Salary range modal
|   |   |-- SummaryWagesReport.jsx      # Summary wages report
|   |   |-- TunjanganDisplay.jsx        # Allowance display
|   |   |-- TunjanganDisplay.css        # Allowance styles
|   |   |
|   |   |-- common/                     # Common components
|   |       |-- AgGridWrapper.jsx          # AG Grid wrapper
|   |       |-- ComponentMetadataViewer.jsx # Metadata viewer
|   |       |-- ComponentMetadataViewer.css
|   |       |-- DivisionTabs.jsx           # Division tabs
|   |       |-- GangCardGrid.jsx           # Gang card grid
|   |       |-- GangFilter.jsx             # Gang filter dropdown
|   |       |-- GangFilter.test.jsx        # Gang filter tests
|   |       |-- HierHeaderGroup.jsx        # Header group component
|   |       |-- LoadingScreen.jsx          # Loading screen
|   |       |-- LoadingScreen.css
|   |       |-- Modal.jsx                  # Modal component
|   |       |-- MonthPicker.jsx            # Month/year picker
|   |       |-- MonthSelector.jsx          # Month selector
|   |       |-- PrintModeSelector.jsx      # Print mode selector
|   |       |-- ReportToolbar.jsx          # Report toolbar
|   |       |-- SelectedCellStatusBar.jsx  # Cell status bar
|   |       |-- SelectionStats.jsx         # Selection statistics
|   |       |-- SelectionStatusBar.jsx     # Selection status bar
|   |       |-- SummaryActionBar.jsx       # Summary action bar
|   |       |-- SummaryKPICards.jsx        # KPI cards
|   |       |-- SummarySelectionStatusBar.jsx
|   |       |-- TableContextMenu.jsx        # Context menu
|   |       |-- TestModePanel.jsx          # Test mode panel
|   |   |
|   |   |-- dashboard/                  # Dashboard components
|   |       |-- GangComparisonChart.jsx    # Gang comparison chart
|   |       |-- GangCostBreakdownChart.jsx # Cost breakdown chart
|   |       |-- GangDetailModal.jsx        # Gang detail modal
|   |       |-- GangTrendChart.jsx         # Trend chart
|   |       |-- KPICard.jsx                # KPI card
|   |       |-- PremiCompositionChart.jsx  # Premi chart
|   |       |-- TopBottomPerformersCard.jsx
|   |   |
|   |   |-- employee/                   # Employee components
|   |       |-- EmployeeDetailPage.jsx     # Employee detail page
|   |       |-- EmployeeDetailPage.css
|   |   |
|   |   |-- layout/                     # Layout components
|   |       |-- DashboardLayout.jsx        # Dashboard layout
|   |
|   |-- context/                     # React Context Providers
|   |   |-- AuthContext.jsx              # Authentication context
|   |   |-- GangFilterContext.jsx        # Gang filter context
|   |   |-- HeaderContext.jsx            # Header context
|   |   |-- ReportContext.jsx            # Report context
|   |
|   |-- hooks/                       # Custom React Hooks
|   |   |-- useCurrentPeriod.js          # Current period hook
|   |
|   |-- layouts/                     # Layout Components
|   |   |-- DashboardLayout.jsx          # Main dashboard layout
|   |
|   |-- pages/                       # Page Components
|   |   |-- AggregationSeederPage.jsx    # Aggregation seeder page
|   |   |-- AnalysisReportPage.jsx       # Analysis report page
|   |   |-- ComponentMetadataTestPage.jsx # Test page
|   |   |-- ComponentMetadataTestPage.css
|   |   |-- DashboardHome.jsx            # Dashboard home
|   |   |-- DivisionDetailCard.jsx       # Division detail card
|   |   |-- EmployeeDetailRoute.jsx      # Employee detail route
|   |   |-- Employees.jsx                # Employees list
|   |   |-- ExecutivePayrollPage.jsx     # Executive payroll
|   |   |-- GangComparisonReportPage.jsx # Gang comparison
|   |   |-- HighEarnerReportPage.jsx     # High earner report
|   |   |-- ImpactReportPage.jsx         # Impact report
|   |   |-- LockedMainPage.jsx           # Locked (public) page
|   |   |-- LoginPage.jsx                # Login page
|   |   |-- MainPage.jsx                 # Main payroll page
|   |   |-- onlyIJLReportPages.jsx       # IJL report pages
|   |   |-- PayrollAnalysisPage.jsx      # Payroll analysis
|   |   |-- PayslipPrintPage.jsx         # Payslip print
|   |   |-- Report.jsx                   # Report page
|   |   |-- SalaryRangeDetailPage.jsx    # Salary range detail
|   |   |-- SpreadsheetSyncPage.jsx      # Spreadsheet sync
|   |   |-- SummaryReportPage.jsx        # Summary report
|   |   |-- WagesSummaryIJLPage.jsx      # IJL wages summary
|   |   |-- WagesSummaryRebinmasPage.jsx # Rebinmas wages
|   |
|   |-- services/                    # API Client Services
|   |   |-- aggregationEngine.js         # Aggregation engine
|   |   |-- aggregationSeederService.js  # Seeder service
|   |   |-- authService.js               # Auth API client
|   |   |-- cookieService.js             # Cookie management
|   |   |-- costHKService.js             # Cost/HK service
|   |   |-- employeeDetailService.js     # Employee detail API
|   |   |-- employeeService.js           # Employee API
|   |   |-- gangFilterService.js         # Gang filter API
|   |   |-- gangService.js               # Gang API
|   |   |-- headerService.js             # Header API
|   |   |-- historyService.js            # History API
|   |   |-- lockedDivisionService.js     # Locked division API
|   |   |-- payrollService.js            # Payroll API
|   |   |-- payslipService.js            # Payslip API
|   |   |-- summaryReportService.js      # Summary report API
|   |   |-- validationService.js         # Validation service
|   |
|   |-- styles/                      # CSS Stylesheets
|   |   |-- ag-grid-professional.css     # AG Grid professional theme
|   |   |-- aggregation-seeder.css       # Seeder styles
|   |   |-- analysis-report-print.css    # Analysis print styles
|   |   |-- animations.css               # Animation styles
|   |   |-- cost-hk-report.css           # Cost/HK report styles
|   |   |-- CustomPayrollTable.css       # Custom table styles
|   |   |-- dashboard-modern.css         # Dashboard styles
|   |   |-- financial-summary.css        # Financial summary styles
|   |   |-- gang-report-print.css        # Gang report print
|   |   |-- impact-report.css            # Impact report styles
|   |   |-- payslip-print.css            # Payslip print styles
|   |   |-- print-optimization.css       # Print optimization
|   |   |-- print-overrides.css          # Print overrides
|   |   |-- report.css                   # Report styles
|   |   |-- summary-report.css           # Summary report styles
|   |   |-- summary-wages-print.css      # Wages print styles
|   |   |-- theme.css                    # Theme styles
|   |   |-- wages-summary-professional.css
|   |   |-- wages-summary-rebinmas.css
|   |
|   |-- utils/                       # Utility Functions
|       |-- aggregationUtils.js          # Aggregation utilities
|       |-- exportPayrollToExcel.js      # Excel export
|       |-- FormulaRegistry.js           # Formula registry
|       |-- httpSetup.js                 # HTTP setup
|       |-- PayrollAggregator.js         # Payroll aggregator
|       |-- pdfGenerator.js              # PDF generation
|       |-- printOptimizer.js            # Print optimization
|       |-- prodModeUtils.js             # Production mode utils
|
|-- __tests__/                      # Test Files
|   |-- expandCollapse.test.jsx
|   |-- hierarchy.test.js
|
|-- index.html                      # HTML entry point
|-- vite.config.js                  # Vite configuration
|-- package.json                    # Frontend dependencies
```

---

## Additional Services Structure

```
Additional_services/
|-- create_aggregation_upah/        # Aggregation Service
|   |-- aggregation_seeder.py          # Main seeder
|   |-- check_cols.py                   # Column checker
|   |-- check_schema.py                 # Schema checker
|   |-- create_table.py                 # Table creator
|   |-- database_agregasi.txt           # Database reference
|   |-- db_connection.py                # Database connection
|   |-- extract_divisions.py            # Division extractor
|   |-- gui_app.py                      # GUI application
|   |-- import_database_agregasi.py     # Import script
|   |-- manual_aggregation_editor.py    # Manual editor
|   |-- setup_divisi_description.py     # Division setup
|   |-- test_mill_hk.py                 # Mill HK test
|   |-- migrations/                     # SQL migrations
|   |   |-- add_premi_insentif_column.sql
|   |   |-- add_premi_kinerja_column.sql
|   |   |-- add_tbs_weight_column.sql
|   |-- web_aggregation_app/            # Web app
|       |-- app.py
|       |-- static/
|           |-- app.js
|           |-- index.html
|           |-- styles.css
|
|-- create_comparison_summary_ton_mill/  # Mill Comparison
|   |-- getTotalHKMill.sql
|   |-- getTotalSallaryMill.sql
|   |-- getTotalHK/
|   |-- query/
|       |-- getTotalAmountOvertimeByPeriod.sql
|       |-- getTotalAmountPPh21ByItsPeriod.sql
|       |-- getTotalAmountSPSIByItsPeriod.sql
|       |-- getTotalFFBbySupplierCode.sql
|       |-- getTotalMillWorker.sql
|
|-- hitung_pajak/                   # Tax Calculator
|   |-- pajak_calculator_gui.py        # Tax calculator GUI
|   |-- pph21_ter_logic.py             # PPH21 TER logic
|   |-- README.md                       # Documentation
|   |-- rule_TER_pajak.json            # TER rules
|   |-- run_calculator.bat             # Run script
|   |-- sample.json                     # Sample data
|   |-- TARIF TER PPH 21.xlsx          # TER rates
|   |-- GAJI AIR KUNYAL JANUARI 2026.xlsx
|
|-- pajak_kalkulator/               # Tax Calculator Files
|   |-- PERHITUNGAN PAJAK 2A JANUARI 2026/
|       |-- Various Excel files for tax calculation
|
|-- query_gateway/                  # SQL Gateway Documentation
|   |-- database_connection_documentation.md
|   |-- database_endpoint_documentation.md
|   |-- ENDPOINT_DOCUMENTATION.md
|   |-- endpoint_requirements.md
```

---

## File Naming Conventions

### Backend
- **Routes**: `*Routes.ts` or plural noun (e.g., `auth.ts`, `payroll.ts`)
- **Services**: `*Service.ts` or noun (e.g., `lemburCalculator.ts`)
- **Scripts**: Verb-noun pattern (e.g., `check_*.ts`, `seed_*.ts`)
- **Queries**: Verb-noun pattern (e.g., `get_*.sql`)

### Frontend
- **Components**: PascalCase (e.g., `GangFilter.jsx`)
- **Pages**: PascalCase with `Page` suffix (e.g., `SummaryReportPage.jsx`)
- **Services**: camelCase with `Service` suffix (e.g., `payrollService.js`)
- **Styles**: kebab-case (e.g., `summary-report.css`)
- **Utils**: camelCase (e.g., `printOptimizer.js`)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | Main server entry point |
| `backend/src/config.ts` | Environment configuration |
| `backend/src/db/client.ts` | SQL Gateway client |
| `backend/src/services/dataExtractorService.ts` | Main data extraction logic |
| `backend/src/services/lemburCalculator.ts` | Overtime calculation |
| `backend/src/services/pph21TerService.ts` | PPH21 TER calculation |
| `frontend/src/App.jsx` | Main React app with routing |
| `frontend/src/layouts/DashboardLayout.jsx` | Main layout component |
| `frontend/src/services/payrollService.js` | Payroll API client |
| `CLAUDE.md` | AI assistant guidance |

---

*Dokumentasi ini dibuat secara otomatis berdasarkan analisis struktur folder*