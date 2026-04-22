# Frontend-Backend Consistency Audit

Tanggal: 2026-04-22

## Tujuan

Menjadikan backend sebagai single source of truth untuk seluruh nilai payroll (termasuk subtotal dan grand total), agar hasil di semua halaman konsisten.

## Temuan Prioritas Tinggi

1. Daftar Upah stream sebelumnya memakai kalkulator total khusus di route SSE.
- File: `backend/src/api/payroll.ts`
- Risiko: grand total/gang total stream bisa beda dengan endpoint non-stream karena rumus berbeda.
- Status: diperbaiki, stream sekarang memakai `calculatePayrollTotals` yang sama dengan endpoint lain.

2. Kontrak source `use_history` belum merata di jalur stream.
- File: `backend/src/api/payroll.ts`, `frontend/src/hooks/usePayrollStream.js`
- Risiko: tabel stream bisa baca origin saat halaman lain baca history.
- Status: diperbaiki, stream endpoint menerima `use_history` dan hook selalu kirim `true/false`.

3. Fallback Daftar Upah masih menghitung total di frontend.
- File: `frontend/src/components/CustomPayrollTable.jsx`
- Risiko: nilai gang/grand total beda dengan API.
- Status: diperbaiki, total gang/grand total sekarang diambil dari payload backend, bukan hitung ulang frontend.

## Hotspot Perlu Refactor Lanjutan

1. Summary page masih banyak `reduce()` untuk subtotal/grand total di client.
- File: `frontend/src/pages/WagesSummaryRebinmasPage.jsx`
- File: `frontend/src/pages/WagesSummaryIJLPage.jsx`
- Dampak: rawan mismatch jika rumus backend berubah.
- Status update: **selesai** pada batch ini.
- Detail:
- Backend `/payroll/summary/all-divisions` dan `/payroll/summary/comparison` sekarang mendukung `scope=all|rebinmas|ijl`.
- Backend sekarang mengembalikan `kpi_totals`, `group_subtotals`, `grand_total`, `premi_breakdown_current` langsung dari API.
- Frontend Rebinmas dan IJL sudah berhenti hitung subtotal/grand total via `reduce()`; page hanya render nilai dari backend.

2. Tax matrix dan report analitik masih melakukan agregasi angka di UI.
- File: `frontend/src/components/PayrollTaxMatrix.jsx`
- File: `frontend/src/pages/AnalysisReportPage.jsx`
- Dampak: inkonsistensi antar tampilan vs export/API.

3. Util agregasi frontend masih tersedia dan bisa dipakai ulang tanpa sadar.
- File: `frontend/src/utils/aggregationUtils.js`
- File: `frontend/src/utils/PayrollAggregator.js`
- Dampak: regresi konsistensi jika dipakai di halaman baru.

## Arah Implementasi Berikutnya

1. Tambah payload backend `subtotals_by_group` dan `grand_total` untuk endpoint summary/analysis, lalu hapus `reduce()` utama di frontend.
2. Standarisasi response contract:
- `rows`: baris data display
- `group_totals`: map total per gang/divisi
- `grand_total`: total akhir halaman
- `meta.source_mode`: `origin|history`
3. Tambah regression test contract di backend:
- endpoint stream vs non-stream harus menghasilkan grand total yang sama untuk filter yang sama.
