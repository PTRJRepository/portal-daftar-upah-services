# Index Dokumentasi Sistem Payroll & Laporan

Selamat datang di dokumentasi teknis sistem **Payroll Daftar Upah**. Dokumen ini dirancang untuk memberikan pemahaman mendalam tentang setiap komponen (service) yang ada di dalam codebase ini.

## Struktur Utama Proyek

Sistem ini terbagi menjadi beberapa blok besar:

1.  **[Frontend](./FRONTEND_SERVICE.md)**: Antarmuka pengguna berbasis React + Vite.
2.  **[Backend API](./BACKEND_SERVICE.md)**: Inti logika bisnis menggunakan Bun/Node.js + TypeScript.
3.  **[Arsitektur Database](./DATABASE_ARCHITECTURE.md)**: Ekosistem multi-database (Plantware, Extend, Mill, Venus).
4.  **[Service Agregasi Upah](./SERVICE_AGREGASI_UPAH.md)**: Layanan pemindahan data ke tabel ringkasan (Python).
5.  **[Layanan Pajak (PPh21)](./SERVICE_PAJAK.md)**: Kalkulator pajak sesuai aturan TER pemerintah.
6.  **[Service Comparison Report](./SERVICE_COMPARISON_REPORT.md)**: Analisis efisiensi biaya pabrik (Tonase vs Gaji).
7.  **[Query Gateway](./SERVICE_QUERY_GATEWAY.md)**: Jalur khusus pengambilan data database skala besar.
8.  **[Context Portal](./SERVICE_CONTEXT_PORTAL.md)**: Infrastruktur data pendukung untuk kecerdasan buatan (AI).
9.  **[Alur Kerja Pengguna](./USER_WORKFLOW.md)**: Panduan operasional dari persiapan hingga cetak laporan.
10. **[Deployment & Infra](./DEPLOYMENT.md)**: Panduan menjalankan sistem dengan Docker.
11. **[Development Utils](./DEV_UTILS.md)**: Kumpulan skrip bantuan, planning, dan tools developer.

---

## Peta Integrasi Service

Setiap service berkomunikasi melalui API atau koneksi database langsung:

-   **Frontend** memanggil **Backend API**.
-   **Backend API** menggunakan **DataExtractorService** untuk meramu data dari database Plantware.
-   **Service Agregasi** memanggil **Backend API** secara berkala (Seeding) untuk mengisi tabel riwayat di database EXTEND.
-   **Backend API** menggunakan **Service Pajak** setiap kali menghitung upah bersih.
-   **Seluruh Service Database** melewati **Query Gateway** untuk akses SQL Server yang aman.
