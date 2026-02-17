# Business Rules - Payroll Daftar Upah

## Overview

Dokumen ini menjelaskan aturan bisnis yang diterapkan dalam sistem Payroll Daftar Upah. Memahami aturan ini sangat penting untuk memastikan kalkulasi payroll yang akurat.

---

## 1. Employee Filtering Rules

### Aturan Utama

**KRITIS:** Filter karyawan berdasarkan aturan berikut:

```typescript
// Effective Work HK = HK - (Minggu + Libur Nasional)
const effective_work_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);

// Cuti lain (tahunan, sakit/haid)
const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

// FILTER LOGIC:
if (effective_work_hk <= 0 && other_cuti == 0) {
    // FILTERED OUT - Tidak ditampilkan
} else {
    // KEPT - Ditampilkan
}
```

### Penjelasan

| Kondisi | Hasil |
|---------|-------|
| HK = 0, hanya Minggu + Libur Nasional | **TIDAK ditampilkan** |
| HK = 0, tapi ada cuti tahunan/sakit | **DITAMPILKAN** |
| HK > 0 | **Selalu DITAMPILKAN** |

### Contoh

| Karyawan | HK | Minggu | Nasional | Tahunan | Sakit | Result |
|----------|----|----|----------|---------|-------|--------|
| A | 25 | 4 | 1 | 0 | 0 | DITAMPILKAN (HK > 0) |
| B | 5 | 4 | 1 | 0 | 0 | DITAMPILKAN (effective_hk = 0, other_cuti = 0) |
| C | 5 | 4 | 1 | 2 | 0 | DITAMPILKAN (other_cuti > 0) |
| D | 0 | 0 | 0 | 0 | 0 | TIDAK ditampilkan |

---

## 2. Lembur (Overtime) Rules

### Klasifikasi Tipe Hari

| Tipe Hari | Deskripsi | Tier 1 | Tier 2 | Tier 3 | Tier 1 Boundary |
|-----------|-----------|--------|--------|--------|-----------------|
| `WORKDAY_LONG` | Senin-Kamis, Sabtu | 1.5x | 2x | - | 1 jam |
| `WORKDAY_SHORT` | Jumat | 1.5x | 2x | - | 1 jam |
| `SUNDAY` | Minggu | 2x | 3x | 4x | 5/7 jam |
| `HOLIDAY_REGULAR` | Libur Umum | 2x | 3x | 4x | 5/7 jam |
| `HOLIDAY_RELIGIOUS` | Libur Keagamaan | 3x | 4x | 4x | 5/7 jam |

### Kalkulasi UPJ (Upah Per Jam)

```
UPJ = (pay_rate × 30) / 173
```

atau menggunakan nilai default dari environment variable `LEMBUR_UPJ` (default: 17257)

### Contoh Kalkulasi

**Skenario:** Karyawan dengan pay_rate 1.500.000, lembur 3 jam di hari kerja biasa

```
UPJ = (1.500.000 × 30) / 173 = 260.116

Jam 1: 260.116 × 1.5 = 390.174
Jam 2-3: 260.116 × 2 × 2 = 1.040.464

Total Lembur = 1.430.638
```

### Data Source

- **Tabel:** `PR_TASKREGLN`
- **Filter:** `OT = 1` (hanya transaksi lembur murni)
- **Archive:** `PR_TASKREGLN_ARC` untuk data lama

---

## 3. PPH21 Tax Rules

### PTKP Status Mapping

PTKP (Penghasilan Tidak Kena Pajak) ditentukan dari `RiceRation` (beras_rate) di tabel `HR_PAYROLL`:

| RiceRation | PTKP Status | TER Category | Rate |
|------------|-------------|--------------|------|
| 2250 | TK/0 | TER A | 5% |
| 3250 | TK/1 | TER A | 5% |
| 4200 | TK/2 | TER B | 15% |
| 3750 | K/0 | TER A | 5% |
| 4650 | K/1 | TER B | 15% |
| 5550 | K/2 | TER B | 15% |
| 6450 | K/3 | TER C | 25% |

### Kalkulasi PPH21

```
Penghasilan Bruto = Gaji Pokok + Tunjangan + Premi + Lembur
PPh21 = Penghasilan Bruto × TER Rate
```

### Contoh

| Karyawan | PTKP | TER Rate | Bruto | PPh21 |
|----------|------|----------|-------|-------|
| A | TK/0 | 5% | 5.000.000 | 250.000 |
| B | K/1 | 15% | 6.000.000 | 900.000 |
| C | K/3 | 25% | 8.000.000 | 2.000.000 |

---

## 4. Premi (Premium) Rules

### Static Premi Columns

| Premi | Source | Pattern Match |
|-------|--------|---------------|
| `premi_brondol` | PR_ADTRANS | DocDesc LIKE '%BRONDOL%' |
| `premi_pruning` | PR_ADTRANS | DocDesc LIKE '%PRUN%' |

### Dynamic Premi Filtering

Item **DI-EXCLUDE** dari dynamic premi jika DocDesc mengandung:

| Pattern | Alasan |
|---------|--------|
| `PPH`, `PPH21`, `PPH 21` | Termasuk potongan pajak |
| `LEMBUR` | Sudah dihitung terpisah |
| `PRUN`, `PRUNING` | Diaggregasi ke premi_pruning |
| `KOREKSI`, `KOREKSI PANEN`, `POTONGAN KOREKSI` | Termasuk koreksi |
| `SPSI` | Simpanan pinjaman |
| `TUNJANGAN JABATAN`, `TUNJANGAN MASA KERJA` | Termasuk tunjangan |
| `TUNJANGAN BERAS` | Termasuk tunjangan |
| `BRONDOL` | Diaggregasi ke premi_brondol |

### Contoh Dynamic Premi

Jika di database ada:
- PREMI_PANEN = 100.000
- PREMI_AKUR = 50.000
- PREMI_PPH = 25.000 (excluded)

Maka dynamic premi columns:
- `PREMI_PANEN`: 100.000
- `PREMI_AKUR`: 50.000

---

## 5. Potongan (Deduction) Rules

### Static Potongan Columns

| Potongan | Source | Calculation |
|----------|--------|-------------|
| `pot_astek` | Calculated | BPJS TK Pekerja |
| `pot_bpjs_kesehatan` | Calculated | BPJS Kesehatan Pekerja |
| `pot_spsi` | PR_ADTRANS | DocDesc LIKE '%SPSI%' |
| `pot_pph21` | Calculated | TER Calculation |

### BPJS Calculation

```typescript
// BPJS Kesehatan Pekerja = 1% dari Upah
const bpjs_kesehatan = upah × 0.01;

// BPJS TK Pekerja = 2% dari Upah
const bpjs_tk = upah × 0.02;
```

### Dynamic Potongan Filtering

Item **DI-EXCLUDE** dari dynamic potongan jika DocDesc:

| Pattern | Alasan |
|---------|--------|
| Starts with `POT%` | Sudah termasuk prefix POT |
| `SPSI` | Sudah di static column |
| `BERAS` | Termasuk tunjangan |
| `JABATAN` | Termasuk tunjangan |
| `MASA` | Termasuk tunjangan |
| `LEMBUR` | Termasuk tunjangan |
| `PPH%` | Sudah dihitung terpisah |

---

## 6. Tunjangan (Allowance) Rules

### Tunjangan Types

| Tunjangan | Source | Calculation |
|-----------|--------|--------------|
| `beras_jumlah` | PR_ADTRANS | DocDesc LIKE '%BERAS%' |
| `jabatan_jumlah` | PR_ADTRANS | DocDesc LIKE '%JABATAN%' |
| `masa_kerja_jumlah` | PR_ADTRANS | DocDesc LIKE '%MASA KERJA%' |

### Masa Kerja Calculation

```typescript
// Masa kerja dalam tahun
const masa_kerja_tahun = Math.floor(
    (currentDate - joinDate) / (365.25 * 24 * 60 * 60 * 1000)
);

// Tunjangan masa kerja
const tunjangan_masa_kerja = masa_kerja_tahun > 0 
    ? calculateMasaKerjaAmount(masa_kerja_tahun) 
    : 0;
```

---

## 7. Gaji Pokok Calculation

### Formula

```typescript
gaji_pokok = pay_rate × jumlah_hk;

// Gaji pokok ideal (jika HK penuh)
gaji_pokok_ideal = pay_rate × 30;

// Gaji pokok aktual
gaji_pokok_aktual = gaji_pokok;
```

### Pay Rate Source

- **Tabel:** `HR_PAYROLL`
- **Column:** `PayRate`

---

## 8. Upah Bersih Calculation

### Formula

```typescript
// Upah Kotor
upah_kotor = gaji_pokok 
           + total_tunjangan 
           + total_premi 
           + lembur_jumlah 
           - potongan_upah_kotor;

// Upah Bersih
upah_bersih = upah_kotor 
            - total_potongan_bersih;
```

### Komponen

| Komponen | Rumus |
|----------|-------|
| `total_tunjangan` | beras + jabatan + masa_kerja |
| `total_premi` | brondol + pruning + dynamic_premi |
| `potongan_upah_kotor` | koreksi |
| `total_potongan_bersih` | BPJS + SPSI + PPH21 + dynamic_potongan |

---

## 9. Attendance (HK) Rules

### HK Calculation

```typescript
// HK dari transaksi kerja
jumlah_hk = COUNT(DISTINCT TrxDate) 
            FROM PR_TASKREGLN 
            WHERE OT = 0;

// Hari kerja efektif
hari_kerja = jumlah_hk - cuti_minggu - cuti_nasional;
```

### Cuti Types

| Cuti | Source | Pattern |
|------|--------|---------|
| `cuti_tahunan` | PR_ADTRANS | DocDesc LIKE '%TAHUNAN%' |
| `cuti_sakit_haid` | PR_ADTRANS | DocDesc LIKE '%SAKIT%' OR '%HAID%' |
| `cuti_minggu` | Calculated | COUNT Minggu dalam periode |
| `cuti_nasional` | PR_ADTRANS | DocDesc LIKE '%NASIONAL%' |

---

## 10. Validation Rules

### Required Fields

| Field | Validation |
|-------|------------|
| `nik` | Tidak boleh kosong |
| `nama` | Tidak boleh kosong |
| `gang_code` | Tidak boleh kosong |
| `jumlah_hk` | Harus >= 0 |
| `upah_bersih` | Harus >= 0 |

### Range Validation

| Field | Min | Max |
|-------|-----|-----|
| `month` | 1 | 12 |
| `year` | 2020 | current_year + 1 |
| `jumlah_hk` | 0 | 31 |

---

## 11. Division Access Rules

### Role-Based Access

| Role | Akses Divisi |
|------|--------------|
| `ADMIN` | Semua divisi |
| `USER` | Divisi yang ditugaskan |
| `VIEWER` | Read-only, semua divisi |

### Implementation

```typescript
// Check division access
if (currentUser.role !== UserRole.ADMIN) {
    if (!currentUser.divisions.includes(division)) {
        throw new Error('Division not accessible');
    }
}
```

---

## 12. Period Rules

### Current Period

```typescript
// Get current payroll period
const currentPeriod = await currentPeriodService.getCurrentPeriod();
// Returns: { month: 12, year: 2025 }
```

### Period Validation

```typescript
// Validate period
if (month < 1 || month > 12) {
    throw new Error('Invalid month');
}
if (year < 2020 || year > currentYear + 1) {
    throw new Error('Invalid year');
}
```

---

## 13. Special Cases

### Karyawan Baru

- Jika `join_date` di bulan berjalan: HK dihitung dari tanggal masuk
- Tunjangan prorated berdasarkan hari kerja

### Karyawan Resign

- Jika `resign_date` di bulan berjalan: HK dihitung sampai tanggal resign
- Potongan tetap dihitung penuh

### Karyawan Cuti Melahirkan

- HK = 0
- Tetap ditampilkan (other_cuti > 0)
- Tunjangan tetap dibayar

---

## 14. Audit Trail

### Data yang Di-log

- User yang melakukan perubahan
- Timestamp perubahan
- Nilai sebelum dan sesudah
- Alasan perubahan (jika ada)

### Implementation

```typescript
// Log perubahan
await auditService.log({
    user: currentUser.username,
    action: 'UPDATE',
    table: 'payroll_data',
    oldValue: previousValue,
    newValue: newValue,
    timestamp: new Date()
});
```

---

## 15. Error Handling Rules

### Business Errors

| Error Code | Message | Solution |
|------------|---------|----------|
| `INVALID_PERIOD` | Periode tidak valid | Pilih bulan 1-12, tahun yang valid |
| `DIVISION_NOT_ACCESSIBLE` | Tidak ada akses ke divisi | Hubungi admin untuk akses |
| `NO_DATA_FOUND` | Data tidak ditemukan | Periksa filter dan periode |
| `CALCULATION_ERROR` | Kesalahan kalkulasi | Periksa data karyawan |

---

**Selanjutnya:** Baca [10_TROUBLESHOOTING.md](./10_TROUBLESHOOTING.md) untuk memahami masalah umum dan solusinya.