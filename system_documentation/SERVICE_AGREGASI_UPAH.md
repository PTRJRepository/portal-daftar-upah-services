# Service Agregasi Upah (Aggregation Seeder)

Layanan ini adalah sistem pengolahan data berbasis **Python** yang berfungsi sebagai "jembatan" untuk memindahkan data laporan bulanan ke dalam tabel riwayat (Snapshot).

## Lokasi: `Additional_services/create_aggregation_upah/`

## Teknologi Utama
- **Language**: Python 3.x.
- **Database Connection**: `pyodbc` untuk SQL Server.
- **API Integration**: `requests` untuk berkomunikasi dengan Backend API.

## Komponen Kunci

### 1. `aggregation_seeder.py` (Script Utama)
Berfungsi untuk memicu proses pengambilan data dan penyimpanannya.
- Mengambil data melalui endpoint `/payroll/report/division-raw-tree`.
- Melakukan pembersihan data: Mengabaikan karyawan dengan HK = 0.
- Menghitung Grand Total per Geng (Kelompok Kerja).

### 2. Logika Khusus Divisi Mill (Mill PKS)
- **Mill PKS** diperlakukan secara berbeda karena strukturnya tidak sama dengan kebun.
- Menggunakan query SQL eksternal (`getTotalHKMill.sql`) untuk menghitung Hari Kerja.
- Mengambil data berat TBS (Tandan Buah Segar) dari database timbangan `WM_TICKET`.

### 3. `db_connection.py`
Mengelola koneksi ke berbagai database:
- `PLANTWARE_DB`: Sumber data absensi mentah.
- `EXTEND_DB`: Tempat menyimpan hasil agregasi bulanan.
- `VENUSHR14`: Untuk data SDM tambahan.

---

## Alur Kerja Seeder
1. **Login**: Mendapatkan token akses dari Backend.
2. **Fetch Data**: Memanggil API untuk mendapatkan data lengkap satu divisi.
3. **Calculate**: Menghitung total Gaji Pokok, Tunjangan, Premi, Potongan, dan Pajak.
4. **Save**: Menyimpan hasil rekap tersebut ke tabel `dbo.daftar_upah_aggregation_history`.

**Tujuan**: Agar dashboard laporan tahunan/bulanan tidak perlu menghitung ulang ribuan data setiap kali dibuka, cukup membaca dari tabel hasil agregasi ini.
