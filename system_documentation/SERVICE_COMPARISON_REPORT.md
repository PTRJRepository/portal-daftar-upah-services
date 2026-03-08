# Service Comparison Summary (Ton vs Mill)

Layanan ini adalah modul pelaporan khusus yang dirancang untuk menganalisis efisiensi biaya pabrik (Mill) dengan membandingkan total upah yang dibayarkan terhadap jumlah tonase TBS (Tandan Buah Segar) yang diolah.

## Lokasi: `Additional_services/create_comparison_summary_ton_mill/`

## Fungsi Utama
- **Penghitungan HK Spesifik Pabrik**: Menghitung total Hari Kerja (HK) dengan rumus: `(Total Karyawan × Jumlah Hari Sebulan) - (Mangkir + Cuti Tanpa Upah + Sakit dengan Surat)`.
- **Integrasi Database VenusHR14**: Mengambil data absensi dari tabel `HR_T_PYWeekly_M` milik sistem SDM pihak ketiga (Venus).
- **Pembandingan Biaya**: Menghubungkan total gaji yang dihitung oleh Backend API dengan hasil timbangan di `db_ptrj_mill`.

## File Kunci & Logika SQL

### 1. `getTotalHKMill.sql`
Digunakan untuk menghitung sisa Hari Kerja (HK) efektif setelah dikurangi absensi. Ini memastikan bahwa anggaran upah dihitung secara akurat berdasarkan siapa yang benar-benar bekerja.

### 2. `getTotalSallaryMill.sql`
Mengambil data gaji total untuk divisi pabrik guna dibandingkan dengan hasil produksi.

---

## Alur Kerja Laporan
1.  **Extract**: Mengambil total berat TBS dari database timbangan.
2.  **Calculate HK**: Menggunakan query `getTotalHKMill.sql` untuk mendapatkan total HK karyawan pabrik bulan berjalan.
3.  **Merge**: Menggabungkan data produksi (Ton) dengan data biaya (Upah).
4.  **Analyze**: Menghasilkan metrik seperti "Biaya Upah per Ton" (Cost per Ton).

## Mengapa Layanan Ini Terpisah?
Karena pabrik (Mill PKS) memiliki jam kerja dan aturan lembur yang berbeda dengan pekerja lapangan di kebun, pemisahan ini memudahkan pengembang untuk mengubah aturan khusus pabrik tanpa mengganggu logika payroll utama di kebun.
