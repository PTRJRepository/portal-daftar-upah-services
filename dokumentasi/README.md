# Dokumentasi Arsitektur Sistem Report Plantware Daftar Upah

## Gambaran Umum
Dokumentasi ini menjelaskan secara menyeluruh arsitektur sistem report daftar upah berbasis backend Python FastAPI yang terintegrasi dengan AG Grid frontend. Sistem ini dirancang untuk mengelola dan menampilkan data payroll karyawan dengan efisien dan aman.

## Struktur Dokumentasi
```
dokumentasi/
├── README.md                     # Dokumentasi utama (file ini)
├── BackendStructure.md          # Struktur dan arsitektur backend
├── API_Documentation.md         # Spesifikasi API endpoints
├── Database_Configuration.md    # Konfigurasi dan arsitektur database
├── Performance_Optimization.md  # Optimisasi performa dan threading
├── Security_Authentication.md   # Keamanan dan otentikasi
├── FrontendStructure.md         # Struktur frontend dan integrasi
├── TestingMode.md              # Mode testing dan debug
└── diagrams/                    # Diagram arsitektur sistem
```

## Arsitektur Keseluruhan
```
refactor_production/
├── backend/                      # Backend Python FastAPI
│   ├── app/                     # Aplikasi utama
│   │   ├── api/                 # Endpoint API
│   │   ├── core/                # Fungsi inti
│   │   ├── models/              # Model data Pydantic
│   │   ├── repositories/        # Layer akses data
│   │   ├── services/            # Logika bisnis
│   │   └── utils/               # Fungsi utilitas
│   ├── config/                  # Konfigurasi aplikasi
│   ├── database/                # Layanan dan konfigurasi database
│   ├── tests/                   # File uji
│   ├── main.py                  # Entry point aplikasi
│   └── requirements.txt         # Dependensi Python
├── frontend/                    # Frontend React AG Grid
├── dokumentasi/                 # Dokumentasi sistem
├── Engine_HTML_Templating/      # Template laporan HTML
└── docker-compose.yml           # Konfigurasi container (jika ada)
```

## Fitur Utama Sistem

### 1. Backend Architecture
- **Framework**: FastAPI dengan Python 3.8+
- **Database**: Microsoft SQL Server (MSSQL) melalui pyodbc
- **Pola Arsitektur**: MVC dengan pemisahan concern
- **Autentikasi**: JWT token-based system
- **Keamanan**: Validasi input, sanitasi data, CORS protection

### 2. Pengelolaan Payroll
- **Perhitungan Gaji**: Formula lengkap untuk upah pokok, tunjangan, premi, dan potongan
- **BPJS Calculation**: Perhitungan komponen BPJS Kesehatan dan Pensiun
- **Absensi Integration**: Integrasi dengan data absensi karyawan
- **Multi-Gang Support**: Dukungan untuk berbagai kelompok kerja (gang)

### 3. Optimisasi Performa
- **Threading**: Pemrosesan paralel untuk header dan data
- **Caching**: Cache service untuk data payroll dan konfigurasi
- **Database Optimization**: Query parameterized dan optimasi indeks
- **Async Processing**: Non-blocking I/O operations

### 4. UI Integration
- **AG Grid**: Tabel interaktif untuk menampilkan data payroll
- **Dynamic Headers**: Struktur header yang disesuaikan dengan data
- **Column Definitions**: Konfigurasi kolom dengan aturan agregasi
- **Real-time Filtering**: Filter data real-time di sisi server

## Alur Proses Utama

### 1. Penanganan Request
1. Frontend mengirim request ke backend API
2. Middleware otentikasi memverifikasi JWT token
3. Validasi parameter input menggunakan Pydantic models
4. Service layer memproses permintaan
5. Repository layer mengakses database
6. Response dikirim kembali ke frontend

### 2. Pengambilan Data Payroll
1. Request `/payroll/report` dengan parameter gang, bulan, tahun
2. Service layer memanggil repository untuk mengambil data karyawan
3. Perhitungan payroll dilakukan berdasarkan data absensi dan konfigurasi
4. Data difilter dan dipaginasi sesuai permintaan
5. Response di-cache untuk permintaan berikutnya
6. Data dikembalikan dalam format PayrollRow

### 3. Generasi Header Dinamis
1. Request `/payroll/headers` untuk struktur AG Grid
2. Service menentukan kolom berdasarkan data aktual
3. Header dihasilkan secara dinamis sesuai dengan periode dan gang
4. Struktur header dirancang untuk AG Grid dengan hierarki kolom
5. Response dioptimasi dengan threading jika diaktifkan

## Konfigurasi Lingkungan

### Mode Operasi
- **Development Mode**: localhost + 10.0.0.128 access
- **Production Mode**: 10.0.0.110 access
- **Test Mode**: Mode pengujian dengan data demo

### Database Profiles
- **Local Profile**: Koneksi ke database lokal
- **Remote Profile**: Koneksi ke server produksi
- **Custom Profile**: Konfigurasi database fleksibel

## Integrasi dan Deployment

### Backend Deployment
- **Uvicorn Server**: Web server production-ready
- **Multiple Workers**: Support untuk concurrent request handling
- **Docker Support**: Containerization ready
- **Environment Configuration**: Multi-environment support

### Frontend Integration
- **REST API**: Endpoint API untuk komunikasi frontend-backend
- **AG Grid Configuration**: Kolom dan header dinamis
- **Authentication Flow**: Integrasi dengan sistem otentikasi
- **Real-time Updates**: Data update mechanism

## Panduan Penggunaan

### Untuk Developer
1. Lihat `BackendStructure.md` untuk arsitektur backend
2. Lihat `API_Documentation.md` untuk spesifikasi endpoint
3. Lihat `Database_Configuration.md` untuk konfigurasi database
4. Lihat `Performance_Optimization.md` untuk optimisasi
5. Lihat `Security_Authentication.md` untuk keamanan

### Untuk Administrator Sistem
1. Konfigurasi `config.json` sesuai lingkungan
2. Atur environment variables untuk keamanan
3. Monitor performa dengan endpoint `/payroll/health`
4. Gunakan endpoint `/payroll/performance/compare` untuk benchmark

### Untuk Pengguna Akhir
1. Gunakan otentikasi untuk mengakses sistem
2. Gunakan AG Grid untuk eksplorasi data payroll
3. Gunakan filter dan paginasi untuk efisiensi tampilan
4. Gunakan export HTML untuk laporan resmi