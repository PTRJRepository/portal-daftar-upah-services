# Backend Service: Bun/Node.js API

Backend ini bertindak sebagai otak utama dari sistem yang mengelola data dari database SQL Server (Plantware/Extend) dan menyajikannya dalam format yang siap digunakan oleh Frontend.

## Teknologi Utama
- **Framework**: ElysiaJS (dengan Bun) / Express-like API.
- **Language**: TypeScript.
- **Runtime**: Bun (juga mendukung Node.js).
- **Database Connection**: Melalui MSSQL (pyodbc/tedious).

## Struktur Folder Kunci (`backend/src`)

### 1. `/api` (Router/Endpoint)
Berisi definisi endpoint API:
- `payroll.ts`: Endpoint `/report/division-raw-tree` yang mengirimkan data besar untuk laporan.
- `auth.ts`: Menangani login dan JWT Token.
- `summary.ts`: Endpoint untuk data ringkasan.

### 2. `/services` (Business Logic)
Ini adalah bagian terpenting dari sistem:
- **`dataExtractorService.ts`**: Mengambil data absensi, premi, potongan, dan lembur secara paralel menggunakan `Promise.all`.
- **`pph21TerService.ts`**: Menghitung pajak berdasarkan aturan TER pemerintah.
- **`gajiPokokService.ts`**: Menghitung gaji berdasarkan Hari Kerja (HK).
- **`lemburCalculator.ts`**: Logika rumit untuk mengubah jam lembur menjadi nilai rupiah.

### 3. `/db` (Database Connection)
Mengelola pool koneksi ke database SQL Server. Ada profil koneksi (Local vs Production) yang diatur di `config.ts`.

---

## Mekanisme Kerja Utama: "Data Extractor"

Setiap kali ada request laporan, sistem menjalankan langkah-langkah berikut:
1. **Filtering**: Karyawan dengan HK = 0 diabaikan (Active Employee Only).
2. **Parallel Fetching**: Mengambil data Premi (dari DocDesc), Potongan (dari TaskDesc), dan Lembur secara bersamaan.
3. **Merging**: Menggabungkan semua data tersebut ke dalam satu objek besar per karyawan (`PayrollRow`).
4. **Tax Calculation**: Mengirimkan bruto gaji ke `Pph21TerService` untuk mendapatkan nilai pajak resmi.
5. **JSON Response**: Mengirimkan data dalam bentuk "Tree" (Kelompok per Geng) ke Frontend.
