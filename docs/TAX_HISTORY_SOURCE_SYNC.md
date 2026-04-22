# Tax History Source Sync

## Tujuan

Dokumen ini menetapkan aturan source-of-truth untuk laporan pajak dan daftar upah agar mode `Origin DB` dan `History DB` tidak kembali tidak sinkron.

## Masalah yang Ditemukan

- Frontend sudah mengirim `use_history=true/false` ke endpoint tax report.
- Sebagian route backend masih membaca `use_history` secara tidak konsisten:
  - ada yang hanya menerima `"1"`
  - ada yang hanya menerima `"true"`
  - ada route tax report yang malah meng-hardcode `false`
- Akibatnya toggle sumber data di UI bisa terlihat aktif, tetapi backend tetap membaca source lain.

## Aturan Baru

### 1. Parser query boolean harus satu pintu

Gunakan helper `backend/src/utils/queryParsers.ts`:

```ts
parseBooleanQueryParam(value)
```

Perilaku:

- `"true"` / `"1"` -> `true`
- `"false"` / `"0"` -> `false`
- `undefined` / nilai lain -> `null`

### 2. Route yang wajib patuh ke `use_history`

Minimal endpoint berikut harus memakai parser yang sama:

- `/tax-report/monthly`
- `/tax-report/monthly/excel`
- `/tax-report/monthly/excel/fast`
- `/payroll/report/division-raw-tree`
- `/payroll/report`
- `/payroll/report-with-components`
- `/payroll/export/pajak`
- `/payroll/summary/*` yang menerima `use_history`

### 3. Default source harus eksplisit

- Route yang butuh fallback tri-state ke service memakai hasil parser apa adanya: `true | false | null`
- Route yang secara bisnis default ke origin/current DB harus memakai:

```ts
parseBooleanQueryParam(query.use_history) ?? false
```

Jangan hardcode `false` saat query sebenarnya sudah dikirim dari UI.

## Kontrak Data

### Origin DB

Dipakai untuk data live/current dan untuk periode yang memang belum disnapshot.

### History DB

Dipakai untuk snapshot hasil seeding. Data ini sah berbeda dari origin jika setelah proses seed terjadi:

- perubahan PTKP
- perubahan ADTRANS
- perubahan pendapatan lain
- edit manual payroll
- koreksi bisnis lain di source live

Perbedaan `history` vs `origin` bukan otomatis bug. Itu baru bug jika:

- UI toggle meminta history tetapi backend membaca origin
- export membaca source berbeda dari tampilan halaman yang sama
- query parser membuat nilai `true/false` frontend tidak terbaca

## Dampak Refactor Saat Ini

- backend punya parser `use_history` terpusat
- route tax report bulanan tidak lagi memaksa `false`
- route tax report progressive dan fast sekarang memakai resolver query bulanan yang sama
- route payroll dan summary memakai parsing boolean yang konsisten
- ada regression test untuk helper parser di `backend/src/utils/queryParsers.test.ts`
- progressive extractor kini bisa mengikuti source policy `history/origin`
- cleanup snapshot di `historySeederService` sekarang patuh ke policy `force + scoped division`, sehingga tidak lagi menghapus `aggregation_history` saat `force=false` atau saat scope terlalu lebar

## Langkah Bersih Berikutnya

- ekstrak selector source data dari route ke service kecil khusus `history/origin source policy`
- tambah integration test untuk progressive tax export saat `use_history=true`
- tambahkan route-level tests untuk endpoint tax report dan payroll export
- audit `taxReportService` agar prioritas `status_ptkp` vs master PTKP jelas dan terdokumentasi
