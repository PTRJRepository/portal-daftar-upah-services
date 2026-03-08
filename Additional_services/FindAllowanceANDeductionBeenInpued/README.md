# Find Allowances and Deductions Per Employee

Folder ini berisi query SQL untuk mengecek semua tunjangan (allowances) dan potongan (deductions) yang diinput per karyawan.

## 📁 Daftar Query

### 1. **FindAllowancesDeductionsPerEmployee.sql**
**Purpose:** Melihat breakdown lengkap semua komponen payroll untuk SATU karyawan.

**Parameters:**
```sql
DECLARE @EmpCode VARCHAR(50) = 'H0033';      -- Kode karyawan
DECLARE @StartDate DATE = '2025-05-01';       -- Periode mulai
DECLARE @EndDate DATE = '2025-06-01';         -- Periode akhir
```

**Output Columns:**
- `emp_code` - Kode karyawan
- `doc_desc` - Deskripsi dokumen (DocDesc dari PR_ADTRANS)
- `task_code` - Kode tugas (dari PR_ADTRANSLN)
- `task_desc` - Deskripsi tugas (dari PR_TASKCODE)
- `amount` - Jumlah nominal
- `component_category` - Kategori detail (misal: `PREMI_PANEN`, `POTONGAN_PPH21`)
- `major_category` - Kategori besar (`TUNJANGAN` atau `POTONGAN`)

**Use Case:** Debugging payroll per individu, cek apakah ada komponen yang hilang atau salah input.

---

### 2. **PivotAllowancesDeductions.sql**
**Purpose:** Ringkasan semua komponen dalam format pivot (satu baris per karyawan).

**Parameters:**
```sql
DECLARE @EmpList VARCHAR(MAX) = '''H0033'',''H0034'',''H0035''';  -- List karyawan
DECLARE @StartDate DATE = '2025-05-01';       -- Periode mulai
DECLARE @EndDate DATE = '2025-06-01';         -- Periode akhir
```

**Output Columns:**
- `emp_code`
- `tunjangan_jabatan`, `tunjangan_beras`, `tunjangan_masa_kerja`, `tunjangan_lembur`
- `premi_panen`, `premi_kinerja`, `premi_brondol`, `premi_insentif`
- `potongan_pph21`, `potongan_bpjs_kesehatan`, `potongan_bpjs_pensiun`, `potongan_spsi`, `potongan_koreksi`, `potongan_pinjaman`
- `total_tunjangan`, `total_potongan`

**Use Case:** Quick view untuk membandingkan komponen payroll antar karyawan, validasi total.

---

### 3. **CheckGangDivisionAllowances.sql**
**Purpose:** Melihat semua tunjangan dan potongan untuk semua karyawan dalam satu gang atau divisi.

**Parameters:**
```sql
DECLARE @GangCode VARCHAR(50) = 'A01';        -- Kode gang (NULL untuk semua)
DECLARE @DivisionCode VARCHAR(50) = 'P1A';    -- Kode divisi (NULL untuk semua)
DECLARE @StartDate DATE = '2025-05-01';       -- Periode mulai
DECLARE @EndDate DATE = '2025-06-01';         -- Periode akhir
```

**Output Columns:**
- `emp_code`, `emp_name`, `gang_code`, `division_code`
- `doc_desc`, `task_code`, `task_desc`
- `amount`
- `component_category`

**Use Case:** Audit payroll per gang/divisi, cek konsistensi input antar karyawan dalam satu tim.

---

## 📊 Component Categories

### TUNJANGAN (Allowances)

| Category Key | DocDesc Pattern | Contoh DocDesc |
|-------------|-----------------|----------------|
| `TUNJANGAN_JABATAN` | `'%JABATAN%'` | `TUNJANGAN JABATAN` |
| `TUNJANGAN_BERAS` | `'%BERAS%'` | `TUNJANGAN BERAS` |
| `TUNJANGAN_MASA_KERJA` | `'%MASA%KERJA%'` | `TUNJANGAN MASA KERJA` |
| `TUNJANGAN_LEMBUR` | `'%LEMBUR%'` | `TUNJANGAN LEMBUR` |
| `PREMI_PANEN` | `'%PREMI%PANEN%'` atau `'%PREMI%AL%'` | `PREMI PANEN (AL)` |
| `PREMI_KINERJA` | `'%PREMI%KINERJA%'` | `PREMI KINERJA` |
| `PREMI_BRONDOL` | `'%PREMI%BRONDOL%'` | `PREMI BRONDOL` |
| `PREMI_INSENTIF` | `'%PREMI%INSENTIF%'` | `PREMI INSENTIF PANEN` |

### POTONGAN (Deductions)

| Category Key | DocDesc Pattern | Contoh DocDesc |
|-------------|-----------------|----------------|
| `POTONGAN_PPH21` | `'%PPH%'` AND NOT `'%PREMI%'` | `PPH21`, `POTONGAN PPH21` |
| `POTONGAN_BPJS_KESEHATAN` | `'%BPJS%KESEHATAN%'` | `BPJS KESEHATAN` |
| `POTONGAN_BPJS_PENSIUN` | `'%BPJS%PENSIUN%'` | `BPJS PENSIUN` |
| `POTONGAN_SPSI` | `'%SPSI%'` | `IURAN SPSI` |
| `POTONGAN_KOREKSI` | `'%KOREKSI%'` | `KOREKSI HK` |
| `POTONGAN_PINJAMAN` | `'%PINJAM%'` | `PINJAMAN KOPERASI` |
| `POTONGAN_LAIN` | `'%POT%'` | `POTONGAN LAIN-LAIN` |

---

## 🔍 Source Tables

```
PR_ADTRANS / PR_ADTRANS_ARC (Header)
├── ID              -- Primary Key
├── EmpCode         -- Kode Karyawan
├── DocDesc         -- Deskripsi Dokumen (KEY MAPPING)
├── DocDate         -- Tanggal Dokumen
└── ...

PR_ADTRANSLN / PR_ADTRANSLN_ARC (Detail)
├── MasterID        -- Foreign Key ke PR_ADTRANS.ID
├── TaskCode        -- Kode Tugas
├── Amount          -- Jumlah Nominal
└── ...

PR_TASKCODE (Master Data)
├── TaskCode        -- Primary Key
└── TaskDesc        -- Deskripsi Tugas
```

---

## 🚀 Quick Start

### Contoh 1: Cek Payroll Karyawan H0033

```sql
-- Gunakan query: FindAllowancesDeductionsPerEmployee.sql
DECLARE @EmpCode VARCHAR(50) = 'H0033';
DECLARE @StartDate DATE = '2025-05-01';
DECLARE @EndDate DATE = '2025-06-01';

-- Run query untuk melihat breakdown lengkap
```

### Contoh 2: Bandingkan 3 Karyawan

```sql
-- Gunakan query: PivotAllowancesDeductions.sql
DECLARE @EmpList VARCHAR(MAX) = '''H0033'',''H0034'',''H0035''';
DECLARE @StartDate DATE = '2025-05-01';
DECLARE @EndDate DATE = '2025-06-01';

-- Run query untuk melihat summary dalam format pivot
```

### Contoh 3: Audit Gang A01

```sql
-- Gunakan query: CheckGangDivisionAllowances.sql
DECLARE @GangCode VARCHAR(50) = 'A01';
DECLARE @DivisionCode VARCHAR(50) = NULL;  -- NULL untuk ignore division filter
DECLARE @StartDate DATE = '2025-05-01';
DECLARE @EndDate DATE = '2025-06-01';

-- Run query untuk melihat semua komponen payroll di gang A01
```

---

## ⚠️ Special Cases

### 1. Premi PPH (ACCRUALS-CHECKROLL)

Premi PPH adalah kasus khusus:
- **Source**: `PR_ADTRANS_ARC` dengan `TaskDesc = 'ACCRUALS-CHECKROLL'`
- **Treatment**: Ditambah ke Upah Bersih (bukan dikurangi seperti premi biasa)
- **Query terpisah**: Lihat dokumentasi `DOCDESC_MAPPING_GUIDE.md` untuk query khusus

### 2. Koreksi HK

- **Category**: `POTONGAN_KOREKSI`
- **Treatment**: Dikurangi dari `jumlah_upah_kotor` (Potongan Upah Kotor), BUKAN dari `upah_bersih`

### 3. TaskDesc = 'ACCRUALS-CHECKROLL'

- Harus di-exclude dari premi dinamis
- Ditangani dengan query terpisah

---

## 📚 Related Documentation

- **DOCDESC_MAPPING_GUIDE.md** - Panduan lengkap mapping DocDesc ke komponen payroll
- **REFACTORING_IMPLEMENTATION_PLAN.md** - Plan untuk sentralisasi logic payroll

---

## 🔗 Quick Reference Query

Untuk cek cepat satu karyawan:

```sql
DECLARE @EmpCode VARCHAR(50) = 'H0033';
DECLARE @StartDate DATE = '2025-05-01';
DECLARE @EndDate DATE = '2025-06-01';

SELECT 
    RTRIM(t.EmpCode) AS emp_code,
    t.DocDesc,
    SUM(ln.Amount) AS amount,
    CASE 
        WHEN UPPER(t.DocDesc) LIKE '%PREMI%' AND UPPER(t.DocDesc) NOT LIKE '%PPH%' THEN 'PREMI'
        WHEN UPPER(t.DocDesc) LIKE '%PPH%' THEN 'PPH21'
        WHEN UPPER(t.DocDesc) LIKE '%JABATAN%' THEN 'JABATAN'
        ELSE 'LAIN'
    END AS kategori
FROM PR_ADTRANS_ARC t
JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
WHERE RTRIM(t.EmpCode) = @EmpCode
  AND t.DocDate >= @StartDate AND t.DocDate < @EndDate
GROUP BY RTRIM(t.EmpCode), t.DocDesc
ORDER BY kategori;
```

---

*Created: 2026-03-08*
