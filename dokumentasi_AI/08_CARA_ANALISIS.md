# Cara Analisis Kode - Payroll Daftar Upah

## Overview

Dokumen ini memberikan panduan praktis untuk menganalisis dan memahami kode dalam project Payroll Daftar Upah. Cocok untuk developer baru atau yang ingin mempelajari bagian tertentu dari kode.

---

## 1. Strategi Analisis Kode

### Pendekatan Top-Down

```
1. Pahami tujuan fitur
2. Cari entry point
3. Ikuti alur eksekusi
4. Pahami data yang diproses
5. Pelajari detail implementasi
```

### Pendekatan Bottom-Up

```
1. Mulai dari fungsi kecil
2. Pahami input/output
3. Lacak pemanggil fungsi
4. Bangun pemahaman ke atas
```

---

## 2. Tools yang Diperlukan

### VS Code Extensions

| Extension | Fungsi |
|-----------|--------|
| ESLint | Linting JavaScript/TypeScript |
| Prettier | Code formatting |
| GitLens | Git integration |
| Path Intellisense | Autocomplete path |
| Auto Rename Tag | Rename HTML/JSX tag |

### Browser DevTools

| Tab | Fungsi |
|-----|--------|
| Console | Lihat log, error |
| Network | Lihat API calls |
| React DevTools | Inspect React components |
| Sources | Debug JavaScript |

---

## 3. Menganalisis Backend

### Mulai dari Entry Point

**File:** [`backend/src/index.ts`](../backend/src/index.ts)

```typescript
// 1. Lihat apa yang di-import
import { Elysia } from "elysia";
import { payrollRoutes } from "./api/payroll";

// 2. Lihat konfigurasi server
const app = new Elysia()
    .use(cors())           // CORS middleware
    .use(authRoutes)       // Auth routes
    .use(payrollRoutes)    // Payroll routes
    .listen({ port: 8002 });

// 3. Lihat routes yang didaftarkan
```

### Menganalisis Route

**File:** [`backend/src/api/payroll.ts`](../backend/src/api/payroll.ts)

```typescript
// 1. Identifikasi prefix route
export const payrollRoutes = new Elysia({ prefix: "/payroll" })

// 2. Identifikasi middleware
.derive(async ({ headers }) => {
    const user = await getUserFromHeader(headers);
    return { currentUser: user };
})

// 3. Identifikasi endpoints
.get("/divisions", async () => { ... })
.get("/gangs", async ({ query }) => { ... })
.get("/report", async ({ query }) => { ... })
```

### Menganalisis Service

**File:** [`backend/src/services/dataExtractorService.ts`](../backend/src/services/dataExtractorService.ts)

```typescript
// 1. Identifikasi dependencies
import { Database } from "../db/client";
import { lemburCalculator } from "./lemburCalculator";

// 2. Identifikasi public methods
export class DataExtractorService {
    async extractPayrollData() { ... }  // Main method
    async getEmployees() { ... }        // Helper
    async getAttendance() { ... }       // Helper
}

// 3. Ikuti alur dalam method utama
async extractPayrollData(month, year, gangCode) {
    // Step 1: Get employees
    const employees = await this.getEmployees();
    
    // Step 2: Get attendance
    const attendance = await this.getAttendance();
    
    // Step 3: Process each employee
    for (const emp of employees) {
        // ... calculation logic
    }
    
    // Step 4: Return result
    return { data_rows, totals };
}
```

### Tips Analisis Backend

1. **Baca dari atas ke bawah** - Mulai dari import, lalu class/function
2. **Cari komentar** - Banyak penjelasan ada di komentar
3. **Ikuti pemanggilan** - Dari route -> service -> db
4. **Perhatikan error handling** - Try-catch blocks
5. **Log output** - Console.log untuk debugging

---

## 4. Menganalisis Frontend

### Mulai dari Entry Point

**File:** [`frontend/src/main.jsx`](../frontend/src/main.jsx)

```jsx
// 1. Lihat apa yang di-render
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### Menganalisis App Component

**File:** [`frontend/src/App.jsx`](../frontend/src/App.jsx)

```jsx
// 1. Identifikasi Context Providers
<AuthProvider>
  <ReportProvider>
    {/* Children */}
  </ReportProvider>
</AuthProvider>

// 2. Identifikasi Routes
<Routes>
  <Route path="/" element={<DashboardLayout />}>
    <Route index element={<DashboardHome />} />
    <Route path="operational" element={<OperationalReport />} />
  </Route>
</Routes>

// 3. Identifikasi lazy loading
const DashboardHome = lazy(() => import('./pages/DashboardHome'))
```

### Menganalisis Page Component

**File:** [`frontend/src/pages/PayrollAnalysisPage.jsx`](../frontend/src/pages/PayrollAnalysisPage.jsx)

```jsx
// 1. Identifikasi hooks yang digunakan
const { division, month, year } = useReport();
const { token } = useAuth();

// 2. Identifikasi state
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

// 3. Identifikasi effects
useEffect(() => {
  fetchData();
}, [division, month, year]);  // Dependencies

// 4. Identifikasi event handlers
const handleExport = () => { ... };
const handlePrint = () => { ... };

// 5. Identifikasi render logic
return (
  <div>
    {/* Components */}
  </div>
);
```

### Menganalisis Service

**File:** [`frontend/src/services/payrollService.js`](../frontend/src/services/payrollService.js)

```javascript
// 1. Identifikasi base URL
const API_BASE = import.meta.env.VITE_API_BASE;

// 2. Identifikasi methods
export const payrollService = {
  async getDivisions() { ... },
  async getGangs(division) { ... },
  async getReport(params) { ... }
};

// 3. Lihat cara memanggil API
const response = await api.get('/payroll/divisions');
return response.data;
```

### Tips Analisis Frontend

1. **Gunakan React DevTools** - Inspect component tree dan props
2. **Perhatikan dependencies** - useEffect dependencies penting
3. **Ikuti data flow** - Dari service -> state -> render
4. **Cek Network tab** - Lihat API calls
5. **Console.log** - Debug dengan logging

---

## 5. Menganalisis Database Query

### Cari File Query

```
backend/query/
|-- get_total_HK.sql
|-- absen/
|-- Tunjangan/
```

### Baca Query SQL

```sql
-- 1. Baca komentar di atas query
-- Query untuk mendapatkan total HK

-- 2. Identifikasi SELECT columns
SELECT EmpCode, COUNT(DISTINCT TrxDate) as HK

-- 3. Identifikasi FROM/JOIN
FROM PR_TASKREGLN

-- 4. Identifikasi WHERE conditions
WHERE TrxDate >= ? AND TrxDate <= ?
  AND OT = 0

-- 5. Identifikasi GROUP BY
GROUP BY EmpCode
```

### Trace Query Usage

```typescript
// Cari di service mana query digunakan
const sql = await Bun.file('query/get_total_HK.sql').text();
const result = await db.query(sql, [startDate, endDate]);
```

---

## 6. Debugging Techniques

### Backend Debugging

```typescript
// 1. Tambahkan log di awal method
console.log('[MethodName] Called with:', params);

// 2. Log hasil query
console.log('[DEBUG] Query result:', JSON.stringify(result, null, 2));

// 3. Log error
catch (e) {
  console.error('[ERROR] Method failed:', e.message);
  console.error('[ERROR] Stack:', e.stack);
}
```

### Frontend Debugging

```jsx
// 1. Log di useEffect
useEffect(() => {
  console.log('[Component] Mounted');
  console.log('[Component] Props:', props);
}, []);

// 2. Log di event handler
const handleClick = () => {
  console.log('[Event] Button clicked');
  console.log('[Event] State:', state);
};

// 3. Gunakan debugger
const processData = (data) => {
  debugger; // Pause execution
  return data.filter(...);
};
```

### Database Debugging

```sql
-- 1. Test query langsung
SELECT * FROM table WHERE condition;

-- 2. Check execution plan
SET SHOWPLAN_TEXT ON;
GO
SELECT * FROM table;
GO

-- 3. Count rows
SELECT COUNT(*) FROM table WHERE condition;
```

---

## 7. Common Patterns

### Pattern: Singleton Service

```typescript
// Cari pattern ini di semua service
export class SomeService {
    private static instance: SomeService;
    
    public static getInstance(): SomeService {
        if (!SomeService.instance) {
            SomeService.instance = new SomeService();
        }
        return SomeService.instance;
    }
}

// Usage
const service = SomeService.getInstance();
```

### Pattern: React Context

```jsx
// Cari pattern ini untuk state management
const Context = createContext(null);

export function Provider({ children }) {
    const [state, setState] = useState(null);
    return (
        <Context.Provider value={{ state, setState }}>
            {children}
        </Context.Provider>
    );
}

export const useContext = () => useContext(Context);
```

### Pattern: API Route

```typescript
// Pattern untuk semua route
export const routes = new Elysia({ prefix: "/path" })
    .derive(/* middleware */)
    .onBeforeHandle(/* auth check */)
    .get("/endpoint", async ({ query }) => {
        // 1. Validate input
        // 2. Call service
        // 3. Return response
    });
```

---

## 8. Checklist Analisis

### Saat Menganalisis Fitur Baru

- [ ] Apa tujuan fitur ini?
- [ ] Di mana entry point-nya?
- [ ] Data apa yang diproses?
- [ ] Service apa yang terlibat?
- [ ] Query database apa yang digunakan?
- [ ] Bagaimana data ditampilkan?
- [ ] Apa error handling-nya?
- [ ] Apa test case-nya?

### Saat Debugging

- [ ] Apa error message-nya?
- [ ] Di mana error terjadi?
- [ ] Apa input yang menyebabkan error?
- [ ] Apa expected output?
- [ ] Apa actual output?
- [ ] Apa perubahan terakhir yang mungkin menyebabkan error?

---

## 9. Sumber Referensi

### Dalam Project

| File | Isi |
|------|-----|
| `CLAUDE.md` | Instruksi untuk AI assistant |
| `README_Dokumentasi.md` | Index dokumentasi |
| `backend/src/config.ts` | Konfigurasi environment |
| `frontend/src/App.jsx` | Struktur routing |

### Online Resources

- [Bun Documentation](https://bun.sh/docs)
- [Elysia.js Documentation](https://elysiajs.com/)
- [React Documentation](https://react.dev/)
- [AG Grid Documentation](https://www.ag-grid.com/)

---

## 10. Tips Praktis

### Untuk Pemula

1. **Mulai dari dokumentasi** - Baca README dan CLAUDE.md
2. **Jalankan aplikasi** - Lihat cara kerjanya
3. **Baca kode secara bertahap** - Jangan terburu-buru
4. **Catat pertanyaan** - Tanyakan ke senior/teammate
5. **Praktik** - Ubah kode kecil dan lihat hasilnya

### Untuk Debugging

1. **Isolate masalah** - Kecilkan scope pencarian
2. **Reproduce error** - Pastikan bisa diulang
3. **Check log** - Lihat console dan terminal
4. **Binary search** - Comment out kode untuk menemukan masalah
5. **Ask for help** - Jika stuck lebih dari 30 menit

---

**Selanjutnya:** Baca [09_BUSINESS_RULES.md](./09_BUSINESS_RULES.md) untuk memahami aturan bisnis yang diterapkan.