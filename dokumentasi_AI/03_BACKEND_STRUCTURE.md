# Struktur Backend - Payroll Daftar Upah

## Overview

Backend dibangun menggunakan **Bun** (JavaScript runtime) + **Elysia.js** (web framework) dengan **TypeScript**. Backend mengikuti pola **Service Layer Architecture** dengan singleton pattern.

---

## 1. Struktur Folder Backend

```
backend/
|-- src/
|   |-- index.ts              # Entry point server
|   |-- config.ts             # Konfigurasi environment
|   |
|   |-- api/                  # Route handlers (Controllers)
|   |   |-- auth.ts
|   |   |-- payroll.ts
|   |   |-- summary.ts
|   |   |-- employee.ts
|   |   |-- dashboardRoutes.ts
|   |   |-- aggregationSeederRoutes.ts
|   |   |-- spreadsheetRoutes.ts
|   |   |-- historyRoutes.ts
|   |   |-- users.ts
|   |   |-- reports.ts
|   |   |-- tunjangan.ts
|   |   |-- employeeEstate.ts
|   |   |-- devConfig.ts
|   |
|   |-- services/             # Business Logic Layer
|   |   |-- dataExtractorService.ts
|   |   |-- payrollService.ts
|   |   |-- lemburCalculator.ts
|   |   |-- pph21TerService.ts
|   |   |-- gangService.ts
|   |   |-- headerService.ts
|   |   |-- summaryService.ts
|   |   |-- aggregationService.ts
|   |   |-- authService.ts
|   |   |-- appsScriptService.ts
|   |   |-- employeeDetailService.ts
|   |   |-- employeeEstateService.ts
|   |   |-- employeeRepository.ts
|   |   |-- harvesterService.ts
|   |   |-- historyDatabaseService.ts
|   |   |-- historySeederService.ts
|   |   |-- thumbprintService.ts
|   |   |-- cacheService.ts
|   |   |-- currentPeriodService.ts
|   |   |-- deductionAdjustmentService.ts
|   |   |-- divisionDefinition.ts
|   |   |-- luasAreaService.ts
|   |   |-- reportService.ts
|   |   |-- tunjanganService.ts
|   |   |
|   |   |-- payroll/          # Modular payroll components
|   |       |-- index.ts
|   |       |-- BasePayrollComponentService.ts
|   |       |-- PayrollComponentRegistry.ts
|   |       |-- components/
|   |           |-- LemburService.ts
|   |           |-- PremiService.ts
|   |           |-- TunjanganService.ts
|   |           |-- PotonganService.ts
|   |           |-- Pph21TerService.ts
|   |
|   |-- db/                   # Database Layer
|   |   |-- client.ts         # SQL Gateway client
|   |
|   |-- scripts/              # Utility Scripts
|   |   |-- seed_aggregation.ts
|   |   |-- get_token.ts
|   |   |-- check_*.ts
|   |   |-- debug_*.ts
|   |   |-- verify_*.ts
|   |   |-- find_*.ts
|   |
|   |-- types/                # TypeScript Types
|       |-- user.ts
|       |-- harvest.ts
|       |-- payroll/
|           |-- BasePayrollTypes.ts
|           |-- PayrollComponent.ts
|
|-- data/                     # Data files
|   |-- thumbprint_data.json
|   |-- area_produktif.json
|   |-- payrate.json
|
|-- keys/                     # SSL/Auth keys
|   |-- private.pem
|   |-- public.pem
|
|-- query/                    # SQL query files
|   |-- get_*.sql
|   |-- absen/
|   |-- absensi/
|   |-- analisis/
|   |-- Gang/
|   |-- headers/
|   |-- JobCode/
|   |-- potongan/
|   |-- Tunjangan/
|
|-- package.json
|-- tsconfig.json
|-- bun.lock
```

---

## 2. Entry Point (index.ts)

### Fungsi Utama

File [`index.ts`](../backend/src/index.ts) adalah entry point server yang:

1. Menginisialisasi database connection
2. Mengkonfigurasi CORS
3. Mendaftarkan semua routes
4. Menjalankan server

### Kode Kunci

```typescript
// Inisialisasi Database
Database.getInstance();

// Buat aplikasi Elysia
const app = new Elysia()
    // CORS Configuration
    .use(cors({
        origin: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true
    }))
    // Register Routes
    .use(authRoutes)
    .use(payrollRoutes)
    .use(summaryRoutes)
    // ... other routes
    // Start Server
    .listen({
        port: Config.PORT,
        hostname: Config.HOST
    });
```

---

## 3. Konfigurasi (config.ts)

### Environment Variables

```typescript
export const Config = {
    // Server
    PORT: parseInt(process.env.PORT || "8002"),
    HOST: process.env.HOST || "0.0.0.0",
    RUN_MODE: process.env.RUN_MODE || "dev",
    
    // Database
    DB_API_URL: process.env.DB_API_URL || "http://localhost:8001",
    DB_API_KEY: process.env.DB_API_KEY || "",
    DB_PROFILE: process.env.DB_PROFILE || "SERVER_PROFILE_1",
    DB_DATABASE: process.env.DB_DATABASE || "db_ptrj",
    
    // Extended Database
    DB_EXTEND_PROFILE: process.env.DB_EXTEND_PROFILE || "SERVER_PROFILE_1",
    DB_EXTEND_DATABASE: process.env.DB_EXTEND_DATABASE || "extend_db_ptrj",
    
    // Venus Database
    DB_VENUS_PROFILE: process.env.DB_VENUS_PROFILE || "SERVER_PROFILE_3",
    DB_VENUS_DATABASE: process.env.DB_VENUS_DATABASE || "VenusHR14",
    
    // Auth
    JWT_SECRET: process.env.JWT_SECRET || "secret",
    ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "60"),
    
    // Lembur
    LEMBUR_UPJ: parseFloat(process.env.LEMBUR_UPJ || "17257"),
};
```

---

## 4. Database Client (db/client.ts)

### Singleton Pattern

```typescript
export class Database {
    private static instances: Map<string, Database> = new Map();
    
    public static getInstance(database?: string, profile?: string): Database {
        const key = `${database || Config.DB_DATABASE}:${profile || Config.DB_PROFILE}`;
        if (!Database.instances.has(key)) {
            Database.instances.set(key, new Database(database, profile));
        }
        return Database.instances.get(key)!;
    }
    
    public static getExtendedInstance(): Database {
        return Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    }
    
    public static getVenusInstance(): Database {
        return Database.getInstance(Config.DB_VENUS_DATABASE, Config.DB_VENUS_PROFILE);
    }
}
```

### Query Method

```typescript
async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/v1/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
        },
        body: JSON.stringify({
            sql: preparedSql,
            params: preparedParams,
            server: this.serverProfile,
            database: this.databaseName
        })
    });
    return response.json();
}
```

---

## 5. Route Handlers (api/)

### Struktur Route

Setiap file route mengikuti pola:

```typescript
export const payrollRoutes = new Elysia({ prefix: "/payroll" })
    // Middleware untuk auth
    .derive(async ({ headers }) => {
        const user = await getUserFromHeader(headers);
        return { currentUser: user };
    })
    // Auth check
    .onBeforeHandle(({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })
    // Routes
    .get("/divisions", async () => {
        return await gangService.getAllDivisions();
    })
    .get("/gangs", async ({ query }) => {
        return await gangService.fetchGangs(query.division);
    });
```

### Daftar Routes

| File | Prefix | Fungsi |
|------|--------|--------|
| `auth.ts` | `/auth` | Login, verify token |
| `payroll.ts` | `/payroll` | Data payroll utama |
| `summary.ts` | `/summary` | Ringkasan per divisi |
| `employee.ts` | `/payroll/employee` | Detail karyawan |
| `dashboardRoutes.ts` | `/dashboard` | Data dashboard |
| `aggregationSeederRoutes.ts` | `/api/aggregation` | Seeding agregasi |
| `spreadsheetRoutes.ts` | `/spreadsheet` | Sync Google |
| `historyRoutes.ts` | `/history` | Riwayat data |
| `users.ts` | `/users` | Manajemen user |

---

## 6. Service Layer (services/)

### Singleton Pattern

Semua service menggunakan singleton:

```typescript
export class PayrollService {
    private static instance: PayrollService;
    
    private constructor() {
        // Private constructor
    }
    
    public static getInstance(): PayrollService {
        if (!PayrollService.instance) {
            PayrollService.instance = new PayrollService();
        }
        return PayrollService.instance;
    }
}

export const payrollService = PayrollService.getInstance();
```

### Service Utama

#### dataExtractorService.ts

**Fungsi:** Mengekstrak data payroll dari database

**Method Utama:**
```typescript
async extractPayrollData(
    month: number,
    year: number,
    gangCode: string,
    divisionCode: string
): Promise<{ data_rows: PayrollRow[], dynamic_headers: string[] }>
```

**Flow:**
1. Get employees dari HR_EMPLOYEE + HR_GANGLN
2. Get attendance dari PR_TASKREGLN
3. Get allowances dari PR_ADTRANS
4. Get overtime dari lemburCalculator
5. Calculate gaji_pokok, tunjangan, premi, potongan
6. Return PayrollRow[]

#### lemburCalculator.ts

**Fungsi:** Menghitung lembur dengan tier-based rate

**Method Utama:**
```typescript
calculate(empCode: string, month: number, year: number): LemburResult
calculateBatchData(empCodes: string[], month: number, year: number): BatchResult
```

**Tier Rates:**
| Day Type | Tier 1 | Tier 2 | Tier 3 |
|----------|--------|--------|--------|
| Workday | 1.5x | 2x | - |
| Sunday | 2x | 3x | 4x |
| Holiday | 2x | 3x | 4x |
| Religious | 3x | 4x | 4x |

#### pph21TerService.ts

**Fungsi:** Menghitung PPH21 dengan metode TER

**TER Categories:**
| Category | Rate | PTKP Status |
|----------|------|-------------|
| TER A | 5% | TK/0, TK/1, K/0 |
| TER B | 15% | TK/2, K/1, K/2 |
| TER C | 25% | K/3 |

#### gangService.ts

**Fungsi:** Mengelola data gang/divisi

**Method Utama:**
```typescript
getAllDivisions(): Promise<Division[]>
fetchGangs(division: string): Promise<Gang[]>
getGangInfo(gangCode: string): Promise<GangInfo>
```

#### headerService.ts

**Fungsi:** Generate kolom AG Grid dinamis

**Method Utama:**
```typescript
generateDynamicHeaders(month: number, year: number, gangCode: string): Promise<ColumnDefs>
getColumnDefinitions(month: number, year: number, gangCode: string): Promise<Columns>
```

---

## 7. Modular Payroll Components (services/payroll/)

### Struktur

```
payroll/
|-- index.ts                      # Export semua components
|-- BasePayrollComponentService.ts # Base class
|-- PayrollComponentRegistry.ts    # Registry pattern
|-- components/
    |-- LemburService.ts
    |-- PremiService.ts
    |-- TunjanganService.ts
    |-- PotonganService.ts
    |-- Pph21TerService.ts
```

### Base Class

```typescript
export abstract class BasePayrollComponentService {
    protected db: Database;
    
    constructor() {
        this.db = Database.getInstance();
    }
    
    abstract calculate(params: CalculateParams): Promise<CalculateResult>;
    abstract getMetadata(): ComponentMetadata;
}
```

### Registry Pattern

```typescript
export class PayrollComponentRegistry {
    private components: Map<string, BasePayrollComponentService> = new Map();
    
    register(name: string, service: BasePayrollComponentService): void {
        this.components.set(name, service);
    }
    
    get(name: string): BasePayrollComponentService | undefined {
        return this.components.get(name);
    }
    
    calculateAll(params: CalculateParams): Promise<Record<string, any>> {
        // Calculate all registered components
    }
}
```

---

## 8. Scripts (scripts/)

### Kategori Scripts

| Prefix | Fungsi | Contoh |
|--------|--------|--------|
| `seed_` | Insert data | `seed_aggregation.ts` |
| `check_` | Validasi data | `check_aggregation_data.ts` |
| `debug_` | Debugging | `debug_attendance.ts` |
| `verify_` | Verifikasi | `verify_lembur_refactor.ts` |
| `find_` | Pencarian | `find_missing_employee.ts` |

### Cara Menjalankan

```bash
# Jalankan script
bun run src/scripts/seed_aggregation.ts

# Dengan argumen
bun run src/scripts/check_employee_columns.ts --division=AB1
```

---

## 9. Query Files (query/)

### Struktur

```
query/
|-- get_cuti_sakit.sql
|-- get_cuti_tahunan.sql
|-- get_total_HK.sql
|-- absen/
|   |-- getAttandances.sql
|   |-- getEmployeeHK.sql
|-- absensi/
|   |-- get_detail_HK.sql
|   |-- ketidakhadiran/
|-- Tunjangan/
|   |-- get_amount_lembur.sql
|   |-- get_brondol_amount.sql
|-- potongan/
|   |-- potong_pph21.sql
|   |-- potongan_spsi.sql
```

### Penggunaan

```typescript
// Baca file SQL
const sql = await Bun.file("query/get_total_HK.sql").text();

// Execute dengan params
const result = await db.query(sql, [empCode, month, year]);
```

---

## 10. Type Definitions (types/)

### user.ts

```typescript
export interface User {
    id: number;
    username: string;
    role: UserRole;
    divisions: string[];
}

export enum UserRole {
    ADMIN = "ADMIN",
    USER = "USER",
    VIEWER = "VIEWER"
}
```

### payroll/BasePayrollTypes.ts

```typescript
export interface PayrollRow {
    nik: string;
    nama: string;
    jumlah_hk: number;
    gaji_pokok: number;
    lembur_jumlah: number;
    total_premi: number;
    total_potongan: number;
    upah_bersih: number;
    // ... banyak field lain
}

export interface LemburRecord {
    trx_date: string;
    task_code: string;
    task_desc: string;
    day_type: string;
    hours: number;
    rate: number;
    amount: number;
}
```

---

## 11. Error Handling

### Pattern

```typescript
try {
    const result = await service.getData();
    return result;
} catch (e: any) {
    console.error(`[ServiceName] Error: ${e.message}`);
    set.status = 500;
    return { message: `Failed to process: ${e.message}` };
}
```

### HTTP Status Codes

| Code | Penggunaan |
|------|------------|
| 400 | Validation error, missing params |
| 401 | Token invalid/expired |
| 403 | Division not accessible |
| 404 | Data not found |
| 500 | Server error, DB error |

---

## 12. Logging

### Request Logging

```typescript
.onBeforeHandle(({ request }) => {
    (request as any).__startTime = performance.now();
})
.onAfterHandle(({ request, set }) => {
    const duration = performance.now() - (request as any).__startTime;
    console.log(`${request.method} ${request.url} ${Math.round(duration)}ms`);
})
```

### Service Logging

```typescript
console.log(`[PayrollService] Processing ${empCode}`);
console.log(`[DEBUG] Dynamic headers: ${headers.length}`);
console.error(`[ERROR] Failed to fetch: ${e.message}`);
```

---

## 13. Testing Backend

### Unit Test

```bash
bun test
```

### Manual Test dengan curl

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
```

---

## 14. Best Practices

### 1. Gunakan Singleton untuk Service
```typescript
// Good
export const payrollService = PayrollService.getInstance();

// Avoid
const payrollService = new PayrollService();
```

### 2. Gunakan Parameterized Query
```typescript
// Good
await db.query("SELECT * FROM table WHERE col = ?", [value]);

// Avoid
await db.query(`SELECT * FROM table WHERE col = '${value}'`);
```

### 3. Handle Error dengan Proper
```typescript
// Good
try {
    // code
} catch (e: any) {
    set.status = 500;
    return { message: e.message };
}

// Avoid
// No try-catch
```

### 4. Log untuk Debugging
```typescript
console.log(`[ServiceName] Processing: ${param}`);
console.log(`[DEBUG] Result: ${JSON.stringify(result)}`);
```

---

**Selanjutnya:** Baca [04_FRONTEND_STRUCTURE.md](./04_FRONTEND_STRUCTURE.md) untuk memahami struktur frontend.