# Service Context Portal

Layanan ini adalah "Memori Arsitektur" dari sistem yang bertugas mengelola sejarah perubahan database (Migration) dan menyediakan data konteks untuk asisten AI.

## Lokasi: `context_portal/`

## Teknologi Utama
- **ORM**: SQLAlchemy (Python).
- **Migration Tool**: Alembic (untuk melacak perubahan tabel secara versi per versi).
- **Context Storage**: `conport_vector_data/` (Penyimpanan data vektor untuk asisten cerdas).

## Komponen Kunci

### 1. `alembic/` (Database Versioning)
Tempat semua skrip perubahan database disimpan. Setiap ada penambahan kolom atau tabel baru, dibuatlah file "Migration" baru di sini. Ini memastikan bahwa struktur database di server produksi sama persis dengan yang ada di komputer developer.
- `alembic.ini`: Konfigurasi koneksi database untuk proses migrasi.
- `env.py`: Skrip penghubung antara Alembic dengan model database SQLAlchemy.

### 2. `conport_vector_data/` (AI Memory)
Folder ini menyimpan file-file hasil ekstraksi pengetahuan tentang sistem.
- **Tujuan**: Memungkinkan asisten AI (seperti Gemini atau Claude) untuk "mengingat" struktur kode dan aturan bisnis yang rumit tanpa harus membaca ulang ribuan baris kode setiap saat.

---

## Alur Kerja Migrasi
1.  **Modify**: Developer mengubah model tabel di Python.
2.  **Generate**: Menjalankan perintah `alembic revision --autogenerate`.
3.  **Upgrade**: Menjalankan `alembic upgrade head` untuk menerapkan perubahan ke SQL Server.

---

## Mengapa Layanan Ini Penting?
Tanpa Context Portal, pengembang akan kesulitan melacak perubahan tabel di database. Layanan ini memastikan integritas data tetap terjaga meskipun aplikasi terus berkembang dengan banyak versi.
