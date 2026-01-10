frontend/
├── public/                    # Static files
├── src/
│   ├── components/            # Reusable components
│   │   ├── common/           # Common components
│   │   │   ├── AgGridWrapper.jsx  # AG Grid wrapper
│   │   │   ├── FilterPanel.jsx    # Filter panel
│   │   │   └── ExportButton.jsx  # Export button
│   │   ├── auth/             # Authentication components
│   │   ├── employees/        # Employee components
│   │   ├── payroll/          # Payroll components
│   │   └── reports/          # Report components
│   ├── pages/                 # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Employees.jsx
│   │   ├── Payroll.jsx
│   │   ├── Reports.jsx
│   │   └── Settings.jsx
│   ├── services/              # API services
│   │   ├── authService.js
│   │   ├── employeeService.js
│   │   ├── payrollService.js
│   │   └── reportService.js
│   ├── store/                 # State management (Redux)
│   │   ├── authSlice.js
│   │   ├── employeeSlice.js
│   │   ├── payrollSlice.js
│   │   └── reportSlice.js
│   ├── utils/                 # Utility functions
│   │   ├── helpers.js
│   │   └── constants.js
│   ├── App.jsx               # Main app component
│   └── index.js              # Entry point
├── package.json              # Node.js dependencies
└── vite.config.js            # Vite configuration

Report Grid Implementation
- Page: `src/pages/Report.jsx` renders AG Grid exclusively with hierarchical grouped headers.
- Styles: `src/styles/report.css` provides zebra striping, highlights, and alignment.
- Features: sideBar columns/filters, CSV export, auto-size, single row selection, pinned bottom grand total.
- Rendering mode: hierarchical-only; flat header mode is not supported.
- Visualization: level-based coloring, indent, and expand/collapse icons on group headers.
- Column groups:
  - CUTI/LIBUR: `TAHUNAN (H)`, `SAKIT+HAID (H)`, `MINGGU (H)`, `NASIONAL (H)`, `IZIN (H)`
  - TUNJANGAN: `BERAS (RATE)`, `BERAS (JUMLAH)`, `JABATAN (RATE)`, `JABATAN (JUMLAH)`, `MASA KERJA (LAMA)`, `MASA KERJA (JUMLAH)`, `LEMBUR (JAM)`, `LEMBUR (JUMLAH)`
  - PREMI: `PREMI 1`–`PREMI 8`
  - CARUMAN ASTEK: `PEKERJA`, `MAJIKAN`, `JUMLAH`
  - POTONGAN BPJS: `KESEHATAN PEKERJA`, `KESEHATAN MAJIKAN`, `PENSIUN PEKERJA`, `PENSIUN MAJIKAN`, `JUMLAH`
  - IURAN SPSI: `JUMLAH`; PPH21: `JUMLAH`
- Key columns: `JUMLAH UPAH KOTOR` (red), `TOTAL POTONGAN` (blue), `UPAH BERSIH` (amber) via cell classes.
