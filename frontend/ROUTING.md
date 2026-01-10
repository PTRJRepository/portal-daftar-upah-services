# Payroll Frontend - Routing Documentation

## Base Path Configuration

### Development Mode
- Base path: `/`
- URL: `http://localhost:5175/`
- Assets: `http://localhost:5175/images/rebinmas.webp`

### Production Mode (Proxy)
- Base path: `/upah/`
- URL: `http://localhost:3001/upah/`
- Assets: `http://localhost:3001/upah/images/rebinmas.webp`

---

## Routes

| Route | Description |
|-------|-------------|
| `/` or `/upah/` | Main page (login/report selection) |
| `/employee/detail` or `/upah/employee/detail` | Employee detail page |

### Employee Detail Query Parameters

```
?nik=A0240&month=12&year=2025&division=INFRA
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `nik` | Yes | Employee NIK code |
| `month` | Yes | Report month (1-12) |
| `year` | Yes | Report year (e.g., 2025) |
| `division` | No | Division code |

---

## Server Configuration

For the dist folder to work correctly, the server must:

1. **Serve static files** from `/upah/` path
2. **Fallback all routes to `index.html`** for SPA routing

### Example: Express.js

```javascript
const express = require('express');
const path = require('path');
const app = express();

// Serve static files from dist folder at /upah path
app.use('/upah', express.static(path.join(__dirname, 'dist')));

// SPA fallback - all /upah/* routes return index.html
app.get('/upah/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
```

### Example: Nginx

```nginx
location /upah {
    alias /path/to/dist;
    try_files $uri $uri/ /upah/index.html;
}
```

---

## Build Commands

```bash
# Development
npm run dev

# Production build (creates dist folder with /upah base)
npm run build

# Preview production build locally
npm run preview
```
