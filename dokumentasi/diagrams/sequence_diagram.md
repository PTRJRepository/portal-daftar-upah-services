# Diagram Interaksi Sistem - Sequence Diagram

## Alur Pengambilan dan Rendering Data

```mermaid
sequenceDiagram
    participant User as Pengguna
    participant Frontend as Frontend (React)
    participant AGGrid as AG Grid
    participant ApiService as API Service
    participant Backend as FastAPI Backend
    participant PayrollService as Payroll Service
    participant GangService as Gang Service
    participant HeaderService as Header Service
    participant Repo as Repository Layer
    participant DB as Database

    User->>Frontend: Membuka halaman report
    Frontend->>ApiService: Request gang list
    ApiService->>GangService: get_gangs()
    GangService->>Repo: fetch_gangs_from_database()
    Repo->>DB: Query gangs
    DB-->>Repo: Return gang data
    Repo-->>GangService: Return gangs
    GangService-->>ApiService: Return gang list
    ApiService-->>Frontend: Return gangs
    Frontend->>AGGrid: Populate gang selector
    
    User->>Frontend: Pilih gang dan bulan
    Frontend->>ApiService: Request report data
    ApiService->>HeaderService: generate_dynamic_headers()
    HeaderService->>Repo: get_data_for_headers()
    Repo->>DB: Query for header data
    DB-->>Repo: Return header data
    Repo-->>HeaderService: Return data for headers
    HeaderService-->>ApiService: Return dynamic headers
    
    ApiService->>PayrollService: generate_rows()
    PayrollService->>Repo: fetch_employee_data()
    Repo->>DB: Query employee data
    DB-->>Repo: Return employee data
    Repo-->>PayrollService: Return employee data
    PayrollService-->>ApiService: Return payroll rows
    
    ApiService-->>Frontend: Return report data + headers
    Frontend->>AGGrid: Configure columns and render data
    AGGrid-->>User: Menampilkan tabel AG Grid
```

## Penjelasan:
1. **Inisialisasi**: Pengguna membuka halaman, sistem mendapatkan daftar gang dari database
2. **Pemilihan Parameter**: Pengguna memilih gang dan bulan untuk laporan
3. **Pengambilan Header Dinamis**: Sistem menghasilkan header kolom secara dinamis berdasarkan data aktual
4. **Pengambilan Data Gaji**: Sistem mengambil data karyawan dan perhitungan gaji dari database
5. **Rendering AG Grid**: Frontend mengkonfigurasi dan merender AG Grid dengan data yang diperoleh
6. **Tampilan Akhir**: Tabel AG Grid ditampilkan dengan kolom-kolom yang sesuai dan fitur-fitur lanjutan