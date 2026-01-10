# Diagram Arsitektur Komponen

## Struktur Backend

```mermaid
graph TB
    subgraph "Main Application (main.py)"
        A[FastAPI App]
    end
    
    subgraph "API Layer (api/)"
        B[Router]
        C[Auth Endpoint]
        D[Payroll Endpoint]
        E[Gang Endpoint]
        F[Header Endpoint]
    end
    
    subgraph "Services Layer (services/)"
        G[PayrollService]
        H[GangService]
        I[HeaderService]
        J[MSSQLService]
    end
    
    subgraph "Repositories Layer (repositories/)"
        K[EmployeeRepository]
        L[GangRepository]
        M[EmployeeRepositoryDB]
        N[GangRepositoryDB]
    end
    
    subgraph "Database"
        O[SQL Server Connection]
        P[Users.db]
    end
    
    A --> B
    B --> C
    B --> D
    B --> E
    B --> F
    D --> G
    E --> H
    F --> I
    G --> K
    H --> L
    G --> M
    H --> N
    K --> O
    L --> O
    M --> O
    N --> P
    J --> O
```

## Struktur Frontend

```mermaid
graph TB
    subgraph "Vite + React"
        A[Main App.jsx]
    end
    
    subgraph "Pages"
        B[Report Page]
    end
    
    subgraph "Components"
        C[AG Grid Component]
        D[Gang Selector]
        E[Date Picker]
        F[Header Customizer]
    end
    
    subgraph "Services"
        G[Payroll Service]
        H[Header Service]
        I[Validation Service]
        J[Auth Service]
    end
    
    A --> B
    B --> C
    B --> D
    B --> E
    B --> F
    D --> G
    D --> H
    C --> I
    A --> J
    G --> J
    H --> J
```

## Penjelasan:
### Backend:
- **Main Application**: Titik masuk aplikasi FastAPI
- **API Layer**: Endpoint-endpoint HTTP untuk berbagai fungsi sistem
- **Services Layer**: Logika bisnis dan pemrosesan data
- **Repositories Layer**: Abstraksi akses database
- **Database**: Sumber data utama sistem

### Frontend:
- **Main App**: Komponen utama React
- **Pages**: Halaman-halaman aplikasi
- **Components**: Komponen UI reusable
- **Services**: Layanan untuk komunikasi dengan backend