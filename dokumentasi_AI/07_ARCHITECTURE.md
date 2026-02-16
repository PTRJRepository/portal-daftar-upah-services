# Architecture Documentation

## System Overview

Sistem Payroll Daftar Upah menggunakan arsitektur **3-tier** dengan pola **SQL Gateway** untuk akses database.

---

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client Layer
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end

    subgraph Frontend Layer
        React[React App]
        AGGrid[AG Grid Enterprise]
        Vite[Vite Build Tool]
    end

    subgraph Backend Layer
        Bun[Bun Runtime]
        Elysia[Elysia.js Server]
        Services[Business Services]
        Auth[JWT Authentication]
    end

    subgraph Gateway Layer
        SQLGateway[Python SQL Gateway]
        GatewayAPI[FastAPI/Flask]
    end

    subgraph Database Layer
        MSSQL[(MSSQL Server)]
        DB1[db_ptrj]
        DB2[extend_db_ptrj]
        DB3[VenusHR14]
        DB4[db_ptrj_mill]
    end

    subgraph External Services
        GSheets[Google Spreadsheet]
        AppsScript[Google Apps Script]
    end

    Browser --> React
    Mobile --> React
    React --> AGGrid
    React --> Vite
    React -->|HTTP/REST| Elysia
    Elysia --> Bun
    Elysia --> Services
    Elysia --> Auth
    Services -->|SQL Gateway API| SQLGateway
    SQLGateway --> GatewayAPI
    GatewayAPI --> MSSQL
    MSSQL --> DB1
    MSSQL --> DB2
    MSSQL --> DB3
    MSSQL --> DB4
    Services -->|HTTP POST| AppsScript
    AppsScript --> GSheets
```

---

## Component Architecture

### Frontend Architecture

```mermaid
flowchart TB
    subgraph Entry Points
        main[main.jsx]
        App[App.jsx]
    end

    subgraph Context Providers
        AuthProvider[AuthContext]
        ReportProvider[ReportContext]
        HeaderProvider[HeaderContext]
        GangProvider[GangFilterContext]
    end

    subgraph Layout
        DashboardLayout[DashboardLayout]
        Sidebar[Sidebar Navigation]
        Header[Header Component]
    end

    subgraph Pages
        Home[DashboardHome]
        Operational[Operational Report]
        Summary[SummaryReportPage]
        Analysis[PayrollAnalysisPage]
        Employee[EmployeeDetailPage]
        Other[Other Pages...]
    end

    subgraph Components
        Common[Common Components]
        Dashboard[Dashboard Components]
        Employee[Employee Components]
    end

    subgraph Services
        API[API Services]
        PayrollSvc[payrollService]
        AuthSvc[authService]
        GangSvc[gangService]
    end

    main --> App
    App --> AuthProvider
    AuthProvider --> ReportProvider
    ReportProvider --> DashboardLayout
    DashboardLayout --> Sidebar
    DashboardLayout --> Header
    DashboardLayout --> Pages
    Pages --> Components
    Pages --> Services
    Services --> API
```

### Backend Architecture

```mermaid
flowchart TB
    subgraph Server
        Index[index.ts]
        Config[config.ts]
    end

    subgraph Middleware
        CORS[CORS Middleware]
        Logger[Request Logger]
        Auth[Auth Middleware]
    end

    subgraph Routes
        AuthRoutes[auth.ts]
        PayrollRoutes[payroll.ts]
        SummaryRoutes[summary.ts]
        EmployeeRoutes[employee.ts]
        AggregationRoutes[aggregationSeederRoutes.ts]
        DashboardRoutes[dashboardRoutes.ts]
        HistoryRoutes[historyRoutes.ts]
        SpreadsheetRoutes[spreadsheetRoutes.ts]
    end

    subgraph Services Layer
        DataExtractor[dataExtractorService]
        PayrollSvc[payrollService]
        LemburCalc[lemburCalculator]
        PPH21Svc[pph21TerService]
        GangSvc[gangService]
        HeaderSvc[headerService]
        SummarySvc[summaryService]
        AggregationSvc[aggregationService]
        AuthSvc[authService]
        AppsScriptSvc[appsScriptService]
    end

    subgraph Data Layer
        DBClient[Database Client]
        SQLGateway[SQL Gateway API]
    end

    subgraph Payroll Components
        BaseComponent[BasePayrollComponentService]
        LemburComp[LemburService]
        PremiComp[PremiService]
        TunjanganComp[TunjanganService]
        PotonganComp[PotonganService]
        PPH21Comp[Pph21TerService]
        Registry[PayrollComponentRegistry]
    end

    Index --> Middleware
    Middleware --> Routes
    Routes --> Services
    Services --> DataLayer
    Services --> PayrollComponents
    DataLayer --> DBClient
    DBClient --> SQLGateway
```

---

## Data Flow Diagrams

### 1. Payroll Report Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant SQLGateway
    participant Database

    User->>Frontend: Select Division, Month, Year
    Frontend->>Backend: GET /payroll/report/division-raw-tree
    Backend->>Backend: Validate Token
    Backend->>SQLGateway: POST /v1/query
    SQLGateway->>Database: Execute SQL
    Database-->>SQLGateway: Result Set
    SQLGateway-->>Backend: JSON Response
    Backend->>Backend: Process Data
    Backend->>Backend: Calculate Totals
    Backend-->>Frontend: JSON Response
    Frontend->>Frontend: Render AG Grid
    Frontend-->>User: Display Report
```

### 2. Overtime Calculation Flow

```mermaid
sequenceDiagram
    participant Service as dataExtractorService
    participant Lembur as lemburCalculator
    participant DB as Database
    participant Gateway as SQL Gateway

    Service->>DB: Get Employee List
    DB-->>Service: Employees
    
    loop For Each Employee
        Service->>Lembur: calculateBatchDataWithTaskBreakdown
        Lembur->>Gateway: Query PR_TASKREGLN where OT=1
        Gateway-->>Lembur: Overtime Records
        Lembur->>Lembur: Classify Day Type
        Lembur->>Lembur: Calculate Tier Rates
        Lembur->>Lembur: Calculate Amount per Tier
        Lembur-->>Service: LemburResult with Records
    end
    
    Service->>Service: Aggregate Results
    Service-->>Service: Return PayrollRow with Lembur
```

### 3. Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant AuthService

    User->>Frontend: Enter Credentials
    Frontend->>Backend: POST /auth/login
    Backend->>AuthService: Verify Credentials
    AuthService->>AuthService: Hash Password Compare
    AuthService->>AuthService: Generate JWT Token
    AuthService-->>Backend: Token + User Info
    Backend-->>Frontend: Token Response
    Frontend->>Frontend: Store Token in Cookie
    Frontend->>Frontend: Set Auth Context
    Frontend-->>User: Redirect to Dashboard

    Note over Frontend,Backend: Subsequent Requests
    Frontend->>Backend: Request with Bearer Token
    Backend->>AuthService: Verify Token
    AuthService-->>Backend: User Object
    Backend->>Backend: Process Request
    Backend-->>Frontend: Response
```

### 4. Google Spreadsheet Sync Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant AppsScript as Google Apps Script
    participant Spreadsheet as Google Spreadsheet

    User->>Frontend: Click Sync Button
    Frontend->>Backend: POST /spreadsheet/sync
    Backend->>Backend: Prepare Sheet Data
    Backend->>AppsScript: HTTP POST with Payload
    AppsScript->>AppsScript: Validate Secret
    AppsScript->>Spreadsheet: Create/Update Sheets
    AppsScript->>Spreadsheet: Add Charts
    AppsScript-->>Backend: Success Response
    Backend-->>Frontend: Spreadsheet URL
    Frontend-->>User: Display Link
```

---

## Deployment Architecture

### Development Environment

```mermaid
flowchart LR
    subgraph Developer Machine
        Bun[Bun Server :8002]
        Vite[Vite Dev Server :5175]
        Python[SQL Gateway :8001]
    end

    subgraph Local Network
        MSSQL[(MSSQL Server)]
    end

    Vite -->|API Calls| Bun
    Bun -->|SQL Queries| Python
    Python -->|TDS Protocol| MSSQL
```

### Production Environment

```mermaid
flowchart TB
    subgraph Internet
        Users[Users]
    end

    subgraph Reverse Proxy
        Nginx[Nginx / Apache]
    end

    subgraph Application Server
        BunProd[Bun Production Server]
        StaticFiles[Static Files - Frontend Build]
    end

    subgraph Database Server
        PythonGateway[SQL Gateway API]
        MSSQLProd[(MSSQL Server)]
    end

    subgraph External
        GoogleAPI[Google API]
    end

    Users -->|HTTPS| Nginx
    Nginx -->|/upah/*| BunProd
    Nginx -->|/assets/*| StaticFiles
    BunProd -->|SQL Queries| PythonGateway
    PythonGateway -->|TDS| MSSQLProd
    BunProd -->|HTTPS| GoogleAPI
```

---

## Service Layer Design

### Singleton Pattern

All services implement the Singleton pattern for efficient resource management:

```typescript
export class PayrollService {
    private static instance: PayrollService;
    
    private constructor() {
        // Private constructor
    }
    
    public static getInstance(): PayrollService {
        if (!PayrollService.instance) {
            PayrollService.instance = new PayrollService();
        }
        return PayrollService.instance;
    }
}

export const payrollService = PayrollService.getInstance();
```

### Service Dependencies

```mermaid
flowchart TB
    dataExtractor[dataExtractorService]
    payroll[payrollService]
    lembur[lemburCalculator]
    pph21[pph21TerService]
    gang[gangService]
    header[headerService]
    summary[summaryService]
    aggregation[aggregationService]
    auth[authService]
    appsScript[appsScriptService]
    employee[employeeDetailService]
    thumbprint[thumbprintService]
    cache[cacheService]
    db[Database Client]

    dataExtractor --> payroll
    dataExtractor --> lembur
    dataExtractor --> pph21
    dataExtractor --> gang
    dataExtractor --> db
    
    payroll --> db
    lembur --> db
    pph21 --> db
    gang --> db
    header --> db
    summary --> db
    aggregation --> db
    employee --> db
    
    appsScript --> dataExtractor
    auth --> db
    
    cache -.->|Optional| dataExtractor
    thumbprint --> db
```

---

## Security Architecture

### Authentication & Authorization

```mermaid
flowchart TB
    subgraph Client
        Browser[Browser]
        Token[JWT Token Storage]
    end

    subgraph Backend
        AuthMiddleware[Auth Middleware]
        JWTService[JWT Service]
        UserService[User Service]
    end

    subgraph Database
        UserTable[User Table]
    end

    Browser -->|Login| JWTService
    JWTService -->|Verify| UserTable
    UserTable -->|User Data| JWTService
    JWTService -->|Sign Token| Browser
    Browser -->|Store| Token

    Browser -->|Request + Token| AuthMiddleware
    AuthMiddleware -->|Verify| JWTService
    JWTService -->|User Object| AuthMiddleware
    AuthMiddleware -->|Allow/Deny| Browser
```

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| ADMIN | All divisions, all features |
| USER | Assigned divisions only |
| VIEWER | Read-only access |

### Division-Based Access

```typescript
// Token contains allowed divisions
interface UserToken {
    id: number;
    username: string;
    role: UserRole;
    divisions: string[]; // ['AB1', 'AB2'] or ['ALL']
}

// Middleware checks division access
if (currentUser.role !== UserRole.ADMIN) {
    if (!currentUser.divisions.includes(division)) {
        return { status: 403, message: 'Division not accessible' };
    }
}
```

---

## Caching Strategy

### Cache Architecture

```mermaid
flowchart LR
    subgraph Request Flow
        Request[API Request]
        CacheCheck{Cache Hit?}
        Cache[In-Memory Cache]
        Service[Service Layer]
        DB[Database]
    end

    Request --> CacheCheck
    CacheCheck -->|Yes| Cache
    CacheCheck -->|No| Service
    Service --> DB
    DB --> Service
    Service --> Cache
    Cache --> Response
```

### Cache Configuration

```typescript
// Environment Variables
ENABLE_PRODUCTION_CACHE=true  // Enable in production
DISABLE_CACHE=true            // Force disable
CACHE_TTL_SECONDS=300         // 5 minutes default

// Cache Service
class CacheService {
    private cache: Map<string, { data: any; expiry: number }>;
    
    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (item && item.expiry > Date.now()) {
            return item.data;
        }
        return null;
    }
    
    set<T>(key: string, data: T, ttl: number): void {
        this.cache.set(key, {
            data,
            expiry: Date.now() + (ttl * 1000)
        });
    }
}
```

---

## Error Handling Architecture

### Error Flow

```mermaid
flowchart TB
    Request[API Request]
    
    subgraph Error Handling
        TryCatch[Try-Catch Block]
        Logger[Error Logger]
        Response[Error Response]
    end

    subgraph Error Types
        ValidationError[Validation Error - 400]
        AuthError[Authentication Error - 401]
        ForbiddenError[Forbidden Error - 403]
        NotFoundError[Not Found Error - 404]
        DBError[Database Error - 500]
        UnknownError[Unknown Error - 500]
    end

    Request --> TryCatch
    TryCatch -->|Error| Logger
    Logger --> ErrorTypes
    ErrorTypes --> Response
```

### Error Response Format

```typescript
interface ErrorResponse {
    message: string;
    error?: string;
    stack?: string; // Only in development
}

// Example
{
    "message": "Failed to fetch gangs: Connection timeout",
    "error": "ConnectionError"
}
```

---

## Performance Optimization

### Frontend Optimizations

1. **Lazy Loading**: Pages loaded on demand
2. **Code Splitting**: Separate chunks for each page
3. **Memoization**: useMemo, useCallback for expensive operations
4. **Virtual Scrolling**: AG Grid handles large datasets
5. **Debouncing**: Input handlers debounced

### Backend Optimizations

1. **Singleton Services**: Single instance per service
2. **Connection Pooling**: Via SQL Gateway
3. **Query Optimization**: Indexed queries, prepared statements
4. **Caching**: In-memory cache for frequently accessed data
5. **Batch Processing**: Bulk database operations

### Database Optimizations

1. **Proper Indexing**: On frequently queried columns
2. **Query Tuning**: Optimized JOINs and WHERE clauses
3. **Archive Tables**: Move old data to archive tables
4. **Connection Pooling**: Managed by SQL Gateway

---

## Monitoring & Logging

### Request Logging

```
GET /payroll/divisions 123ms
POST /auth/login 45ms
GET /payroll/report/division-raw-tree?division_code=AB1&month=12&year=2025 234ms
```

### Health Check Endpoint

```json
GET /health
{
    "status": "ok",
    "timestamp": "2025-12-15T10:30:00Z",
    "database": "db_ptrj",
    "profile": "SERVER_PROFILE_2"
}
```

---

## Scalability Considerations

### Horizontal Scaling

```mermaid
flowchart TB
    subgraph Load Balancer
        LB[Nginx Load Balancer]
    end

    subgraph Application Servers
        App1[Bun Server 1]
        App2[Bun Server 2]
        App3[Bun Server N]
    end

    subgraph Database Cluster
        Primary[(Primary DB)]
        Replica1[(Replica 1)]
        Replica2[(Replica 2)]
    end

    LB --> App1
    LB --> App2
    LB --> App3

    App1 --> Primary
    App2 --> Primary
    App3 --> Primary

    Primary --> Replica1
    Primary --> Replica2
```

### Future Improvements

1. **Redis Cache**: Distributed caching
2. **Message Queue**: For async operations
3. **Microservices**: Split into smaller services
4. **Containerization**: Docker/Kubernetes deployment
5. **CDN**: For static assets

---

*Dokumentasi ini dibuat secara otomatis berdasarkan analisis arsitektur sistem*