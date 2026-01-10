# Ringkasan Query EmpCode dan GangCode per Divisi

## File Query yang Telah Dibuat

### 1. `get_empcode_gangcode_by_divisi.sql`
```sql
-- Query untuk mendapatkan EmpCode dan GangCode dalam satu divisi
-- Digunakan untuk mendapatkan data karyawan dan gang berdasarkan divisi tertentu

SELECT
    e."EmpCode",
    g."GangCode"
FROM "HR_EMPLOYEE" e
JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
WHERE UPPER(g."GangCode") LIKE UPPER(? || '%')  -- Parameter: divisi prefix (misal: 'A', 'B', 'C', dll)
ORDER BY g."GangCode", e."EmpCode";
```

### 2. `get_emp_gang_by_divisi_detailed.sql`
```sql
-- Query untuk mendapatkan EmpCode, EmpName, LocCode, dan GangCode dalam satu divisi
-- Digunakan untuk mendapatkan data lengkap karyawan dan gang berdasarkan divisi tertentu
-- Berdasarkan hasil debugging, tidak menggunakan filter status karena tidak ada status 'A'

SELECT 
    e."EmpCode",
    e."EmpName",
    e."LocCode",
    g."GangCode"
FROM "HR_EMPLOYEE" e
INNER JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
WHERE UPPER(g."GangCode") LIKE UPPER(? || '%')  -- Parameter: divisi prefix (misal: 'A', 'B', 'C', dll)
ORDER BY g."GangCode", e."EmpCode";
```

## Hasil Pengujian
- Koneksi database: ✅ Berhasil
- Query dasar: ✅ Berhasil, mendapatkan 205 hasil untuk divisi 'A'
- Query detail: ✅ Berhasil, mendapatkan 205 hasil untuk divisi 'A'
- Data yang ditemukan: EmpCode, Nama Karyawan, LocCode, dan GangCode

## Contoh Hasil untuk Divisi A (PG1A):
- EmpCode: A0039, Nama: NANO ( SUTIYEM ), LocCode: P1A, Gang: A1H
- EmpCode: A0187, Nama: SUHAYAT ( ZALIAH ), LocCode: P1A, Gang: A1H
- dll.

## Parameter Query
- Gunakan `?` sebagai placeholder untuk prefix divisi (misal: 'A', 'B', 'C')
- Query mendukung pencarian berdasarkan prefix GangCode

## Struktur Tabel
- Tabel `HR_EMPLOYEE` berisi: "EmpCode", "EmpName", "LocCode", "Status"
- Tabel `HR_GANGLN` berisi: "GangCode", "GangMember"
- Join dilakukan antara `HR_GANGLN."GangMember"` dan `HR_EMPLOYEE."EmpCode"`