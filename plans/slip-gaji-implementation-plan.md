# Implementation Plan: Slip Gaji Multi-Employee Print Feature

## Overview
Membuat fitur cetak slip gaji untuk beberapa karyawan sekaligus dengan layout 4 slip gaji per lembar A4.

## Data Structure Analysis

### Existing Data Sources
1. **EmployeeDetailPage.jsx** - Sudah ada komponen slip gaji individual
2. **employeeDetailService.js** - Service untuk fetch data checkroll per karyawan
3. **Backend API** `/payroll/employee/:emp_code/checkroll` - Endpoint untuk data detail karyawan
4. **dataExtractorService.ts** - Service backend yang mengextract data payroll lengkap

### Data yang Ditampilkan di Slip Gaji
Berdasarkan EmployeeDetailPage.jsx:

#### Header
- Logo perusahaan
- Nama perusahaan (PT REBINMAS JAYA)
- Judul: SLIP GAJI KARYAWAN
- Periode (bulan & tahun)
- Nomor slip: {empCode}/{month}{year}

#### Informasi Karyawan
- NIK
- Nama
- Jabatan
- Unit/Gang
- Status karyawan
- HK / Rate

#### Penerimaan (Earnings)
1. **Gaji Pokok** - Dihitung dari HK × Rate
2. **Tunjangan**:
   - Tunjangan Beras
   - Tunjangan Jabatan
   - Tunjangan Masa Kerja
3. **Premi** (dinamis):
   - Premi Brondol
   - Premi lainnya (dinamis dari data)
4. **Lembur** (jam & jumlah)
5. **Total Kotor**

#### Potongan (Deductions)
1. **Potongan Upah Kotor**:
   - Koreksi
   - Variasi koreksi lainnya
2. **Potongan Upah Bersih**:
   - BPJS Kesehatan
   - BPJS Pensiun
   - Astek Pekerja
   - SPSI
   - PPh 21
   - Potongan dinamis lainnya
3. **Total Potongan**

#### Footer
- Penerimaan Bersih (Take Home Pay)
- Tanda tangan (Dibuat, Diperiksa, Disetujui, Diterima)
- Timestamp

## Architecture Design

### Backend Changes

#### New API Endpoint
```
GET /payroll/employee/batch-checkroll
```

**Query Parameters:**
- `emp_codes` (array/string) - List NIK karyawan (comma-separated)
- `month` (number) - Bulan
- `year` (number) - Tahun
- `division` (string, optional) - Divisi

**Response:**
```typescript
{
  success: boolean;
  data: Array<{
    emp_code: string;
    month: number;
    year: number;
    employee: EmployeeInfo;
    attendance: AttendanceData;
    overtime: OvertimeData;
    payroll_data: PayrollRow;
  }>;
  meta: {
    count: number;
    execution_time_ms: number;
  }
}
```

**Implementation:**
- Reuse existing `employeeDetailService.getEmployeeCheckroll()`
- Loop through emp_codes array
- Return batch results

### Frontend Changes

#### New Components

1. **PayslipPrintPage.jsx** (Page)
   - Route: `/payslip-print`
   - Full page layout for print preview
   - Employee selection interface
   - Print button

2. **PayslipCard.jsx** (Component)
   - Individual slip gaji card
   - Compact layout for 4-per-page
   - Props: employeeData, month, year

3. **EmployeeMultiSelect.jsx** (Component)
   - Checkbox list for employee selection
   - Select all/none functionality
   - Search/filter employees

4. **payslip-print.css** (Styles)
   - Print-specific styles
   - 4-per-page grid layout
   - A4 page sizing

#### Route Integration
Add to App.jsx:
```jsx
<Route path="payslip-print" element={<SummaryReportWrapper component={PayslipPrintPage} />} />
```

#### Service Addition
Add to employeeDetailService.js:
```javascript
export async function getBatchEmployeeCheckroll(token, empCodes, month, year, division = null)
```

## Layout Design (4 per A4)

### Page Layout
```
+------------------+------------------+
|   Slip Gaji 1    |   Slip Gaji 2    |
|   (Karyawan A)   |   (Karyawan B)   |
+------------------+------------------+
|   Slip Gaji 3    |   Slip Gaji 4    |
|   (Karyawan C)   |   (Karyawan D)   |
+------------------+------------------+
```

### CSS Grid for Print
```css
@page {
  size: A4;
  margin: 10mm;
}

.payslip-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 5mm;
  height: 277mm; /* A4 height minus margins */
}

.payslip-card {
  border: 1px solid #000;
  padding: 8mm;
  font-size: 9pt;
  overflow: hidden;
}
```

### Compact Card Layout
- Reduce font sizes
- Compact spacing
- Two-column layout for earnings/deductions
- Minimal signature section

## Implementation Steps

### Phase 1: Backend API
1. Add batch endpoint in `backend/src/api/employee.ts`
2. Implement batch service method
3. Test with multiple employees

### Phase 2: Frontend Components
1. Create PayslipCard component (compact version)
2. Create PayslipPrintPage
3. Create EmployeeMultiSelect component
4. Add CSS styles for print layout

### Phase 3: Integration
1. Add route in App.jsx
2. Add navigation link from Operational page
3. Add "Print Slip Gaji" button in CustomPayrollTable

### Phase 4: Testing
1. Test print output
2. Verify 4-per-page layout
3. Test employee selection
4. Verify data accuracy

## Files to Create/Modify

### New Files
- `frontend/src/pages/PayslipPrintPage.jsx`
- `frontend/src/components/PayslipCard.jsx`
- `frontend/src/components/EmployeeMultiSelect.jsx`
- `frontend/src/styles/payslip-print.css`

### Modified Files
- `backend/src/api/employee.ts` - Add batch endpoint
- `frontend/src/services/employeeDetailService.js` - Add batch service
- `frontend/src/App.jsx` - Add route
- `frontend/src/components/CustomPayrollTable.jsx` - Add print button

## Print Flow

1. User selects employees from grid (checkbox)
2. User clicks "Print Slip Gaji" button
3. Navigate to `/payslip-print?emp_codes=...&month=...&year=...`
4. Fetch batch data from backend
5. Display preview with 4-per-page layout
6. User clicks Print button
7. Browser print dialog opens
8. User selects printer and prints

## Technical Considerations

### Performance
- Batch API should handle up to 50 employees efficiently
- Use Promise.all for parallel data fetching
- Implement loading state

### Print Optimization
- Use `@media print` CSS
- Hide UI elements (buttons, selectors) when printing
- Ensure page breaks work correctly

### Error Handling
- Handle missing employee data gracefully
- Show error message if batch fetch fails
- Allow retry for failed individual employees

## Future Enhancements
- Export to PDF option
- Email slips to employees
- Bulk download as ZIP
- Custom slip template selection
