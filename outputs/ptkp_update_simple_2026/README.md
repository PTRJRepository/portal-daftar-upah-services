# PTKP Update Simple 2026

Dataset ini adalah hasil parsing sederhana untuk kebutuhan update status PTKP.
Tidak ada cell dump besar; hanya identitas, PTKP, TER, status kesiapan, dan sumber baris Excel.

## Ringkasan

- Generated at: `2026-05-04T09:26:47`
- Source rows current 2026: 1610
- Update rows: 1598
- READY_NIK: 1594
- READY_NAME_FALLBACK: 2
- CONFLICT: 2, sudah diberi manual resolution `K/0` pada JSON update-ready.

## Cara Pakai

- Pakai `ptkp_update_ready_nik_only_2026.csv` untuk update otomatis berbasis NIK.
- Pakai `ptkp_update_ready_with_name_fallback_2026.csv` jika updater sudah mendukung fallback nama yang unik.
- Row `CONFLICT` hanya boleh ikut update kalau ada `resolved_ptkp_status`.
- Manual resolution saat ini ada di `ptkp_manual_resolutions_2026.csv`: dua conflict diputuskan menjadi `K/0`.

## Kolom Utama

- `update_status`: `READY_NIK`, `READY_NAME_FALLBACK`, atau `CONFLICT`.
- `match_key_type`: tipe lookup utama, `NIK` atau `NAME`.
- `match_key`: nilai lookup utama.
- `ptkp_status`: nilai PTKP final; kosong untuk konflik.
- `kategori_ter`: hasil derivasi dari PTKP.
- `sources`: asal file, sheet, row, dan nilai PTKP dari Excel.
