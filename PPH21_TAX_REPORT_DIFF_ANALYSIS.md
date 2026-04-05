# Analisis Perbedaan PPh21: Report Pajak vs Daftar Upah

**Tanggal:** 2026-04-05  
**Issue:** PPh21 di Report Pajak berbeda ~Rp 4.6 juta dari Daftar Upah untuk AB2 H!H  
**Status:** 🔍 ANALISIS ROOT CAUSE

---

## 🎯 Masalah

Grand Total PPh21 di **Report Pajak** menunjukkan nilai yang berbeda (lebih besar ~Rp 4.637.898) dibandingkan dengan PPh21 di **Daftar Upah** untuk gang AB2 H!H.

---

## 🔍 Root Cause Analysis

### Perbedaan Sumber Data

| Aspek | Daftar Upah | Report Pajak |
|-------|-------------|--------------|
| **Sumber Data** | Live dari `dataExtractorService` (PR_TASKREGLN + PR_ADTRANS) | History database (jika ada) ATAU fallback ke `dataExtractorService` |
| **PPh21** | Dihitung ulang saat extract | Dihitung ulang dari history data ATAU recalculate |
| **Pendapatan Lainnya** | Sudah termasuk dalam `jumlah_upah_kotor` | Perlu lookup tambahan dari database/JSON |

### Penyebab Utama Perbedaan

#### 1. **Sumber PTKP Status yang Berbeda**

**Daftar Upah:**
```typescript
// dataExtractorService.ts line 3856
const statusPTKP = emp.status_ptkp 
    || dbPtkpMap.get(emp.emp_code?.toUpperCase()) 
    || mapBerasRateToPTKP(emp.beras_rate || 0);
```

**Report Pajak:**
```typescript
// taxReportService.ts line 495
const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
const ptkpMap = new Map<string, string>();
for (const p of ptkpMaster) {
    ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
}

// line 544
const masterPtkp = ptkpMap.get(empCodeTrimmed) 
    || row.status_ptkp 
    || 'TK/0';
```

**Masalah:** Report pajak mengambil PTKP dari **master table PTKP** yang mungkin berbeda dari yang digunakan saat payroll calculation.

#### 2. **Perbedaan Sumber `pendapatan_lainnya` (THR, Bonus, Custom)**

**Daftar Upah (CURRENT data):**
- `pendapatan_lainnya` sudah termasuk dalam `jumlah_upah_kotor` 
- Sudah dihitung di `penghasilan_bruto`

**Report Pajak (HISTORY data):**
```typescript
// taxReportService.ts line 644
const rowPendapatanLainnyaValue = row.total_pendapatan_lainnya || row.pendapatan_lainnya || 0;

// line 651-656 - FALLBACK jika history tidak punya pendapatan_lainnya
if (rowPendapatanLainnyaValue === 0 && computedPendapatanLainnya > 0) {
    penghasilanBruto += computedPendapatanLainnya;
    rowPendapatanLainnya = computedPendapatanLainnya;
}
```

**Masalah:** Jika data history tidak menyimpan `pendapatan_lainnya`, maka report pajak akan **menghitung ulang** menggunakan formula THR yang mungkin berbeda dengan yang sebenarnya dibayarkan.

#### 3. **THR Formula yang Mungkin Tidak Akurat**

```typescript
// taxReportService.ts line 585-590
if (isThrMonth) {
    const masaKerjaTahun = row.masa_kerja_tahun || 0;
    if (masaKerjaTahun >= 1) {
        const upahDasar = row.upah_dasar || 0;
        const berasRate = row.beras_rate || 0;
        thrAmount = (upahDasar * 30) + (berasRate * 30) + tunjanganMasaKerja;
    }
}
```

**Masalah:** Formula THR ini adalah **fallback** jika tidak ada data THR di database. THR yang sebenarnya mungkin berbeda karena:
- Ada penyesuaian manual
- Ada aturan khusus (min/max)
- Masa kerja dihitung berbeda

#### 4. **Data Source: History vs Current**

```typescript
// taxReportService.ts line 418-440
const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
    month, year, gangCode, divisionCode
);

if (!historyData || historyData.data_rows.length === 0) {
    // FALLBACK ke origin data
    const originData = await DataExtractorService.getInstance().extractPayrollData(...);
    return { data: originData, isSourceCurrent };
}
```

**Masalah:** Jika data sudah di-seed ke history database, maka report pajak akan menggunakan data history yang mungkin:
- Tidak lengkap (missing `pendapatan_lainnya`)
- Sudah usang (tidak di-update setelah ada perubahan)
- Berbeda PPh21 yang tersimpan di database

---

## 📊 Cara Verifikasi

### 1. Check Data Source (History vs Current)

Buka browser console atau backend log, cari:
```
[TaxReportService] Fetching data for (3/2026) - trying HISTORY first.
```

Jika muncul:
- `No history data... falling back to ORIGIN` = Menggunakan live data (seharusnya sama)
- TIDAK muncul = Menggunakan history data (potensi perbedaan)

### 2. Check PPh21 Diff di Backend Log

Backend sudah logging otomatis untuk 5 employee pertama:
```
[TAX_REPORT_DEBUG] [0] AB2H!H001: TaxReport_pph21=1234567, row_pph21_ter=1230000, diff=4567, bruto=8500000, PTKP=K/1, TER=TER B, rate=15%
```

### 3. Run Debug Script

```bash
cd backend
bun run ../debug_pph21_difference.ts
```

Script ini akan:
- Fetch data dari Daftar Upah
- Fetch data dari Report Pajak
- Bandingkan setiap employee
- Tampilkan perbedaan dan komponen yang menyebabkan perbedaan

---

## ✅ Solusi

### Solusi Cepat: Regenerate History Data

Jika perbedaan karena history data yang tidak akurat:

```bash
# Re-seed history data dengan data terbaru
curl -X POST "http://localhost:8002/api/aggregation/seed?year=2026&month=3"
```

### Solusi Medium: Update PTKP Mapping

Pastikan PTKP di master table sama dengan yang digunakan saat payroll:

```sql
-- Check PTKP di master table
SELECT emp_code, ptkp_status FROM PTKP WHERE year = 2026 AND emp_code LIKE '%AB2%'

-- Compare dengan yang di payroll data
SELECT emp_code, status_ptkp FROM payroll_history_detail WHERE period_month = 3 AND period_year = 2026
```

### Solusi Long Term: Gunakan Sumber Data yang Sama

**Recommendation:** Report Pajak seharusnya **TIDAK** menghitung ulang PPh21, tapi menggunakan nilai PPh21 yang sudah dihitung saat payroll calculation.

```typescript
// taxReportService.ts - SEHARUSNYA begini:
const pph21_ter = row.pph21_ter || 0; // Gunakan yang sudah dihitung

// JANGAN recalculate kecuali untuk debugging
// const pphResult = pph21TerService.calculatePph21Ter(...)
```

**ATAU** jika harus recalculate, pastikan:
1. ✅ Menggunakan PTKP yang sama (bukan dari master table berbeda)
2. ✅ Menggunakan `pendapatan_lainnya` yang sama (bukan recalculate THR)
3. ✅ Menggunakan penghasilan bruto yang sama (sudah termasuk semua komponen)

---

## 🔧 Testing Checklist

- [ ] Check apakah menggunakan history data atau current data
- [ ] Verify PTKP status sama antara kedua report
- [ ] Verify `pendapatan_lainnya` sama (THR, Bonus, Custom)
- [ ] Verify `penghasilan_bruto` calculation sama
- [ ] Compare PPh21 per employee, bukan hanya grand total
- [ ] Test untuk gang lain (apakah hanya AB2 H!H atau semua berbeda)
- [ ] Test untuk bulan lain (apakah hanya Maret/THR atau semua bulan)

---

## 📝 Files Terkait

| File | Purpose |
|------|---------|
| `backend/src/services/taxReportService.ts` | Main tax report calculation |
| `backend/src/services/dataExtractorService.ts` | Daftar Upah data extraction |
| `backend/src/services/pph21TerService.ts` | PPh21 TER calculation engine |
| `backend/src/services/historyDatabaseService.ts` | History data storage |
| `backend/src/services/ptkpTaxService.ts` | PTKP master data |
| `frontend/src/pages/TaxReportPage.jsx` | Tax report UI |
| `frontend/src/pages/PayrollReportPage.jsx` | Daftar Upah UI |

---

## 🎯 Next Steps

1. **Run debug script** untuk identify employee mana yang berbeda
2. **Check backend logs** untuk lihat diff details
3. **Verify data source** (history vs current)
4. **Compare PTKP** antara kedua report
5. **Compare pendapatan_lainnya** (THR/Bonus/Custom)
6. **Fix root cause** berdasarkan temuan

---

## 💡 Catatan Penting

**Kenapa Report Pajak Recalculate PPh21?**

Alasan awalnya adalah untuk **memastikan akurasi** dan **debugging**. Tapi ini jadi masalah jika:
- Data source berbeda (history vs current)
- Parameter calculation berbeda (PTKP, pendapatan_lainnya)
- Formula berbeda (THR fallback tidak akurat)

**Idealnya:**
- Report Pajak hanya **menampilkan** data yang sudah dihitung saat payroll
- Jika perlu recalculate, gunakan **parameter yang sama persis**
- Log warning jika ada perbedaan > threshold (sudah ada, tapi perlu diaktifkan)

---

## 🔗 Dokumentasi Terkait

- `TAX_REPORT_PPH21_FIX.md` - Fix sebelumnya untuk pendapatan_lainnya
- `dokumentasi/KALKULATOR_PPH21_TER.md` - Detail perhitungan PPh21
- `asknowledge/02_THR_2026_IMPLEMENTATION_CHECKLIST.md` - THR 2026 changes
