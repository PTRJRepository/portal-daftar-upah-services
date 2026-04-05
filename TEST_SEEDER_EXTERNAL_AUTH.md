# Test Seeder - Cara yang Benar dengan External Auth

## Problem
Ketika akses via proxy port 3001, auth-token dihapus/disanitasi oleh proxy.

```
✂️ Sanitized Cookies (Removed auth-token): session=...
⚠️ WARNING: payroll_auth_token is MISSING!
```

## Solution: Akses Frontend Langsung

### ✅ Step 1: Buka Frontend Langsung (Bukan via Proxy)

**JANGAN gunakan:**
```
http://localhost:3001/upah/...  ❌ (Proxy - auth token dihapus)
```

**GUNAKAN:**
```
http://localhost:5175  ✅ (Frontend langsung)
```

atau jika menggunakan DEV_MODE:
```
http://localhost:5173  ✅
```

### ✅ Step 2: Login via External Auth

1. Buka `http://localhost:5175`
2. Sistem akan otomatis cek `localStorage.getItem('auth-token')`
3. Jika ada, otomatis login menggunakan external auth
4. Jika tidak ada, akan redirect ke login page

### ✅ Step 3: Cek Auth Status

Buka **Browser Console** (F12) dan run:
```javascript
// Cek apakah token ada
console.log('Token:', localStorage.getItem('auth-token'))
console.log('User:', localStorage.getItem('user'))
```

Harusnya muncul token JWT dan user info.

### ✅ Step 4: Buka Halaman Seeder

1. Di sidebar/menu, cari **"Aggregation Seeder"** atau **"Payroll Seeder"**
2. Atau langsung akses: `http://localhost:5175/aggregation-seeder`

### ✅ Step 5: Verifikasi Token Terkirim

Di Browser Console → Network tab:
1. Klik request ke `/payroll/history/seed/progress`
2. Cek **Request Headers**
3. Harus ada:
   ```
   Authorization: Bearer eyJhbGci...
   ```

### ✅ Step 6: Jalankan Seeder

Set parameter:
- **Division**: `P1A` (test dulu)
- **Month**: `Maret`
- **Year**: `2026`
- **History Seeder Type**: `Payroll & Transactions`

Klik **"💾 Save to History"**

---

## Troubleshooting

### Jika Masih Error "payroll_auth_token is MISSING"

**Cek 1: Token ada di localStorage?**
```javascript
// Di browser console
const token = localStorage.getItem('auth-token');
console.log('Token exists:', !!token);
console.log('Token length:', token?.length);
```

**Fix jika null:**
- Login dulu di external system (port 3001)
- Token akan otomatis tersimpan di localStorage

**Cek 2: AuthContext sudah load token?**
```javascript
// Di browser console
// Cek axios header
console.log('Axios auth header:', 
  axios.defaults.headers.common['Authorization']
);
```

**Fix jika kosong:**
- Refresh halaman
- AuthContext akan reload token dari localStorage

**Cek 3: Backend menerima token?**
```
// Di backend console log, harus ada:
[Auth] Token verified: { userId: 17, email: 'admin', role: 'ADMIN' }
```

### Jika Akses via Proxy (Port 3001) WAJIB

Anda perlu modify proxy di port 3001 untuk **TIDAK menghapus** auth-token cookie.

Di proxy config (port 3001), tambahkan:
```javascript
// JANGAN hapus auth-token dari cookies
// Atau: Teruskan Authorization header ke backend
proxy.on('proxyReq', (proxyReq, req, res) => {
  const authToken = getAuthTokenFromSomewhere();
  if (authToken) {
    proxyReq.setHeader('Authorization', `Bearer ${authToken}`);
  }
});
```

---

## Why This Happens

### Flow yang BENAR (Direct Access):
```
Browser (5175) 
  → AuthContext reads localStorage['auth-token']
  → Sets axios header: Authorization: Bearer <token>
  → Request ke Backend (8002)
  → Backend verify token ✅
  → Seeder jalan ✅
```

### Flow yang SALAH (Via Proxy 3001):
```
Browser (3001/upah/...)
  → Proxy sanitizes cookies (hapus auth-token)
  → Frontend tidak dapat token
  → Request ke Backend TANPA Authorization
  → Backend reject (401) ❌
  → Seeder gagal ❌
```

---

## Quick Test Command

Jalankan ini di browser console untuk quick test:

```javascript
// 1. Cek token
const token = localStorage.getItem('auth-token');
if (!token) {
  console.error('❌ No auth token! Login dulu di external system.');
} else {
  console.log('✅ Token found, length:', token.length);
  
  // 2. Test backend access
  fetch('http://localhost:8002/payroll/history/health', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(r => r.json())
  .then(data => {
    console.log('✅ Backend response:', data);
    console.log('✅ Token valid, seeder should work!');
  })
  .catch(err => {
    console.error('❌ Backend error:', err);
  });
}
```

---

## Summary

| Method | Status | Reason |
|--------|--------|--------|
| `http://localhost:3001/upah/...` | ❌ FAIL | Proxy hapus auth-token |
| `http://localhost:5175` | ✅ WORK | Direct access, token intact |
| `http://localhost:5173` | ✅ WORK | Direct access (dev mode) |

**Recommendation:** Gunakan `http://localhost:5175` untuk test seeder!
