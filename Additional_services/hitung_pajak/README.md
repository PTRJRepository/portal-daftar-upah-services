# Kalkulator Pajak PPh21 TER

Aplikasi GUI sederhana untuk menghitung Pajak PPh21 menggunakan metode Tarif Efektif Rata-rata (TER) berdasarkan PP 58 Tahun 2023.

## Cara Menjalankan

### Windows (Recommended)
Klik dua kali file `run_calculator.bat`

### Manual
```bash
python pajak_calculator_gui.py
```

## Fitur

### 1. Tab Kalkulator
- Input data karyawan (nama, penghasilan bruto, status PTKP)
- Hitung PPh21 secara real-time
- Lihat detail perhitungan dengan breakdown

### 2. Tab Data Sampel
- Daftar karyawan sampel dengan perhitungan yang sudah valid
- Klik dua kali untuk memuat data ke kalkulator

### 3. Tab Info TER
- Penjelasan metode TER
- Referensi tarif dan kategori
- Contoh perhitungan

## Status PTKP yang Didukung

| Status | Kategori TER | Keterangan |
|--------|--------------|------------|
| TK/0   | TER A        | Tidak Kawin, 0 tanggungan |
| TK/1   | TER A        | Tidak Kawin, 1 tanggungan |
| TK/2   | TER B        | Tidak Kawin, 2 tanggungan |
| TK/3   | TER B        | Tidak Kawin, 3 tanggungan |
| K/0    | TER A        | Kawin, 0 tanggungan |
| K/1    | TER B        | Kawin, 1 tanggungan |
| K/2    | TER B        | Kawin, 2 tanggungan |
| K/3    | TER C        | Kawin, 3 tanggungan |

## Rumus Perhitungan

```
PPh21 = Penghasilan Bruto × Tarif TER
```

Tarif TER ditentukan berdasarkan:
1. **Kategori TER** (dari status PTKP)
2. **Besar Penghasilan Bruto**

## Contoh Perhitungan

### Contoh 1: ARDIYANSA (TK/0 → TER A)
- Penghasilan Bruto: Rp 5.900.240
- Tarif: 0,50%
- **PPh21 = Rp 29.501**

### Contoh 2: AMRIL (K/1 → TER B)
- Penghasilan Bruto: Rp 8.318.695
- Tarif: 1,00%
- **PPh21 = Rp 83.187**

## File Pendukung

- `rule_TER_pajak.json` - Data tarif TER lengkap
- `sample.json` - Data sampel karyawan untuk testing
- `pph21_ter_logic.py` - Core logic (versi command line)

## Requirement

- Python 3.7 atau lebih tinggi
- Tkinter (biasanya sudah include dengan Python)

## Troubleshooting

### "Python is not installed"
Install Python dari https://python.org dan pastikan centang "Add Python to PATH"

### "ModuleNotFoundError"
Pastikan tidak perlu install library tambahan, aplikasi menggunakan standard library Python (tkinter, json)

## Screenshot Layout

```
┌─────────────────────────────────────────────────────────────┐
│  KALKULATOR PPh21 - METODE TER                              │
├─────────────────────────────────────────────────────────────┤
│  Input Data                                                  │
│  Nama Karyawan    : [________________]                       │
│  Penghasilan Bruto: [__________] (contoh: 6000000)          │
│  Status PTKP      : [TK/0 ▼]                                │
│  [HITUNG PAJAK]                                              │
├─────────────────────────────────────────────────────────────┤
│  Hasil Perhitungan                                          │
│  PPh21 Terutang: Rp 29.501                                  │
│  Nama: ARDIYANSA                                            │
│  Bruto: Rp 5.900.240                                        │
│  PTKP: TK/0 → TER A                                         │
│  Tarif: 0,50%                                               │
├─────────────────────────────────────────────────────────────┤
│  Detail Perhitungan                                         │
│  PPh21 = 5.900.240 × 0.0050 = 29.501                        │
└─────────────────────────────────────────────────────────────┘
```

---

© 2025 - PT Rebinmas Payroll System
