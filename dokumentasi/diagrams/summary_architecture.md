# Ringkasan Arsitektur Sistem dan Proses Rendering AG Grid

## Gambaran Keseluruhan

Sistem Report Plantware Daftar Upah adalah aplikasi full-stack yang terdiri dari backend berbasis FastAPI dan frontend berbasis React dengan AG Grid sebagai komponen utama untuk menampilkan data dalam bentuk tabel interaktif.

## Alur Kerja Lengkap

### 1. Inisialisasi Aplikasi
- Backend (FastAPI) menyediakan API endpoints
- Frontend (React) menginisialisasi komponen dan layanan

### 2. Pengambilan Data
- Frontend meminta daftar gang dari backend
- Backend mengakses database melalui repositories
- Data gang dikembalikan ke frontend

### 3. Penentuan Parameter Laporan
- Pengguna memilih gang dan bulan yang ingin ditampilkan
- Frontend mengirim parameter ke backend

### 4. Pembuatan Header Dinamis
- Backend menggunakan HeaderService untuk membuat header berdasarkan data aktual
- Header dinamis disesuaikan dengan struktur data yang akan ditampilkan

### 5. Pengambilan Data Karyawan dan Perhitungan Gaji
- Backend menggunakan PayrollService untuk mengambil dan menghitung data gaji
- Data dikumpulkan dari berbagai tabel di database

### 6. Pengembalian Data ke Frontend
- Backend mengembalikan data dalam format yang siap digunakan AG Grid
- Termasuk definisi kolom, data baris, dan konfigurasi tambahan

### 7. Konfigurasi AG Grid
- Frontend mengkonfigurasi AG Grid dengan data yang diterima
- Kolom-kolom dibuat sesuai dengan header dinamis
- Fitur-fitur AG Grid diaktifkan (sorting, filtering, dll.)

-### 8. Rendering dan Tampilan Akhir
- AG Grid merender data dalam mode hierarkis dengan header bertingkat
- Kolom NO dan NAMA difreeze di posisi kiri
- Tabel ditampilkan dengan semua fitur interaktif

## Teknologi yang Digunakan

### Backend
- **FastAPI**: Framework web untuk membuat API
- **Pydantic**: Validasi data
- **SQL Server**: Database utama
- **MSSQL Service**: Koneksi dan query database

### Frontend
- **React**: Framework untuk UI
- **AG Grid**: Komponen tabel canggih
- **Axios**: HTTP client
- **Vite**: Build tool

### Fitur Spesifik AG Grid
- **Frozen Columns**: Kolom NO dan NAMA tetap di posisi kiri saat scroll
- **Column Headers**: Dinamis berbentuk hierarki bertingkat dengan hubungan parent-child yang jelas
- **Rendering Mode**: Hanya mode hierarkis, tidak ada mode flat
- **Virtual Scrolling**: Performa tinggi untuk data besar
- **Filtering & Sorting**: Interaktif per kolom
- **Responsive**: Tampilan adaptif di berbagai ukuran layar

## Optimasi yang Telah Dilakukan
- Implementasi header dinamis berdasarkan data nyata
- Penyesuaian frozen columns untuk pengalaman pengguna yang lebih baik
- Penggunaan threading dan parallel processing untuk perhitungan data
- Query optimasi untuk efisiensi database
- Modularisasi kode untuk maintainability
