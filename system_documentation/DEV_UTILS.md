# Development Utilities (_dev_utils)

Folder ini adalah "Gudang Alat" (Workshop) bagi para pengembang. Sesuai mandat `GEMINI.md`, semua file yang tidak berhubungan langsung dengan jalannya aplikasi di server produksi harus ditempatkan di sini.

## Lokasi: `_dev_utils/`

## Struktur Folder Kunci

### 1. `scripts/` (Alat Bantu)
Berisi script otomatisasi satu-kali-jalan (one-off scripts):
- **Diagnostic Tools**: Script untuk mengecek koneksi database, skema tabel, atau validasi data gaji.
- **Extractors**: Script untuk mengambil header pajak atau data NPWP karyawan.
- **Seeding Helpers**: Script pembantu untuk mengisi data awal ke database.

### 2. `planning/` (Dokumentasi Perancangan)
Tempat menyimpan rencana implementasi fitur baru (Implementation Plans).
- **Contoh**: `slip-gaji-implementation-plan.md`, `cost-hk-report-plan.md`.
- **Fungsi**: Memastikan setiap perubahan besar dipikirkan matang-matang sebelum mulai menulis kode.

### 3. `prompts/` (Instruksi AI)
Kumpulan instruksi (prompts) yang digunakan untuk membimbing asisten AI dalam bekerja di project ini.
- `Aturan_Payroll.txt`: Berisi rumus dan logika bisnis payroll agar AI tidak salah hitung.
- `struktur.txt`: Gambaran singkat struktur kode untuk asisten AI.

### 4. `tests/` (Uji Coba)
Folder tempat pengembang menulis unit test atau script percobaan (Exploration) sebelum kode tersebut dimasukkan ke folder `backend/` atau `frontend/`.

---

## Aturan Penggunaan (Mandat `GEMINI.md`)
- **No Pollution**: Jangan pernah membuat file sampah seperti `temp.py` atau `test123.js` di folder root atau folder backend. Semua harus di `_dev_utils/`.
- **Test First**: Sebelum fitur baru masuk ke backend, buatlah script percobaannya di `_dev_utils/tests/` dan pastikan berhasil.

---

## Kenapa Folder Ini Ada?
Untuk menjaga agar folder utama (`backend/`, `frontend/`, dll) tetap bersih, ringan, dan hanya berisi kode yang benar-benar dibutuhkan oleh sistem saat berjalan (Production Ready).
