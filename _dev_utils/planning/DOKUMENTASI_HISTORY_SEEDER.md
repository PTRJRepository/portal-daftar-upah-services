# Dokumentasi History Seeder & Archiving (Aggregation)

## Konteks & Latar Belakang
Database operasional utama sistem (`db_ptrj`) didesain untuk **hanya menyimpan data transaksi dan aktivitas pada periode berjalan (Current Period).** 
Artinya, ketika tutup buku (Cut-Off) bulan dilakukan, data di daftar upah, absensi harian, dan mutasi karyawan akan berubah sesuai bulan baru, menyebabkan data bulan lalu hilang dari akses "Live".

Untuk mengatasi ini, sistem memiliki mekanisme **History Seeder** (biasa diakses melalui menu *Aggregation Seeder*). Mekanisme ini mengambil data "Live" sebelum tutup buku dan memindahkannya ke database penyimpanan riwayat permanen bernama `extend_db_ptrj`. Karena ini, sangat penting untuk menjalankan proses *Save to History* secara rutin setiap kali gaji bulan berjalan siap ditutup.

---

## Data yang Direkam (History Data Coverage)

Saat Anda memilih menu **Save to History** di modul Aggregation Seeder, berikut adalah rincian fungsional dan tabel yang menangkap data historikal secara akurat:

### 1. Data Payroll (Operasional)
Ini adalah menu default "Payroll & Transactions (Master/Detail)".
Merekam semua rekap upah dan hitungan HK akhir bulan.
- **Master Payroll (`payroll_history_master`)**: Merekam metadata level Gang per bulan per divisi (informasi status locked/unlocked).
- **Detail Payroll (`payroll_history_detail`)**: Merekam detail "Daftar Upah" final tiap *Head/Karyawan*.
  - Meliputi: Hari Kerja (HK), Nilai Upah Dasar, **Semua Header Dinamis** (Semua variasi Premi, Semua variasi Potongan Upah Kotor, dan Semua variasi Potongan Upah Bersih), Total Upah Kotor, dan Upah Bersih.
  - *Intinya: Apa saja kolom header yang ada di layar Daftar Upah saat ini, semuanya direkam dan dibekukan nilainya secara komprehensif ke dalam data historikal.*
- **Transaksi Absen Harian (`history_taskreg`)**: Merekam rincian tugas apa saja yang dilakukan karyawan (BSS, Rawat, Panen) harian, lengkap dengan jumlah HK dan Jam Lembur.
- **Dokumen Denda/Transaksi Khusus (`history_adtrans`)**: Merekam dokumen ADTrans / Advance (Potongan kas, premi khusus, dll).

### 2. Data Karyawan (HR Employee)
Bisa dipilih secara eksplisit via mode *Data Karyawan (HR Employee)*.
Karena data karyawan di sistem HR (*Position, Status Pajak, Gaji Pokok*) bisa berubah kapan saja karena mutasi atau promosi, sistem mengambil *"Snapshot / Foto"* data pegawai tersebut tepat di bulan yang bersangkutan. 
**PENTING: Pendekatan pencarian dan tautan data (linking) riwayat pegawai SEPENUHNYA menggunakan NIK (Nomor Induk Kependudukan / IC NO), BUKAN Employee Code (EmpCode).** Hal ini menjamin keakuratan sejarah data pegawai meskipun karyawan mengalami promosi/mutasi yang menyebabkan perubahan kode pegawai di masanya.
- **Tabel Tujuan**: `history_hr_employee`
- **Data Tersimpan**: NIK (IC NO), Employee Code, Nama Lengkap, Jabatan (Position / JobCode), Divisi Aktif, Gang Aktif, Status (BHL/SKU), PTKP Beras, PTKP Pajak, Nilai Dasar Gaji Pokok bulan tersebut.

### 3. Data Kemandoran (HR Gang)
Bisa dipilih secara eksplisit via mode *Data Kemandoran (HR Gang)*.
Sama halnya dengan struktur organisasi gang yang bisa berubah Mandor/Asisten-nya, formasi ini ditebalkan ke histori.
- **Tabel Tujuan**: `history_hr_gang`
- **Data Tersimpan**: Kode Gang, Deskripsi, Nama Mandor Utama, Nama Mandor 1, Nama Asisten, Jumlah Total Anggota BHL di bulan tersebut, dan status Aktif/Tidak.

---

## Panduan Penggunaan yang Disarankan
1. Pastikan Anda melihat panel **"Info Database Aktif"** di menu Dashboard. Jika periode aktif adalah berjalan (misal: November 2026), hasil yang akan ditarik oleh menu *Live Operational* adalah murni data mentah bulan November.
2. Saat tutup payroll bulan berjalan disahkan, buka menu **Aggregation Seeder**, pilih Divisi, dan klik **Save to History** dengan mode **Semua Data (Payroll + HR)** untuk memastikan kompilasi rekapan gajihan beserta snapshot jabatan karyawan tercopy dengan presisi.
3. Setelah periode ditutup, gunakan "Summary Report Per Gang" atau "Laporan Analisis" pada bulan-bulan *History* untuk memastikan angka yang dihasilkan konsisten tanpa takut data HR.
