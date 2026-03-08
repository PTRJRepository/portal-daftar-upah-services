# Arsitektur Database (Multi-Database Ecosystem)

Sistem Payroll ini tidak hanya menggunakan satu database, melainkan ekosistem beberapa database yang saling terintegrasi untuk fungsi yang berbeda-beda.

## Peta Database & Fungsi

| Nama Database | Server Profile | Fungsi Utama |
|:---|:---|:---|
| `db_ptrj` | `PROFILE_1` | **Database Utama (Plantware)**: Berisi data absensi, master karyawan, dan transaksi harian. |
| `extend_db_ptrj` | `PROFILE_1` | **Database Agregasi**: Menyimpan hasil "Seeding" atau snapshot laporan bulanan agar dashboard cepat diakses. |
| `VenusHR14` | `PROFILE_3` | **Database SDM (Mill)**: Digunakan khusus untuk mengambil data karyawan dan HK di bagian Pabrik (Mill PKS). |
| `db_ptrj_mill` | `PROFILE_3` | **Database Timbangan**: Berisi data tiket timbangan TBS (`WM_TICKET`) untuk menghitung rasio upah terhadap hasil panen. |
| `staging_PTRJ_iFES` | `PROFILE_2` | **Staging Database**: Tempat transit data scanner panen sebelum masuk ke sistem utama. |

---

## Konfigurasi Upah & Tunjangan (Dinamis per Tahun)

Sistem secara cerdas memilih tarif upah berdasarkan tahun transaksi yang diminta. Konfigurasi ini diatur di `backend/src/config.ts`:

- **Gaji Pokok (Upah Dasar)**:
  - 2024: Rp 125.000
  - 2025: Rp 129.220
  - 2026: Rp 129.220
- **Tunjangan (Rate 2025/2026)**:
  - Beras: Rp 35.000
  - Jabatan: Rp 150.000
  - Masa Kerja: Rp 25.000

---

## Tabel Kunci yang Sering Diakses

### 1. Data Karyawan & Absensi (`db_ptrj`)
- `HR_EMPLOYEE`: Master data profil karyawan.
- `HR_PAYROLL`: Data pendaftaran gaji dan porsi beras.
- `PR_TASKREGLN`: Data transaksi harian (HK, Lembur, Premi).
- `HR_GANGLN`: Data pengelompokan karyawan ke dalam Geng/Mandor.

### 2. Data Histori Agregasi (`extend_db_ptrj`)
- `dbo.daftar_upah_aggregation_history`: Tabel hasil rekap bulanan yang dihasilkan oleh `aggregation_seeder.py`.

### 3. Data Timbangan (`db_ptrj_mill`)
- `dbo.WM_TICKET`: Mencatat berat `NetWeight` dalam satuan gram (dibagi 1000 untuk mendapatkan Ton).

---

## Integritas Data
Sistem menggunakan **SQL Gateway API** sebagai perantara (Proxy). Ini memastikan:
1.  **Read-Only**: Query ke database produksi (`db_ptrj`) mayoritas bersifat Read-Only untuk keamanan.
2.  **Audit**: Semua query SQL yang lewat bisa dipantau melalui log Gateway.
