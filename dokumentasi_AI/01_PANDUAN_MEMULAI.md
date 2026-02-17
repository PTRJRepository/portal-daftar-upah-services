# Panduan Memulai - Payroll Daftar Upah Project

## Selamat Datang! 👋

Panduan ini akan membantu Anda memahami project Payroll Daftar Upah dari nol. Ikuti langkah-langkah berikut untuk mulai bekerja dengan project ini.

---

## 1. Apa itu Project Ini?

**Payroll Daftar Upah** adalah sistem pelaporan penggajian untuk PT Rebinmas (perusahaan perkebunan kelapa sawit) yang dapat:

- Menampilkan data payroll karyawan dalam bentuk tabel interaktif
- Menghitung lembur dengan sistem tarif bertingkat (tier-based)
- Menghitung pajak PPH21 dengan metode TER (Tarif Efektif Rata-rata)
- Menghasilkan laporan dalam format Excel, PDF, dan Google Spreadsheet

---

## 2. Teknologi yang Digunakan

### Backend
| Teknologi | Fungsi |
|-----------|--------|
| **Bun** | JavaScript runtime (pengganti Node.js) |
| **Elysia.js** | Web framework untuk Bun |
| **TypeScript** | Bahasa pemrograman dengan type safety |

### Frontend
| Teknologi | Fungsi |
|-----------|--------|
| **React** | Library untuk membangun UI |
| **Vite** | Build tool yang cepat |
| **AG Grid** | Komponen tabel data interaktif |

### Database
| Teknologi | Fungsi |
|-----------|--------|
| **MSSQL** | Database server utama |
| **SQL Gateway** | API perantara untuk akses database |

---

## 3. Prasyarat (Prerequisites)

Sebelum memulai, pastikan Anda telah menginstall:

### Wajib
- [ ] **Bun** - [Download disini](https://bun.sh/)
- [ ] **Node.js 18+** - [Download disini](https://nodejs.org/)
- [ ] **Git** - [Download disini](https://git-scm.com/)
- [ ] **VS Code** - [Download disini](https://code.visualstudio.com/)

### Opsional tapi Disarankan
- [ ] **Docker** - Untuk menjalankan database lokal
- [ ] **DBeaver** - Untuk mengelola database
- [ ] **Postman** - Untuk testing API

---

## 4. Setup Project

### Langkah 1: Clone Repository
```bash
git clone <repository-url>
cd refactor_production
```

### Langkah 2: Install Dependencies

**Backend:**
```bash
cd backend
bun install
```

**Frontend:**
```bash
cd frontend
npm install
```

### Langkah 3: Konfigurasi Environment

Buat file `.env` di folder `backend/`:

```bash
# Server Configuration
PORT=8002
RUN_MODE=dev
HOST=0.0.0.0

# SQL Gateway
DB_API_URL=http://localhost:8001
DB_API_KEY=your-api-key

# Database Profiles
DB_PROFILE=SERVER_PROFILE_1
DB_DATABASE=db_ptrj
DB_EXTEND_PROFILE=SERVER_PROFILE_1
DB_EXTEND_DATABASE=extend_db_ptrj
DB_VENUS_PROFILE=SERVER_PROFILE_3
DB_VENUS_DATABASE=VenusHR14

# Authentication
JWT_SECRET=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Lembur Configuration
LEMBUR_UPJ=17257
```

### Langkah 4: Jalankan Aplikasi

**Terminal 1 - Backend:**
```bash
cd backend
bun run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Langkah 5: Akses Aplikasi

Buka browser dan akses:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8002/api-info
- **Health Check:** http://localhost:8002/health

---

## 5. Struktur Folder Utama

```
refactor_production/
├── backend/              # Backend application
│   ├── src/
│   │   ├── api/          # Route handlers
│   │   ├── services/     # Business logic
│   │   ├── db/           # Database client
│   │   └── index.ts      # Entry point
│   └── package.json
│
├── frontend/             # Frontend application
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── services/     # API clients
│   │   └── App.jsx       # Main app
│   └── package.json
│
├── Additional_services/  # Python utilities
└── dokumentasi_AI/       # Documentation
```

---

## 6. File Penting untuk Dipahami

### Backend Entry Points
| File | Fungsi |
|------|--------|
| [`backend/src/index.ts`](../backend/src/index.ts) | Entry point server |
| [`backend/src/config.ts`](../backend/src/config.ts) | Konfigurasi environment |
| [`backend/src/api/payroll.ts`](../backend/src/api/payroll.ts) | Route payroll utama |

### Backend Services
| File | Fungsi |
|------|--------|
| [`backend/src/services/dataExtractorService.ts`](../backend/src/services/dataExtractorService.ts) | Ekstraksi data payroll |
| [`backend/src/services/lemburCalculator.ts`](../backend/src/services/lemburCalculator.ts) | Kalkulasi lembur |
| [`backend/src/services/pph21TerService.ts`](../backend/src/services/pph21TerService.ts) | Kalkulasi pajak |

### Frontend Entry Points
| File | Fungsi |
|------|--------|
| [`frontend/src/main.jsx`](../frontend/src/main.jsx) | Entry point React |
| [`frontend/src/App.jsx`](../frontend/src/App.jsx) | Root component |
| [`frontend/src/layouts/DashboardLayout.jsx`](../frontend/src/layouts/DashboardLayout.jsx) | Layout utama |

### Frontend Pages
| File | Fungsi |
|------|--------|
| [`frontend/src/pages/DashboardHome.jsx`](../frontend/src/pages/DashboardHome.jsx) | Halaman dashboard |
| [`frontend/src/pages/PayrollAnalysisPage.jsx`](../frontend/src/pages/PayrollAnalysisPage.jsx) | Analisis payroll |
| [`frontend/src/components/CustomPayrollTable.jsx`](../frontend/src/components/CustomPayrollTable.jsx) | Tabel payroll |

---

## 7. Cara Membaca Kode

### Urutan Membaca Backend
1. **Mulai dari** `backend/src/index.ts` - Lihat cara server dijalankan
2. **Pahami config** di `backend/src/config.ts` - Variabel environment
3. **Lihat routes** di `backend/src/api/` - Endpoint yang tersedia
4. **Pelajari services** di `backend/src/services/` - Logika bisnis

### Urutan Membaca Frontend
1. **Mulai dari** `frontend/src/main.jsx` - Entry point
2. **Lihat App.jsx** - Routing dan struktur
3. **Pelajari layouts** - Bagaimana halaman disusun
4. **Lihat pages** - Komponen halaman
5. **Pelajari services** - Cara memanggil API

---

## 8. Perintah yang Sering Digunakan

### Backend
```bash
# Jalankan development server
bun run dev

# Jalankan production server
bun run start

# Jalankan script tertentu
bun run src/scripts/get_token.ts
```

### Frontend
```bash
# Jalankan development server
npm run dev

# Build untuk production
npm run build

# Preview production build
npm run preview

# Jalankan tests
npm run test
```

### Full Stack (dari root)
```bash
# Jalankan backend + frontend bersamaan
npm run dev

# Setup semua dependencies
npm run setup
```

---

## 9. Testing API

### Menggunakan curl

**Health Check:**
```bash
curl http://localhost:8002/health
```

**Login:**
```bash
curl -X POST http://localhost:8002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

**Get Divisions:**
```bash
curl http://localhost:8002/payroll/divisions \
  -H "Authorization: Bearer <token>"
```

### Menggunakan Postman
1. Import collection dari `postman/` (jika ada)
2. Set environment variables untuk `base_url` dan `token`
3. Jalankan request sesuai kebutuhan

---

## 10. Debugging

### Backend Debugging
```typescript
// Tambahkan console.log untuk debugging
console.log('[DEBUG] Data:', JSON.stringify(data, null, 2));

// Gunakan di service
console.log(`[PayrollService] Processing employee: ${empCode}`);
```

### Frontend Debugging
```javascript
// Gunakan console.log di component
console.log('[Component] Props:', props);

// Gunakan React DevTools di browser
// Install extension: React Developer Tools
```

### Database Query Debugging
```typescript
// Query akan di-log otomatis oleh SQL Gateway
// Lihat output di terminal SQL Gateway
```

---

## 11. Sumber Belajar Tambahan

### Dokumentasi Resmi
- [Bun Documentation](https://bun.sh/docs)
- [Elysia.js Documentation](https://elysiajs.com/)
- [React Documentation](https://react.dev/)
- [AG Grid Documentation](https://www.ag-grid.com/)

### Video Tutorial (Rekomendasi)
- React untuk pemula
- TypeScript basics
- SQL query fundamentals

---

## 12. Bantuan & Support

Jika mengalami masalah:

1. **Baca dokumentasi** di folder `dokumentasi_AI/`
2. **Cek troubleshooting** di `10_TROUBLESHOOTING.md`
3. **Tanyakan ke tim** melalui komunikasi internal

---

## Checklist Pemahaman

Setelah membaca panduan ini, pastikan Anda memahami:

- [ ] Apa itu project Payroll Daftar Upah
- [ ] Teknologi yang digunakan
- [ ] Cara setup dan menjalankan project
- [ ] Struktur folder utama
- [ ] File-file penting yang perlu dipahami
- [ ] Cara membaca kode dengan urutan yang benar
- [ ] Perintah-perintah yang sering digunakan

---

**Selanjutnya:** Baca [02_ARSITEKTUR_PROJECT.md](./02_ARSITEKTUR_PROJECT.md) untuk memahami arsitektur sistem secara lengkap.