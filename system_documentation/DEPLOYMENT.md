# Deployment & Infrastruktur (Production)

Dokumen ini menjelaskan bagaimana menjalankan sistem ini di server menggunakan **Docker** dan konfigurasi jaringan yang diperlukan.

## Lokasi File: `docker-compose.yml`, `frontend/Dockerfile`

## Strategi Kontainerisasi (Docker)
Sistem ini menggunakan **Docker Compose** untuk menjalankan dua layanan utama secara bersamaan:

1.  **Backend (API Service)**:
    - **Port**: `8000` (atau `8002` tergantung konfigurasi `.env`).
    - **Fungsi**: Menangani logika bisnis dan koneksi database MSSQL.
2.  **Frontend (UI Service)**:
    - **Port**: `5173` (Vite Default).
    - **Dependensi**: Layanan Frontend tidak akan berjalan sebelum Backend siap (`depends_on: backend`).

## Langkah-langkah Menjalankan Sistem
1.  Pastikan Docker & Docker Compose sudah terinstal di server.
2.  Pastikan file `.env` sudah dikonfigurasi dengan benar (terutama `BACKEND_HOST` dan `DB_PASSWORD`).
3.  Jalankan perintah:
    ```bash
    docker-compose up --build -d
    ```
4.  Akses sistem melalui browser: `http://[IP-SERVER]:5173`.

---

## Konfigurasi Jaringan (Network)
Sistem ini dirancang untuk bekerja dalam jaringan lokal perusahaan agar bisa mengakses SQL Server internal:
- **Server Produksi**: Biasanya diakses melalui IP `10.0.0.110` atau `10.0.0.2`.
- **Koneksi Database**: Menggunakan protokol TCP/IP standar MSSQL (Port `1433` atau `1888`).

## Pemeliharaan (Maintenance)
- **Log**: Anda bisa mengecek log aplikasi jika terjadi error dengan perintah:
  ```bash
  docker-compose logs -f backend
  ```
- **Update**: Untuk memperbarui kode, lakukan `git pull` lalu jalankan `docker-compose up --build -d` kembali.

---

## Catatan Penting
- **Penyimpanan (Volume)**: Pastikan folder `backend/logs` di-mount ke host agar log tidak hilang saat kontainer di-restart.
- **Node Modules**: Jika dijalankan tanpa Docker (menggunakan Bun), gunakan `bun install` di masing-masing folder (backend & frontend).
