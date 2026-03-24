# Pendapatan Upah Lainnya (Other Income) dan Korelasi dengan Perhitungan Pajak

## Ringkasan Eksekutif

Dokumen ini menjelaskan bagaimana sistem menangani **pendapatan upah lainnya** (seperti THR, Bonus, dan custom income lainnya) dan korelasinya dengan **perhitungan pajak (PPh 21)** dalam sistem payroll Plantware Estate.

**Catatan Penting untuk Tahun 2026**: 
- **THR diberikan pada bulan Maret (bulan 3)**, bukan bulan Februari (bulan 2)
- THR hanya menambah komponen `upah` (penghasilan bruto) dalam perhitungan pajak
- Perhitungan pajak menggunakan metode **TER (Tarif Efektif Rata-rata)** untuk pemotongan bulanan

---

## 1. Jenis Pendapatan Upah Lainnya

### 1.1 THR (Tunjangan Hari Raya)

**Karakteristik**:
- Diberikan menjelang hari raya keagamaan
- Untuk tahun 2026: **diberikan pada bulan Maret (periode_month = 3)**
- Formula: `(UPAH_DASAR × 30) + (BERAS_RATE × 30) + MASA_KERJA_JUMLAH`
- Status: **Taxable** (dikenai pajak)

**Perhitungan Proporsional**:
```typescript
// Karyawan dengan masa kerja < 12 bulan
if (workingMonths < 12) {
    thrAmount = (fullThr * workingMonths) / 12;
}
```

### 1.2 Bonus / Exgratia

**Karakteristik**:
- Bonus kinerja atau bonus tahunan
- Amount dapat bervariasi (fixed atau formula-based)
- Status: **Taxable** (dikenai pajak)
- Disimpan dalam JSON static atau database

### 1.3 Custom Income

**Karakteristik**:
- Pendapatan lain yang didefinisikan user
- Flexible formula dan amount
- Dapat dikonfigurasi: `is_taxable` (true/false)

---

## 2. Struktur Database

### 2.1 Tabel: `employee_other_incomes`

```sql
CREATE TABLE employee_other_incomes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nik VARCHAR(50) NOT NULL,              -- Nomor Induk Karyawan
    emp_name VARCHAR(150),                  -- Nama karyawan
    division_code VARCHAR(50),              -- Kode divisi
    gang_code VARCHAR(50),                  -- Kode gang
    period_year INT NOT NULL,               -- Tahun periode
    period_month INT NOT NULL,              -- Bulan periode
    income_type VARCHAR(50) NOT NULL,       -- 'THR', 'Bonus', 'Custom'
    income_name VARCHAR(150),               -- Detail nama
    amount DECIMAL(18, 2) DEFAULT 0,        -- Nominal rupiah
    is_paid_in_thp BIT DEFAULT 0,           -- Dibayar di THP
    is_taxable BIT DEFAULT 0,               -- Kena pajak
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    details_json NVARCHAR(MAX) NULL         -- Formula variables (JSON)
);

-- Unique constraint untuk mencegah duplikasi
CREATE UNIQUE INDEX UX_nik_period_type
ON employee_other_incomes(nik, period_year, period_month, income_type);
```

### 2.2 Tabel: `employee_other_incomes_formulas`

```sql
CREATE TABLE employee_other_incomes_formulas (
    income_type VARCHAR(50) PRIMARY KEY,
    formula_string VARCHAR(500) NOT NULL,   -- Formula expression
    is_paid_in_thp BIT DEFAULT 1,
    is_taxable BIT DEFAULT 1,
    updated_at DATETIME DEFAULT GETDATE()
);

-- Default formula untuk THR
INSERT INTO employee_other_incomes_formulas (income_type, formula_string, is_paid_in_thp, is_taxable)
VALUES ('THR', '(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH', 1, 1);
```

### 2.3 Tabel: `employee_other_incomes_blacklist`

```sql
CREATE TABLE employee_other_incomes_blacklist (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nik VARCHAR(50) NOT NULL,
    emp_name VARCHAR(150),
    period_year INT NOT NULL,
    period_month INT NOT NULL,
    income_type VARCHAR(50) NOT NULL,
    reason VARCHAR(255),                    -- Alasan blacklist
    created_at DATETIME DEFAULT GETDATE()
);

-- Index untuk performa
CREATE INDEX IX_blacklist_nik_period
ON employee_other_incomes_blacklist(nik, period_year, period_month);
```

---

## 3. Service Architecture

### 3.1 OtherIncomesService

**Lokasi**: `backend/src/services/otherIncomesService.ts`

**Metode Utama**:

```typescript
// Hitung THR untuk semua karyawan di divisi/gang tertentu
static async calculateTHRData(
    year: number, 
    month: number, 
    divisionCode?: string, 
    gangCode?: string
): Promise<OtherIncome[]>

// Simpan THR ke database
static async calculateAndSaveTHR(
    year: number, 
    month: number, 
    divisionCode?: string, 
    gangCode?: string
): Promise<{ success: boolean; count: number; summary: any }>

// Ambil data THR dengan filter
static async getIncomes(
    year: number, 
    month: number, 
    divisionCode?: string, 
    gangCode?: string
): Promise<OtherIncome[]>

// Hapus THR dan tambahkan ke blacklist
static async deleteOtherIncome(
    id: number, 
    reason: string = 'User deleted'
): Promise<boolean>
```

### 3.2 TaxCalculationService

**Lokasi**: `backend/src/services/tax/TaxCalculationService.ts`

**Mapping Beras Rate ke PTKP**:

```typescript
private static readonly BERAS_RATE_TO_PTKP: Record<number, PTKPStatus> = {
    2250: 'TK/0',   // Lajang tanpa tanggungan
    3250: 'TK/1',   // 1 tanggungan
    4200: 'TK/2',   // 2 tanggungan
    3700: 'K/0',    // Menikah tanpa tanggungan
    4650: 'K/1',    // 1 tanggungan
    5500: 'K/2',    // 2 tanggungan
    6450: 'K/3',    // 3 tanggungan
};
```

**Mapping PTKP ke TER Category**:

```typescript
public mapPTKPToTER(ptkpStatus: string): TERCategory {
    if (!ptkpStatus || ptkpStatus === '-') return '-';
    if (['TK/0', 'TK/1', 'K/0'].includes(ptkpStatus)) return 'TER A';
    if (ptkpStatus === 'K/3') return 'TER C';
    return 'TER B'; // TK/2, K/1, K/2
}
```

**Tax Rates (TER 2026)**:

```typescript
private static readonly TER_RATES: Record<TERCategory, number> = {
    'TER A': 0.05,   // 5%
    'TER B': 0.15,   // 15%
    'TER C': 0.25,   // 25%
    '-': 0,          // No tax
};
```

---

## 4. Korelasi Other Income dengan Perhitungan Pajak

### 4.1 Alur Perhitungan Pajak dengan THR

```
┌─────────────────────────────────────────────────────────────────┐
│            ALUR PERHITUNGAN PAJAK DENGAN THR                     │
└─────────────────────────────────────────────────────────────────┘

1. Tentukan Periode THR
   └─ loadActiveThrPeriode() → { year: 2026, month: 3 }

2. Kumpulkan Data Karyawan
   ├─ HR_EMPLOYEE: nik, nama, agama, join_date
   ├─ HR_PAYROLL: PayRate, RiceRation
   └─ HR_HISTORY: masa_kerja_jumlah

3. Hitung THR (jika bulan = THR month)
   ├─ Formula: (UPAH × 30) + (BERAS × 30) + MASA_KERJA
   ├─ Proporsional jika masa_kerja_tahun < 1
   └─ Simpan ke employee_other_incomes

4. Perhitungan Pajak Bulanan (TER Method)
   ├─ Gross Income = Upah Kotor + Other Taxable Incomes
   ├─ PTKP Status dari Beras Rate
   ├─ TER Category dari PTKP Status
   └─ PPh21 = Gross Income × TER Rate

5. Perhitungan Pajak Tahunan (Form 1721)
   ├─ Total Penghasilan Setahun = (Gaji × 12) + THR + Bonus
   ├─ PTKP Annual (dari status)
   ├─ PKP = Total - PTKP - Biaya Jabatan
   └─ PPh21 Terutang = Progressive Rate × PKP
```

### 4.2 Integrasi di TaxReportService

**Lokasi**: `backend/src/services/taxReportService.ts`

**Kode Penting**:

```typescript
// Line 484-550: Load THR untuk bulan aktif
const activeThr = loadActiveThrPeriode();
const isThrMonth = activeThr && activeThr.month === month && activeThr.year === year;

if (isThrMonth) {
    // Load THR dari database
    const otherIncomes = await OtherIncomesService.getIncomes(year, month);
    
    otherIncomes.forEach(inc => {
        const nik = String(inc.nik || '').trim().toUpperCase();
        if (inc.is_taxable) {
            // Tambahkan ke taxable income
            dbTaxableIncomesMap.set(nik, (dbTaxableIncomesMap.get(nik) || 0) + Number(inc.amount));
        }
    });
}

// Line 1113-1167: Perhitungan Total Penghasilan Setahun
let thr = 0;
let exgratia = 0;

// 1. Dynamic THR Calculation (Fallback)
if (activeThr) {
    // Get factors from the specific THR month (March for 2026)
    let thrFactors = emp.monthly_thr_factors[String(activeThr.month)];
    
    if (thrFactors && thrFactors.masa_kerja_tahun >= 1) {
        thr = (thrFactors.upah_dasar * 30) + 
              (thrFactors.beras_rate * 30) + 
              thrFactors.masa_kerja_jumlah;
    }
}

// 2. Database Overrides
if (dbIncomeByNik.has(rawEmpNik)) {
    const dbData = dbIncomeByNik.get(rawEmpNik)!;
    if (dbData.thr > 0) thr = dbData.thr;
    if (dbData.exgratia > 0) exgratia = dbData.exgratia;
}

// 3. Total penghasilan setahun
const totalPenghasilanSetahun = 
    gajiJanNov +           // Gaji Jan-Nov
    masaKerjaJanNov +      // Masa kerja Jan-Nov
    bpjsKes4pct +          // BPJS 4%
    astek084pct +          // ASTEK 0.84%
    thr +                  // THR (Maret)
    exgratia +             // Bonus
    customIncomeYear;      // Custom income lainnya
```

### 4.3 Perhitungan Gross Income untuk Pajak

**Di DataExtractorService** (Line 743-774):

```typescript
// Pendapatan tidak tetap yang taxable (THR, Bonus, dll)
const pendapatan_tidak_tetap_taxable = dbTaxableIncomesMap.get(rawEmpNik) || 0;

// [NEW] Upah Kotor Pajak = Jumlah Upah Kotor + Other Taxable Incomes
const upahKotorPajak = 
    jumlahUpahKotor +          // Upah kotor reguler
    astek +                    // ASTEK (0.84%)
    bpjsKesehatanMajikan +     // BPJS Kesehatan Majikan (4%)
    pendapatan_tidak_tetap_taxable; // THR, Bonus, dll

// Gross income untuk perhitungan pajak
const grossIncomeForTax = upahKotorPajak;
```

### 4.4 Perhitungan PPh21 TER

**Di Pph21TerService**:

```typescript
public calculatePph21Ter(grossIncome: number, ptkpStatus: string): Pph21TerResult {
    // 1. Map PTKP ke TER Category
    const terCategory = this.mapPTKPToTER(ptkpStatus);
    
    // 2. Get TER Rate
    const ratePercent = this.getTerRate(terCategory, grossIncome);
    const rateDecimal = ratePercent / 100;
    
    // 3. Calculate Tax
    const taxAmount = Math.round(grossIncome * rateDecimal);
    
    return {
        gross_income: grossIncome,    // Termasuk THR jika ada
        ptkp_status: ptkpStatus,
        ter_category: terCategory,
        tax_rate: ratePercent,
        tax_amount: taxAmount
    };
}
```

---

## 5. Perubahan untuk Tahun 2026

### 5.1 THR Periode Change

**Sebelumnya (2025)**:
```json
{
    "year": 2025,
    "month": 2,
    "type": "THR",
    "name": "THR 2025",
    "description": "Tunjangan Hari Raya Tahun 2025",
    "is_active": true
}
```

**Sekarang (2026)**:
```typescript
// Hardcoded di taxReportService.ts line 179-186
function loadActiveThrPeriode(): ThrPeriode | null {
    return {
        year: 2026,
        month: 3,  // ← PERUBAHAN: Dari bulan 2 ke bulan 3
        type: 'THR',
        name: 'THR 2026',
        description: 'Fixed THR Period (March)',
        is_active: true
    };
}
```

### 5.2 Dampak Perubahan

**Bulan Februari (Month 2)**:
- ❌ TIDAK ada THR
- Perhitungan pajak normal (tanpa THR)

**Bulan Maret (Month 3)**:
- ✅ ADA THR
- Perhitungan pajak **include THR** dalam gross income
- THR ditambahkan ke `upah_kotor_pajak`

**Bulan Lainnya**:
- Perhitungan pajak normal (tanpa THR)
- THR hanya mempengaruhi pajak tahunan (Form 1721)

### 5.3 Implementasi di Code

```typescript
// Di TaxReportService - Line 484-491
const activeThr = loadActiveThrPeriode();
const isThrMonth = activeThr && 
                   activeThr.month === month &&    // ← Cek bulan = 3
                   activeThr.year === year;

if (isThrMonth) {
    // Load THR dari database
    const otherIncomes = await OtherIncomesService.getIncomes(year, month);
    // ... proses THR
}

// Di TaxReportService - Line 1586-1587
// Simpan THR factors untuk bulan Maret saja
if (activeThr && month === activeThr.month) {
    emp.monthly_thr_factors[String(month)] = {
        upah_dasar: det.upah_dasar,
        beras_rate: det.beras_rate,
        masa_kerja_jumlah: det.masa_kerja,
        masa_kerja_tahun: emp.masa_kerja_tahun
    };
}
```

---

## 6. Menambahkan Other Income Baru (Selain THR)

### 6.1 Custom Income Type

Untuk menambahkan jenis other income baru (misalnya "Bonus Tahunan"):

**Step 1: Tambahkan Formula**

```typescript
// Di employee_other_incomes_formulas
INSERT INTO employee_other_incomes_formulas (
    income_type, 
    formula_string, 
    is_paid_in_thp, 
    is_taxable
)
VALUES (
    'BONUS_TAHUNAN',
    '(UPAH_DASAR * 60) + (PRESTASI_KERJA * 0.5)',
    0,  // Tidak dibayar di THP
    1   // Taxable
);
```

**Step 2: Buat Service Method**

```typescript
// Di otherIncomesService.ts
static async calculateBonusTahunan(
    year: number, 
    month: number, 
    divisionCode?: string
): Promise<OtherIncome[]> {
    const formula = await this.getFormula('BONUS_TAHUNAN');
    
    // Ambil data karyawan
    const employees = await getEmployees(divisionCode);
    
    const results: OtherIncome[] = [];
    for (const emp of employees) {
        // Hitung bonus berdasarkan formula
        const amount = evaluateFormula(formula.formula, {
            UPAH_DASAR: emp.pay_rate,
            PRESTASI_KERJA: emp.prestasi_score
        });
        
        results.push({
            nik: emp.nik,
            emp_name: emp.name,
            period_year: year,
            period_month: month,
            income_type: 'BONUS_TAHUNAN',
            income_name: 'Bonus Tahunan 2026',
            amount: amount,
            is_paid_in_thp: formula.is_paid_in_thp,
            is_taxable: formula.is_taxable,
            details: {
                upah_dasar: emp.pay_rate,
                prestasi_kerja: emp.prestasi_score
            }
        });
    }
    
    return results;
}
```

**Step 3: Integrasikan dengan Tax Calculation**

```typescript
// Di TaxReportService
const otherIncomes = await OtherIncomesService.getIncomes(year, month);

otherIncomes.forEach(inc => {
    if (inc.is_taxable) {
        // Tambahkan ke taxable income
        taxableIncomesMap.set(
            inc.nik, 
            (taxableIncomesMap.get(inc.nik) || 0) + inc.amount
        );
    }
});
```

### 6.2 Menambahkan THR di Bulan Lain (Jika Diperlukan)

Jika ingin menambahkan THR di bulan lain (misalnya THR Ke-2 di bulan 11):

**Option A: Update THR Periode JSON**

```json
[
    {
        "year": 2026,
        "month": 3,
        "type": "THR",
        "name": "THR 2026 - Idul Fitri",
        "is_active": true
    },
    {
        "year": 2026,
        "month": 11,
        "type": "THR2",
        "name": "THR 2026 - Natal",
        "is_active": true
    }
]
```

**Option B: Hardcode Multiple Periods**

```typescript
function loadActiveThrPeriodes(): ThrPeriode[] {
    return [
        {
            year: 2026,
            month: 3,
            type: 'THR',
            name: 'THR 2026 - Idul Fitri',
            is_active: true
        },
        {
            year: 2026,
            month: 11,
            type: 'THR2',
            name: 'THR 2026 - Natal',
            is_active: true
        }
    ];
}
```

---

## 7. Testing dan Validasi

### 7.1 Test Script untuk THR 2026

```typescript
// backend/src/scripts/check_thr_data.ts
async function checkThrData() {
    const db = Database.getExtendedInstance();
    
    // Cek THR untuk bulan 3 (Maret) 2026
    const rows = await db.query(`
        SELECT TOP 100 
            nik, 
            emp_name, 
            period_year, 
            period_month, 
            income_type, 
            amount, 
            income_name, 
            details_json
        FROM employee_other_incomes
        WHERE income_type = 'THR' 
          AND period_year = 2026 
          AND period_month = 3  -- ← Maret, bukan Februari
        ORDER BY emp_name
    `);
    
    console.log(`Found ${rows.length} THR records for March 2026`);
    
    rows.forEach(r => {
        let details = null;
        if (r.details_json) {
            try {
                details = JSON.parse(r.details_json);
            } catch { }
        }
        
        console.log(`
            NIK: ${r.nik}
            Name: ${r.emp_name}
            Amount: ${r.amount}
            Details: ${JSON.stringify(details)}
        `);
    });
}
```

### 7.2 Validasi Perhitungan Pajak

```typescript
// Test calculation dengan THR
const testEmployee = {
    nik: 'E0001',
    upah_dasar: 75000,
    beras_rate: 4650,  // K/1
    masa_kerja: 150000,
    masa_kerja_tahun: 5
};

// Hitung THR (Maret 2026)
const thrAmount = (75000 * 30) + (4650 * 30) + 150000;
// = 2,250,000 + 139,500 + 150,000
// = 2,539,500

// Hitung Gross Income untuk Maret
const grossIncomeMaret = 
    (75000 * 26) +        // Gaji pokok (26 HK)
    150000 +              // Masa kerja
    2539500;              // THR

// PTKP Status: K/1 (beras_rate = 4650)
// TER Category: TER B (K/1)
// Tax Rate: 15%

const taxMaret = grossIncomeMaret * 0.15;
```

---

## 8. Troubleshooting

### Issue 1: THR Tidak Muncul di Perhitungan Pajak

**Symptom**: Pajak karyawan tidak termasuk THR meskipun sudah ada di database.

**Solution**:
1. Cek `period_month` di database = 3 (Maret)
2. Cek `is_taxable` = 1 (true)
3. Verifikasi `loadActiveThrPeriode()` return month = 3
4. Cek log di TaxReportService line 484-550

### Issue 2: THR Muncul di Bulan yang Salah

**Symptom**: THR muncul di bulan Februari (month 2) padahal seharusnya Maret (month 3).

**Solution**:
1. Update `loadActiveThrPeriode()` di taxReportService.ts:
   ```typescript
   return {
       year: 2026,
       month: 3,  // ← Pastikan month = 3
       // ...
   };
   ```
2. Re-calculate THR:
   ```typescript
   await OtherIncomesService.calculateAndSaveTHR(2026, 3, divisionCode);
   ```
3. Delete data lama:
   ```sql
   DELETE FROM employee_other_incomes 
   WHERE period_year = 2026 AND period_month = 2 AND income_type = 'THR';
   ```

### Issue 3: Pajak Terlalu Besar Setelah THR

**Symptom**: PPh21 melonjak drastis di bulan THR.

**Cause**: THR ditambahkan ke gross income, sehingga kena pajak lebih besar.

**Solution**:
- Ini adalah **perilaku yang benar** sesuai peraturan pajak
- THR adalah penghasilan taxable
- Alternatif: Gunakan `is_taxable = 0` jika ingin THR tidak kena pajak (tidak direkomendasikan)

---

## 9. Referensi

### 9.1 File Terkait

| File | Deskripsi |
|------|-----------|
| `backend/src/services/otherIncomesService.ts` | Service untuk THR & other income |
| `backend/src/services/tax/TaxCalculationService.ts` | Perhitungan PTKP & TER |
| `backend/src/services/taxReportService.ts` | Integrasi THR dengan pajak |
| `backend/src/services/dataExtractorService.ts` | Extract data untuk payroll |
| `backend/src/services/pph21TerService.ts` | Perhitungan PPh21 TER |
| `backend/data/thr_periode.json` | Konfigurasi periode THR |

### 9.2 Database Tables

| Table | Deskripsi |
|-------|-----------|
| `employee_other_incomes` | Data THR/Bonus/Custom income |
| `employee_other_incomes_formulas` | Formula untuk setiap income type |
| `employee_other_incomes_blacklist` | Blacklist untuk exclude karyawan |
| `HR_PAYROLL` | PayRate, RiceRation |
| `HR_HISTORY` | Masa kerja karyawan |

### 9.3 Dokumentasi Terkait

- 📄 [`04_OTHER_INCOMES_SERVICE.md`](./dokumentasi/daftar_upah_services/04_OTHER_INCOMES_SERVICE.md) - Detail OtherIncomesService
- 📄 [`10_CALCULATION_FORMULAS.md`](./dokumentasi/daftar_upah_services/10_CALCULATION_FORMULAS.md) - Formula perhitungan
- 📄 [`01_PAYROLL_SERVICE.md`](./dokumentasi/daftar_upah_services/01_PAYROLL_SERVICE.md) - Payroll calculation integration

---

## 10. FAQ

### Q: Kenapa THR hanya di bulan Maret untuk 2026?

**A**: Sesuai kebijakan perusahaan, THR 2026 diberikan pada bulan Maret (menjelang hari raya). Ini dapat diubah di `loadActiveThrPeriode()`.

### Q: Apakah THR kena pajak?

**A**: **Ya**, THR adalah penghasilan taxable dan ditambahkan ke gross income untuk perhitungan PPh21.

### Q: Bagaimana jika karyawan resign sebelum bulan THR?

**A**: Karyawan yang resign tidak akan masuk dalam perhitungan THR (filter berdasarkan status aktif).

### Q: Bisakah THR diberikan di beberapa bulan?

**A**: **Ya**, dengan menambahkan multiple entries di `loadActiveThrPeriode()` atau menggunakan multiple income types (THR, THR2, dll).

### Q: Apa bedanya `is_paid_in_thp` dan `is_taxable`?

**A**:
- `is_paid_in_thp`: Apakah income dibayarkan bersama THP (Take Home Pay)
- `is_taxable`: Apakah income dikenakan pajak PPh21

---

**Dibuat**: Maret 2026  
**Versi**: 1.0  
**Author**: Plantware Auto Report Team  
**Last Updated**: 2026-03-24
