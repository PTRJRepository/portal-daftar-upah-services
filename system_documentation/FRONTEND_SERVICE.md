# Frontend Service: React + Vite + AG Grid

Frontend ini adalah antarmuka utama yang digunakan oleh Admin dan HR untuk melihat laporan payroll secara visual.

## Teknologi Utama
- **Framework**: React.js.
- **Build Tool**: Vite.
- **Table Library**: AG Grid Enterprise (untuk performa tinggi menampilkan ribuan baris data).
- **Styling**: Vanilla CSS.
- **State Management**: React Hooks.

## Struktur Folder Kunci (`frontend/src`)

### 1. `/pages`
- `PayrollAnalysisPage.jsx`: Halaman utama untuk analisis gaji dan integrasi dengan API.
- `Dashboard.jsx`: Menampilkan ringkasan data dari Agregasi Upah.

### 2. `/components`
- `CustomPayrollTable.jsx`: Komponen tabel yang sangat kompleks untuk menampilkan kolom gaji yang dinamis.
- `LegacyPayrollGrid.jsx`: Grid versi lama yang masih didukung untuk kompatibilitas.

### 3. `/services`
- `api.js`: Konfigurasi `axios` untuk memanggil API Backend.

---

## Fitur Unggulan

### 1. Dinamis Kolom (Dynamic Columns)
Tabel ini tidak memiliki kolom yang kaku. Kolom Premi dan Potongan muncul secara otomatis berdasarkan data yang ada di database. Jika bulan ini ada premi "Brondol", maka kolom tersebut akan muncul secara otomatis.

### 2. Grouping & Aggregation
Menggunakan fitur AG Grid untuk melakukan pengelompokan (Grouping) berdasarkan **Geng/Kelompok Kerja**. Admin bisa melihat total biaya per geng hanya dengan satu klik.

### 3. Ekspor Data
Mendukung ekspor data ke format HTML, CSV, atau Excel untuk keperluan laporan cetak atau pengarsipan manual.
