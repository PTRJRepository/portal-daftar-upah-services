# Dokumentasi Sistem Kehadiran dan Lembur Plantware

## Ringkasan
Sistem Kehadiran dan Lembur Plantware adalah aplikasi berbasis web yang dirancang untuk memvisualisasikan dan melacak data kehadiran dan lembur karyawan. Sistem ini terhubung ke database SQL Server (db_ptrj) dan menyajikan data dalam format grid interaktif, memungkinkan supervisor dan staf administrasi (kerani) untuk memonitor pola kehadiran karyawan.

## Arsitektur Sistem
- **Frontend**: Antarmuka HTML dengan AG-Grid untuk visualisasi data
- **Backend**: Server Node.js/Express.js 
- **Database**: SQL Server (db_ptrj) di 10.0.0.2:1888
- **Autentikasi**: Autentikasi SQL Server dasar (sa/supp0rt@)

## Fungsi Utama

### Dua Mode Operasional:
1. **Mode HK (Kehadiran)**: Menampilkan data kehadiran reguler termasuk jam kerja, lembur, status cuti, dan indikator hari spesial
2. **Mode OT (Lembur)**: Fokus eksklusif pada jam lembur, menampilkan hanya karyawan dengan catatan lembur

### Sumber Data:
1. **Data Kehadiran**: Diambil dari tabel `PR_EMP_ATTN`
2. **Data Lembur**: Diambil dari tabel `PR_TASKREG` dan `PR_TASKREGLN`
3. **Data Karyawan**: Diambil dari tabel `HR_EMPLOYEE` dan `HR_EMPLOYMENT`
4. **Data Kelompok Kerja**: Diambil dari tabel `HR_GANGLN`

## Logika Pemrosesan Data Secara Rinci

### Penghubungan Data Karyawan:
- Karyawan dihubungkan ke lokasi melalui tabel `HR_EMPLOYMENT`
- Karyawan dikelompokkan menurut kelompok kerja melalui tabel `HR_GANGLN`
- Nama karyawan diambil dari tabel `HR_EMPLOYEE`
- Integritas data dipertahankan menggunakan fungsi `RTRIM()` untuk menangani spasi kosong

### Logika Perhitungan Harian:
- Setiap hari dalam bulan yang dipilih diproses sebagai kolom terpisah
- Kehadiran dihitung ketika: jamKerja > 0 ATAU jamLembur > 0 ATAU sedangCuti ATAU hariLibur
- Hari istirahat sendiri tidak dihitung sebagai hari kehadiran
- Jam lembur dijumlahkan dari beberapa transaksi per hari
- Penanganan khusus untuk karyawan C0045 (Imam) di mana entri 2 jam dipisah menjadi dua entri 1 jam

### Perhitungan Total:
- **Total HK per Karyawan**: Jumlah hari dengan aktivitas kerja
- **Total HK per Kelompok**: Jumlah hari kerja berbeda di mana OT = 0
- **Total OT per Karyawan**: Jumlah semua jam lembur dalam bulan yang dipilih
- **Total OT per Hari**: Jumlah jam lembur untuk semua karyawan pada hari tertentu

### Fitur Antarmuka Pengguna

#### Kontrol Interaktif:
- **Input Kode Lokasi**: Memungkinkan pemfilteran berdasarkan lokasi kerja tertentu
- **Pemilihan Periode**: Secara otomatis diisi dengan bulan yang tersedia dari database
- **Fungsi Pencarian**: Filter karyawan berdasarkan nama
- **Tombol Mode**: Beralih antara tampilan HK (kehadiran) dan OT (lembur)

#### Elemen Visual:
- **Lingkaran Biru**: Menunjukkan kehadiran dalam mode HK
- **Angka Oranye**: Menampilkan jam lembur dalam mode OT
- **Header Kelompok**: Mengelompokkan karyawan berdasarkan kelompok kerja yang ditetapkan
- **Penyorotan Minggu**: Membedakan secara visual hari Minggu
- **Badge Total HK**: Menampilkan total kelompok dalam mode HK

### Kasus Khusus dan Penanganan:
1. **Karyawan C0045 (Imam)**: Pemrosesan khusus untuk 12 November di mana entri 2 jam dipisahkan menjadi dua entri 1 jam
2. **Transaksi OT Ganda**: Sesi lembur pada hari yang sama digabung dengan pemisah '|'
3. **Penanganan Hari Libur**: Hari Minggu disorot secara visual tetapi tidak otomatis ditandai sebagai hari libur kecuali ditentukan dalam database
4. **Data Cadangan**: Mode pengembangan menyediakan data tiruan saat database tidak tersedia

### Keamanan Database:
- Akses database langsung melalui koneksi SQL Server
- Kredensial database dihardcode dalam file konfigurasi
- Manajemen pool koneksi untuk query yang dioptimalkan
- Operasi RTRIM untuk penanganan data yang konsisten

### Catatan Integrasi:
Sistem dirancang untuk membantu kerani (klerk) memverifikasi bahwa data kehadiran yang dibuat di IFESS cocok dengan data yang ditampilkan dalam sistem. Jika ditemukan perbedaan, koreksi harus dilakukan di sistem Plantware melalui Taskreg.

Sistem komprehensif ini menyediakan solusi yang kuat untuk memonitor pola kehadiran dan lembur karyawan sambil menjaga integritas data dan menawarkan opsi tampilan yang fleksibel untuk berbagai kebutuhan organisasi.

---

## Struktur Database
### Tabel Utama dan Fungsinya

1. **PR_EMP_ATTN** - Tabel utama kehadiran yang berisi:
   - `EmpCode`: Kode karyawan
   - `AttnDate`: Tanggal kehadiran
   - `WorkHours`: Jam kerja reguler
   - `OTHours`: Jam lembur
   - `IsOnLeave`: Tanda apakah karyawan sedang cuti
   - `LeaveLength`: Durasi cuti
   - `TodayIsRestDay`: Tanda hari istirahat
   - `TodayIsHoliday`: Tanda hari libur
   - `LocCode`: Kode lokasi

2. **PR_TASKREG** - Tabel registrasi tugas:
   - `id`: ID catatan tugas
   - `DocDate`: Tanggal dokumen
   - `masterId`: ID master untuk catatan terkait

3. **PR_TASKREGLN** - Item baris registrasi tugas:
   - `EmpCode`: Kode karyawan
   - `OT`: Tanda apakah ini lembur (1 untuk ya, 0 untuk tidak)
   - `Hours`: Jam kerja
   - `masterId`: Kunci asing yang menghubungkan ke PR_TASKREG

4. **HR_EMPLOYMENT** - Rekam pekerjaan:
   - `EmpCode`: Kode karyawan
   - `LocCode`: Kode lokasi
   - Menghubungkan karyawan ke lokasi kerja mereka

5. **HR_EMPLOYEE** - Data master karyawan:
   - `EmpCode`: Kode karyawan
   - `EmpName`: Nama karyawan
   - `Status`: Status karyawan (1 untuk aktif)

6. **HR_GANGLN** - Keanggotaan kelompok kerja:
   - `GangMember`: Kode karyawan
   - `GangCode`: Kode kelompok
   - Menghubungkan karyawan ke kelompok kerja masing-masing

## Endpoint API dan Alur Data

### Endpoint Utama: `/api/attendance-by-loc-enhanced`
**Metode**: GET
**Tujuan**: Mengambil data kehadiran yang ditingkatkan untuk karyawan di lokasi dan bulan tertentu

**Parameter**:
- `locCode` (wajib): Kode lokasi (mis. P1A, P2A)
- `month` (wajib): Bulan (1-12)
- `year` (wajib): Tahun (mis. 2025)
- `includeInactive` (opsional): Apakah akan menyertakan karyawan tidak aktif
- `mode` (opsional): 'hk' untuk kehadiran atau 'ot' untuk lembur (bawaan: 'hk')

**Alur Data**:
1. Memvalidasi parameter wajib
2. Menghitung hari dalam bulan dan rentang tanggal (startDate, endDate)
3. Mengambil catatan karyawan berbeda dari database berdasarkan lokasi dan bulan
4. Menjalankan query berbasis mode:
   - **Mode HK**: Mengambil dari tabel `PR_EMP_ATTN`
   - **Mode OT**: Mengambil dari tabel `PR_TASKREG` dan `PR_TASKREGLN` di mana `OT = 1`
5. Memproses data harian setiap karyawan ke format terstruktur
6. Menghitung total kelompok untuk mode HK saja
7. Memfilter karyawan (dalam mode OT, hanya menampilkan yang memiliki > 0 OT)
8. Mengembalikan respons JSON dengan data, metadata, dan total kelompok

**Struktur Respons**:
```javascript
{
  success: boolean,
  data: array of employee records,
  daysInMonth: number,
  totalEmployees: number,
  location: string,
  gangTotals: object,
  mode: string
}
```

### Endpoint Bulan Tersedia: `/api/available-months`
**Metode**: GET
**Tujuan**: Mengambil semua bulan yang memiliki data kehadiran untuk lokasi tertentu

**Parameter**:
- `locCode` (wajib): Kode lokasi

**Alur Data**:
1. Memvalidasi kode lokasi
2. Query tabel `PR_EMP_ATTN` untuk kombinasi tahun/bulan berbeda
3. Mengembalikan daftar yang diurutkan secara menurun (terbaru dulu)

**Struktur Respons**:
```javascript
{
  success: boolean,
  data: [
    { year: number, month: number }
  ],
  count: number
}
```

### Endpoint Warisan: `/api/attendance-by-loc`
**Metode**: GET
**Tujuan**: Menyediakan data kehadiran dasar (dipertahankan untuk kompatibilitas)

**Parameter**:
- `locCode` (wajib): Kode lokasi
- `month` (wajib): Bulan
- `year` (wajib): Tahun
- `includeEmpName` (opsional): Apakah akan menyertakan nama karyawan

### Endpoint Cek Kesehatan: `/health`
**Metode**: GET
**Tujuan**: Cek kesehatan sederhana untuk mengonfirmasi status server

**Respons**:
```javascript
{
  status: "OK",
  timestamp: ISOString
}
```

### Integrasi Frontend:
**Endpoint Root**: `/`
**Metode**: GET
**Tujuan**: Melayani antarmuka aplikasi utama (`index.html`)

### Alur Pemrosesan Data:
1. **Inisiasi Permintaan**: Frontend (app.js) mengirim permintaan dengan locCode, month, year, dan mode
2. **Koneksi Database**: Server terhubung ke database SQL Server di 10.0.0.2:1888
3. **Eksekusi Query**: Query yang sesuai dijalankan berdasarkan mode (HK/OT)
4. **Transformasi Data**: Hasil diubah menjadi format yang kompatibel dengan grid
5. **Persiapan Respons**: Data disusun dengan metadata yang tepat
6. **Tampilan Frontend**: Grid diperbarui dengan definisi kolom dan data baris
7. **Pengelompokan Visual**: Karyawan dikelompokkan berdasarkan kelompok kerja dengan header visual

Sistem menyertakan mekanisme cadangan untuk lingkungan pengembangan ketika koneksi database gagal, menyediakan data tiruan yang mengikuti struktur yang sama dengan data produksi.