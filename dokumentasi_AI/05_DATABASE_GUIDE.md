# Panduan Database - Payroll Daftar Upah

## Overview

Sistem menggunakan **Microsoft SQL Server (MSSQL)** dengan akses melalui **SQL Gateway Pattern**. Backend tidak terhubung langsung ke database, melainkan melalui API gateway Python.

---

## 1. Database Profiles

### Konfigurasi

| Profile | Database | Server | Penggunaan |
|---------|----------|--------|------------|
| `SERVER_PROFILE_1` | `extend_db_ptrj` | Development | Aggregation, History |
| `SERVER_PROFILE_2` | `db_ptrj` | Production | Main Payroll Data |
| `SERVER_PROFILE_3` | `VenusHR14` | HR System | Employee Master |
| `SERVER_PROFILE_3` | `db_ptrj_mill` | Mill System | FFB Weight Data |

### Environment Variables

```bash
# Main Database
DB_PROFILE=SERVER_PROFILE_2
DB_DATABASE=db_ptrj

# Extended Database (Aggregation)
DB_EXTEND_PROFILE=SERVER_PROFILE_1
DB_EXTEND_DATABASE=extend_db_ptrj

# Venus Database (Employee)
DB_VENUS_PROFILE=SERVER_PROFILE_3
DB_VENUS_DATABASE=VenusHR14

# Mill Database (FFB)
DB_MILL_PROFILE=SERVER_PROFILE_3
DB_MILL_DATABASE=db_ptrj_mill
```

---

## 2. SQL Gateway Pattern

### Cara Kerja

```
Backend (Bun) --> HTTP POST --> SQL Gateway (Python) --> MSSQL
```

### Endpoint

```
POST {DB_API_URL}/v1/query
```

### Request Format

```json
{
    "sql": "SELECT * FROM HR_EMPLOYEE WHERE EmpCode = @p0",
    "params": {
        "p0": "001"
    },
    "server": "SERVER_PROFILE_2",
    "database": "db_ptrj"
}
```

### Response Format

```json
{
    "success": true,
    "data": {
        "recordset": [
            { "EmpCode": "001", "EmpName": "John Doe", ... }
        ]
    }
}
```

---

## 3. Tabel Utama

### HR_EMPLOYEE (VenusHR14)

**Fungsi:** Master data karyawan

| Column | Type | Description |
|--------|------|-------------|
| EmpCode | VARCHAR(20) | NIK - Primary Key |
| EmpName | VARCHAR(100) | Nama lengkap |
| Gender | CHAR(1) | L/P |
| LocCode | VARCHAR(20) | Kode lokasi/divisi |
| Status | CHAR(1) | A = Active |
| PayrollInd | CHAR(1) | Payroll indicator |

**Query Contoh:**
```sql
SELECT EmpCode, EmpName, Gender, LocCode
FROM HR_EMPLOYEE
WHERE Status = 'A'
ORDER BY EmpCode
```

### HR_GANGLN (VenusHR14)

**Fungsi:** Relasi karyawan dengan gang

| Column | Type | Description |
|--------|------|-------------|
| GangCode | VARCHAR(20) | Kode gang |
| GangMember | VARCHAR(20) | NIK karyawan |
| GangLeader | BIT | Is leader |

**Query Contoh:**
```sql
SELECT g.GangCode, g.GangMember, e.EmpName
FROM HR_GANGLN g
INNER JOIN HR_EMPLOYEE e ON e.EmpCode = g.GangMember
WHERE g.GangCode LIKE 'H%'
```

### HR_GANG (VenusHR14)

**Fungsi:** Master data gang

| Column | Type | Description |
|--------|------|-------------|
| GangCode | VARCHAR(20) | Kode gang - PK |
| Description | VARCHAR(100) | Deskripsi |
| LocCode | VARCHAR(20) | Kode lokasi |

### HR_PAYROLL (VenusHR14)

**Fungsi:** Data payroll karyawan

| Column | Type | Description |
|--------|------|-------------|
| EmpCode | VARCHAR(20) | NIK - PK |
| PayRate | DECIMAL(18,2) | Rate gaji/hari |
| RiceRation | DECIMAL(18,2) | Tunjangan beras |
| Position | VARCHAR(50) | Jabatan |
| JoinDate | DATE | Tanggal masuk |

**Note:** `RiceRation` menentukan status PTKP:
- 2250 = TK/0
- 3250 = TK/1
- 4200 = TK/2
- 3750 = K/0
- 4650 = K/1
- 5550 = K/2
- 6450 = K/3

### PR_TASKREGLN (db_ptrj)

**Fungsi:** Transaksi harian karyawan

| Column | Type | Description |
|--------|------|-------------|
| MasterID | VARCHAR(50) | ID master |
| EmpCode | VARCHAR(20) | NIK |
| TrxDate | DATE | Tanggal transaksi |
| TaskCode | VARCHAR(20) | Kode tugas |
| Hours | DECIMAL(18,2) | Jam kerja |
| OT | BIT | 1 = Lembur |
| Amount | DECIMAL(18,2) | Jumlah |

**Query untuk Lembur:**
```sql
SELECT l.EmpCode, l.TrxDate, l.Hours, l.TaskCode, l.Amount
FROM PR_TASKREGLN l
JOIN PR_TASKREG m ON l.MasterID = m.ID
WHERE l.EmpCode = ?
  AND l.TrxDate >= ?
  AND l.TrxDate <= ?
  AND l.OT = 1
```

**Archive Tables:**
- `PR_TASKREGLN_ARC` - Data arsip
- `PR_TASKREG_ARC` - Master arsip

### PR_ADTRANS (db_ptrj)

**Fungsi:** Transaksi tunjangan/potongan

| Column | Type | Description |
|--------|------|-------------|
| ID | VARCHAR(50) | ID transaksi |
| EmpCode | VARCHAR(20) | NIK |
| DocDesc | VARCHAR(100) | Deskripsi |
| Amount | DECIMAL(18,2) | Jumlah |
| TrxMonth | INT | Bulan |
| TrxYear | INT | Tahun |

**DocDesc Patterns:**

| Pattern | Kategori |
|---------|----------|
| PREMI%, BRONDOL% | Premi |
| POT%, POTONGAN% | Potongan |
| PPH%, PPH21% | Pajak |
| LEMBUR% | Lembur |
| TUNJANGAN% | Tunjangan |
| SPSI% | Simpanan |
| KOREKSI% | Koreksi |

**Query untuk Premi:**
```sql
SELECT EmpCode, DocDesc, SUM(Amount) as Total
FROM PR_ADTRANS
WHERE TrxMonth = ? AND TrxYear = ?
  AND DocDesc LIKE '%PREMI%'
GROUP BY EmpCode, DocDesc
```

### PR_TASKCODE (db_ptrj)

**Fungsi:** Master kode tugas

| Column | Type | Description |
|--------|------|-------------|
| TaskCode | VARCHAR(20) | Kode tugas - PK |
| TaskDesc | VARCHAR(100) | Deskripsi |
| TaskType | VARCHAR(20) | Tipe |
| UOM | VARCHAR(20) | Satuan |

---

## 4. Tabel Agregasi (extend_db_ptrj)

### daftar_upah_aggregation_history

**Fungsi:** Menyimpan history agregasi payroll

| Column | Type | Description |
|--------|------|-------------|
| id | INT | PK |
| division_code | VARCHAR(20) | Kode divisi |
| gang_code | VARCHAR(20) | Kode gang |
| month | INT | Bulan |
| year | INT | Tahun |
| total_employees | INT | Total karyawan |
| total_hk | DECIMAL | Total HK |
| total_upah_bersih | DECIMAL | Total upah bersih |
| created_at | DATETIME | Tanggal buat |

---

## 5. Tabel Mill (db_ptrj_mill)

### WM_TICKET

**Fungsi:** Data timbangan TBS

| Column | Type | Description |
|--------|------|-------------|
| TicketNo | VARCHAR(50) | Nomor tiket |
| TrxDate | DATE | Tanggal |
| SupplierCode | VARCHAR(20) | Kode supplier |
| FFBWeight | DECIMAL | Berat TBS |

---

## 6. Database Client Usage

### Mendapatkan Instance

```typescript
// Default instance (db_ptrj)
const db = Database.getInstance();

// Extended instance (extend_db_ptrj)
const db = Database.getExtendedInstance();

// Venus instance (VenusHR14)
const db = Database.getVenusInstance();

// Mill instance (db_ptrj_mill)
const db = Database.getMillInstance();

// Custom instance
const db = Database.getInstance('custom_db', 'SERVER_PROFILE_X');
```

### Query dengan Parameter

```typescript
// Menggunakan ? placeholder (RECOMMENDED)
const result = await db.query(
    'SELECT * FROM HR_EMPLOYEE WHERE EmpCode = ? AND Status = ?',
    ['001', 'A']
);

// Parameter otomatis dikonversi ke @p0, @p1
```

### Query Methods

```typescript
// Query biasa - return array
const rows = await db.query('SELECT * FROM table');

// Query satu baris
const row = await db.queryOne('SELECT * FROM table WHERE id = ?', [id]);

// Count
const count = await db.count('table', 'WHERE status = ?', ['A']);

// Transaction
await db.transaction([
    { sql: 'INSERT INTO table VALUES (?)', params: [value1] },
    { sql: 'UPDATE table SET col = ?', params: [value2] }
]);
```

---

## 7. Query Files

### Lokasi

```
backend/query/
|-- get_cuti_sakit.sql
|-- get_cuti_tahunan.sql
|-- get_total_HK.sql
|-- absen/
|-- absensi/
|-- Tunjangan/
|-- potongan/
```

### Penggunaan

```typescript
// Baca file SQL
const sqlFile = Bun.file('query/get_total_HK.sql');
const sql = await sqlFile.text();

// Execute
const result = await db.query(sql, [empCode, month, year]);
```

---

## 8. Relasi Tabel

```
HR_EMPLOYEE (Master Karyawan)
    |
    +-- HR_GANGLN (Relasi Gang)
    |       |
    |       +-- HR_GANG (Master Gang)
    |
    +-- HR_PAYROLL (Data Payroll)
    |
    +-- PR_TASKREGLN (Transaksi Harian)
    |       |
    |       +-- PR_TASKREG (Master Transaksi)
    |       |
    |       +-- PR_TASKCODE (Kode Tugas)
    |
    +-- PR_ADTRANS (Tunjangan/Potongan)
```

---

## 9. Query Patterns

### Get Employee dengan Gang

```sql
SELECT 
    e.EmpCode, 
    e.EmpName, 
    e.LocCode,
    g.GangCode
FROM HR_EMPLOYEE e
INNER JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
WHERE g.GangCode LIKE ?
ORDER BY g.GangCode, e.EmpCode
```

### Get Attendance (HK)

```sql
SELECT 
    EmpCode,
    COUNT(DISTINCT TrxDate) as HK
FROM PR_TASKREGLN
WHERE TrxDate >= ? AND TrxDate <= ?
  AND OT = 0
GROUP BY EmpCode
```

### Get Overtime

```sql
SELECT 
    EmpCode,
    SUM(Hours) as TotalHours,
    SUM(Amount) as TotalAmount
FROM PR_TASKREGLN
WHERE TrxDate >= ? AND TrxDate <= ?
  AND OT = 1
GROUP BY EmpCode
```

### Get Allowances

```sql
SELECT 
    EmpCode,
    DocDesc,
    SUM(Amount) as Total
FROM PR_ADTRANS
WHERE TrxMonth = ? AND TrxYear = ?
  AND DocDesc LIKE '%PREMI%'
GROUP BY EmpCode, DocDesc
```

### Union dengan Archive

```sql
-- Data aktif
SELECT * FROM PR_TASKREGLN WHERE TrxDate >= ? AND TrxDate <= ?
UNION ALL
-- Data arsip
SELECT * FROM PR_TASKREGLN_ARC WHERE TrxDate >= ? AND TrxDate <= ?
```

---

## 10. Index Recommendations

### HR_EMPLOYEE
```sql
CREATE INDEX IX_HR_EMPLOYEE_LocCode ON HR_EMPLOYEE(LocCode);
CREATE INDEX IX_HR_EMPLOYEE_Status ON HR_EMPLOYEE(Status);
```

### PR_TASKREGLN
```sql
CREATE INDEX IX_PR_TASKREGLN_EmpCode ON PR_TASKREGLN(EmpCode);
CREATE INDEX IX_PR_TASKREGLN_TrxDate ON PR_TASKREGLN(TrxDate);
CREATE INDEX IX_PR_TASKREGLN_OT ON PR_TASKREGLN(OT);
CREATE INDEX IX_PR_TASKREGLN_EmpCode_TrxDate ON PR_TASKREGLN(EmpCode, TrxDate);
```

### PR_ADTRANS
```sql
CREATE INDEX IX_PR_ADTRANS_EmpCode ON PR_ADTRANS(EmpCode);
CREATE INDEX IX_PR_ADTRANS_Period ON PR_ADTRANS(TrxMonth, TrxYear);
```

---

## 11. Troubleshooting Database

### Connection Timeout

```bash
# Tingkatkan timeout
DB_CONN_TIMEOUT=120
DB_QUERY_TIMEOUT=60
```

### Query Lambat

1. **Cek execution plan**
2. **Tambahkan index**
3. **Optimize query** - hindari SELECT *
4. **Gunakan parameterized query**

### Data Tidak Muncul

1. **Cek profile yang benar** - dev vs prod
2. **Cek filter status** - mungkin status tidak 'A'
3. **Cek periode** - month/year benar?
4. **Cek archive tables** - mungkin data sudah di-archive

---

## 12. Best Practices

### 1. Gunakan Parameterized Query

```typescript
// Good
await db.query('SELECT * FROM table WHERE col = ?', [value]);

// Bad - SQL Injection risk
await db.query(`SELECT * FROM table WHERE col = '${value}'`);
```

### 2. Pilih Database Profile yang Benar

```typescript
// Payroll data - db_ptrj
const db = Database.getInstance();

// Aggregation - extend_db_ptrj
const db = Database.getExtendedInstance();

// Employee master - VenusHR14
const db = Database.getVenusInstance();
```

### 3. Handle Error dengan Proper

```typescript
try {
    const result = await db.query(sql, params);
    return result;
} catch (e) {
    console.error('[DB] Query failed:', e.message);
    throw e;
}
```

### 4. Gunakan Transaction untuk Batch

```typescript
await db.transaction([
    { sql: 'INSERT INTO table1 VALUES (?)', params: [val1] },
    { sql: 'INSERT INTO table2 VALUES (?)', params: [val2] }
]);
```

---

**Selanjutnya:** Baca [06_API_ENDPOINTS.md](./06_API_ENDPOINTS.md) untuk memahami endpoint API yang tersedia.