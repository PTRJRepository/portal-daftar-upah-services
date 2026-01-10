# Mode Testing: Login Injection & Token Management

Fitur ini hanya aktif ketika `TEST_MODE=true` atau `VITE_DEV_MODE=true` di frontend. Semua bagian bertanda `// TESTING ONLY` tidak akan dipakai di production.

## Ringkasan
- Login di-bypass pada mode testing, menggunakan akun admin default.
- Tersedia token permanen untuk seluruh request selama mode testing.
- Auto-inject token saat menerima `401` dan lakukan retry sekali.
- Panel dropdown untuk memilih `division`, `gang`, `month`, dan `year` tanpa autentikasi.

## Cara Mengaktifkan
1. Frontend: jalankan dengan dev test flag
   - `npm run dev:test` (mengaktifkan `VITE_DEV_MODE=true`)
2. Backend: set environment `TEST_MODE=true`
   - PowerShell: `$env:TEST_MODE='true'`

## Komponen & Endpoint
- Endpoint backend: `GET /auth/test-token` (hanya di testing)
  - Mengembalikan `{ access_token, token_type: 'bearer', expires: 'never' }`
- File token permanen: `backend/token.json` berisi `{"token":"permanent-testing-token"}`
- Interceptor frontend: `src/utils/httpSetup.js`
  - Menambahkan header `Authorization: Bearer <testing_token>` ke semua request.
  - Ketika `401`, otomatis mengambil token testing dan retry sekali.
- Panel pemilihan: `src/components/common/TestModePanel.jsx`
  - Menyediakan dropdown `Division`, `Gang`, `Month`, `Year`.

## Alur Pakai
1. Jalankan backend dengan `TEST_MODE=true`.
2. Jalankan frontend dengan `npm run dev:test`.
3. Di halaman utama, panel “TESTING ONLY” muncul.
4. Pilih `Division`, `Gang`, `Month`, `Year`.
5. Laporan akan dimuat tanpa proses login dan tanpa manajemen token manual.

## Catatan Keamanan
- Token permanen hanya diterima ketika `TEST_MODE=true`; di production endpoint `GET /auth/test-token` akan mengembalikan `403`.
- Backend akan mencatat warning saat ada akses tanpa header Authorization di mode testing.
- Semua kode bertanda `// TESTING ONLY` ditujukan khusus untuk pengujian.

## Troubleshooting
- Mengalami `401` di mode testing:
  - Pastikan frontend dijalankan dengan `VITE_DEV_MODE=true` (gunakan `npm run dev:test`).
  - Pastikan backend environment `TEST_MODE=true`.
  - Buka DevTools Console; Anda akan melihat warning “TESTING ONLY: Received 401 — injecting testing token and retrying once”.
- Panel tidak memuat `Gang`:
  - Pastikan backend up dan endpoint `/payroll/gangs` bisa diakses.
  - Coba pilih `Division` lain, atau kosongkan pencarian.

