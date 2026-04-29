# Payroll Source Verification Popup — Design Document

**Date:** 2026-04-29
**Branch:** `server-fix-1`
**Author:** AI-assisted design (brainstorming skill)

---

## 1. Purpose

Mendeteksi kesalahan **input data dari db_ptrj** yang tampil di tabel Daftar Upah UI. Sistem ini adalah lapisan verifikasi independen yang tidak mengubah alur rendering payroll. User mengklik tombol "Verifikasi Sumber" di toolbar tabel, lalu modal pop-up menampilkan laporan komprehensif perbandingan antara nilai UI dan nilai asli dari database.

**Scope verifikasi** (on-demand, bukan real-time):
- Masa Kerja
- Jabatan (tunjangan jabatan)
- Potongan SPSI
- Dynamic Premi
- Dynamic Koreksi
- Dynamic Potongan

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend: CustomPayrollTable                               │
│  ├── PayrollViewModeToolbar  ← tombol [🔍 Verifikasi]      │
│  └── PayrollVerificationModal ← popup 3-tab report         │
└────────────────────────┬────────────────────────────────────┘
                         │ GET /payroll/verify/source-data
                         │   ?division_code=PG1A&month=5&year=2025
                         │   &gang_code=ALL&emp_codes=...
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: New endpoint + existing service                    │
│  ├── manualAdjustmentService.compareAdtransWithAdjustments() │
│  ├── direct HR_EMPLOYEE query (jabatan text validation)      │
│  └── direct PR_ADTRANS detail query per emp_code             │
└─────────────────────────────────────────────────────────────┘
```

**Fondasi yang sudah ada:**
- `ManualAdjustmentService.compareAdtransWithAdjustments()` membandingkan PR_ADTRANS (db_ptrj) dengan payroll_manual_adjustments (extend_db_ptrj)
- `ManualAdjustmentService.reverseCompareAdtransWithAdjustments()` arah berlawanan
- `manualAdjustmentApplier.ts` menerapkan adjustment ke payroll row

---

## 3. Backend: New API Endpoint

### 3.1 Endpoint

```
GET /payroll/verify/source-data
```

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `division_code` | string | Yes | Division code (e.g. PG1A) |
| `month` | number | Yes | Period month (1-12) |
| `year` | number | Yes | Period year |
| `gang_code` | string | No | Specific gang or ALL |
| `emp_codes` | string[] | No | Filter to specific employees |

### 3.2 Internal Flow

1. **Resolve division** via `divisionConfigService.resolveAdtransLocCode(division_code)`
2. **Parallel queries:**
   - (A) `manualAdjustmentService.compareAdtransWithAdjustments(month, year, division_code, filters)` → Masa Kerja, Jabatan, SPSI, Premi, Koreksi, Potongan
   - (B) Direct query ke `HR_EMPLOYEE` + `HR_GANGLN` untuk validasi text jabatan
   - (C) Direct query ke `PR_ADTRANS` + `PR_ADTRANSLN` untuk detail per emp_code per kategori
3. **Cross-reference** dengan data UI yang dikirim frontend (list emp_codes + nilai yang tampil)
4. **Klasifikasi status** per employee per kategori
5. **Return** structured JSON report

### 3.3 Response Schema

```typescript
interface VerificationReport {
  division: string;
  period_month: number;
  period_year: number;
  summary: {
    total_employees: number;
    match: number;               // MATCH
    mismatch_adjusted: number;   // MISMATCH_ADJUSTED
    mismatch_raw: number;        // MISMATCH_RAW
    missing_in_db: number;       // MISSING_IN_DB
    missing_in_ui: number;       // MISSING_IN_UI
  };
  per_employee: Record<string, EmployeeVerification>;
  per_category: Record<string, CategorySummary>;
}

interface EmployeeVerification {
  emp_code: string;
  nama: string;
  jabatan_text_ui: string | null;
  jabatan_text_db: string | null;
  jabatan_match: boolean;
  categories: Record<string, CategoryVerification>;
}

interface CategoryVerification {
  ui_value: number | null;
  db_value: number | null;
  adjustment_amount: number | null;  // auto buffer / manual adjustment
  status: 'MATCH' | 'MISMATCH_ADJUSTED' | 'MISMATCH_RAW' | 'MISSING_IN_DB' | 'MISSING_IN_UI';
  diff: number | null;
  doc_desc_details: AdtransDocDescDetail[];  // PR_ADTRANS rows
  remarks: string | null;  // dari payroll_manual_adjustments
}

interface CategorySummary {
  category: string;
  match: number;
  mismatch: number;
  missing_in_db: number;
  employees_with_issues: string[];
}

interface AdtransDocDescDetail {
  doc_id: string | null;
  doc_desc: string;
  amount: number;
}
```

### 3.4 Status Classification Rules

| Status | Condition |
|---|---|
| **MATCH** | `abs(ui_value - db_value) <= 1` (rupiah) |
| **MISMATCH_ADJUSTED** | `abs(ui_value - db_value) > 1` AND ada manual adjustment / auto buffer yang menjelaskan selisih (`abs(diff - adjustment_amount) <= 1`) |
| **MISMATCH_RAW** | `abs(ui_value - db_value) > 1` AND tidak ada penjelasan adjustment → **flag merah** |
| **MISSING_IN_DB** | Karyawan ada di UI, `ui_value > 0`, tapi tidak ditemukan di PR_ADTRANS untuk kategori ini |
| **MISSING_IN_UI** | Ada transaksi di PR_ADTRANS (`db_value > 0`), tapi karyawan tidak muncul di UI tabel |

---

## 4. Frontend: UI Components

### 4.1 PayrollViewModeToolbar — Tombol Verifikasi

Penempatan: di sebelah kanan tombol "Export Excel".

```jsx
<button
  onClick={() => setVerifyModalOpen(true)}
  className={verifyBadgeCount > 0 ? 'btn-verify-has-issues' : 'btn-verify'}
>
  🔍 Verifikasi Sumber
  {verifyBadgeCount > 0 && (
    <span className="verify-badge">{verifyBadgeCount}</span>
  )}
</button>
```

**Badge count** = jumlah karyawan dengan `mismatch_raw + missing_in_db`. Di-refresh otomatis setelah SSE stream selesai dengan memanggil endpoint ringkasan cepat (atah hasil verify sebelumnya di-cache).

### 4.2 PayrollVerificationModal — Struktur 3 Tab

**Tab 1 — Ringkasan**
- 4 kartu besar:
  - 🟢 **Match**: `{summary.match}` karyawan
  - 🟡 **Mismatch Adjusted**: `{summary.mismatch_adjusted}` karyawan
  - 🔴 **Mismatch Raw**: `{summary.mismatch_raw}` karyawan
  - ❓ **Missing in DB**: `{summary.missing_in_db}` karyawan
- Bar chart per kategori (6 kategori)
- Toggle: "Tampilkan Semua" / "Hanya Bermasalah"

**Tab 2 — Per Karyawan**
- Tabel: `Kode | Nama | Masa Kerja | Jabatan | SPSI | Premi | Koreksi | Potongan | Status`
- Sel nilai: format `UI_value | db_value`
  - 🟢 Hijau = MATCH
  - 🟡 Kuning = MISMATCH_ADJUSTED
  - 🔴 Merah = MISMATCH_RAW
  - ⚪ Gray = MISSING_IN_DB
- Expandable row: klik untuk melihat detail PR_ADTRANS (doc_desc, doc_id, amount)

**Tab 3 — Per Kolom**
- Dropdown pilih kategori
- Tabel semua karyawan untuk kategori tersebut
- Highlight baris bermasalah
- Tombol "Export Laporan" → Excel

### 4.3 State Management (Lokal)

```javascript
const [verifyModalOpen, setVerifyModalOpen] = useState(false);
const [verifyData, setVerifyData] = useState(null);
const [verifyLoading, setVerifyLoading] = useState(false);
const [verifyFilter, setVerifyFilter] = useState('all'); // 'all' | 'issues_only'
const [verifyBadgeCount, setVerifyBadgeCount] = useState(0);
```

### 4.4 Data Fetching

```javascript
async function fetchVerificationReport() {
  setVerifyLoading(true);
  const params = new URLSearchParams({
    division_code: division,
    month: String(month),
    year: String(year),
  });
  if (gangCode && gangCode !== 'ALL') params.set('gang_code', gangCode);

  // Collect emp_codes currently visible in UI
  const visibleEmpCodes = gangs.flatMap(g =>
    g.employees.map(e => e.emp_code || e.nik)
  ).filter(Boolean);
  visibleEmpCodes.forEach(code => params.append('emp_codes', code));

  const res = await fetch(`/payroll/verify/source-data?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  setVerifyData(data);
  setVerifyBadgeCount(data.summary.mismatch_raw + data.summary.missing_in_db);
  setVerifyLoading(false);
}
```

---

## 5. Files to Create / Modify

### New Files

| File | Description |
|---|---|
| `backend/src/api/payrollVerificationRoutes.ts` | New API route module |
| `backend/src/services/payrollVerificationService.ts` | Core verification logic |
| `frontend/src/components/PayrollVerificationModal.jsx` | Modal popup component |
| `frontend/src/services/payrollVerificationService.js` | API wrapper frontend |
| `docs/plans/2026-04-29-payroll-source-verification-popup-design.md` | This document |

### Modified Files

| File | Change |
|---|---|
| `backend/src/api/payroll.ts` | Register new route |
| `frontend/src/components/CustomPayrollTable.jsx` | Add verify button + modal integration |
| `frontend/src/components/PayrollViewModeToolbar.jsx` | Add verify button to toolbar |

---

## 6. Testing Strategy

### Backend Tests
1. **Unit test** `payrollVerificationService` dengan mock data PR_ADTRANS
2. **Integration test** endpoint `/payroll/verify/source-data` dengan test division
3. **Edge cases**:
   - Virtual division (NRS, INF) mapping ke LocCode
   - Employee dengan NIK vs EmpCode berbeda
   - PR_ADTRANS_ARC (archived) included
   - Gang prefix filtering

### Frontend Tests
1. **Modal renders** dengan data mock
2. **Tab switching** berfungsi
3. **Color coding** sesuai status
4. **Expand row** menampilkan detail
5. **Badge count** update setelah stream selesai

---

## 7. Business Rules to Preserve

- **Jabatan text** validasi: `jabatan_estate` dari UI vs `HR_EMPLOYEE.JobTitle` (atau field jabatan di HR_EMPLOYEE). Ini terpisah dari tunjangan jabatan amount.
- **PTRJ EmpCode** untuk PR_ADTRANS: gunakan letter-prefixed code (A0001), bukan numeric NIK/KTP. Lihat memory: `PTRJ EmpCode for PR_ADTRANS`.
- **Division LocCode mapping**: PG1A → P1A, ARB1 → AB1, dll. Gunakan `normalizeAdtransDivisionLocCode()` yang sudah ada.
- **Virtual divisions**: NRS, INF, WKS_AR resolve ke source division. Gunakan `resolveAdtransLocCode()`.
- **Database profiles**: PR_ADTRANS query pakai `Database.getInstance()` (SERVER_PROFILE_2, db_ptrj). Never use SERVER_PROFILE_3.

---

## 8. Out of Scope (YAGNI)

- Real-time background verification (on-demand only)
- Auto-sync dari hasil verify ke manual adjustments
- Email / notifikasi laporan
- Historical trend verification (hanya periode aktif)
- Verifikasi kolom non-manual-adjustment (Gaji Pokok, HK, Lembur, PPh21) — scope terbatas pada kolom manual adjustment

---

## 9. Next Steps

1. Implement backend: `payrollVerificationService.ts` + route
2. Implement frontend: `PayrollVerificationModal.jsx`
3. Wire up ke `CustomPayrollTable`
4. Test dengan data real

**Ready for implementation.**
