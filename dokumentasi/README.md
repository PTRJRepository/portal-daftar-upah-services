# Dokumentasi Arsitektur Sistem Report Plantware Daftar Upah

## Gambaran Umum

Dokumentasi ini menjelaskan arsitektur sistem daftar upah berbasis **Bun + Elysia** (backend) dan **React + AG Grid Enterprise** (frontend). Sistem dirancang untuk payroll processing dan reporting dengan performa tinggi.

## Catatan Penting

**Dokumentasi ini outdated.** Banyak file di folder `dokumentasi/` masih referensi FastAPI, Python backend, dan struktur lama. **CLAUDE.md di root project adalah sumber kebenaran utama** untuk arsitektur dan panduan development. Selalu preferensi CLAUDE.md di atas file dokumentasi dalam folder ini.

## Stack Teknologi

### Backend
- **Bun** runtime + **Elysia** framework
- **Python SQL Gateway API** sebagai middleware ke MSSQL databases
- **Singleton pattern** untuk services
- JWT token authentication

### Frontend
- **React 18** + **Vite 5**
- **AG Grid Enterprise** untuk komponen tabel
- **CustomPayrollTable** (CSS-based) untuk daftar upah utama
- **React Context** untuk state management (bukan Redux)
- Progressive streaming via SSE

## Struktur Direktori
```
dokumentasi/
├── README.md                      # Dokumentasi utama (file ini)
├── TestingMode.md                # Mode testing & login bypass
├── FrontendStructure.md           # Struktur frontend (aktaual)
├── arsitektur_sistem.md          # Diagram arsitektur
└── diagrams/
    ├── FrontendStructure.md      # Struktur frontend (aktaual)
    └── [lainya]                   # Diagram lain (perlu verifikasi)
```

## Fitur Utama

### Backend
- **SQL Gateway**: Koneksi via Python middleware (bukan ODBC langsung)
- **Parallel Batch Queries**: DB queries dijalankan parallel untuk performa
- **Caching**: Payroll cache 1h TTL untuk historical periods
- **JWT Auth**: Token-based authentication
- **Progressive Streaming**: SSE endpoint untuk streaming data per gang
- **Singleton Services**: Service instances di-cache untuk reuse

### Frontend
- **CustomPayrollTable**: Tabel kustom CSS-based (bukan AG Grid native rows)
- **React Context**: AuthContext, HeaderContext, GangFilterContext
- **Test Mode**: Login bypass untuk development
- **Dynamic Headers**: Kolom berdasarkan data aktual
- **Export Excel**: Dukungan export payroll data

## Panduan Developer

1. **CLAUDE.md (root)** — Sumber kebenaran utama untuk arsitektur, API, database rules, business logic
2. **dokumentasi/TestingMode.md** — Mode testing & login bypass
3. **dokumentasi/arsitektur_sistem.md** — Diagram alur data (aktaual)
4. **dokumentasi/FrontendStructure.md** — Struktur frontend (aktaual)

File dokumentasi lain (BackendStructure.md, Performance_Optimization.md, dll) mungkin outdated — cek CLAUDE.md untuk informasi terbaru.
