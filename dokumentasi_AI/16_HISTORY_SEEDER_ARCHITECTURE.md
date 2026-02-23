# Arsitektur History Seeder & Penggajian Historis (ICNO/NIK Based)

Dokumen ini menjelaskan secara komprehensif bagaimana arsitektur **Payroll History** bekerja dalam sistem. Fitur ini dirancang untuk menyelesaikan masalah di mana perubahan master data karyawan (seperti perpindahan divisi/mutasi yang merubah `EmpCode` karyawan) dapat menghilangkan atau memutus jejak komputasi gaji di bulan-bulan sebelumnya.

Sistem historis ini menyelesaikan masalah tersebut dengan menciptakan **Snapshot Database** (di `extend_db_ptrj`) yang dilacak menggunakan `NIK` / `NewICNo` secara permanen, bukan `EmpCode`. 

---

## 1. Konsep Dasar

1. **Snapshot Data**: Saat _Daftar Upah_ dijalankan, semua nominal tunjangan, potongan, lembur, dan absensi dihitung secara *live* berdasarkan pengaturan master di hari tersebut. Sistem History bekerja dengan menyimpan "foto" / "snapshot" hasil kalkulasi final tersebut ke tabel terpisah (`payroll_history_header` dan `payroll_history_detail`).
2. **Kunci Permanen (NIK)**: Dalam sistem operasional, seorang karyawan mungkin berganti `EmpCode` setiap tahun jika ia dimutasi (misal dari pemeliharaan ke panen). Di tabel sejarah (History), data tersebut diikat dan dikueri kembali menggunakan **NIK** (KTP). NIK bersifat seumur hidup dan tidak berubah, sehingga saat Anda mengueri Riwayat Karyawan (meskipun ia sudah berganti 3 EmpCode), seluruh gajinya di masa lalu dapat diagregasikan dengan tepat.
3. **Pencegahan Duplikasi**: Apabila *seeder* (proses penyimpanan historis) dijalankan berulang kali untuk periode dan divisi yang sama (misalnya `01/2026 Divisi A0150`), sistem tidak akan menciptakan baris ganda. Sistem akan **menghapus (_delete_)** data historis lama pada periode+divisi terkait, lalu **menciptakan ulang (_insert_)** snapshot yang terbaru. 

---

## 2. Struktur Tabel & Relasi Database Historis (`extend_db_ptrj`)

Histori tidak disimpan di database Plantware asli, melainkan di database ekstensi (`extend_db_ptrj`) untuk menjaga keamanan sistem transaksi utama. Terdapat konsep **Header-Detail (Parent-Child)**:

### Diagram Relasi Entitas (ERD)

```
┌──────────────────────────────────────────────┐
│         payroll_history_header                │
│  (PARENT / MASTER)                           │
│  Database: extend_db_ptrj                    │
├──────────────────────────────────────────────┤
│  id              INT (PK, AUTO_INCREMENT)    │ ◄── Kunci Utama
│  period_month    INT                         │ ◄── BULAN (1-12)
│  period_year     INT                         │ ◄── TAHUN (2025, 2026, ...)
│  division_code   VARCHAR                     │
│  gang_code       VARCHAR                     │
│  total_employees INT                         │
│  total_upah_bersih   DECIMAL                 │
│  total_potongan      DECIMAL                 │
│  dynamic_premi_data      TEXT (JSON array)   │
│  dynamic_potongan_data   TEXT (JSON array)   │
│  seeded_at       DATETIME                    │
│  is_locked       BIT                         │
└──────────────┬───────────────────────────────┘
               │
               │  1 : N (Satu Header → Banyak Detail)
               │  Foreign Key: master_id
               ▼
┌──────────────────────────────────────────────┐
│         payroll_history_detail                │
│  (CHILD / DETAIL)                            │
│  Database: extend_db_ptrj                    │
├──────────────────────────────────────────────┤
│  id              INT (PK, AUTO_INCREMENT)    │
│  master_id       INT (FK → header.id)        │ ◄── RELASI KE HEADER
│  nik             VARCHAR                     │ ◄── NIK Permanen (KTP)
│  emp_code        VARCHAR                     │ ◄── EmpCode saat itu
│  emp_name        VARCHAR                     │
│  gender          VARCHAR                     │
│  gang_code       VARCHAR                     │
│  division_code   VARCHAR                     │
│  gaji_pokok      DECIMAL                     │
│  upah_bersih     DECIMAL                     │
│  total_potongan  DECIMAL                     │
│  total_tunjangan DECIMAL                     │
│  ... (80+ kolom komputasi lainnya)           │
│  premi_detail    TEXT (JSON)                 │ ◄── Premi dinamis
│  potongan_detail TEXT (JSON)                 │ ◄── Potongan dinamis
└──────────────────────────────────────────────┘
```

### Bagaimana Mengetahui Periode dari Baris Detail?

**Tabel `payroll_history_detail` TIDAK memiliki kolom `period_month` atau `period_year`.**  
Informasi periode tersimpan **hanya di tabel `payroll_history_header`**.

Untuk mengetahui dari periode mana sebuah transaksi detail berasal, Anda **HARUS melakukan JOIN** melalui `master_id`:

```sql
-- Contoh: Mencari semua detail karyawan beserta periodenya
SELECT 
    h.period_month,
    h.period_year,
    h.division_code,
    h.gang_code,
    d.nik,
    d.emp_name,
    d.gaji_pokok,
    d.upah_bersih,
    d.total_potongan
FROM dbo.payroll_history_detail d
INNER JOIN dbo.payroll_history_header h ON d.master_id = h.id
WHERE h.period_month = 1 AND h.period_year = 2026;

-- Contoh: Mencari riwayat gaji seorang karyawan berdasarkan NIK
SELECT 
    h.period_month,
    h.period_year,
    d.emp_code,
    d.gaji_pokok,
    d.upah_bersih
FROM dbo.payroll_history_detail d
INNER JOIN dbo.payroll_history_header h ON d.master_id = h.id
WHERE d.nik = '3201XXXXXXXXXX'
ORDER BY h.period_year DESC, h.period_month DESC;
```

### Mengapa Periode Tidak Disimpan di Detail?

| Pendekatan | Pro | Kontra |
|---|---|---|
| **Periode di Header saja** (arsitektur saat ini) | Hemat ruang, normalisasi tinggi, satu sumber kebenaran | Membutuhkan JOIN untuk query |
| Periode di kedua tabel | Query lebih simpel | Data redundan, risiko inkonsistensi |

Kami memilih **normalisasi** karena:
- **1 Header** bisa memiliki **500+ Detail** → menyimpan bulan/tahun 500x adalah pemborosan.
- Jika ingin "lock" (kunci) satu periode, cukup ubah 1 baris di Header → semua 500 Detail otomatis terlindungi.

### Alur Penyimpanan Transaksi (Seeding Flow)

```
Frontend: Klik "Seed History" untuk Januari 2026, Divisi PG1A
                    │
                    ▼
Backend: POST /payroll/history/seed
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
1. Hitung live   2. Hapus data   3. Simpan baru
   payroll dari     lama untuk      ke header +
   db_ptrj          Jan/2026/PG1A   detail di
   (DataExtractor)  (DELETE)        extend_db_ptrj
                                    (INSERT)
    
    Langkah 3 secara detail:
    ┌──────────────────────────────────────────┐
    │ INSERT INTO payroll_history_header       │
    │   (period_month=1, period_year=2026,     │
    │    division_code='PG1A', ...)            │
    │   → Mendapat id = 42                     │
    ├──────────────────────────────────────────┤
    │ INSERT INTO payroll_history_detail       │
    │   (master_id=42, nik='320106...', ...)   │
    │   (master_id=42, nik='320107...', ...)   │
    │   ... (semua karyawan divisi PG1A)       │
    └──────────────────────────────────────────┘
```

---

## 3. Alur Kerja (Timeline Eksekusi)

### Fase A: Proses Seeding (Penyimpanan)
Dilakukan pada akhir bulan (Closing) saat data payroll dianggap final.

1.  **Trigger API**: Endpoint `POST /payroll/history/seed` dipanggil oleh Frontend.
2.  **Mode Validasi**: Seeder memastikan aplikasi berjalan dalam _production mode_ (`RUN_MODE="prod"`).
3.  **Kalkulasi Live**: Sistem memanggil `DataExtractorService` pada mode aktif. Seluruh data dihitung secara *live* seolah-olah halaman "Daftar Upah" sedang diakses.
4.  **Duplication Removal**: Memanggil metode `historyDatabaseService.deleteHistoryForPeriodAndLocation()`. Modul ini akan menghapus detail historis lama yang cocok.
5.  **Penyimpanan**: Baris-baris `PayrollRow` hasil ekstraksi yang rumit dipetakan menjadi tabel `PayrollHistoryDetail` SQL dan disimpan secara masal. 

### Fase B: Intersepsi Deep Query (Pembacaan Masa Lalu yang Seamless)
Fitur paling canggih dalam arsitektur ini. Jika pengguna mengakses "Daftar Upah" pada periode yang sudah lama berlalu (Contoh: Saat ini Februari 2026, lalu pengguna membuka kembali Desember 2025).

1.  **Request Frontend**: Pengguna memilih periode `12/2025` di kalender.
2.  **Interceptor Trigger**: API memanggil `dataExtractorService.ts`. Sistem menyadari bahwa `12/2025 < Saat Ini`.
3.  **Bypass Kalkulasi**: Alih-alih melakukan `JOIN` jutaan baris data absensi, SPK, Tunjangan Aktif, dan PR_TASKREGLN secara "live" (yang sangat melambat dan tidak akurat karena _master data rate_ telah berubah di 2026), sistem melakukan pembelokan rute (intersepsi).
4.  **Pengembalian Snapshot**: Metode `historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat()` dijalankan. Ini akan menarik data utuh dari database historis dan **merekonstruksinya** persis menjadi format array `PayrollRow[]` yang diharapkan oleh antarmuka. Keakuratan finansial 100% konsisten dengan saat closing dulu tanpa melakukan re-kalkulasi yang berbahaya.

### Fase C: Pencarian Riwayat Lintas Waktu (NIK-Based Employee History)
Digunakan saat klik profil karyawan untuk melihat grafik trend.

1.  **Identifikasi NIK**: Mengurai `emp_code` yang dicari pengguna, untuk menemukan NIK aktual karyawan di tabel `HR_EMPLOYEE`.
2.  **Pengumpulan Kodes**: Mengumpulkan seluruh variasi `emp_code` purba yang pernah berafiliasi dengan NIK spesifik tersebut (*misal: A012 (2024), A099 (Mutasi 2025), B221 (Promosi 2026)*).
3.  **Agregasi History**: Kueri dikirimkan ke DB `extend_db_ptrj` dengan `WHERE nik = 'XYZ'`. Semua pendapatan di semua tahun yang terdaftar atas nama KTP yang sama dipulihkan, diagregasi, dan ditampilkan di layar profil *History Gaji* dengan presisi.

---

## 4. Keuntungan Arsitektur Ini
*   **Immutability**: Nilai gaji tidak akan berubah jika master rate _Upah Minimum_ (UMK) tahun berikutnya dinaikkan.
*   **Safety Tracking**: Meskipun karyawan dimutasi lintas PT atau Divisi, gajinya selalu dapat diaudit menggunakan NIK.
*   **Performance**: Membuka halaman Daftar Upah pada periode lampau berlangsung instan (dibawah 200 milidetik), karena tidak perlu mereplika ulang kalkulasi rumit *attendance* dan pajak progresif TER.

---

## 5. Validasi & Uji Komparasi

Untuk memastikan transisi mulus antara `db_ptrj` (original) dan `extend_db_ptrj` (history), gunakan script:
```bash
bun run _dev_utils/scripts/test_comparison_jan.ts
```

Script ini akan:
1. Menarik data Januari 2026 dari database **original** (`db_ptrj`) via `DataExtractorService`.
2. Menarik data Januari 2026 dari database **history** (`extend_db_ptrj`) via `getHistoricalPayrollDataAsExtractorFormat`.
3. Mencocokkan field-by-field untuk setiap karyawan (berdasarkan `emp_code`).
4. Melaporkan apakah semua nilai numerik identik atau terdapat perbedaan.

