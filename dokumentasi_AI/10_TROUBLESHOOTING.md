# Troubleshooting Guide - Payroll Daftar Upah

## Overview

Dokumen ini berisi daftar masalah umum yang sering terjadi beserta solusinya. Gunakan sebagai referensi saat menghadapi error atau perilaku tidak expected.

---

## 1. Backend Issues

### 1.1 Server Tidak Bisa Start

**Gejala:**
```
Error: Cannot find module 'elysia'
```

**Penyebab:** Dependencies belum diinstall

**Solusi:**
```bash
cd backend
bun install
```

---

### 1.2 Database Connection Failed

**Gejala:**
```
Error: Connection refused to SQL Gateway
```

**Penyebab:** SQL Gateway tidak berjalan atau URL salah

**Solusi:**
1. Pastikan SQL Gateway berjalan di port yang benar
2. Cek environment variable `DB_API_URL`
3. Test koneksi:
```bash
curl http://localhost:8001/health
```

---

### 1.3 Query Timeout

**Gejala:**
```
Error: Query timeout after 30 seconds
```

**Penyebab:** Query terlalu lambat atau data terlalu besar

**Solusi:**
1. Tingkatkan timeout:
```bash
DB_QUERY_TIMEOUT=60
```
2. Optimize query dengan index
3. Batasi range data yang diquery

---

### 1.4 JWT Token Invalid

**Gejala:**
```
Error: Invalid token
```

**Penyebab:** Token expired atau secret salah

**Solusi:**
1. Cek `JWT_SECRET` di environment
2. Generate token baru:
```bash
bun run src/scripts/get_token.ts
```
3. Pastikan clock server sinkron

---

### 1.5 Port Already in Use

**Gejala:**
```
Error: Port 8002 is already in use
```

**Penyebab:** Proses lain menggunakan port yang sama

**Solusi:**
```bash
# Windows
netstat -ano | findstr :8002
taskkill /PID <pid> /F

# Linux/Mac
lsof -i :8002
kill -9 <pid>
```

---

## 2. Frontend Issues

### 2.1 Blank Page

**Gejala:** Halaman kosong saat membuka aplikasi

**Penyebab:** JavaScript error atau build gagal

**Solusi:**
1. Buka Browser DevTools (F12)
2. Cek Console untuk error
3. Clear cache dan rebuild:
```bash
cd frontend
rm -rf node_modules/.vite
npm run dev
```

---

### 2.2 AG Grid Not Rendering

**Gejala:** Tabel tidak muncul atau kosong

**Penyebab:** Data tidak ter-load atau columnDefs salah

**Solusi:**
1. Cek Network tab untuk API response
2. Pastikan `rowData` dan `columnDefs` terisi
3. Cek console untuk AG Grid license warning

---

### 2.3 CORS Error

**Gejala:**
```
Access to XMLHttpRequest at 'http://localhost:8002' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Penyebab:** CORS tidak dikonfigurasi dengan benar

**Solusi:**
1. Pastikan backend CORS mengizinkan origin frontend
2. Gunakan proxy di Vite config:
```javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/backend': 'http://localhost:8002'
    }
  }
}
```

---

### 2.4 Token Not Sent

**Gejala:** API return 401 Unauthorized

**Penyebab:** Token tidak disertakan di request header

**Solusi:**
1. Cek cookie apakah token tersimpan
2. Pastikan axios interceptor terkonfigurasi:
```javascript
api.interceptors.request.use(config => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

### 2.5 Vite Outdated Deps

**Gejala:**
```
The dependency is outdated. Please run npm install.
```

**Penyebab:** Cache Vite outdated

**Solusi:**
```bash
cd frontend
rm -rf node_modules/.vite
npm install
npm run dev
```

---

## 3. Data Issues

### 3.1 Data Tidak Muncul

**Gejala:** Tabel kosong padahal filter sudah benar

**Penyebab:**
1. Tidak ada data di database untuk periode tersebut
2. Filter terlalu ketat
3. Employee filtering rules mengexclude data

**Solusi:**
1. Cek database langsung dengan query
2. Relax filter (pilih "ALL" untuk division/gang)
3. Cek business rules untuk employee filtering

---

### 3.2 Total Tidak Sesuai

**Gejala:** Total berbeda dengan ekspektasi

**Penyebab:**
1. Kalkulasi salah
2. Data tidak lengkap
3. Rounding error

**Solusi:**
1. Trace kalkulasi step-by-step
2. Bandingkan dengan data mentah
3. Cek log untuk error kalkulasi

---

### 3.3 Lembur Tidak Terhitung

**Gejala:** Lembur_jumlah = 0 padahal ada transaksi lembur

**Penyebab:**
1. Transaksi tidak memiliki flag OT=1
2. UPJ = 0 (pay_rate tidak ditemukan)
3. Data ada di archive table tapi tidak di-query

**Solusi:**
1. Cek PR_TASKREGLN untuk transaksi lembur
2. Pastikan pay_rate ada di HR_PAYROLL
3. Query harus UNION dengan _ARC tables

---

### 3.4 PPH21 Salah

**Gejala:** PPH21 tidak sesuai ekspektasi

**Penyebab:**
1. PTKP status salah (RiceRation tidak match)
2. TER category salah
3. Penghasilan bruto salah

**Solusi:**
1. Cek RiceRation di HR_PAYROLL
2. Map ke PTKP dan TER category yang benar
3. Verifikasi komponen penghasilan bruto

---

## 4. Performance Issues

### 4.1 Loading Lambat

**Gejala:** Data lama muncul (> 10 detik)

**Penyebab:**
1. Query tidak optimal
2. Data terlalu besar
3. Network lambat

**Solusi:**
1. Tambahkan index di database
2. Implementasi pagination
3. Enable caching

---

### 4.2 Memory Leak

**Gejala:** Browser/server memory terus meningkat

**Penyebab:**
1. Event listener tidak di-cleanup
2. Large objects tidak di-garbage collect
3. Memory leak di AG Grid

**Solusi:**
1. Cleanup useEffect dengan return function
2. Destroy AG Grid saat unmount
3. Monitor memory dengan DevTools

---

## 5. Export Issues

### 5.1 Export Excel Gagal

**Gejala:** Error saat export ke Excel

**Penyebab:**
1. Data terlalu besar
2. Format tidak didukung
3. Memory tidak cukup

**Solusi:**
1. Batasi jumlah baris
2. Gunakan streaming untuk data besar
3. Export per batch

---

### 5.2 Print Tidak Sesuai

**Gejala:** Print result berbeda dengan tampilan

**Penyebab:** CSS print tidak ter-load

**Solusi:**
1. Pastikan print CSS ter-load:
```html
<link rel="stylesheet" href="print.css" media="print">
```
2. Gunakan @media print di CSS
3. Test dengan Print Preview

---

## 6. Authentication Issues

### 6.1 Login Gagal

**Gejala:** "Invalid credentials" padahal password benar

**Penyebab:**
1. Password hash tidak match
2. User tidak ditemukan di database
3. bcrypt version berbeda

**Solusi:**
1. Reset password user
2. Cek user di database
3. Pastikan bcryptjs version konsisten

---

### 6.2 Session Expired

**Gejala:** User di-logout tiba-tiba

**Penyebab:** Token expired

**Solusi:**
1. Tingkatkan token expiry:
```bash
ACCESS_TOKEN_EXPIRE_MINUTES=120
```
2. Implementasi refresh token
3. Auto-redirect ke login

---

## 7. Development Issues

### 7.1 Hot Reload Tidak Bekerja

**Gejala:** Perubahan kode tidak terlihat

**Penyebab:**
1. Cache issue
2. File tidak di-watch

**Solusi:**
1. Restart dev server
2. Clear cache:
```bash
# Backend
bun run dev

# Frontend
rm -rf node_modules/.vite
npm run dev
```

---

### 7.2 TypeScript Error

**Gejala:** Type errors saat compile

**Penyebab:** Type definition tidak sesuai

**Solusi:**
1. Update type definitions
2. Gunakan `any` sementara untuk debug
3. Cek tsconfig.json

---

## 8. Deployment Issues

### 8.1 Build Gagal

**Gejala:** `npm run build` error

**Penyebab:**
1. Environment variable tidak set
2. Syntax error
3. Missing dependencies

**Solusi:**
1. Set semua required env vars
2. Fix syntax errors
3. Install dependencies production

---

### 8.2 Static Files Not Found

**Gejala:** 404 untuk assets

**Penyebab:** Path tidak sesuai

**Solusi:**
1. Cek base path di Vite config
2. Pastikan build output di folder yang benar
3. Configure static file serving di backend

---

## 9. Debugging Checklist

### Saat Terjadi Error

- [ ] Baca error message dengan teliti
- [ ] Cek console/terminal untuk detail
- [ ] Identifikasi di mana error terjadi
- [ ] Cek log file jika ada
- [ ] Reproduce error secara konsisten
- [ ] Isolate masalah (comment out code)
- [ ] Cari solusi di dokumentasi/Google
- [ ] Test solusi di development
- [ ] Deploy fix ke production

### Tools untuk Debug

| Tool | Kegunaan |
|------|----------|
| Browser DevTools | Debug frontend |
| Console.log | Trace execution |
| Network Tab | Cek API calls |
| Database Query | Verifikasi data |
| Postman | Test API |

---

## 10. Getting Help

### Sebelum Bertanya

1. Cari di dokumentasi ini
2. Cari di Google/Stack Overflow
3. Reproduce error
4. Siapkan informasi:
   - Error message lengkap
   - Step untuk reproduce
   - Environment (dev/prod)
   - Versi software

### Kontak Support

- **Internal:** Hubungi tim development
- **Documentation:** Baca file README dan CLAUDE.md

---

**Selanjutnya:** Baca [11_PERUBAHAN_TERAKHIR.md](./11_PERUBAHAN_TERAKHIR.md) untuk mengetahui perubahan terakhir pada kode.