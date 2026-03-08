# Service Query Gateway: SQL Gateway API

Layanan ini adalah "Jalur Pipa Data" (Data Pipeline) yang dirancang khusus untuk mengeksekusi query SQL yang berat ke beberapa server SQL Server sekaligus dengan aman.

## Lokasi: `Additional_services/query_gateway/`

## Fungsi Utama
- **Multi-Server Access**: Mengakses beberapa profil server (misal: Server Produksi `10.0.0.110` vs Server Secondary `10.0.0.2`).
- **Read-Only Enforcement**: Melindungi database penting dengan flag `readOnly: true` untuk mencegah perubahan data yang tidak sengaja.
- **Connection Pooling**: Mengelola antrian koneksi database agar tidak terjadi kemacetan (bottleneck).
- **Security Check**: Memblokir perintah SQL berbahaya seperti `DROP`, `TRUNCATE`, dan `ALTER`.

## Mekanisme Keamanan
Setiap request ke Gateway ini wajib menyertakan **API Key** khusus di header HTTP:
`x-api-key: [SECRET_KEY]`

---

## Profil Server (Server Profiles)

Sistem ini mendukung dua profil utama:
1.  **SERVER_PROFILE_1 (10.0.0.110)**: Server utama dengan akses penuh (Read/Write) untuk database agregasi.
2.  **SERVER_PROFILE_2 (10.0.0.2)**: Server sekunder dengan akses **Read-Only** (Hanya SELECT).

## Contoh Cara Kerja
Jika Backend membutuhkan data dari tabel timbangan yang ada di server berbeda, Backend tidak membuka koneksi baru sendiri, melainkan memanggil Gateway ini:
1.  Backend kirim Query SQL + API Key.
2.  Gateway cek apakah query aman (tidak ada `DROP`).
3.  Gateway eksekusi ke SQL Server tujuan.
4.  Hasil dikembalikan dalam format JSON yang rapi.

---

## Keuntungan Menggunakan Gateway
- **Satu Pintu**: Semua query SQL ke database luar terpusat di sini.
- **Keamanan Berlapis**: Database asli tidak terpapar langsung ke internet/jaringan luar tanpa melalui validasi Gateway.
- **Efisiensi**: Mengurangi beban koneksi langsung ke SQL Server utama.
