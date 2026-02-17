# Arsitektur Project - Payroll Daftar Upah

## Gambaran Umum

Project ini menggunakan arsitektur **3-tier** dengan pola **SQL Gateway** untuk akses database yang aman.

---

## 1. Arsitektur Tingkat Tinggi

```
+-------------------+     +-------------------+     +-------------------+
|    CLIENT TIER    |     |  APPLICATION TIER |     |   DATA TIER       |
|                   |     |                   |     |                   |
|  - Browser        |---->|  - Backend (Bun)  |---->|  - MSSQL Server   |
|  - Mobile         |     |  - Frontend (React)|     |  - SQL Gateway    |
|                   |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
```

### Komponen Utama

| Komponen | Teknologi | Port | Fungsi |
|----------|-----------|------|--------|
| Frontend | React + Vite | 5173 | User Interface |
| Backend | Bun + Elysia | 8002 | API Server |
| SQL Gateway | Python + FastAPI | 8001 | Database Proxy |
| Database | MSSQL | 1433 | Data Storage |

---

## 2. Arsitektur Frontend

### Struktur Komponen

```
App.jsx
  |-- AuthProvider (Context)
  |-- ReportProvider (Context)
  |-- BrowserRouter
      |-- DashboardLayout
          |-- Sidebar
          |-- Header
          |-- MainContent
              |-- Pages (Routes)
                  |-- DashboardHome
                  |-- OperationalReport
                  |-- SummaryReportPage
                  |-- PayrollAnalysisPage
                  |-- EmployeeDetailPage
                  |-- ...other pages
```

### Context Providers

| Context | Fungsi |
|---------|--------|
| `AuthContext` | Menyimpan state autentikasi user |
| `ReportContext` | Menyimpan state filter (division, gang, period) |
| `HeaderContext` | Menyimpan definisi kolom AG Grid |
| `GangFilterContext` | Menyimpan state filter gang |

### Data Flow Frontend

```
User Action -> Component -> Service -> API Call -> Backend
                                                    |
Response <- Component Update <- State Change <- JSON Response
```

---

## 3. Arsitektur Backend

### Struktur Layers

```
+------------------+
|    Routes/API    |  <- HTTP Endpoints
+------------------+
         |
+------------------+
|    Services      |  <- Business Logic
+------------------+
         |
+------------------+
|  DB Client       |  <- SQL Gateway Client
+------------------+
         |
+------------------+
|  SQL Gateway     |  <- External Python API
+------------------+
         |
+------------------+
|  MSSQL Database  |  <- Data Storage
+------------------+
```

### Route Groups

| Prefix | Module | Fungsi |
|--------|--------|--------|
| `/auth` | auth.ts | Autentikasi |
| `/payroll` | payroll.ts | Data payroll utama |
| `/summary` | summary.ts | Ringkasan per divisi |
| `/api/aggregation` | aggregationSeederRoutes.ts | Seeding agregasi |
| `/spreadsheet` | spreadsheetRoutes.ts | Sync ke Google |
| `/dashboard` | dashboardRoutes.ts | Data dashboard |
| `/history` | historyRoutes.ts | Riwayat data |

### Service Layer

| Service | Tanggung Jawab |
|---------|----------------|
| `dataExtractorService` | Ekstraksi data payroll dari database |
| `payrollService` | Kalkulasi gaji dan potongan |
| `lemburCalculator` | Kalkulasi lembur dengan tier rate |
| `pph21TerService` | Kalkulasi pajak PPH21 |
| `gangService` | Manajemen data gang/divisi |
| `headerService` | Generate kolom AG Grid dinamis |
| `summaryService` | Agregasi data summary |
| `aggregationService` | Seeding data ke extend_db |
| `authService` | Verifikasi JWT token |
| `appsScriptService` | Integrasi Google Spreadsheet |

---

## 4. Arsitektur Database

### Database Profiles

```
+-------------------+     +-------------------+
| SERVER_PROFILE_1  |     | SERVER_PROFILE_2  |
| extend_db_ptrj    |     | db_ptrj           |
| (Development)     |     | (Production)      |
+-------------------+     +-------------------+
         |                         |
         +-----------+-------------+
                     |
         +-------------------+
         | SERVER_PROFILE_3  |
         | VenusHR14         |
         | db_ptrj_mill      |
         +-------------------+
```

### Penggunaan Database

| Database | Isi | Penggunaan |
|----------|-----|------------|
| `db_ptrj` | Transaksi payroll | Data utama payroll |
| `extend_db_ptrj` | Agregasi & history | Laporan summary |
| `VenusHR14` | Master karyawan | Data karyawan & gang |
| `db_ptrj_mill` | Data mill | Timbangan TBS |

---

## 5. SQL Gateway Pattern

### Mengapa SQL Gateway?

1. **Keamanan**: Kredensial database tidak exposed ke backend
2. **Centralized**: Semua query melewati satu titik kontrol
3. **Logging**: Query dapat di-log untuk audit
4. **Connection Pooling**: Dikelola oleh gateway

### Cara Kerja

```
Backend                    SQL Gateway              Database
  |                            |                       |
  |-- POST /v1/query --------->|                       |
  |   {sql, params, server}    |-- Execute Query ----->|
  |                            |<-- Result Set --------|
  |<-- JSON Response ----------|                       |
```

### Format Request

```json
POST /v1/query
{
    "sql": "SELECT * FROM HR_EMPLOYEE WHERE EmpCode = @p0",
    "params": {
        "p0": "001"
    },
    "server": "SERVER_PROFILE_2",
    "database": "db_ptrj"
}
```

---

## 6. Authentication & Authorization

### JWT Token Flow

```
Login Request
     |
     v
+-------------+
| Verify Creds|
+-------------+
     |
     v
+-------------+
| Generate JWT|
+-------------+
     |
     v
+-------------+
| Return Token|
+-------------+
     |
     v
Client Stores Token (Cookie)
     |
     v
Subsequent Requests with Bearer Token
     |
     v
+-------------+
| Verify Token|
+-------------+
     |
     v
+-------------+
| Extract User|
+-------------+
     |
     v
Process Request with User Context
```

### Role-Based Access

| Role | Akses |
|------|-------|
| `ADMIN` | Semua divisi, semua fitur |
| `USER` | Divisi yang ditugaskan saja |
| `VIEWER` | Read-only |

---

## 7. Caching Strategy

### Cache Flow

```
Request
   |
   v
+-------------+
| Check Cache |
+-------------+
   |       |
Hit|       |Miss
   v       v
+-----+  +-------------+
|Return|  | Fetch from |
|Cache |  | Database   |
+-----+  +-------------+
              |
              v
         +-------------+
         | Store Cache |
         +-------------+
              |
              v
         +-------------+
         | Return Data |
         +-------------+
```

### Cache Configuration

```bash
# Enable/disable cache
ENABLE_PRODUCTION_CACHE=true
DISABLE_CACHE=false

# Cache TTL
CACHE_TTL_SECONDS=300  # 5 menit
```

---

## 8. Error Handling Architecture

### Error Flow

```
Error Occurs
     |
     v
+-------------+
| Catch Error |
+-------------+
     |
     v
+-------------+
| Log Error   |
+-------------+
     |
     v
+-------------+
| Map to HTTP |
| Status Code |
+-------------+
     |
     v
+-------------+
| Return JSON |
| Error       |
+-------------+
```

### HTTP Status Codes

| Code | Kondisi |
|------|---------|
| 200 | Success |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## 9. Deployment Architecture

### Development

```
+------------------------+
| Developer Machine      |
|                        |
| +--------+ +--------+  |
| | Backend| |Frontend|  |
| | :8002  | | :5173  |  |
| +--------+ +--------+  |
|         |              |
|         v              |
| +--------+             |
| |SQL Gate|             |
| | :8001  |             |
| +--------+             |
|         |              |
|         v              |
| +--------+             |
| | MSSQL  |             |
| +--------+             |
+------------------------+
```

### Production

```
+-----------------+
| Internet Users  |
+-----------------+
        |
        v
+-----------------+
| Reverse Proxy   |
| (Nginx)         |
+-----------------+
        |
   +----+----+
   |         |
   v         v
+------+ +------+
|Backend| |Static|
|Server | |Files |
+------+ +------+
   |
   v
+-----------------+
| SQL Gateway     |
+-----------------+
   |
   v
+-----------------+
| MSSQL Cluster   |
+-----------------+
```

---

## 10. Scalability Considerations

### Current Limitations

1. **Single Backend Instance**: Belum support horizontal scaling
2. **In-Memory Cache**: Tidak bisa di-share antar instance
3. **No Load Balancer**: Belum ada load balancing

### Future Improvements

1. **Redis Cache**: Untuk distributed caching
2. **Message Queue**: Untuk async processing
3. **Containerization**: Docker + Kubernetes
4. **CDN**: Untuk static assets

---

## 11. Security Architecture

### Layers of Security

```
+------------------+
| HTTPS/TLS        |  <- Transport Security
+------------------+
| Authentication   |  <- JWT Token
+------------------+
| Authorization    |  <- Role-Based Access
+------------------+
| Input Validation |  <- Request Validation
+------------------+
| SQL Injection    |  <- Parameterized Queries
| Prevention       |
+------------------+
```

### Security Best Practices

1. **Password Hashing**: bcrypt dengan salt
2. **JWT Signing**: RS256 algorithm
3. **CORS**: Whitelist origins
4. **Rate Limiting**: Via reverse proxy
5. **Input Sanitization**: Validasi semua input

---

## 12. Monitoring & Observability

### Logging Points

```typescript
// Request logging
console.log(`GET /payroll/divisions 123ms`);

// Error logging
console.error(`[ERROR] Failed to fetch gangs: ${e.message}`);

// Debug logging
console.log(`[DEBUG] Processing employee: ${empCode}`);
```

### Health Check

```bash
GET /health
{
    "status": "ok",
    "timestamp": "2025-12-15T10:30:00Z",
    "database": "db_ptrj",
    "profile": "SERVER_PROFILE_2"
}
```

---

## Diagram Arsitektur Lengkap

```
                                    +-------------------+
                                    |     INTERNET      |
                                    +-------------------+
                                             |
                                             v
                                    +-------------------+
                                    |   REVERSE PROXY   |
                                    |     (Nginx)       |
                                    +-------------------+
                                             |
                          +------------------+------------------+
                          |                                     |
                          v                                     v
                 +-------------------+                 +-------------------+
                 |    FRONTEND       |                 |    BACKEND        |
                 |    (React/Vite)   |                 |    (Bun/Elysia)   |
                 |                   |                 |                   |
                 | - Pages           |                 | - Routes          |
                 | - Components      |                 | - Services        |
                 | - Services        |                 | - Middleware      |
                 +-------------------+                 +-------------------+
                                                             |
                                                             v
                                                 +-------------------+
                                                 |   SQL GATEWAY     |
                                                 |   (Python/FastAPI)|
                                                 +-------------------+
                                                             |
                          +----------------------------------+----------------------------------+
                          |                                  |                                  |
                          v                                  v                                  v
                 +-------------------+             +-------------------+             +-------------------+
                 |    db_ptrj        |             |  extend_db_ptrj   |             |   VenusHR14       |
                 | (Payroll Trans)   |             | (Aggregation)     |             | (Employee Master) |
                 +-------------------+             +-------------------+             +-------------------+
```

---

**Selanjutnya:** Baca [03_BACKEND_STRUCTURE.md](./03_BACKEND_STRUCTURE.md) untuk memahami struktur backend secara detail.