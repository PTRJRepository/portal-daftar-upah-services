# Diagram Alur Data ke AG Grid

## Proses Rendering Data dari Database ke AG Grid

```mermaid
graph LR
    subgraph "Database Layer"
        A[SQL Server]
        B[Employee Data]
        C[Gang Data]
        D[Payroll Calculations]
    end
    
    subgraph "Repository Layer"
        E[EmployeeRepositoryDB]
        F[GangRepositoryDB]
        G[fetch_employee_data()]
        H[fetch_gang_data()]
    end
    
    subgraph "Service Layer"
        I[PayrollService]
        J[GangService]
        K[HeaderService]
        L[generate_rows()]
        M[get_gang_info()]
        N[generate_dynamic_headers()]
    end
    
    subgraph "API Layer"
        O[FastAPI Endpoints]
        P[/reports endpoint]
        Q[/columns endpoint]
        R[/headers endpoint]
    end
    
    subgraph "Frontend Layer"
        S[Report.jsx]
        T[AG Grid Configuration]
        U[Column Definitions]
        V[Row Data]
    end
    
    subgraph "AG Grid Rendering"
        W[AG Grid Component]
        X[Rendered Table]
        Y[Frozen Columns: NO, NAMA]
        Z[Scrollable Data Area]
    end
    
    A --> B
    A --> C
    A --> D
    B --> E
    C --> F
    D --> E
    E --> G
    F --> H
    G --> I
    H --> J
    I --> L
    J --> M
    E --> N
    F --> N
    K --> N
    L --> I
    M --> J
    N --> K
    I --> O
    J --> O
    K --> O
    O --> P
    O --> Q
    O --> R
    P --> V
    Q --> U
    R --> T
    S --> T
    S --> U
    S --> V
    T --> W
    U --> W
    V --> W
    W --> X
    X --> Y
    X --> Z
```

## Tahapan Proses:
1. **Database Query**: Data karyawan, gang, dan perhitungan gaji diambil dari SQL Server
2. **Repository Abstraction**: Repositories menyediakan antarmuka untuk akses data
3. **Service Processing**: Services memproses logika bisnis dan menggabungkan data
4. **Header Generation**: Header dinamis dihasilkan berdasarkan data aktual
5. **API Response**: Endpoint menyediakan data dalam format yang siap dikonsumsi frontend
6. **Frontend Request**: Report.jsx meminta data dan konfigurasi kolom dari API
7. **AG Grid Configuration**: Data dan definisi kolom dikonfigurasi untuk AG Grid
8. **Rendering**: AG Grid merender data dalam bentuk tabel dengan fitur lanjutan
9. **Final Display**: Tabel ditampilkan dengan kolom NO dan NAMA difreeze di posisi kiri

## Fitur AG Grid:
- Kolom dinamis sesuai dengan data aktual
- Kolom NO dan NAMA difreeze di posisi paling kiri
- Kemampuan sorting, filtering, dan pencarian
- Virtual scrolling untuk data besar
- Responsif dan mobile-friendly