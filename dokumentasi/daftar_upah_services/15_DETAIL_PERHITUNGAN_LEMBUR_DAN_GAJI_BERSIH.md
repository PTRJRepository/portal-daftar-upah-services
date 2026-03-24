# 📊 Detail Perhitungan Lembur dan Gaji Bersih

> **Dokumentasi lengkap tentang bagaimana gaji bersih (net salary) didapatkan dari database `extend_db_ptrj`**  
> Termasuk query SQL lengkap, formula perhitungan, dan alur proses

---

## 📋 Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Database Schema](#2-database-schema)
3. [Query Utama untuk Gaji Bersih](#3-query-utama-untuk-gaji-bersih)
4. [Detail Perhitungan Lembur](#4-detail-perhitungan-lembur)
5. [Komponen Gaji Bersih](#5-komponen-gaji-bersih)
6. [Formula Lengkap](#6-formula-lengkap)
7. [Contoh Perhitungan Step-by-Step](#7-contoh-perhitungan-step-by-step)
8. [Query Template](#8-query-template)

---

## 1️⃣ Gambaran Umum

### Alur Mendapatkan Gaji Bersih

```
┌─────────────────────────────────────────────────────────────────┐
│            PROSES MENDAPATKAN GAJI BERSIH                        │
└─────────────────────────────────────────────────────────────────┘

Database extend_db_ptrj
    │
    ├─ PR_TASKREGLN / PR_TASKREGLN_ARC     → Data Lembur
    ├─ PR_ADTRANS / PR_ADTRANS_ARC         → Data Premi & Tunjangan
    ├─ PR_LOOSEFRUIT / PR_LOOSEFRUIT_ARC   → Data Premi Berondol
    │
    ↓
HR_PAYROLL (HR Database)
    └─ PayRate, RiceRation                 → Gaji Pokok & Tunjangan Beras
    │
    ↓
Perhitungan
    ├─ Gaji Pokok = HK × PayRate
    ├─ Lembur = Σ(Jam × UPJ × Multiplier)
    ├─ Premi = Brondol + Dinamis
    ├─ Tunjangan = Beras + Jabatan + Masa Kerja
    ├─ Potongan = BPJS + PPh21 + Lainnya
    │
    ↓
Gaji Bersih = (Gaji Pokok + Lembur + Premi + Tunjangan) - Potongan
```

### Database yang Digunakan

| Database | Tabel Utama | Fungsi |
|----------|-------------|--------|
| **extend_db_ptrj** | `PR_TASKREGLN`, `PR_TASKREGLN_ARC` | Transaksi lembur |
| **extend_db_ptrj** | `PR_ADTRANS`, `PR_ADTRANS_ARC` | Transaksi premi/tunjangan |
| **extend_db_ptrj** | `PR_LOOSEFRUIT`, `PR_LOOSEFRUIT_ARC` | Premi berondol |
| **HR Database** | `HR_PAYROLL` | PayRate, RiceRation |
| **HR Database** | `HR_EMPLOYEE` | Data karyawan |
| **HR Database** | `HR_GANGLN` | Assignment gang |

---

## 2️⃣ Database Schema

### Tabel PR_TASKREGLN (Detail Lembur)

```sql
CREATE TABLE PR_TASKREGLN (
    ID INT IDENTITY(1,1) PRIMARY KEY,      -- Auto-increment ID
    MasterID INT,                          -- FK ke PR_TASKREG.ID
    EmpCode VARCHAR(50),                   -- Kode karyawan
    TrxDate DATETIME,                      -- Tanggal transaksi
    Hours DECIMAL(18, 2),                  -- Jumlah jam lembur
    TaskCode VARCHAR(50),                  -- Kode task (jenis pekerjaan)
    ShiftCode VARCHAR(50),                 -- Kode shift
    Amount DECIMAL(18, 2),                 -- Amount (pre-calculated, optional)
    Rate DECIMAL(18, 2),                   -- Rate (pre-calculated, optional)
    OT BIT,                                -- Overtime flag (1 = lembur)
    GangCode VARCHAR(50),                  -- Kode gang
    DivisionCode VARCHAR(50)               -- Kode divisi
);
```

### Tabel PR_TASKREG (Master Lembur)

```sql
CREATE TABLE PR_TASKREG (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    DocDate DATETIME,                      -- Tanggal dokumen
    DocNo VARCHAR(50),                     -- Nomor dokumen
    GangCode VARCHAR(50),                  -- Kode gang
    DivisionCode VARCHAR(50),              -- Kode divisi
    CreatedBy VARCHAR(50),                 -- User yang create
    CreatedDate DATETIME,                  -- Tanggal create
    Approved BIT,                          -- Approval flag
    Posted BIT                             -- Posting flag
);
```

### Tabel PR_TASKCODE (Master Task)

```sql
CREATE TABLE PR_TASKCODE (
    TaskCode VARCHAR(50) PRIMARY KEY,
    TaskDesc VARCHAR(255),                 -- Deskripsi task
    Category VARCHAR(50),                  -- Kategori (PANEN, RAWAT, LAINNYA)
    IsOvertime BIT,                        -- Flag untuk lembur
    Multiplier DECIMAL(18, 2)              -- Multiplier default
);
```

### Relasi Tabel

```
PR_TASKREG (Master)
    │
    ├─ 1:N → PR_TASKREGLN (Detail per karyawan)
    │           │
    │           ├─ N:1 → HR_EMPLOYEE (Data karyawan)
    │           │
    │           └─ N:1 → PR_TASKCODE (Jenis pekerjaan)
    │
    └─ Archive → PR_TASKREG_ARC
                │
                └─ 1:N → PR_TASKREGLN_ARC
```

---

## 3️⃣ Query Utama untuk Gaji Bersih

### Query 1: Ambil Semua Lembur per Karyawan (Periode)

```sql
-- Query lengkap untuk mendapatkan semua lembur seorang karyawan
DECLARE @EmpCode VARCHAR(50) = 'E0001';
DECLARE @StartDate DATE = '2026-01-01';
DECLARE @EndDate DATE = '2026-01-31';

SELECT
    trl.ID,
    trl.EmpCode,
    e.EmpName,
    trl.TrxDate,
    trl.Hours,
    trl.TaskCode,
    tc.TaskDesc,
    trl.ShiftCode,
    trl.Amount AS RawAmount,
    trl.Rate AS RawRate,
    trl.GangCode,
    trl.DivisionCode
FROM (
    -- Active Table
    SELECT 
        l.ID, l.EmpCode, l.TrxDate, l.Hours, 
        l.TaskCode, l.ShiftCode, l.Amount, l.Rate,
        l.GangCode, l.DivisionCode
    FROM PR_TASKREGLN l
    JOIN PR_TASKREG m ON l.MasterID = m.ID
    WHERE l.EmpCode = @EmpCode 
      AND l.TrxDate >= @StartDate 
      AND l.TrxDate <= @EndDate 
      AND l.OT = 1  -- Hanya lembur

    UNION ALL

    -- Archive Table
    SELECT 
        l.ID, l.EmpCode, l.TrxDate, l.Hours, 
        l.TaskCode, l.ShiftCode, l.Amount, l.Rate,
        l.GangCode, l.DivisionCode
    FROM PR_TASKREGLN_ARC l
    JOIN PR_TASKREG_ARC m ON l.MasterID = m.ID
    WHERE l.EmpCode = @EmpCode 
      AND l.TrxDate >= @StartDate 
      AND l.TrxDate <= @EndDate 
      AND l.OT = 1
) trl
LEFT JOIN HR_EMPLOYEE e ON e.EmpCode = trl.EmpCode
LEFT JOIN PR_TASKCODE tc ON tc.TaskCode = trl.TaskCode
ORDER BY trl.TrxDate;
```

**Hasil Contoh:**

| ID | EmpCode | EmpName | TrxDate | Hours | TaskCode | TaskDesc | RawAmount | RawRate |
|----|---------|---------|---------|-------|----------|----------|-----------|---------|
| 123 | E0001 | John Doe | 2026-01-05 | 2 | OVT001 | Overtime - Panen | NULL | NULL |
| 124 | E0001 | John Doe | 2026-01-08 | 3 | OVT002 | Overtime - Rawat | NULL | NULL |
| 125 | E0001 | John Doe | 2026-01-12 | 1 | OVT001 | Overtime - Panen | NULL | NULL |

---

### Query 2: Total Lembur per Karyawan (Summary)

```sql
-- Summary total lembur per karyawan
DECLARE @Month INT = 1;
DECLARE @Year INT = 2026;

SELECT 
    trl.EmpCode,
    e.EmpName,
    COUNT(*) AS TransactionCount,
    SUM(trl.Hours) AS TotalHours,
    SUM(ISNULL(trl.Amount, 0)) AS RawTotalAmount
FROM (
    SELECT EmpCode, Hours, Amount FROM PR_TASKREGLN WHERE OT = 1
    UNION ALL
    SELECT EmpCode, Hours, Amount FROM PR_TASKREGLN_ARC WHERE OT = 1
) trl
LEFT JOIN HR_EMPLOYEE e ON e.EmpCode = trl.EmpCode
WHERE YEAR(trl.TrxDate) = @Year 
  AND MONTH(trl.TrxDate) = @Month
GROUP BY trl.EmpCode, e.EmpName
ORDER BY trl.EmpCode;
```

---

### Query 3: Lembur dengan Breakdown per Task Code

```sql
-- Breakdown lembur per jenis task
DECLARE @EmpCode VARCHAR(50) = 'E0001';
DECLARE @Month INT = 1;
DECLARE @Year INT = 2026;

SELECT 
    trl.TaskCode,
    tc.TaskDesc,
    COUNT(*) AS TransactionCount,
    SUM(trl.Hours) AS TotalHours,
    SUM(ISNULL(trl.Amount, 0)) AS RawAmount
FROM (
    SELECT TaskCode, Hours, Amount FROM PR_TASKREGLN WHERE OT = 1
    UNION ALL
    SELECT TaskCode, Hours, Amount FROM PR_TASKREGLN_ARC WHERE OT = 1
) trl
LEFT JOIN PR_TASKCODE tc ON tc.TaskCode = trl.TaskCode
WHERE trl.EmpCode = @EmpCode
  AND YEAR(trl.TrxDate) = @Year 
  AND MONTH(trl.TrxDate) = @Month
GROUP BY trl.TaskCode, tc.TaskDesc
ORDER BY TotalHours DESC;
```

**Hasil Contoh:**

| TaskCode | TaskDesc | TransactionCount | TotalHours | RawAmount |
|----------|----------|------------------|------------|-----------|
| OVT001 | Overtime - Panen | 5 | 10 | 0 |
| OVT002 | Overtime - Rawat | 3 | 5 | 0 |
| OVT003 | Overtime - Pabrik | 2 | 3 | 0 |

---

## 4️⃣ Detail Perhitungan Lembur

### Step 1: Dapatkan UPJ (Upah per Jam)

**Query untuk mendapatkan PayRate:**

```sql
SELECT EmpCode, PayRate, RiceRation
FROM HR_PAYROLL
WHERE EmpCode = 'E0001';
```

**Formula UPJ:**

```
UPJ = (PayRate × 30) / 173
```

**Contoh:**

```
Input:
  PayRate = Rp 75,000/hari

Calculation:
  UPJ = (75,000 × 30) / 173
      = 2,250,000 / 173
      = Rp 13,005.78 per jam
```

**Default Value:** Jika PayRate tidak ada, gunakan UPJ default = **Rp 17,257** (dari environment variable `LEMBUR_UPJ`).

---

### Step 2: Klasifikasi Jenis Hari

**Query untuk mendapatkan holiday calendar:**

```sql
SELECT HolidayDate, Description
FROM HR_GPH
WHERE YEAR(HolidayDate) = 2026
ORDER BY HolidayDate;
```

**Klasifikasi Hari:**

| Hari | Day Type | Keterangan |
|------|----------|------------|
| Senin, Rabu, Kamis, Sabtu | WORKDAY_LONG | Hari kerja panjang (7+ jam) |
| Jumat | WORKDAY_SHORT | Hari kerja pendek (5+ jam) |
| Minggu | SUNDAY | Hari Minggu |
| Tanggal merah (non-agama) | HOLIDAY_REGULAR | Libur umum |
| Tanggal merah (agama) | HOLIDAY_RELIGIOUS | Libur keagamaan |

**Deteksi Libur Keagamaan:**

```typescript
const isReligious = description.includes("IDUL") ||
                    description.includes("NATAL") ||
                    description.includes("IMLEK") ||
                    description.includes("WAISAK") ||
                    description.includes("ISRA") ||
                    description.includes("MAULID");
```

---

### Step 3: Hitung Lembur per Transaksi dengan Tier System

#### A. Hari Kerja (WORKDAY_LONG & WORKDAY_SHORT)

**2-Tier System:**

| Tier | Durasi | Multiplier | Formula |
|------|--------|------------|---------|
| Tier 1 | 1 jam pertama | 1.5× UPJ | `1 × UPJ × 1.5` |
| Tier 2 | Jam berikutnya | 2.0× UPJ | `(hours-1) × UPJ × 2.0` |

**Contoh: Lembur 3 jam di hari Senin**

```
Input:
  UPJ = Rp 13,005.78
  Hours = 3
  Day Type = WORKDAY_LONG

Calculation:
  Tier 1: 1 jam × 13,005.78 × 1.5 = Rp 19,508.67
  Tier 2: 2 jam × 13,005.78 × 2.0 = Rp 52,023.12
  
  Total = 19,508.67 + 52,023.12 = Rp 71,531.79
  Rounded = Rp 71,532
```

---

#### B. Minggu & Libur Umum (SUNDAY & HOLIDAY_REGULAR)

**3-Tier System:**

| Tier | Durasi | Multiplier | Formula |
|------|--------|------------|---------|
| Tier 1 | 7 jam pertama | 2.0× UPJ | `min(hours, 7) × UPJ × 2.0` |
| Tier 2 | 1 jam berikutnya (jam ke-8) | 3.0× UPJ | `min(hours-7, 1) × UPJ × 3.0` |
| Tier 3 | Jam setelahnya (> 8 jam) | 4.0× UPJ | `max(hours-8, 0) × UPJ × 4.0` |

**Contoh: Lembur 8 jam di hari Minggu**

```
Input:
  UPJ = Rp 13,005.78
  Hours = 8
  Day Type = SUNDAY

Calculation:
  Tier 1: 7 jam × 13,005.78 × 2.0 = Rp 182,080.92
  Tier 2: 1 jam × 13,005.78 × 3.0 = Rp 39,017.34
  Tier 3: 0 jam × 13,005.78 × 4.0 = Rp 0
  
  Total = 182,080.92 + 39,017.34 + 0 = Rp 221,098.26
  Rounded = Rp 221,098
```

---

#### C. Libur Keagamaan (HOLIDAY_RELIGIOUS)

**3-Tier System (Multiplier Lebih Tinggi):**

| Tier | Durasi | Multiplier | Formula |
|------|--------|------------|---------|
| Tier 1 | 7 jam pertama | 3.0× UPJ | `min(hours, 7) × UPJ × 3.0` |
| Tier 2 | 1 jam berikutnya (jam ke-8) | 4.0× UPJ | `min(hours-7, 1) × UPJ × 4.0` |
| Tier 3 | Jam setelahnya (> 8 jam) | 4.0× UPJ | `max(hours-8, 0) × UPJ × 4.0` |

**Contoh: Lembur 6 jam di hari Idul Fitri**

```
Input:
  UPJ = Rp 13,005.78
  Hours = 6
  Day Type = HOLIDAY_RELIGIOUS

Calculation:
  Tier 1: 5 jam × 13,005.78 × 3.0 = Rp 195,086.70
  Tier 2: 1 jam × 13,005.78 × 4.0 = Rp 52,023.12
  Tier 3: 0 jam × 13,005.78 × 4.0 = Rp 0
  
  Total = 195,086.70 + 52,023.12 + 0 = Rp 247,109.82
  Rounded = Rp 247,110
```

---

### Step 4: Agregasi Semua Lembur

**Formula Total Lembur:**

```
TotalLembur = Σ(breakdown.total_amount untuk semua transaksi)
```

**Contoh Agregasi:**

```
Karyawan: E0001 - John Doe
Periode: Januari 2026

Transaksi:
  2026-01-05 (Senin): 2 jam → Rp 39,017
  2026-01-08 (Kamis): 3 jam → Rp 71,532
  2026-01-12 (Minggu): 8 jam → Rp 221,098
  2026-01-15 (Jumat): 1 jam → Rp 19,509
  2026-01-20 (Idul Fitri): 6 jam → Rp 247,110

TotalLembur = 39,017 + 71,532 + 221,098 + 19,509 + 247,110
            = Rp 598,266
```

---

## 5️⃣ Komponen Gaji Bersih

### Formula Lengkap

```
┌─────────────────────────────────────────────────────────────┐
│               FORMULA GAJI BERSIH                            │
└─────────────────────────────────────────────────────────────┘

1. GAJI POKOK = HK × PayRate

2. TUNJANGAN BERAS = HK × RiceRation

3. TUNJANGAN JABATAN = Fixed amount (dari tunjangan_rate)

4. TUNJANGAN MASA KERJA = Fixed amount (dari HR_HISTORY)

5. LEMBUR = Σ(Jam × UPJ × Multiplier) ← Detail di Section 4

6. PREMI BERONDOL = Σ(Kg × Rate) dari PR_LOOSEFRUIT

7. PREMI DINAMIS = Σ(Amount) dari PR_ADTRANS

8. JUMLAH UPAH KOTOR = (1) + (2) + (3) + (4) + (5) + (6) + (7)

9. POTONGAN BPJS:
   ├─ BPJS Kesehatan Pekerja = 1% × Base
   ├─ BPJS Pensiun Pekerja = 1% × Base
   └─ ASTEK Pekerja = 2% × Base
   
   Dimana Base = (PayRate × 30) + TunjanganMasaKerja

10. POTONGAN PPh21 = Tarif TER × Penghasilan Bruto
    
    Penghasilan Bruto = (8) + ASTEK Majikan (0.84%) + BPJS Majikan (4%)

11. POTONGAN LAINNYA = SPSI + Koreksi + Alpa

12. GAJI BERSIH = (8) - (9) - (10) - (11)
```

---

### Query untuk Mendapatkan Semua Komponen

```sql
-- Query lengkap untuk semua komponen gaji
DECLARE @EmpCode VARCHAR(50) = 'E0001';
DECLARE @Month INT = 1;
DECLARE @Year INT = 2026;
DECLARE @StartDate DATE = CAST(@Year AS VARCHAR) + '-' + CAST(@Month AS VARCHAR) + '-01';
DECLARE @EndDate DATE = CAST(@Year AS VARCHAR) + '-' + CAST(@Month AS VARCHAR) + '-31';

SELECT 
    -- Employee Info
    e.EmpCode,
    e.EmpName,
    hr.PayRate,
    hr.RiceRation,
    
    -- Attendance
    ISNULL(att.TotalHK, 0) AS TotalHK,
    
    -- Gaji Pokok
    ISNULL(att.TotalHK, 0) * ISNULL(hr.PayRate, 0) AS GajiPokok,
    
    -- Tunjangan Beras
    ISNULL(att.TotalHK, 0) * ISNULL(hr.RiceRation, 0) AS TunjanganBeras,
    
    -- Lembur (RAW - belum dikalkulasi tier)
    ISNULL(lembur.TotalHours, 0) AS TotalJamLembur,
    ISNULL(lembur.RawAmount, 0) AS LemburRawAmount,
    
    -- Premi Berondol
    ISNULL(berondol.TotalAmount, 0) AS PremiBerondol,
    
    -- Premi Dinamis
    ISNULL(adtrans.TotalAmount, 0) AS PremiDinamis

FROM HR_EMPLOYEE e
LEFT JOIN HR_PAYROLL hr ON hr.EmpCode = e.EmpCode

-- Attendance
LEFT JOIN (
    SELECT 
        EmpCode,
        COUNT(DISTINCT CAST(TrxDate AS DATE)) AS TotalHK
    FROM PR_ABSEN
    WHERE EmpCode = @EmpCode
      AND TrxDate >= @StartDate
      AND TrxDate <= @EndDate
    GROUP BY EmpCode
) att ON att.EmpCode = e.EmpCode

-- Lembur (RAW hours, bukan amount)
LEFT JOIN (
    SELECT 
        EmpCode,
        SUM(Hours) AS TotalHours,
        SUM(ISNULL(Amount, 0)) AS RawAmount
    FROM (
        SELECT EmpCode, Hours, Amount FROM PR_TASKREGLN WHERE OT = 1
        UNION ALL
        SELECT EmpCode, Hours, Amount FROM PR_TASKREGLN_ARC WHERE OT = 1
    ) trl
    WHERE EmpCode = @EmpCode
      AND TrxDate >= @StartDate
      AND TrxDate <= @EndDate
    GROUP BY EmpCode
) lembur ON lembur.EmpCode = e.EmpCode

-- Premi Berondol
LEFT JOIN (
    SELECT 
        EmpCode,
        SUM(ISNULL(Amount, 0)) AS TotalAmount
    FROM (
        SELECT EmpCode, Amount FROM PR_LOOSEFRUIT
        UNION ALL
        SELECT EmpCode, Amount FROM PR_LOOSEFRUIT_ARC
    ) bf
    WHERE EmpCode = @EmpCode
      AND TrxDate >= @StartDate
      AND TrxDate <= @EndDate
    GROUP BY EmpCode
) berondol ON berondol.EmpCode = e.EmpCode

-- Premi Dinamis (ADTRANS)
LEFT JOIN (
    SELECT 
        EmpCode,
        SUM(ISNULL(Amount, 0)) AS TotalAmount
    FROM (
        SELECT EmpCode, Amount FROM PR_ADTRANS
        UNION ALL
        SELECT EmpCode, Amount FROM PR_ADTRANS_ARC
    ) adt
    WHERE EmpCode = @EmpCode
      AND TrxDate >= @StartDate
      AND TrxDate <= @EndDate
    GROUP BY EmpCode
) adtrans ON adtrans.EmpCode = e.EmpCode

WHERE e.EmpCode = @EmpCode;
```

---

## 6️⃣ Formula Lengkap

### A. Perhitungan UPJ

```typescript
function calculateUPJ(payRate: number): number {
    if (payRate <= 0) {
        return 17257; // Default UPJ
    }
    return (payRate * 30) / 173;
}
```

### B. Perhitungan Lembur per Transaksi

```typescript
function calculateOvertimePayment(
    hours: number,
    dayType: DayType,
    upj: number,
    isShortDay: boolean = false
): OvertimeBreakdown {
    const rates = OVERTIME_RATES[dayType];
    let remainingHours = hours;
    
    // Tier 1
    const tier1Limit = isShortDay ? rates.tier_1_boundary_short : rates.tier_1_boundary_long;
    const tier1Hours = Math.min(remainingHours, tier1Limit);
    const tier1Amount = tier1Hours * upj * rates.tier_1_rate;
    remainingHours -= tier1Hours;
    
    // Tier 2
    const tier2Limit = (dayType === DayType.SUNDAY || dayType === DayType.HOLIDAY_REGULAR || dayType === DayType.HOLIDAY_RELIGIOUS) ? 1 : 999;
    const tier2Hours = Math.min(remainingHours, tier2Limit);
    const tier2Amount = tier2Hours * upj * rates.tier_2_rate;
    remainingHours -= tier2Hours;
    
    // Tier 3
    const tier3Hours = remainingHours;
    const tier3Amount = tier3Hours * upj * rates.tier_3_rate;
    
    // Total
    const totalAmount = tier1Amount + tier2Amount + tier3Amount;
    const totalRate = hours > 0 ? totalAmount / (upj * hours) : 0;
    
    return {
        tier_1_rate: rates.tier_1_rate,
        tier_1_hours: tier1Hours,
        tier_1_amount: tier1Amount,
        tier_1_boundary: tier1Limit,
        tier_2_rate: rates.tier_2_rate,
        tier_2_hours: tier2Hours,
        tier_2_amount: tier2Amount,
        tier_3_rate: rates.tier_3_rate,
        tier_3_hours: tier3Hours,
        tier_3_amount: tier3Amount,
        total_rate: totalRate,
        total_amount: totalAmount
    };
}
```

### C. Perhitungan Gaji Bersih

```typescript
interface SalaryComponents {
    gajiPokok: number;
    tunjanganBeras: number;
    tunjanganJabatan: number;
    tunjanganMasaKerja: number;
    lemburJumlah: number;
    premiBerondol: number;
    premiDinamis: number;
    bpjsKesehatanPekerja: number;
    bpjsPensiunPekerja: number;
    astekPekerja: number;
    pph21: number;
    spsi: number;
    koreksi: number;
}

function calculateNetSalary(
    hk: number,
    payRate: number,
    riceRation: number,
    jabatanAmount: number,
    masaKerjaAmount: number,
    lemburAmount: number,
    berondolAmount: number,
    dinamisAmount: number,
    ptkp: string
): number {
    // 1. Gaji Pokok
    const gajiPokok = hk * payRate;
    
    // 2. Tunjangan Beras
    const tunjanganBeras = hk * riceRation;
    
    // 3-4. Tunjangan
    const totalTunjangan = tunjanganBeras + jabatanAmount + masaKerjaAmount + lemburAmount;
    
    // 5-7. Premi
    const totalPremi = berondolAmount + dinamisAmount;
    
    // 8. Jumlah Upah Kotor
    const jumlahUpahKotor = gajiPokok + totalTunjangan + totalPremi;
    
    // 9. Potongan BPJS
    const baseBPJS = (payRate * 30) + masaKerjaAmount;
    const bpjsKesehatanPekerja = baseBPJS * 0.01;
    const bpjsPensiunPekerja = baseBPJS * 0.01;
    const astekPekerja = baseBPJS * 0.02;
    const totalBPJSPekerja = bpjsKesehatanPekerja + bpjsPensiunPekerja + astekPekerja;
    
    // 10. PPh21
    const astekMajikan = baseBPJS * 0.0084;
    const bpjsKesehatanMajikan = baseBPJS * 0.04;
    const penghasilanBruto = jumlahUpahKotor + astekMajikan + bpjsKesehatanMajikan;
    const pph21 = calculatePph21Ter(penghasilanBruto, ptkp);
    
    // 11. Potongan Lainnya
    const spsi = 5000; // Fixed
    const koreksi = 0; // Optional
    const totalPotonganLainnya = spsi + koreksi;
    
    // 12. Gaji Bersih
    const gajiBersih = jumlahUpahKotor - totalBPJSPekerja - pph21 - totalPotonganLainnya;
    
    return Math.round(gajiBersih);
}
```

---

## 7️⃣ Contoh Perhitungan Step-by-Step

### Studi Kasus: Karyawan E0001 - John Doe

**Data Karyawan:**

```
EmpCode: E0001
EmpName: John Doe
PayRate: Rp 75,000/hari
RiceRation: Rp 15,000/HK
PTKP: TK/0
HK (Hari Kerja): 26 hari
```

**Data Lembur (dari PR_TASKREGLN):**

| Tanggal | Jam | Hari | Task Code | Task Desc |
|---------|-----|------|-----------|-----------|
| 2026-01-05 | 2 | Senin | OVT001 | Overtime - Panen |
| 2026-01-08 | 3 | Kamis | OVT002 | Overtime - Rawat |
| 2026-01-12 | 8 | Minggu | OVT001 | Overtime - Panen |
| 2026-01-15 | 1 | Jumat | OVT003 | Overtime - Pabrik |
| 2026-01-20 | 6 | Idul Fitri | OVT001 | Overtime - Panen |

**Data Lain:**

```
Tunjangan Jabatan: Rp 100,000
Tunjangan Masa Kerja: Rp 500,000
Premi Berondol: Rp 250,000
Premi Dinamis: Rp 150,000
```

---

### Step 1: Hitung UPJ

```
UPJ = (PayRate × 30) / 173
    = (75,000 × 30) / 173
    = 2,250,000 / 173
    = Rp 13,005.78
```

---

### Step 2: Hitung Lembur per Transaksi

#### Transaksi 1: 2026-01-05 (Senin) - 2 jam

```
Day Type: WORKDAY_LONG
Hours: 2

Tier 1: 1 jam × 13,005.78 × 1.5 = Rp 19,508.67
Tier 2: 1 jam × 13,005.78 × 2.0 = Rp 26,011.56
Total: Rp 45,520.23 → Rp 45,520
```

#### Transaksi 2: 2026-01-08 (Kamis) - 3 jam

```
Day Type: WORKDAY_LONG
Hours: 3

Tier 1: 1 jam × 13,005.78 × 1.5 = Rp 19,508.67
Tier 2: 2 jam × 13,005.78 × 2.0 = Rp 52,023.12
Total: Rp 71,531.79 → Rp 71,532
```

#### Transaksi 3: 2026-01-12 (Minggu) - 8 jam

```
Day Type: SUNDAY
Hours: 8

Tier 1: 7 jam × 13,005.78 × 2.0 = Rp 182,080.92
Tier 2: 1 jam × 13,005.78 × 3.0 = Rp 39,017.34
Tier 3: 0 jam × 13,005.78 × 4.0 = Rp 0
Total: Rp 221,098.26 → Rp 221,098
```

#### Transaksi 4: 2026-01-15 (Jumat) - 1 jam

```
Day Type: WORKDAY_SHORT
Hours: 1

Tier 1: 1 jam × 13,005.78 × 1.5 = Rp 19,508.67
Tier 2: 0 jam × 13,005.78 × 2.0 = Rp 0
Total: Rp 19,508.67 → Rp 19,509
```

#### Transaksi 5: 2026-01-20 (Idul Fitri) - 6 jam

```
Day Type: HOLIDAY_RELIGIOUS
Hours: 6

Tier 1: 5 jam × 13,005.78 × 3.0 = Rp 195,086.70
Tier 2: 1 jam × 13,005.78 × 4.0 = Rp 52,023.12
Tier 3: 0 jam × 13,005.78 × 4.0 = Rp 0
Total: Rp 247,109.82 → Rp 247,110
```

---

### Step 3: Agregasi Lembur

```
TotalLembur = 45,520 + 71,532 + 221,098 + 19,509 + 247,110
            = Rp 404,769
TotalJamLembur = 2 + 3 + 8 + 1 + 6 = 20 jam
```

---

### Step 4: Hitung Komponen Lain

```
1. Gaji Pokok = HK × PayRate
              = 26 × 75,000
              = Rp 1,950,000

2. Tunjangan Beras = HK × RiceRation
                   = 26 × 15,000
                   = Rp 390,000

3. Tunjangan Jabatan = Rp 100,000 (fixed)

4. Tunjangan Masa Kerja = Rp 500,000 (fixed)

5. Lembur = Rp 404,769 (dari Step 3)

6. Premi Berondol = Rp 250,000

7. Premi Dinamis = Rp 150,000

8. Jumlah Upah Kotor = 1,950,000 + 390,000 + 100,000 + 500,000 + 404,769 + 250,000 + 150,000
                     = Rp 3,744,769
```

---

### Step 5: Hitung Potongan BPJS

```
Base BPJS = (PayRate × 30) + TunjanganMasaKerja
          = (75,000 × 30) + 500,000
          = 2,250,000 + 500,000
          = Rp 2,750,000

BPJS Kesehatan Pekerja = 1% × 2,750,000 = Rp 27,500
BPJS Pensiun Pekerja = 1% × 2,750,000 = Rp 27,500
ASTEK Pekerja = 2% × 2,750,000 = Rp 55,000

Total BPJS Pekerja = 27,500 + 27,500 + 55,000 = Rp 110,000
```

---

### Step 6: Hitung PPh21 TER

```
ASTEK Majikan = 0.84% × 2,750,000 = Rp 23,100
BPJS Kesehatan Majikan = 4% × 2,750,000 = Rp 110,000

Penghasilan Bruto = Jumlah Upah Kotor + ASTEK Majikan + BPJS Majikan
                  = 3,744,769 + 23,100 + 110,000
                  = Rp 3,877,869

PTKP: TK/0 → TER A
Penghasilan Bruto: Rp 3,877,869

Cari Layer TER A:
- Layer 1: 0 - 5,400,000 → 0.00%

Bruto 3,877,869 < 5,400,000
→ Tarif: 0.00%

PPh21 = 3,877,869 × 0.00% = Rp 0
```

---

### Step 7: Hitung Potongan Lainnya

```
SPSI = Rp 5,000 (fixed)
Koreksi = Rp 0 (tidak ada)

Total Potongan Lainnya = Rp 5,000
```

---

### Step 8: Hitung Gaji Bersih

```
Gaji Bersih = Jumlah Upah Kotor - Total BPJS Pekerja - PPh21 - Total Potongan Lainnya
            = 3,744,769 - 110,000 - 0 - 5,000
            = Rp 3,629,769
```

---

### Summary Perhitungan

```
┌─────────────────────────────────────────────────────────────┐
│            RINGKASAN PERHITUNGAN GAJI                       │
│            Periode: Januari 2026                            │
│            Karyawan: E0001 - John Doe                       │
└─────────────────────────────────────────────────────────────┘

PENGHASILAN:
  Gaji Pokok              Rp 1,950,000
  Tunjangan Beras            390,000
  Tunjangan Jabatan          100,000
  Tunjangan Masa Kerja       500,000
  Lembur (20 jam)            404,769
  Premi Berondol             250,000
  Premi Dinamis              150,000
  ─────────────────────────────────────
  Jumlah Upah Kotor       Rp 3,744,769

POTONGAN:
  BPJS Kesehatan             27,500
  BPJS Pensiun               27,500
  ASTEK Pekerja              55,000
  SPSI                        5,000
  PPh21                           0
  ─────────────────────────────────────
  Total Potongan          Rp   115,000

GAJI BERSIH              Rp 3,629,769
```

---

## 8️⃣ Query Template

### Template 1: Get All Overtime for Employee

```sql
-- Get all overtime transactions for an employee in a period
DECLARE @EmpCode VARCHAR(50) = ?;
DECLARE @StartDate DATE = ?;
DECLARE @EndDate DATE = ?;

SELECT 
    trl.ID,
    trl.EmpCode,
    e.EmpName,
    trl.TrxDate,
    DATENAME(WEEKDAY, trl.TrxDate) AS DayName,
    trl.Hours,
    trl.TaskCode,
    tc.TaskDesc,
    trl.ShiftCode,
    trl.Amount AS RawAmount,
    trl.Rate AS RawRate,
    trl.GangCode,
    trl.DivisionCode
FROM (
    SELECT 
        l.ID, l.EmpCode, l.TrxDate, l.Hours, 
        l.TaskCode, l.ShiftCode, l.Amount, l.Rate,
        l.GangCode, l.DivisionCode
    FROM PR_TASKREGLN l
    JOIN PR_TASKREG m ON l.MasterID = m.ID
    WHERE l.EmpCode = @EmpCode 
      AND l.TrxDate >= @StartDate 
      AND l.TrxDate <= @EndDate 
      AND l.OT = 1

    UNION ALL

    SELECT 
        l.ID, l.EmpCode, l.TrxDate, l.Hours, 
        l.TaskCode, l.ShiftCode, l.Amount, l.Rate,
        l.GangCode, l.DivisionCode
    FROM PR_TASKREGLN_ARC l
    JOIN PR_TASKREG_ARC m ON l.MasterID = m.ID
    WHERE l.EmpCode = @EmpCode 
      AND l.TrxDate >= @StartDate 
      AND l.TrxDate <= @EndDate 
      AND l.OT = 1
) trl
LEFT JOIN HR_EMPLOYEE e ON e.EmpCode = trl.EmpCode
LEFT JOIN PR_TASKCODE tc ON tc.TaskCode = trl.TaskCode
ORDER BY trl.TrxDate;
```

---

### Template 2: Get Overtime Summary by Employee

```sql
-- Get overtime summary for all employees in a period
DECLARE @Month INT = ?;
DECLARE @Year INT = ?;
DECLARE @DivisionCode VARCHAR(50) = ?;

SELECT 
    trl.EmpCode,
    e.EmpName,
    e.GangCode,
    COUNT(*) AS TransactionCount,
    SUM(trl.Hours) AS TotalHours,
    SUM(ISNULL(trl.Amount, 0)) AS RawTotalAmount
FROM (
    SELECT EmpCode, Hours, Amount, GangCode FROM PR_TASKREGLN WHERE OT = 1
    UNION ALL
    SELECT EmpCode, Hours, Amount, GangCode FROM PR_TASKREGLN_ARC WHERE OT = 1
) trl
LEFT JOIN HR_EMPLOYEE e ON e.EmpCode = trl.EmpCode
WHERE YEAR(trl.TrxDate) = @Year 
  AND MONTH(trl.TrxDate) = @Month
  AND (@DivisionCode IS NULL OR e.DivisionCode = @DivisionCode)
GROUP BY trl.EmpCode, e.EmpName, e.GangCode
ORDER BY trl.EmpCode;
```

---

### Template 3: Get Overtime with Task Breakdown

```sql
-- Get overtime breakdown by task code for an employee
DECLARE @EmpCode VARCHAR(50) = ?;
DECLARE @Month INT = ?;
DECLARE @Year INT = ?;

SELECT 
    trl.TaskCode,
    tc.TaskDesc,
    tc.Category,
    COUNT(*) AS TransactionCount,
    SUM(trl.Hours) AS TotalHours,
    SUM(ISNULL(trl.Amount, 0)) AS RawAmount
FROM (
    SELECT TaskCode, Hours, Amount FROM PR_TASKREGLN WHERE OT = 1
    UNION ALL
    SELECT TaskCode, Hours, Amount FROM PR_TASKREGLN_ARC WHERE OT = 1
) trl
LEFT JOIN PR_TASKCODE tc ON tc.TaskCode = trl.TaskCode
WHERE trl.EmpCode = @EmpCode
  AND YEAR(trl.TrxDate) = @Year 
  AND MONTH(trl.TrxDate) = @Month
GROUP BY trl.TaskCode, tc.TaskDesc, tc.Category
ORDER BY TotalHours DESC;
```

---

### Template 4: Get Complete Payroll Components

```sql
-- Get all payroll components for an employee
DECLARE @EmpCode VARCHAR(50) = ?;
DECLARE @Month INT = ?;
DECLARE @Year INT = ?;

WITH Attendance AS (
    SELECT 
        EmpCode,
        COUNT(DISTINCT CAST(TrxDate AS DATE)) AS TotalHK
    FROM PR_ABSEN
    WHERE EmpCode = @EmpCode
      AND YEAR(TrxDate) = @Year
      AND MONTH(TrxDate) = @Month
    GROUP BY EmpCode
),
Overtime AS (
    SELECT 
        EmpCode,
        SUM(Hours) AS TotalHours
    FROM (
        SELECT EmpCode, Hours FROM PR_TASKREGLN WHERE OT = 1
        UNION ALL
        SELECT EmpCode, Hours FROM PR_TASKREGLN_ARC WHERE OT = 1
    ) trl
    WHERE EmpCode = @EmpCode
      AND YEAR(TrxDate) = @Year
      AND MONTH(TrxDate) = @Month
    GROUP BY EmpCode
),
LooseFruit AS (
    SELECT 
        EmpCode,
        SUM(ISNULL(Amount, 0)) AS TotalAmount
    FROM (
        SELECT EmpCode, Amount FROM PR_LOOSEFRUIT
        UNION ALL
        SELECT EmpCode, Amount FROM PR_LOOSEFRUIT_ARC
    ) bf
    WHERE EmpCode = @EmpCode
      AND YEAR(TrxDate) = @Year
      AND MONTH(TrxDate) = @Month
    GROUP BY EmpCode
),
ADTrans AS (
    SELECT 
        EmpCode,
        SUM(ISNULL(Amount, 0)) AS TotalAmount
    FROM (
        SELECT EmpCode, Amount FROM PR_ADTRANS
        UNION ALL
        SELECT EmpCode, Amount FROM PR_ADTRANS_ARC
    ) adt
    WHERE EmpCode = @EmpCode
      AND YEAR(TrxDate) = @Year
      AND MONTH(TrxDate) = @Month
    GROUP BY EmpCode
)
SELECT 
    e.EmpCode,
    e.EmpName,
    hr.PayRate,
    hr.RiceRation,
    ISNULL(att.TotalHK, 0) AS TotalHK,
    ISNULL(att.TotalHK, 0) * ISNULL(hr.PayRate, 0) AS GajiPokok,
    ISNULL(att.TotalHK, 0) * ISNULL(hr.RiceRation, 0) AS TunjanganBeras,
    ISNULL(ot.TotalHours, 0) AS TotalJamLembur,
    ISNULL(lf.TotalAmount, 0) AS PremiBerondol,
    ISNULL(ad.TotalAmount, 0) AS PremiDinamis
FROM HR_EMPLOYEE e
LEFT JOIN HR_PAYROLL hr ON hr.EmpCode = e.EmpCode
LEFT JOIN Attendance att ON att.EmpCode = e.EmpCode
LEFT JOIN Overtime ot ON ot.EmpCode = e.EmpCode
LEFT JOIN LooseFruit lf ON lf.EmpCode = e.EmpCode
LEFT JOIN ADTrans ad ON ad.EmpCode = e.EmpCode
WHERE e.EmpCode = @EmpCode;
```

---

## 📚 Referensi

### File Terkait

| File | Lokasi | Fungsi |
|------|--------|--------|
| `lemburCalculator.ts` | `backend/src/services/` | Core calculation logic |
| `LemburService.ts` | `backend/src/services/payroll/components/` | Component service |
| `11_LEMBUR_CALCULATION.md` | `dokumentasi/daftar_upah_services/` | Existing documentation |
| `get_amount_lembur.sql` | `backend/query/Tunjangan/` | SQL query template |

### Database Tables

- `PR_TASKREGLN` - Detail transaksi lembur (active)
- `PR_TASKREGLN_ARC` - Detail transaksi lembur (archive)
- `PR_TASKREG` - Master transaksi lembur (active)
- `PR_TASKREG_ARC` - Master transaksi lembur (archive)
- `PR_TASKCODE` - Master kode task
- `HR_EMPLOYEE` - Data karyawan
- `HR_PAYROLL` - PayRate dan RiceRation
- `HR_GPH` - Calendar hari libur

---

**Versi:** 1.0  
**Tanggal:** Maret 2026  
**Author:** Development Team
