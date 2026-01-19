# Implementasi Tunjangan (Beras, Jabatan, Masa Kerja, Lembur)

## Referensi dari Backend Lama

Berdasarkan analisis `backend_lama`, berikut adalah query dan perhitungan yang digunakan:

### 1. Tunjangan Beras
**Query SQL:**
```sql
SELECT RiceRation FROM "HR_PAYROLL" WHERE EmpCode = ?
```

**Perhitungan:**
- `beras_rate = RiceRation` (rate per HK)
- `beras_jumlah = hk_count * beras_rate`

### 2. Tunjangan Jabatan
**Query SQL:**
```sql
SELECT SUM(ln.Amount)
FROM PR_ADTRANS_ARC t
JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
WHERE t.EmpCode = ?
  AND t.DocDate >= ?
  AND t.DocDate < ?
  AND t.DocDesc = 'TUNJANGAN JABATAN'
```

**Perhitungan:**
- `jabatan_jumlah = SUM(ln.Amount)`
- `jabatan_rate = jabatan_jumlah / hari_kerja` (setelah cuti)

### 3. Tunjangan Masa Kerja
**Query SQL (tahun):**
```sql
SELECT
    CASE
        WHEN MONTH("AppJoinGrpDate") > MONTH(GETDATE()) OR
             (MONTH("AppJoinGrpDate") = MONTH(GETDATE()) AND DAY("AppJoinGrpDate") > DAY(GETDATE()))
        THEN DATEDIFF(year, "AppJoinGrpDate", GETDATE()) - 1
        ELSE DATEDIFF(year, "AppJoinGrpDate", GETDATE())
    END AS YearsSinceAppJoinGrpDate
FROM "HR_EMPLOYMENT"
WHERE "EmpCode" = ?
```

**Query SQL (jumlah):**
```sql
SELECT SUM(ln.Amount)
FROM PR_ADTRANS_ARC AS t
JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
WHERE t.EmpCode = ?
  AND t.DocDate >= ?
  AND t.DocDate < ?
  AND t.DocDesc = 'TUNJANGAN MASA KERJA'
```

### 4. Tunjangan Lembur
**Query SQL:**
```sql
SELECT SUM(trl."Amount") AS TotalAmount,
       SUM(trl."Hours") AS TotalHours
FROM "PR_TASKREG_ARC" tr
JOIN "PR_TASKREGLN_ARC" trl ON tr."id" = trl."masterId"
WHERE trl."EmpCode" = ?
  AND tr."DocDate" >= ?
  AND tr."DocDate" < ?
  AND trl.OT = 1
```

## Implementation Plan untuk Backend Baru

### Step 1: Tambah Query Methods
Tambahkan method-method berikut ke `ThreadedDataExtractor`:

```python
def _get_beras_rate_query(self, gang_code: str, start_date: str, end_date: str):
    # Query dari HR_PAYROLL.RiceRation

def _get_jabatan_query(self, gang_code: str, start_date: str, end_date: str):
    # Query dari PR_ADTRANS_ARC dengan DocDesc='TUNJANGAN JABATAN'

def _get_masa_kerja_tahun_query(self, gang_code: str, start_date: str, end_date: str):
    # Query dari HR_EMPLOYMENT.AppJoinGrpDate

def _get_masa_kerja_jumlah_query(self, gang_code: str, start_date: str, end_date: str):
    # Query dari PR_ADTRANS_ARC dengan DocDesc='TUNJANGAN MASA KERJA'

def _get_lembur_query(self, gang_code: str, start_date: str, end_date: str):
    # Query dari PR_TASKREGLN_ARC dengan OT=1
```

### Step 2: Update Query Tasks
Tambahkan query baru ke `query_tasks`:

```python
query_tasks = {
    # ... existing queries ...

    # Add new queries for missing allowance data
    'beras_rate_data': self._get_beras_rate_query(gang_code, start_date, end_date),
    'jabatan_data': self._get_jabatan_query(gang_code, start_date, end_date),
    'masa_kerja_tahun_data': self._get_masa_kerja_tahun_query(gang_code, start_date, end_date),
    'masa_kerja_jumlah_data': self._get_masa_kerja_jumlah_query(gang_code, start_date, end_date),
    'lembur_data': self._get_lembur_query(gang_code, start_date, end_date)
}
```

### Step 3: Update Data Processing Logic
Update `_process_parallel_results` atau logic merge untuk menggabungkan data tunjangan:

```python
def merge_tunjangan_data(employee_data, results):
    # Merge beras rate
    for row in results.get('beras_rate_data', []):
        emp_code, beras_rate = row
        if emp_code in employee_data:
            employee_data[emp_code]['beras_rate'] = float(beras_rate or 0)
            employee_data[emp_code]['beras_jumlah'] = (
                float(beras_rate or 0) * employee_data[emp_code].get('jumlah_hk', 0)
            )

    # Merge jabatan
    for row in results.get('jabatan_data', []):
        emp_code, jabatan_jumlah = row
        if emp_code in employee_data:
            employee_data[emp_code]['jabatan_jumlah'] = float(jabatan_jumlah or 0)
            hari_kerja = employee_data[emp_code].get('hari_kerja', 0)
            if hari_kerja > 0 and jabatan_jumlah > 0:
                employee_data[emp_code]['jabatan_rate'] = float(jabatan_jumlah or 0) / hari_kerja

    # Merge masa kerja (tahun dan jumlah)
    for row in results.get('masa_kerja_tahun_data', []):
        emp_code, masa_kerja_tahun = row
        if emp_code in employee_data:
            employee_data[emp_code]['masa_kerja_tahun'] = int(masa_kerja_tahun or 0)

    for row in results.get('masa_kerja_jumlah_data', []):
        emp_code, masa_kerja_jumlah = row
        if emp_code in employee_data:
            employee_data[emp_code]['masa_kerja_jumlah'] = float(masa_kerja_jumlah or 0)
            employee_data[emp_code]['masa_kerja_amount'] = float(masa_kerja_jumlah or 0)

    # Merge lembur
    for row in results.get('lembur_data', []):
        emp_code, lembur_jumlah, lembur_jam = row
        if emp_code in employee_data:
            employee_data[emp_code]['lembur_jumlah'] = float(lembur_jumlah or 0)
            employee_data[emp_code]['lembur_jam'] = int(lembur_jam or 0)

    # Calculate total tunjangan
    for emp_code, emp in employee_data.items():
        total_tunjangan = (
            emp.get('beras_jumlah', 0) +
            emp.get('jabatan_jumlah', 0) +
            emp.get('masa_kerja_amount', 0) +
            emp.get('lembur_jumlah', 0)
        )
        employee_data[emp_code]['total_tunjangan'] = total_tunjangan
```

### Step 4: Update PayrollRow Creation
Pastikan semua field tunjangan diisi saat membuat PayrollRow:

```python
row = PayrollRow(
    # ... existing fields ...

    # Tunjangan fields
    beras_rate=emp.get('beras_rate', 0.0),
    beras_jumlah=emp.get('beras_jumlah', 0.0),
    jabatan_rate=emp.get('jabatan_rate', 0.0),
    jabatan_jumlah=emp.get('jabatan_jumlah', 0.0),
    masa_kerja_tahun=emp.get('masa_kerja_tahun', 0),
    masa_kerja_jumlah=emp.get('masa_kerja_jumlah', 0.0),
    masa_kerja_amount=emp.get('masa_kerja_amount', 0.0),
    lembur_jam=emp.get('lembur_jam', 0),
    lembur_jumlah=emp.get('lembur_jumlah', 0.0),
    total_tunjangan=emp.get('total_tunjangan', 0.0),
)
```

### Step 5: Testing dengan Batch Parameter
Gunakan endpoint `/payroll/report?batch=true` untuk testing sistem batch update.

## Priority Implementation

1. **HIGH**: Tunjangan Beras (query sederhana dari HR_PAYROLL)
2. **HIGH**: Tunjangan Jabatan (query dari PR_ADTRANS_ARC)
3. **MEDIUM**: Tunjangan Masa Kerja (dua query: tahun + jumlah)
4. **MEDIUM**: Tunjangan Lembur (query dari PR_TASKREGLN_ARC)

## Catatan Penting

- Gunakan parameterized queries (`?`) untuk security
- Implement proper error handling dan null value checking
- Follow existing pattern untuk parallel execution
- Test dengan data real untuk validasi perhitungan
- Pastikan timezone handling konsisten

## Backend Pattern Reference

Dari backend lama, pattern yang berhasil:
- Parameterisasi query dengan regex `_paramify`
- Scalar value extraction dengan `_scalar` method
- Batch processing dengan chunking
- TTL-based caching untuk performance
- Parallel execution dengan ThreadPoolExecutor