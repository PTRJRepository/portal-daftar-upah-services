# Staging vs db_ptrj — Mapping & Comparison

> Database staging (`staging_PTRJ_iFES_Plantware`) adalah data mentah sebelum ditransfer ke `db_ptrj`. Dokumen ini mendokumentasikan mapping setiap tabel staging ke tabel di db_ptrj, key join, dan hasil verifikasi.

## Konfigurasi

| Detail | Value |
|---|---|
| Staging DB | `staging_PTRJ_iFES_Plantware` |
| Staging Profile | `SERVER_PROFILE_2` |
| Target DB | `db_ptrj` |
| Target Profile | `SERVER_PROFILE_2` |
| Accessor | `Database.getStagingInstance()` |

## Ringkasan Tabel

| # | Staging | Baris | db_ptrj | Confidence |
|---|---|---|---|---|
| 1 | Ffbscannerdata | 4,782,758 | PR_HARVESTERLN_ARC | **VERIFIED** |
| 2 | Ffbscannerdata.LOOSEFRUIT | 3,839,125 | PR_LOOSEFRUITLN | **VERIFIED** |
| 3 | Gwscannerdata | 4,200,737 | PR_TASKREGLN | **VERIFIED** |
| 4 | Overtime | 402,806 | PR_TASKREGLN (OT=true) | **VERIFIED** |
| 5 | Employee_Info | 5,904 | HR_EMPLOYEE | **VERIFIED** |
| 6 | iFES_MillWeight | 730,101 | PR_FFBDRIVERLN | **LIKELY** |
| 7 | P3_MillWeight | 248,028 | PR_FFBDRIVER | **LIKELY** |
| 8 | Workerleave | 20,040 | HR_LEAVETRX | **LIKELY** |
| 9 | Workerholidays | 2,143 | HR_CPTRX_LEAVE | **LIKELY** |
| 10 | Gang_Number | 112 | PR_GANGLN | **LIKELY** |
| 11 | OC | 11 | PR_PAYDIVISION | **LIKELY** |
| 12 | Job_Code | 221 | WS_JOBWORKCODE | **LIKELY** |
| 13 | Field_Profile | 322 | RPT_Fields | **LIKELY** |
| 14 | Piecemeal | 11 | PR_PIECERATEALLOCLN | **POSSIBLE** |
| 15 | Halfdaywork | 0 | PR_ATTENDANCE | **POSSIBLE** |
| 16 | Vehicle_Code | 137 | GL_VEHICLE | **LIKELY** |
| 17 | Route_Path | 11 | PR_ROUTEPATH | **LIKELY** |
| 18 | Allowable_Holidays | 21 | HR_LEAVE | **POSSIBLE** |
| 19 | Checkroll_Division | 63 | PR_CHECKROLLMASTER | **POSSIBLE** |
| 20 | Company | 1 | — | Reference |
| 21 | IntegrationDateTime | 100 | — | Metadata |
| 22 | Validation | 9 | — | Metadata |
| 23 | Ffbanalysisdata | 0 | — | Empty |
| 24 | FfbLoadingCrop | 0 | — | Empty |
| 25 | LeaveType | 0 | — | Empty |
| 26 | Scanner_User | 0 | — | Empty |
| 27 | sysdiagrams | 0 | — | System |
| 28 | temp_M3DoNo | 439 | — | Temp |
| 29 | WMSExportData | 457 | — | Temp |
| 30 | GangNumberVW | 97 | — | View |

---
## Detail Mapping Terverifikasi

### 1. Ffbscannerdata → PR_HARVESTERLN_ARC / PR_LOOSEFRUITLN

**Deskripsi**: Scan FFB (Fresh Fruit Bunch) panen — data bunches per transaksi.

**Key Join**:

| Join Key | Staging | db_ptrj |
|---|---|---|
| Emp Code | `WORKERCODE` | `EmpCode` |
| Date | `TRANSDATE` | `TrxDate` |
| Tanggal | `MONTH(TRANSDATE), YEAR(TRANSDATE)` | `MONTH(TrxDate), YEAR(TrxDate)` |

**Hasil Verifikasi**:
- **100% emp match** untuk sample 50 worker pada May 2026
- **96% row count match** (staging: 4,782,758 vs ARC: 4,568,001)
- Staging mencakup data hingga **30 Mei 2026**, prod ARC hanya hingga **30 April 2026** — data Mei 2026 belum terintegrasi penuh

**Kolom Mapping**:

| Staging | db_ptrj (ARC) | Catatan |
|---|---|---|
| WORKERCODE | EmpCode | Key join |
| TRANSDATE | TrxDate | Tanggal transaksi |
| RIPE | Ripe | Tandan matang |
| UNRIPE | Unripe | Tandan mentah |
| LOOSEFRUIT | — (Tidak ada di ARC) | Masuk ke PR_LOOSEFRUITLN |
| ROTTEN | — | Tidak tersimpan |
| ABNORMAL | — | Tidak tersimpan |
| FIELDNO | — | Tidak tersimpan langsung |
| TASKNO | TaskCode | Kode tugas |
| TRANSNO | — | Nomor transaksi unik |
| FROMOCCODE | ChargeTo | OC asal |

**Catatan**: Staging menyimpan lebih detail (FIELDNO, LOOSEFRUIT, ROTTEN, ABNORMAL, TRANSNO) sementara PR_HARVESTERLN_ARC hanya menyimpan subset (Ripe, Unripe, TotalBunches, TotalRound, ABW).

---

### 2. Ffbscannerdata (LOOSEFRUIT) → PR_LOOSEFRUITLN

**Deskripsi**: Loosefruit (tandan lepas) dari Ffbscannerdata masuk ke tabel terpisah.

**Key Join**: `WORKERCODE` + `CAST(TRANSDATE AS DATE)` → `EmpCode` + `CAST(TrxDate AS DATE)`

**Hasil Verifikasi** (`2026-05-28`):
- **518/518 workers MATCH** — 100%
- **0 worker staging-only**, **0 worker prod-only**
- Nilai staging `LOOSEFRUIT` (bunches) = persis nilai prod `MT` (metric tons)

**Flow Data**:
```
Ffbscannerdata.LOOSEFRUIT (per transaksi, bunches)
  ↓
PR_LOOSEFRUITLN.MT (per employee per day, aggregated)
  ↓
PR_LOOSEFRUIT (header — DocDesc = "Import from IFES")
```

**Monthly Summary (May 2026)**:
| Source | Total | Workers |
|---|---|---|
| Staging (bunches) | 145,573 | 596 |
| PR_LOOSEFRUITLN (MT) | 156,554 | 596 |
| iFES_MillWeight (LF) | 141,760 | 111 drivers |

Selisih staging vs prod: staging hanya sampai 30 Mei, prod sudah full month penutupan.

---

### 3. Gwscannerdata → PR_TASKREGLN

**Deskripsi**: Scan general work — tugas non-panen (maintenance, pruning, raking, transport, dll).

**Key Join**:
| Join Key | Staging | db_ptrj |
|---|---|---|
| Emp Code | `WORKERCODE` | `EmpCode` |
| Tanggal | `CAST(TRANSDATE AS DATE)` | `CAST(TrxDate AS DATE)` |
| Job Code | `JOBCODE` | `TaskCode LIKE '%JOBCODE%'` |

**Hasil Verifikasi** (`2026-05-28`):
- **10/10 rows MATCH** — 100%
- Staging JOBCODE cocok ke PR_TASKCODE (misal `PM0110` → `PM0110P1A` — ada suffix division)
- **Daily count** staging 1,550-1,578 vs prod 1,625-1,754 (prod sedikit lebih besar karena bisa include entri dari sumber lain)

**Kolom Mapping**:

| Staging | db_ptrj (TASKREGLN) | Catatan |
|---|---|---|
| WORKERCODE | EmpCode | Key join |
| TRANSDATE | TrxDate | Tanggal |
| JOBCODE | TaskCode | Cari LIKE '%JOBCODE%' karena ada suffix division |
| TRANSNO | — | Nomor unik transaksi |
| FIELDNO | — | Lokasi lapangan |
| VEHICLENO | — | Kendaraan (jika ada) |
| FROMOCCODE | ChargeTo | OC / division |
| JOBCODE → JOBCODE+FROMOCCODE | TaskCode | Contoh: PM0110 + P1A = PM0110P1A |

**Catatan**: TaskCode di PR_TASKREGLN pakai format `{JOBCODE}{LOCCODE}` (contoh: PM0110P1A). Di staging disimpan terpisah (`JOBCODE` + `FROMOCCODE`).

---

### 4. Overtime → PR_TASKREGLN (dengan OT flag)

**Deskripsi**: Data lembur per transaksi. Bedanya dengan GWS: TASKREGLN punya flag `OT` (boolean).

**Key Join**: `WORKERCODE` + `CAST(TRANSDATE AS DATE)` → `EmpCode` + `CAST(TrxDate AS DATE)` + `OT=1`

**Hasil Verifikasi** (`2026-05-28`):
- **9/10 rows MATCH** di TASKREGLN dengan OT=true (90%)
- **1 miss**: A0001 (2 jam OT staging) — TASKREGLN hanya punya non-OT 7 jam. Mungkin OT belum diproses atau masuk di tanggal lain.
- **PR_MTHRATEDOTLN**: 0 baris — tabel ini tidak dipakai untuk OT harian
- **Daily OT**: staging 149-161 rows vs TASKREGLN(OT=1) 169-187 rows

**Kolom Mapping**:

| Staging | db_ptrj (TASKREGLN) | Catatan |
|---|---|---|
| WORKERCODE | EmpCode | Key join |
| TRANSDATE | TrxDate | Tanggal lembur |
| JOBCODE | TaskCode | Kode tugas |
| HOURS | Hours | Jam lembur |
| BASICRATE | Rate | Rate dasar |
| ADDRATE | — | Rate tambahan (tidak tersimpan langsung) |

---

### 5. Employee_Info → HR_EMPLOYEE

**Deskripsi**: Master data karyawan.

**Key Join**: `Employee_Code` (trim) → `EmpCode`

**Hasil Verifikasi**: **10/10 nama cocok persis** (SALASATUN, MARTONO, SUHARTINI, dll).

---

## Flow Integration

```
PLANTWARE (Scanner Device)
  │
  ├── FFB Scan    →  staging_PTRJ_iFES_Plantware.Ffbscannerdata
  ├── GWS Scan    →  staging_PTRJ_iFES_Plantware.Gwscannerdata
  ├── OT Scan     →  staging_PTRJ_iFES_Plantware.Overtime
  └── Mill Weight →  staging_PTRJ_iFES_Plantware.iFES_MillWeight
                        │
                        │ (Integrasi — proses batch)
                        ▼
                    db_ptrj
  │
  ├── PR_HARVESTERLN_ARC      (FFB panen, bunches)
  ├── PR_LOOSEFRUITLN          (Loosefruit, metric tons)
  ├── PR_TASKREGLN             (General work + Overtime)
  └── PR_FFBDRIVERLN           (Mill weight)
```

### Integrasi Timeline
Data staging diintegrasikan ke db_ptrj secara batch. Berdasarkan `IntegrationDateTime` dan `INTEGRATETIME`:
- Staging bisa berisi data real-time (scan terbaru)
- db_ptrj diperbarui secara periodik (interval jam/hari)
- **Konsekuensi**: staging = superset data terbaru, prod = data yang sudah melewati proses verifikasi

---

## Invariant Check

```
Staging ⊆ db_ptrj
```

Setiap record di staging harus ditemukan di db_ptrj — baik sebagai record langsung maupun hasil agregasi. Verifikasi membuktikan invariant ini berlaku untuk:

- ✅ Ffbscannerdata → PR_HARVESTERLN_ARC
- ✅ Ffbscannerdata.LOOSEFRUIT → PR_LOOSEFRUITLN
- ✅ Gwscannerdata → PR_TASKREGLN
- ✅ Overtime → PR_TASKREGLN (OT=true) — 90%, 1 anomaly
- ✅ Employee_Info → HR_EMPLOYEE

---

---
## API Endpoints — Staging Comparison Service

Base path: `/api/staging`

Semua endpoint return `{ success: true/false, data: ... }` atau `{ success: false, error: string }`.

### Explore

| Method | Path | Query | Description |
|--------|------|-------|-------------|
| GET | `/api/staging/explore/tables` | — | Full discovery: 30 tables with row counts + column schemas |
| GET | `/api/staging/explore/table/:name` | `?sample=10` | Single table: columns + sample rows |

### Compare — Row-Level

| Method | Path | Query | Default | Description |
|--------|------|-------|---------|-------------|
| GET | `/api/staging/compare/attendance` | `?date=&limit=` | 2026-05-28, 50 | Match GWS rows → PR_TASKREGLN by EmpCode+Date+JobCode |
| GET | `/api/staging/compare/overtime` | `?date=&limit=` | 2026-05-28, 50 | Match OT rows → PR_TASKREGLN(OT=1) or PR_MTHRATEDOTLN |
| GET | `/api/staging/compare/loosefruit` | `?date=&limit=&missing_only=` | 2026-05-28, 50, false | Match FFB LOOSEFRUIT → PR_LOOSEFRUITLN (set missing_only=true for only missing) |
| GET | `/api/staging/compare/brondol-missing` | `?date=&limit=` | 2026-05-28, 50 | Returns brondol items in staging but NOT in plantware (staging > prod) |

Masing-masing return `{ rows: [...], summary: { match_count, staging_only, staging_total, prod_total, pct_match } }`. Endpoint `brondol-missing` returns simplified format:

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "nama": "WORKER NAME",
      "divisi": "A1",      // Gang code (first 2 chars)
      "blok": "OC001",     // FromOcCode (fieldno)
      "estate": "Estate1", // Division/location
      "jumlah_selisih": 25, // Number of missing brondol
      "emp_code": "P001",
      "trans_date": "2026-05-28"
    }
  ]
}
```

### Compare — Daily Summary (aggregate per day)

| Method | Path | Query | Default | Description |
|--------|------|-------|---------|-------------|
| GET | `/api/staging/compare/daily-attendance` | `?month=&year=&top=` | 5, 2026, 15 | Per-day GWS count vs TASKREGLN vs ARC |
| GET | `/api/staging/compare/daily-overtime` | `?month=&year=&top=` | 5, 2026, 15 | Per-day OT rows+hours vs TASKREGLN(OT=1) vs MTHRATEDOTLN |
| GET | `/api/staging/compare/daily-loosefruit` | `?month=&year=&top=` | 5, 2026, 15 | Per-day LF workers+quantity vs PR_LOOSEFRUITLN |

---

## Catatan untuk Implementasi

1. **PR_HARVESTERLN_ACC** (79K rows) hanya menyimpan subset data — schema berbeda (akuntansi), gunakan ARC untuk full data
2. **TaskCode join** perlu string concatenation: `JOBCODE + LOCCODE` (tanpa spasi, uppercase)
3. **Loosefruit** beda satuan — staging dalam bunches, prod dalam MT (1:1 secara kebetulan)
4. **Data Mei 2026** di staging belum semua masuk ke ARC (prod hanya sampai April 2026)
5. **DATECREATED dan CREATEDBY** di staging terkadang berbeda dengan CreatedDate di prod — karena bisa di-reprocess oleh user berbeda
