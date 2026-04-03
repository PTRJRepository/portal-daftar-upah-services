# Mode Testing: Login Injection & Token Management

Fitur ini aktif ketika `TEST_MODE=true` (backend) atau `VITE_DEV_MODE=true` (frontend). Kode bertanda `// TESTING ONLY` tidak jalan di production.

## Ringkasan
- Login di-bypass menggunakan akun admin default
- Token permanen untuk seluruh request selama mode testing
- Auto-inject token saat menerima `401` dan retry sekali
- Panel dropdown untuk memilih `division`, `gang`, `month`, `year` tanpa autentikasi manual

## Cara Mengaktifkan

### Backend
```powershell
$env:TEST_MODE='true'
cd backend
bun run dev
```

### Frontend
```bash
cd frontend
npm run dev:test   # Aktifkan VITE_DEV_MODE=true
```

Atau dengan environment variable langsung:
```bash
$env:VITE_DEV_MODE='true'
npm run dev
```

## Cara Pakai
1. Jalankan backend dengan `TEST_MODE=true`
2. Jalankan frontend dengan `npm run dev:test`
3. Browser langsung ke halaman utama (tanpa login)
4. Pilih `Division`, `Gang`, `Month`, `Year` dari panel TESTING ONLY
5. Laporan langsung dimuat tanpa login

## Endpoint & Komponen

| Item | Lokasi | Keterangan |
|------|--------|------------|
| Test token endpoint | `GET /auth/test-token` | Hanya aktif di mode TEST_MODE=true |
| Token permanent | `backend/token.json` | Isi: `{"token": "permanent-testing-token"}` |
| HTTP interceptor | `src/utils/httpSetup.js` | Inject Authorization header + retry on 401 |
| Test mode panel | `src/components/common/TestModePanel.jsx` | Dropdown division/gang/month/year |
| Prod mode check | `src/utils/prodModeUtils.js` | `isProdMode()` function |

## Troubleshooting

### Mengalami 401 di mode testing
1. Pastikan frontend jalan dengan `VITE_DEV_MODE=true` (bukan hanya TEST_MODE backend)
2. Cek DevTools Console — akan ada warning "TESTING ONLY: Received 401 — injecting testing token"
3. Pastikan `token.json` ada di folder `backend/`

### Panel TESTING tidak muncul
1. Pastikan `VITE_DEV_MODE=true` di environment frontend
2. Cek `npm run dev:test` bukan `npm run dev`
3. Pastikan backend sudah jalan dengan `TEST_MODE=true`

### Gang tidak dimuat
1. Pastikan endpoint `/payroll/gangs` accessible dari backend
2. Cek network tab di DevTools untuk response
3. Pastikan database credentials benar di `.env`
