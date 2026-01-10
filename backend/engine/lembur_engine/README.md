# Lembur Engine - Overtime Payment Calculator

Modul perhitungan pembayaran lembur dengan arsitektur modular yang memisahkan engine, CLI, dan GUI.

## Quick Start

```bash
# Engine only (tanpa database)
python -m lembur_engine.cli --engine-only --hours 5 --day-type WORKDAY_LONG

# Full calculation (dengan database)
python -m lembur_engine.cli --empcode B0497 --month 11 --year 2025

# GUI
python -m lembur_engine.gui
```

## Architecture

```
lembur_engine/
├── __init__.py           # Package exports
├── config_loader.py      # Load UPJ dari config.json
├── models.py             # Data models (DayType, OvertimeRecord, etc.)
├── day_classifier.py     # Klasifikasi hari (kerja/minggu/libur)
├── rate_calculator.py    # Perhitungan rate bertingkat
├── db_service.py         # Query database (PR_TASKREGLN & HR_GPH)
├── lembur_calculator.py  # Orchestrator utama
├── cli.py                # Command-line interface
├── gui.py                # Tkinter GUI
└── query/                # SQL files
    ├── getLemburDetailEachEmp.sql
    └── getLemburDetailEachEmp_ARC.sql
```

## Rate Tables (3-Tier System)

### 1. Hari Kerja (Senin-Sabtu)

Tier 1 boundary: **1 jam**

| Tier | Rate | Keterangan |
|------|------|------------|
| Tier 1 | 1.5x | Jam 1 |
| Tier 2+ | 2.0x | Jam 2 dst |

**Contoh 5 jam**: 1×1.5 + 4×2 = 1.5 + 8 = **9.5** = UPJ × 9.5

---

### 2. Minggu / Libur Umum (Non-Keagamaan)

Tier 1 boundary: **5 jam** (Jumat) atau **7 jam** (hari lain)

| Tier | Rate | Keterangan |
|------|------|------------|
| Tier 1 | 2.0x | 0 s/d batas (5h atau 7h) |
| Tier 2 | 3.0x | 1 jam setelah batas |
| Tier 3 | 4.0x | Jam selebihnya |

**Contoh 10 jam (long day)**: 7×2 + 1×3 + 2×4 = 14+3+8 = **25**
**Contoh 10 jam (short/Jumat)**: 5×2 + 1×3 + 4×4 = 10+3+16 = **29**

---

### 3. Libur Keagamaan

Tier 1 boundary: **5 jam** (Jumat) atau **7 jam** (hari lain)

| Tier | Rate | Keterangan |
|------|------|------------|
| Tier 1 | 3.0x | 0 s/d batas (5h atau 7h) |
| Tier 2 | 4.0x | 1 jam setelah batas |
| Tier 3 | 4.0x | Jam selebihnya |

**Contoh 8 jam (long day)**: 7×3 + 1×4 = 21+4 = **25**
**Contoh 6 jam (short/Jumat)**: 5×3 + 1×4 = 15+4 = **19**

## Configuration

UPJ (Upah Per Jam) diambil dari `backend/config.json`:

```json
{
  "constants": {
    "upah_per_jam": {
      "dasar": 27387.55
    }
  }
}
```

## Database Tables

### Overtime Records
- Current month: `PR_TASKREGLN` + `PR_TASKREG`
- Previous months: `PR_TASKREGLN_ARC` + `PR_TASKREG_ARC`
- Filter: `OT = 1`

### Holiday Calendar
- Table: `HR_GPH`
- Filter: `Status = 1` (active)
- Religious: `IsRegionPH = 1`

## CLI Options

```
--engine-only       Engine only mode (no database)
--empcode, -e       Employee code
--month, -m         Month (1-12)
--year, -y          Year
--hours, -H         Overtime hours (engine-only mode)
--day-type, -d      Day type (engine-only mode)
--format, -f        Output format (table/json)
--db-profile        Database profile (local/remote/remote_2)
```

## Python API

```python
from lembur_engine import LemburCalculator

# Full calculation
with LemburCalculator() as calc:
    result = calc.calculate('B0497', 11, 2025)
    print(f"Total: Rp {result.total_payment:,.2f}")

# Engine only
from lembur_engine.lembur_calculator import quick_calculate
result = quick_calculate(5, "WORKDAY_LONG")
print(f"Total: Rp {result['total_amount']:,.2f}")
```
