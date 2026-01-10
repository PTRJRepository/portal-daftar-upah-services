# Query untuk Mendapatkan EmpCode dan GangCode dalam Satu Divisi

## Query Utama (Sudah Dites di Backend)

### Query Dasar - EmpCode dan GangCode
```sql
SELECT
    e."EmpCode",
    g."GangCode"
FROM "HR_EMPLOYEE" e
JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
WHERE UPPER(g."GangCode") LIKE UPPER(? || '%')  -- Parameter divisi diisi di sini
ORDER BY g."GangCode", e."EmpCode";
```

### Query Detail - EmpCode, Nama, LocCode dan GangCode
```sql
SELECT
    e."EmpCode",
    e."EmpName",
    e."LocCode",
    g."GangCode"
FROM "HR_EMPLOYEE" e
INNER JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
WHERE UPPER(g."GangCode") LIKE UPPER(? || '%')  -- Parameter divisi diisi di sini
ORDER BY g."GangCode", e."EmpCode";
```

## Hasil Pengujian
- Koneksi database: ✅ Berhasil
- Query dasar: ✅ Berhasil, mendapatkan 205 hasil untuk divisi 'A'
- Query detail: ✅ Berhasil, mendapatkan 205 hasil untuk divisi 'A'

## Catatan Penting Berdasarkan Pengujian
- Tabel menggunakan format `"NamaKolom"` dengan tanda petik ganda
- Tidak ada karyawan dengan status 'A' dalam database (semua query dengan WHERE Status='A' mengembalikan 0 hasil)
- Join antara `"HR_EMPLOYEE"` dan `"HR_GANGLN"` berhasil
- Data yang ditemukan: EmpCode (dengan padding spasi), Nama Karyawan (dalam format "NAMA (PANGGILAN)"), LocCode, dan GangCode

## Contoh Hasil untuk Divisi A (PG1A):
- EmpCode: A0039, Nama: NANO ( SUTIYEM ), LocCode: P1A, Gang: A1H
- EmpCode: A0187, Nama: SUHAYAT ( ZALIAH ), LocCode: P1A, Gang: A1H
- EmpCode: A0191, Nama: YULIANTO ( NUNI ), LocCode: P1A, Gang: A1H

## Query untuk Divisi Tertentu
Berikut beberapa query untuk divisi-divisi yang terdeteksi dalam sistem:

### Divisi A (PG1A)
```sql
SELECT
    e."EmpCode",
    g."GangCode"
FROM "HR_EMPLOYEE" e
JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
WHERE UPPER(g."GangCode") LIKE UPPER('A%')
ORDER BY g."GangCode", e."EmpCode";
```

### Divisi B (PG1B)
```sql
SELECT
    e."EmpCode",
    g."GangCode"
FROM "HR_EMPLOYEE" e
JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
WHERE UPPER(g."GangCode") LIKE UPPER('B%')
ORDER BY g."GangCode", e."EmpCode";
```

### Divisi C (PG2A)
```sql
SELECT
    e."EmpCode",
    g."GangCode"
FROM "HR_EMPLOYEE" e
JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
WHERE UPPER(g."GangCode") LIKE UPPER('C%')
ORDER BY g."GangCode", e."EmpCode";
```

### Divisi D (PG2B)
```sql
SELECT
    e."EmpCode",
    g."GangCode"
FROM "HR_EMPLOYEE" e
JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
WHERE UPPER(g."GangCode") LIKE UPPER('D%')
ORDER BY g."GangCode", e."EmpCode";
```

## Mapping Divisi Berdasarkan Prefix GangCode
Berdasarkan konfigurasi dalam kode sistem:

- **PG1A**: `A%` (GangCode dengan awalan A)
- **PG1B**: `B%` (GangCode dengan awalan B)
- **PG2A**: `C%` (GangCode dengan awalan C)
- **PG2B**: `D%` (GangCode dengan awalan D)
- **DME**: `E%` (GangCode dengan awalan E)
- **ARA**: `F%` (GangCode dengan awalan F)
- **ARB1**: `G%` (GangCode dengan awalan G)
- **ARB2**: `H%` (GangCode dengan awalan H)
- **INFRA**: `I%` (GangCode dengan awalan I)
- **AREC**: `J%` (GangCode dengan awalan J)
- **IJL**: `IJL%` (GangCode dengan awalan IJL)
- **STF-OFFICE**: `STF%` (GangCode dengan awalan STF)
- **SECURITY**: `SEC%` (GangCode dengan awalan SEC)

## Catatan Teknis
- Tabel `HR_EMPLOYEE` berisi data karyawan ("EmpCode", "EmpName", "LocCode", "Status")
- Tabel `HR_GANGLN` berisi hubungan antara karyawan dan gang ("GangCode", "GangMember")
- Join dilakukan melalui field `"GangMember" = "EmpCode"`
- Format kolom menggunakan tanda petik ganda ("NamaKolom")
- Data hasil pengujian menunjukkan bahwa tidak semua karyawan memiliki status 'A' (aktif)