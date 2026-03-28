# Asknowledge - Pendapatan Upah Lainnya & Pajak

## 📚 Knowledge Base Index

Folder ini berisi dokumentasi lengkap tentang penanganan **pendapatan upah lainnya** (THR, Bonus, Custom Income) dan korelasinya dengan **perhitungan pajak (PPh 21)** dalam sistem Plantware Auto Report.

---

## 📖 Daftar Dokumen

### 1. **01_PENDAPATAN_UPAH_LAINNYA_DAN_PAJAK.md**
**Judul**: Pendapatan Upah Lainnya dan Korelasi dengan Perhitungan Pajak  
**Isi**:
- ✅ Ringkasan eksekutif
- ✅ Jenis pendapatan lainnya (THR, Bonus, Custom)
- ✅ Struktur database
- ✅ Service architecture
- ✅ Korelasi dengan perhitungan pajak
- ✅ Perubahan untuk tahun 2026 (THR di bulan 3)
- ✅ Cara menambahkan other income baru
- ✅ Testing dan validasi
- ✅ Troubleshooting
- ✅ FAQ

**Gunakan dokumen ini untuk**: Pemahaman konsep dan arsitektur sistem

---

### 2. **02_THR_2026_IMPLEMENTATION_CHECKLIST.md**
**Judul**: Implementation Guide: THR 2026 (Bulan 3)  
**Isi**:
- ✅ Ringkasan perubahan (Month 2 → Month 3)
- ✅ Checklist implementasi step-by-step
- ✅ Testing checklist
- ✅ Code references (file & line numbers)
- ✅ API endpoints reference
- ✅ Verification queries
- ✅ Common issues & solutions
- ✅ Migration from 2025 to 2026

**Gunakan dokumen ini untuk**: Implementasi dan testing THR 2026

---

### 3. **03_FLOW_DIAGRAM_OTHER_INCOME.md**
**Judul**: Flow Diagram: Other Income dan Perhitungan Pajak  
**Isi**:
- ✅ System architecture overview
- ✅ Alur perhitungan THR (diagram)
- ✅ Alur perhitungan pajak dengan THR (diagram)
- ✅ Alur perhitungan pajak tahunan (Form 1721)
- ✅ Timeline THR dan pajak 2026
- ✅ Data flow diagram
- ✅ Comparison: With vs Without THR

**Gunakan dokumen ini untuk**: Memahami alur dan visualisasi proses

---

## 🎯 Quick Start

### Untuk Developer Baru

1. **Baca**: `01_PENDAPATAN_UPAH_LAINNYA_DAN_PAJAK.md` (Bab 1-4)
2. **Lihat**: `03_FLOW_DIAGRAM_OTHER_INCOME.md` (Visualisasi)
3. **Praktek**: `02_THR_2026_IMPLEMENTATION_CHECKLIST.md`

### Untuk Implementasi THR 2026

1. **Baca**: `02_THR_2026_IMPLEMENTATION_CHECKLIST.md` (Semua bab)
2. **Verifikasi**: Code di `taxReportService.ts` line 179-186
3. **Test**: Gunakan testing checklist
4. **Validasi**: Gunakan verification queries

### Untuk Troubleshooting

1. **Cek**: `01_PENDAPATAN_UPAH_LAINNYA_DAN_PAJAK.md` (Bab 8)
2. **Cek**: `02_THR_2026_IMPLEMENTATION_CHECKLIST.md` (Common Issues)
3. **Debug**: Gunakan test scripts yang disediakan

---

## 🔑 Key Concepts

### THR 2026: Bulan 3 (Maret)

```
⚠️ PENTING: Untuk tahun 2026, THR diberikan pada bulan Maret (bulan 3),
            BUKAN bulan Februari (bulan 2) seperti tahun 2025.
```

**Konfigurasi**:
```typescript
// backend/src/services/taxReportService.ts
function loadActiveThrPeriode(): ThrPeriode | null {
    return {
        year: 2026,
        month: 3,  // ← PERUBAHAN: Dari 2 ke 3
        type: 'THR',
        name: 'THR 2026',
        is_active: true
    };
}
```

### THR adalah Taxable Income

```
✅ THR ditambahkan ke gross income untuk perhitungan pajak
✅ THR mempengaruhi PPh21 bulanan (TER method)
✅ THR mempengaruhi pajak tahunan (Form 1721)
```

**Formula**:
```
THR = (UPAH_DASAR × 30) + (BERAS_RATE × 30) + MASA_KERJA_JUMLAH

Gross Income (March) = Regular Income + THR

PPh21 = Gross Income × TER Rate
```

### PTKP → TER Mapping

```
Beras Rate → PTKP Status → TER Category → Tax Rate

4650 → K/1 → TER B → 15%
6450 → K/3 → TER C → 25%
2250 → TK/0 → TER A → 5%
```

---

## 📁 File Structure

```
asknowledge/
├── README.md                              # Index ini
├── 01_PENDAPATAN_UPAH_LAINNYA_DAN_PAJAK.md
├── 02_THR_2026_IMPLEMENTATION_CHECKLIST.md
└── 03_FLOW_DIAGRAM_OTHER_INCOME.md
```

---

## 🔗 Related Documentation

### Internal Project Docs

- 📄 [`backend/src/services/otherIncomesService.ts`](../backend/src/services/otherIncomesService.ts)
- 📄 [`backend/src/services/tax/TaxCalculationService.ts`](../backend/src/services/tax/TaxCalculationService.ts)
- 📄 [`backend/src/services/taxReportService.ts`](../backend/src/services/taxReportService.ts)
- 📄 [`dokumentasi/daftar_upah_services/04_OTHER_INCOMES_SERVICE.md`](../dokumentasi/daftar_upah_services/04_OTHER_INCOMES_SERVICE.md)

### External References

- Peraturan Dirjen Pajak tentang TER (Tarif Efektif Rata-rata)
- UU PPh tentang Penghasilan Kena Pajak
- Peraturan pemerintah tentang THR keagamaan

---

## 🧪 Testing

### Quick Test Commands

```bash
# 1. Calculate and save THR for March 2026
curl -X POST http://localhost:3000/api/other-incomes/calculate-and-save \
  -H "Content-Type: application/json" \
  -d '{"year":2026,"month":3,"divisionCode":"ALL"}'

# 2. Get THR data
curl http://localhost:3000/api/other-incomes?year=2026&month=3&type=THR

# 3. Get tax report for March (include THR)
curl http://localhost:3000/api/tax-report/1721?year=2026&month=3

# 4. Get annual tax report (Form 1721)
curl http://localhost:3000/api/tax-report/annual?year=2026
```

### SQL Verification

```sql
-- Check THR data for March 2026
SELECT 
    period_year, 
    period_month, 
    income_type, 
    COUNT(*) as count,
    SUM(amount) as total
FROM employee_other_incomes
WHERE period_year = 2026 AND period_month = 3 AND income_type = 'THR'
GROUP BY period_year, period_month, income_type;

-- Check THR per employee
SELECT TOP 10
    nik,
    emp_name,
    amount,
    details_json
FROM employee_other_incomes
WHERE period_year = 2026 AND period_month = 3 AND income_type = 'THR'
ORDER BY amount DESC;
```

---

## 📊 Summary Statistics

| Concept | Value |
|---------|-------|
| THR Period 2026 | Month 3 (March) |
| THR Formula | `(UPAH×30) + (BERAS×30) + MASA_KERJA` |
| THR Tax Status | Taxable (is_taxable = 1) |
| TER Categories | 3 (TER A: 5%, TER B: 15%, TER C: 25%) |
| PTKP Statuses | 8 (TK/0-3, K/0-3) |
| Database Tables | 3 (other_incomes, formulas, blacklist) |

---

## 🆘 Support

### Untuk Pertanyaan

1. **Cek FAQ**: `01_PENDAPATAN_UPAH_LAINNYA_DAN_PAJAK.md` (Bab 10)
2. **Cek Troubleshooting**: `01_PENDAPATAN_UPAH_LAINNYA_DAN_PAJAK.md` (Bab 8)
3. **Cek Common Issues**: `02_THR_2026_IMPLEMENTATION_CHECKLIST.md`

### Untuk Update Dokumentasi

1. Edit file markdown yang sesuai
2. Update version number dan tanggal
3. Commit dengan pesan yang jelas
4. Update index ini jika menambahkan file baru

---

## 📝 Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-03-24 | Initial documentation for THR 2026 |

---

## ✅ Checklist: Memahami Dokumentasi

Setelah membaca dokumentasi ini, Anda seharusnya bisa:

- [ ] Menjelaskan apa itu THR dan bagaimana perhitungannya
- [ ] Menjelaskan korelasi THR dengan perhitungan pajak
- [ ] Menjelaskan mengapa THR 2026 di bulan Maret (bukan Februari)
- [ ] Menjalankan script untuk calculate dan save THR
- [ ] Memverifikasi data THR di database
- [ ] Memverifikasi perhitungan pajak include THR
- [ ] Menambahkan other income type baru (jika diperlukan)
- [ ] Troubleshooting common issues

---

**Last Updated**: 2026-03-24  
**Version**: 1.0  
**Maintained by**: Plantware Auto Report Team
