# Attendance Matrix Display Modes Design

## Goal

Perbaiki matrix absensi agar:
- bisa discroll sampai baris paling bawah
- tidak menampilkan kolom alamat
- punya mode tampilan `Status` dan `Amount`
- hari `kurang jam` menampilkan jam kerja aktual agar warning lebih informatif

## Current Problems

`GangAttendanceMatrix` masih menyimpan layout lama:
- container scroll vertikal berada di flex layout yang tidak cukup eksplisit untuk tinggi minimum, sehingga area bawah bisa terpotong
- kolom `Alamat` membuat sticky width lebih lebar dari yang dibutuhkan
- cell `kurang jam` hanya menampilkan label warning generik
- tidak ada mode terpisah untuk melihat nominal `amount`

## Proposed Design

### Layout

- Jadikan `gam-inline-container` dan `gam-content` aman untuk flex scrolling dengan `min-height: 0`
- Pindahkan tanggung jawab scroll ke satu area isi utama dan pertahankan scroll horizontal di wrapper tabel
- Hapus kolom `Alamat` dari header, body, sticky offsets, dan print layout

### Display Modes

- Tambahkan state `displayMode` dengan nilai `status` dan `amount`
- Tambahkan toggle kecil di header matrix

### Cell Rendering

- Mode `status`
  - tampilkan status biasa (`H`, `C`, `S`, dst.)
  - untuk `kurang jam`, tampilkan jam aktual, misalnya `5j` atau `4.5j`
  - untuk `kurang HK`, tetap tampilkan `HK!`
- Mode `amount`
  - tampilkan nominal harian ringkas, misalnya `45k`
  - warning `kurang jam` dan `kurang HK` tetap memakai warna background yang sama
  - jika tidak ada amount, fallback ke status default

### Testing

- Tambahkan regresi test untuk memastikan:
  - toggle `Amount` menampilkan nominal
  - hari `kurang jam` di mode default menampilkan jam
  - kolom `Alamat` tidak lagi dirender
  - CSS render mengandung guard scroll `min-height: 0`
