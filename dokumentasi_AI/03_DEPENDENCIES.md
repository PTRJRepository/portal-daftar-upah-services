# Dependencies Documentation

## Overview

Proyek ini menggunakan dua set dependencies terpisah untuk backend dan frontend, dengan beberapa shared dev dependencies di root.

---

## Root Dependencies

### package.json (Root)

```json
{
  "name": "payroll-system",
  "version": "1.0.0",
  "devDependencies": {
    "concurrently": "^8.2.2"
  },
  "keywords": ["payroll", "fastapi", "react", "vite"],
  "author": "Payroll System Team",
  "license": "MIT"
}
```

| Package | Version | Purpose |
|---------|---------|---------|
| `concurrently` | ^8.2.2 | Run backend and frontend simultaneously |

---

## Backend Dependencies

### package.json (Backend)

```json
{
  "name": "payroll-backend-bun",
  "version": "1.0.0",
  "module": "src/index.ts",
  "dependencies": {
    "@elysiajs/cors": "^1.4.1",
    "@elysiajs/static": "^1.4.7",
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "date-fns": "^3.3.1",
    "dotenv": "^16.3.1",
    "elysia": "latest",
    "googleapis": "^171.4.0",
    "jose": "^5.2.0",
    "mssql": "^10.0.1"
  },
  "devDependencies": {
    "bun-types": "latest",
    "typescript": "^5.0.0"
  }
}
```

### Dependencies Detail

#### Web Framework
| Package | Version | Purpose |
|---------|---------|---------|
| `elysia` | latest | High-performance TypeScript web framework |
| `@elysiajs/cors` | ^1.4.1 | CORS middleware for Elysia |
| `@elysiajs/static` | ^1.4.7 | Static file serving middleware |

#### Authentication & Security
| Package | Version | Purpose |
|---------|---------|---------|
| `jose` | ^5.2.0 | JWT token generation and verification |
| `bcryptjs` | ^2.4.3 | Password hashing |

#### Database
| Package | Version | Purpose |
|---------|---------|---------|
| `mssql` | ^10.0.1 | MSSQL client (used for reference, actual connection via SQL Gateway) |

#### Date/Time
| Package | Version | Purpose |
|---------|---------|---------|
| `date-fns` | ^3.3.1 | Date manipulation and formatting |

#### Google Integration
| Package | Version | Purpose |
|---------|---------|---------|
| `googleapis` | ^171.4.0 | Google API client for Spreadsheet sync |

#### Utilities
| Package | Version | Purpose |
|---------|---------|---------|
| `dotenv` | ^16.3.1 | Environment variable loader |
| `cors` | ^2.8.5 | CORS handling |

#### TypeScript Types
| Package | Version | Purpose |
|---------|---------|---------|
| `@types/bcryptjs` | ^2.4.6 | TypeScript types for bcryptjs |
| `@types/cors` | ^2.8.17 | TypeScript types for cors |
| `bun-types` | latest | TypeScript types for Bun runtime |
| `typescript` | ^5.0.0 | TypeScript compiler |

---

## Frontend Dependencies

### package.json (Frontend)

```json
{
  "name": "payroll-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "ag-grid-community": "^31.3.2",
    "ag-grid-enterprise": "^31.3.2",
    "ag-grid-react": "^31.3.2",
    "axios": "^1.7.2",
    "exceljs": "^4.4.0",
    "file-saver": "^2.0.5",
    "html2pdf.js": "^0.14.0",
    "js-cookie": "^3.0.5",
    "lucide-react": "^0.563.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^7.13.0",
    "recharts": "^3.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "cross-env": "^7.0.3",
    "jsdom": "^24.1.3",
    "vite": "^5.0.0",
    "vitest": "^1.6.0"
  }
}
```

### Dependencies Detail

#### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.2.0 | UI library |
| `react-dom` | ^18.2.0 | React DOM renderer |

#### Data Grid
| Package | Version | Purpose |
|---------|---------|---------|
| `ag-grid-community` | ^31.3.2 | AG Grid community edition |
| `ag-grid-enterprise` | ^31.3.2 | AG Grid enterprise features (Excel export, etc.) |
| `ag-grid-react` | ^31.3.2 | React wrapper for AG Grid |

#### Routing
| Package | Version | Purpose |
|---------|---------|---------|
| `react-router-dom` | ^7.13.0 | React routing library |

#### HTTP Client
| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | ^1.7.2 | HTTP client for API calls |

#### Charts & Visualization
| Package | Version | Purpose |
|---------|---------|---------|
| `recharts` | ^3.7.0 | React charting library |

#### Icons
| Package | Version | Purpose |
|---------|---------|---------|
| `lucide-react` | ^0.563.0 | Modern icon library |

#### Export & File Handling
| Package | Version | Purpose |
|---------|---------|---------|
| `exceljs` | ^4.4.0 | Excel file generation |
| `file-saver` | ^2.0.5 | File download helper |
| `html2pdf.js` | ^0.14.0 | HTML to PDF conversion |

#### State & Storage
| Package | Version | Purpose |
|---------|---------|---------|
| `js-cookie` | ^3.0.5 | Cookie management |

#### Build Tools
| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^5.0.0 | Fast build tool |
| `@vitejs/plugin-react` | ^4.2.0 | Vite React plugin |

#### Testing
| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^1.6.0 | Unit testing framework |
| `jsdom` | ^24.1.3 | DOM simulation for tests |

#### Utilities
| Package | Version | Purpose |
|---------|---------|---------|
| `cross-env` | ^7.0.3 | Cross-platform environment variables |

---

## Python Dependencies (Additional Services)

### Requirements (Implied from code analysis)

```
# Database
pyodbc>=4.0.0          # MSSQL connection
sqlalchemy>=2.0.0      # ORM

# Web Framework
flask>=2.0.0           # Web framework for SQL Gateway
flask-cors>=3.0.0      # CORS support

# GUI
tkinter                # GUI (built-in with Python)
customtkinter          # Modern tkinter theme

# Data Processing
pandas>=2.0.0          # Data manipulation
openpyxl>=3.0.0        # Excel handling

# Utilities
python-dotenv>=1.0.0   # Environment variables
requests>=2.28.0       # HTTP client
```

---

## Dependency Graph

```mermaid
graph TD
    subgraph Root
        concurrently[concurrently]
    end

    subgraph Backend
        elysia[elysia]
        elysia_cors[@elysiajs/cors]
        elysia_static[@elysiajs/static]
        jose[jose]
        bcryptjs[bcryptjs]
        date_fns[date-fns]
        googleapis[googleapis]
        dotenv[dotenv]
        typescript[typescript]
        bun_types[bun-types]
    end

    subgraph Frontend
        react[react]
        react_dom[react-dom]
        react_router[react-router-dom]
        ag_grid[ag-grid-*]
        axios[axios]
        recharts[recharts]
        exceljs[exceljs]
        html2pdf[html2pdf.js]
        vite[vite]
        vitest[vitest]
    end

    concurrently --> Backend
    concurrently --> Frontend
    elysia --> elysia_cors
    elysia --> elysia_static
    react --> ag_grid
    react --> recharts
    react --> react_router
```

---

## Version Compatibility Matrix

| Component | Version | Node/Bun Version | Notes |
|-----------|---------|------------------|-------|
| Bun Runtime | latest | - | Backend runtime |
| TypeScript | ^5.0.0 | - | Backend & Frontend |
| React | ^18.2.0 | Node 18+ | Frontend framework |
| Vite | ^5.0.0 | Node 18+ | Build tool |
| AG Grid | ^31.3.2 | - | Data grid |

---

## Security Considerations

### Known Security Features

| Package | Security Feature |
|---------|-----------------|
| `bcryptjs` | Password hashing with salt |
| `jose` | JWT with RS256 signing |
| `axios` | HTTPS support, interceptors |

### Recommended Security Updates

1. **Regular Updates**: Run `npm audit` and `bun audit` regularly
2. **Dependency Scanning**: Use tools like Snyk or Dependabot
3. **Lock Files**: Keep `bun.lock` and `package-lock.json` in version control

---

## Installation Commands

### Backend
```bash
cd backend
bun install
```

### Frontend
```bash
cd frontend
npm install
```

### Full Stack (from root)
```bash
npm run setup
```

### Development
```bash
# Run both backend and frontend
npm run dev

# Run backend only
npm run backend:dev

# Run frontend only
npm run frontend:dev
```

---

## Dependency Update Commands

### Backend
```bash
cd backend
bun update              # Update all dependencies
bun update <package>    # Update specific package
```

### Frontend
```bash
cd frontend
npm update              # Update all dependencies
npm update <package>    # Update specific package
npm audit fix           # Fix security vulnerabilities
```

---

## Troubleshooting

### Common Issues

#### 1. AG Grid License
```
Error: AG Grid Enterprise requires a license key
```
**Solution**: Set `LicenseManager.setLicenseKey()` in production

#### 2. Bun Lock Mismatch
```
Error: bun.lock is out of date
```
**Solution**: Run `bun install` to update lock file

#### 3. Vite Cache Issues
```
Error: Outdated optimize dep
```
**Solution**: 
```bash
rm -rf node_modules/.vite
npm install
```

#### 4. Node Version Mismatch
```
Error: Node version incompatible
```
**Solution**: Use Node 18+ or Bun runtime

---

*Dokumentasi ini dibuat secara otomatis berdasarkan analisis package.json*