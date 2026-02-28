# Daftar Divisi Lengkap - PT Rebinmas

## Sumber Data
Data ini diambil dari tabel `[dbo].[Divisi_Description]` di database `extend_db_ptrj` dan file `backend/data/area_produktif.json`.

---

## Real Divisions (Divisi Riil dari Database)

| No | Kode | Deskripsi | Luas Hektar | Prefix Gang |
|----|------|-----------|-------------|-------------|
| 1 | **P1A** | Parit Gunung 1A | 1,188.85 | A |
| 2 | **P1B** | Parit Gunung 1B | 61.83 | B |
| 3 | **P2A** | Parit Gunung 2A | 1,491.97 | C |
| 4 | **P2B** | Parit Gunung 2B | 982.11 | D |
| 5 | **DME** | KEBUN DME | 1,518.88 | E |
| 6 | **ARA** | KEBUN ARA | 1,158.20 | F |
| 7 | **AB1** | Air Ruak B1 | 1,210.10 | G |
| 8 | **AB2** | Air Ruak B2 | 1,056.13 | - |
| 9 | **ARC** | Air Ruak RC | 1,824.94 | - |
| 10 | **IJL** | KEBUN IJL | 0.00 | L |
| 11 | **INF** | INFRASTRUKTUR | 0.00 | I |
| 12 | **NRS** | NURSERY | 0.00 | - |
| 13 | **MILL** | MILL PKS | 0.00 | - |
| 14 | **PGE** | Parit Gunung Estate | 0.00 | - |
| 15 | **WKS** | WORKSHOP | 0.00 | - |

---

## Virtual Divisions (Divisi Virtual)

| No | Kode | Deskripsi | Sumber / Pola |
|----|------|-----------|---------------|
| 16 | **WKS_PG** | WORKSHOP PARIT GUNUNG | Dynamic (description pattern: workshop + parit/PGE/P.G) |
| 17 | **WKS_AR** | WORKSHOP AIR RUAK | Dynamic (description pattern: workshop + Air Ruak/ARE/A.R) |

---

## Keterangan Tambahan

### Mapping Kode Divisi ke Gang
- **P1A** → Gang prefix: A (A1H, A2H, A1M, dll)
- **P1B** → Gang prefix: B (B1H, B2H, B1M, dll)
- **P2A** → Gang prefix: C (C1H, C2H, C1M, dll)
- **P2B** → Gang prefix: D (D1H, D2H, D1M, dll)
- **DME** → Gang prefix: E (E1H, E2H, dll)
- **ARA** → Gang prefix: F (F1H, F2H, dll)
- **AB1/ARB1** → Gang prefix: G (G1H, G2H, dll)
- **AB2/ARB2** → Gang prefix: H (H1H, H1M, dll)
- **INFRA/INF** → Gang prefix: I (I1H, I2H, dll)
- **AREC** → Gang prefix: J (J1H, J2H, dll)
- **IJL** → Gang prefix: L (L1H, L2H, dll)
- **STF-OFFICE** → Gang prefix: O (O1H, O2H, dll)
- **SECURITY** → Gang prefix: SEC (SEC001, SEC002, dll)

### Alias yang Digunakan
| Alias | Kode Resolusi |
|-------|---------------|
| INFRA | INF |
| NURSERY | NRS |
| PG1A | P1A |
| PG1B | P1B |
| PG2A | P2A |
| PG2B | P2B |

### Catatan Penting
1. **PG** = Parit Gunung (bukan Plantation Group)
2. **AR** = Air Ruak (bukan Arbei)
3. **DME** = KEBUN DME (perlu konfirmasi kepanjangan dari database)
4. **ARA** = KEBUN ARA
5. **AB1/AB2** = Air Ruak B1/B2 (juga dikenal sebagai ARB1/ARB2)
6. **ARC** = Air Ruak RC
7. **PGE** = Parit Gunung Estate (divisi general/umum)
8. **WKS** = Workshop (umum)
9. **WKS_PG** = Workshop Parit Gunung (virtual division)
10. **WKS_AR** = Workshop Air Ruak (virtual division)

---

## Total Divisi
- **Real Divisions**: 15 divisi
- **Virtual Divisions**: 2 divisi
- **Grand Total**: **17 divisi**

---

## File Referensi
- `backend/data/area_produktif.json` - Data luas area dan deskripsi
- `backend/src/services/divisionDefinition.ts` - Definisi virtual division
- `Additional_services/create_aggregation_upah/setup_divisi_description.py` - Script seeding deskripsi divisi
- Database: `extend_db_ptrj` → Tabel: `[dbo].[Divisi_Description]`
