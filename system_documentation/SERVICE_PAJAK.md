# Service Pajak (PPh21 TER)

Layanan ini adalah spesialis perhitungan pajak penghasilan karyawan (PPh21) menggunakan metode TER (Tarif Efektif Rata-rata) sesuai regulasi perpajakan Indonesia terbaru.

## Lokasi: `Additional_services/hitung_pajak/` & `backend/src/services/pph21TerService.ts`

## Komponen Utama

### 1. `rule_TER_pajak.json` (Aturan Perpajakan)
File ini adalah "database aturan" yang berisi layer tarif pajak:
- **Kategori A**: Untuk status PTKP (TK/0, TK/1, K/0).
- **Kategori B**: Untuk status PTKP (TK/2, TK/3, K/1, K/2).
- **Kategori C**: Untuk status PTKP (K/3).

Setiap kategori memiliki rentang penghasilan bruto (Minimal - Maksimal) dan tarif persentase yang sesuai.

### 2. `pph21TerService.ts` (Implementasi di Backend)
Fungsi utama yang memproses data karyawan:
- **`calculatePenghasilanBruto`**: Menggabungkan gaji pokok, tunjangan, lembur, premi, dan iuran BPJS (porsi majikan) untuk mendapatkan angka dasar pengenaan pajak.
- **`calculatePph21Ter`**: Mencari tarif yang sesuai di file JSON dan menghitung nilai rupiah pajaknya.

---

## Rumus Bruto Pajak
Pajak dihitung berdasarkan penghasilan bruto yang mencakup:
1. Gaji Pokok Aktual (Berdasarkan HK)
2. Tunjangan Beras + Jabatan + Masa Kerja
3. Total Lembur (Rupiah)
4. Total Premi (Rupiah)
5. **ASTEK/Jamsostek (Porsi Majikan 0.84%)**
6. **BPJS Kesehatan (Porsi Majikan 4%)**

**Formula**:
`Pajak = Bruto Pajak × Tarif TER`

---

## Keuntungan Metode Ini
- **Akurasi Tinggi**: Mengikuti aturan terbaru secara dinamis (cukup edit JSON jika aturan pemerintah berubah).
- **Integrasi Mudah**: Dipanggil otomatis oleh Backend setiap kali menghitung `upah_bersih`.
- **Transparan**: Admin bisa melihat kategori TER mana yang diterapkan pada setiap karyawan di laporan.
