# Simulasi Pajak PPh 21

Aplikasi web untuk mensimulasikan perhitungan pajak PPh 21 karyawan, mencakup perhitungan bulanan menggunakan metode TER (Tarif Efektif Rata-rata) berdasarkan PP 58 Tahun 2023, perhitungan tahunan untuk bulan Desember, dan akumulasi iuran ASTEK (JHT, JP, JKK, JKM, BPJS Kesehatan).

## Fitur

### 1. Perhitungan Pajak Bulanan (TER)
- Menggunakan metode TER sesuai PP 58 Tahun 2023
- Tiga kategori TER: A, B, dan C berdasarkan status PTKP
- Perhitungan otomatis untuk Januari - November
- Tabel tarif progresif dengan 40+ lapisan penghasilan

### 2. Perhitungan Pajak Tahunan (Desember)
- Perhitungan ulang akhir tahun dengan tarif progresif
- Penghitungan PKP (Penghasilan Kena Pajak)
- Perhitungan PPh 21 terutang setahun
- Penyesuaian pajak untuk bulan Desember (kurang/lebih bayar)

### 3. Akumulasi ASTEK
- Perhitungan iuran JHT (Jaminan Hari Tua)
- Perhitungan iuran JP (Jaminan Pensiun)
- Perhitungan premi JKK (Jaminan Kecelakaan Kerja)
- Perhitungan premi JKM (Jaminan Kematian)
- Perhitungan iuran BPJS Kesehatan
- Rincian per bulan dan total setahun

### 4. Manajemen Data Karyawan
- Tambah, edit, hapus data karyawan
- Simpan data ke localStorage
- Export data ke format JSON
- Load sample data untuk testing

## Struktur File

```
simulasi pajak/
├── index.html          # Halaman utama aplikasi
├── styles.css          # Styling dan layout
├── taxEngine.js        # Engine perhitungan pajak
├── app.js              # Logic aplikasi utama
├── README.md           # Dokumentasi ini
└── data/               # Data sampel (opsional)
    ├── data_pajak_per_bulan.json
    ├── data_pajak_bulan_des.json
    └── akumulasi_asek_pensiunan_per_bulan.json
```

## Cara Penggunaan

### 1. Buka Aplikasi
Buka file `index.html` di browser web modern (Chrome, Firefox, Edge, Safari).

### 2. Input Data Karyawan
1. Klik tab "Data Karyawan"
2. Isi informasi karyawan:
   - Nama lengkap (wajib)
   - NIK/Paspor
   - NPWP
   - Status PTKP (wajib) - menentukan kategori TER
   - Jabatan
   - Alamat
   - Masa kerja
   - Tahun pajak

### 3. Input Penghasilan Bulanan
1. Klik tab "Penghasilan Bulanan"
2. Masukkan penghasilan bruto untuk setiap bulan (Januari - Desember)
3. Masukkan iuran ASTEK/BPJS per bulan (opsional)
4. Masukkan penghasilan tidak teratur:
   - THR (Tunjangan Hari Raya)
   - Bonus
   - Tantiem
5. Klik "Hitung & Simpan"

### 4. Lihat Perhitungan Pajak Bulanan (TER)
- Klik tab "Pajak Bulanan (TER)"
- Lihat rincian pajak untuk Januari - November
- Lihat total pajak yang sudah dibayar
- Lihat estimasi pajak untuk Desember

### 5. Lihat Perhitungan Tahunan
- Klik tab "Perhitungan Tahunan"
- Lihat ringkasan penghasilan bruto setahun
- Lihat pengurang (biaya jabatan, iuran JHT/JP)
- Lihat penghasilan netto dan PKP
- Lihat perhitungan pajak dengan tarif progresif
- Lihat penyesuaian pajak Desember

### 6. Lihat Akumulasi ASTEK
- Klik tab "Akumulasi ASTEK"
- Lihat rincian iuran per bulan
- Lihat total iuran JHT, JP, JKK, JKM, Kesehatan
- Lihat total iuran setahun

## Kategori TER

| Kategori | Status PTKP |
|----------|-------------|
| TER A | TK/0, TK/1, K/0 |
| TER B | TK/2, TK/3, K/1, K/2 |
| TER C | K/3 |

## PTKP (Penghasilan Tidak Kena Pajak)

| Status | PTKP Tahunan |
|--------|--------------|
| TK/0 | Rp 54.000.000 |
| TK/1 | Rp 58.500.000 |
| TK/2 | Rp 63.000.000 |
| TK/3 | Rp 67.500.000 |
| K/0 | Rp 58.500.000 |
| K/1 | Rp 63.000.000 |
| K/2 | Rp 67.500.000 |
| K/3 | Rp 72.000.000 |

## Tarif Pajak Progressif Tahunan

| Lapisan PKP | Tarif |
|-------------|-------|
| s.d. Rp 60.000.000 | 5% |
| Rp 60.000.000 - Rp 250.000.000 | 15% |
| Rp 250.000.000 - Rp 500.000.000 | 25% |
| Rp 500.000.000 - Rp 5.000.000.000 | 30% |
| Di atas Rp 5.000.000.000 | 35% |

## Iuran ASTEK

| Jenis | Karyawan | Perusahaan |
|-------|----------|------------|
| JHT (Jaminan Hari Tua) | 2% | 3.7% |
| JP (Jaminan Pensiun) | 1% | 2% |
| JKK (Jaminan Kecelakaan Kerja) | - | 0.24% - 1.74% |
| JKM (Jaminan Kematian) | - | 0.3% |
| BPJS Kesehatan | 1% | 4% |

## Rumus Perhitungan

### Pajak Bulanan (TER)
```
PPh 21 = Penghasilan Bruto × Tarif TER
```

### Pajak Tahunan
```
Penghasilan Bruto Setahun = Total Gaji + THR + Bonus + Premi Asuransi
Biaya Jabatan = 5% × Penghasilan Bruto (maks Rp 6.000.000)
Iuran JHT/JP = 3% × Total Gaji (2% JHT + 1% JP)
Penghasilan Netto = Penghasilan Bruto - Biaya Jabatan - Iuran JHT/JP
PKP = Penghasilan Netto - PTKP
PPh 21 Setahun = PKP × Tarif Progressif
PPh 21 Desember = PPh 21 Setahun - PPh 21 Jan-Nov
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Edge 80+
- Safari 13+

## Data Storage

Data disimpan di browser menggunakan localStorage. Data akan tetap ada meskipun browser ditutup, kecuali cache/cookies dihapus.

## Export Data

Klik tombol "Export JSON" untuk menyimpan data karyawan dalam format JSON yang dapat diimport kembali atau diproses lebih lanjut.

## Sample Data

Klik "Load Sample Data" untuk memuat data contoh 4 karyawan dengan berbagai status PTKP dan penghasilan.

## Referensi

- PP 58 Tahun 2023 tentang Tarif Efektif Rata-rata
- UU PPh No. 36 Tahun 2008
- Peraturan BPJS Ketenagakerjaan
- Peraturan BPJS Kesehatan

## Pengembang

Aplikasi ini dikembangkan untuk keperluan simulasi dan edukasi perhitungan pajak PPh 21.

## Lisensi

Free to use for internal company purposes.