# Dokumentasi PDF Export & Report Generation

## Gambaran Umum

Sistem Daftar Upah menggunakan **html2pdf.js** untuk generate PDF dari komponen React. Dokumentasi ini menjelaskan library yang digunakan, cara kerja, dan implementasinya.

---

## Library yang Digunakan

### **html2pdf.js** (Frontend)

**Package**: `html2pdf.js`  
**Versi**: ^0.14.0  
**Lokasi**: `frontend/package.json`

**Install**:
```bash
npm install html2pdf.js
# atau
yarn add html2pdf.js
```

**GitHub**: https://github.com/eKoopmans/html2pdf.js

---

## Cara Kerja

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│            ALUR PDF GENERATION (html2pdf.js)                │
└─────────────────────────────────────────────────────────────┘

1. User Click "Save PDF" Button
   └─ Trigger handleSavePDF() function

2. Clone DOM Element
   ├─ element.cloneNode(true)
   └─ Create temporary container (position: fixed, hidden)

3. Apply PDF Styles
   └─ Add .pdf-export-active class
      - White background
      - Fixed width (210mm = A4)
      - Print-optimized styles

4. Convert HTML to Canvas
   └─ html2canvas renders DOM to canvas
      - scale: 2 (higher quality)
      - useCORS: true (allow cross-origin images)
      - quality: 0.98 (JPEG quality)

5. Convert Canvas to PDF
   └─ jsPDF generates PDF from canvas
      - Format: A4
      - Orientation: portrait
      - Unit: mm

6. Download PDF
   └─ Browser downloads file
      - Filename: custom name
      - Auto-save to Downloads folder

7. Cleanup
   └─ Remove temporary container from DOM
```

---

## File Implementasi

### 1. **pdfGenerator.js** (Utility)

**Lokasi**: `frontend/src/utils/pdfGenerator.js`

**Export Function**:
```javascript
export const generatePDF = async (
    element, 
    filename = 'report.pdf', 
    options = {}
)
```

**Parameters**:
- `element`: DOM element to convert (React ref)
- `filename`: Output PDF filename
- `options`: Configuration overrides

**Default Configuration**:
```javascript
const defaultOptions = {
    margin: [0, 0, 0, 0],
    filename: filename,
    image: { 
        type: 'jpeg', 
        quality: 0.98 
    },
    html2canvas: {
        scale: 2,                    // Quality scale (1-4)
        useCORS: true,               // Allow cross-origin images
        logging: false,              // Disable console logs
        letterRendering: true,       // Better text rendering
        allowTaint: true             // Allow tainted canvas
    },
    jsPDF: {
        unit: 'mm',                  // Measurement unit
        format: 'a4',                // Paper size
        orientation: 'portrait',     // or 'landscape'
        compress: true               // Compress PDF
    },
    pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'] 
    }
};
```

---

### 2. **Pages yang Menggunakan PDF Export**

#### a. **WagesSummaryRebinmasPage.jsx**

**Lokasi**: `frontend/src/pages/WagesSummaryRebinmasPage.jsx`

**Usage**:
```javascript
import { generatePDF } from '../utils/pdfGenerator';

const handleSavePDF = () => {
    const element = printRef.current;
    const filename = `Laporan_Daftar_Upah_${division}_${month}_${year}.pdf`;
    generatePDF(element, filename);
};

// Render
<button onClick={handleSavePDF}>Save PDF</button>
```

**Features**:
- Export entire summary table
- Custom filename with division & period
- Styled for print

---

#### b. **PayslipPrintPage.jsx** (Slip Gaji)

**Lokasi**: `frontend/src/pages/PayslipPrintPage.jsx`

**Usage**:
```javascript
const handleExportPDF = async () => {
    const element = printRef.current;
    const filename = `Slip_Gaji_${emp_name}_${month}_${year}.pdf`;
    
    await generatePDF(element, filename, {
        jsPDF: {
            format: 'a5',          // Smaller paper size
            orientation: 'portrait'
        }
    });
};
```

**Features**:
- Individual payslip PDF
- A5 format (half of A4)
- Employee-specific filename

---

#### c. **OtherIncomesPage.jsx** (THR/Bonus)

**Lokasi**: `frontend/src/pages/OtherIncomesPage.jsx`

**Usage**:
```javascript
import html2pdf from 'html2pdf.js';

const handleDownloadPDF = () => {
    const element = document.getElementById('thr-report');
    
    const opt = {
        margin: 10,
        filename: `THR_Report_${month}_${year}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(element).save();
};
```

**Features**:
- Direct html2pdf usage (not via utility)
- Landscape orientation for wide tables
- Custom margins

---

#### d. **SummaryReportPage.jsx**

**Lokasi**: `frontend/src/pages/SummaryReportPage.jsx`

**Usage**:
```javascript
import { generatePDF } from '../utils/pdfGenerator';

const handleExportPDF = () => {
    const element = reportRef.current;
    const filename = `Summary_Report_${division}_${month}_${year}.pdf`;
    generatePDF(element, filename);
};
```

---

#### e. **AnalysisReportPage.jsx**

**Lokasi**: `frontend/src/pages/AnalysisReportPage.jsx`

**Usage**:
```javascript
import { generatePDF } from '../utils/pdfGenerator';

const handleDownloadPDF = () => {
    const element = analysisRef.current;
    const filename = `Analysis_Report_${month}_${year}.pdf`;
    generatePDF(element, filename);
};
```

---

#### f. **HighEarnerReportPage.jsx**

**Lokasi**: `frontend/src/pages/HighEarnerReportPage.jsx`

**Usage**:
```javascript
import { generatePDF } from '../utils/pdfGenerator';

const handleExportPDF = () => {
    const element = reportRef.current;
    const filename = `High_Earner_Report_${month}_${year}.pdf`;
    generatePDF(element, filename);
};
```

---

## CSS Styling untuk PDF

### .pdf-export-active Class

Tambahkan CSS ini untuk styling saat export PDF:

```css
/* Base styles for PDF export */
.pdf-export-active {
    background: white !important;
    color: black !important;
    width: 210mm !important;        /* A4 width */
    padding: 10mm !important;
    font-size: 12pt !important;
    font-family: Arial, sans-serif !important;
}

/* Table styles */
.pdf-export-active table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
}

.pdf-export-active th,
.pdf-export-active td {
    border: 1px solid #000;
    padding: 4px 8px;
    text-align: left;
}

.pdf-export-active th {
    background-color: #f0f0f0 !important;
    font-weight: bold;
}

/* Hide elements during PDF export */
.pdf-export-active .no-print,
.pdf-export-active button,
.pdf-export-active .actions {
    display: none !important;
}

/* Page breaks */
.pdf-export-active .page-break {
    page-break-before: always;
}

.pdf-export-active .avoid-break {
    page-break-inside: avoid;
}
```

---

## Best Practices

### 1. **Use React Ref for Element Reference**

```javascript
// ✅ GOOD: Use ref
const printRef = useRef(null);

return (
    <div ref={printRef} className="report-container">
        {/* Content */}
    </div>
);

const handleSavePDF = () => {
    generatePDF(printRef.current, 'report.pdf');
};

// ❌ BAD: Query selector
const handleSavePDF = () => {
    const element = document.getElementById('report');
    generatePDF(element, 'report.pdf');
};
```

---

### 2. **Custom Filename dengan Period Info**

```javascript
// ✅ GOOD: Descriptive filename
const filename = `Laporan_Daftar_Upah_P1A_Januari_2026.pdf`;

// ❌ BAD: Generic filename
const filename = 'report.pdf';
```

---

### 3. **Handle Loading State**

```javascript
// ✅ GOOD: Show loading indicator
const [exporting, setExporting] = useState(false);

const handleExportPDF = async () => {
    setExporting(true);
    try {
        await generatePDF(printRef.current, 'report.pdf');
    } catch (err) {
        console.error(err);
    } finally {
        setExporting(false);
    }
};

return (
    <button onClick={handleExportPDF} disabled={exporting}>
        {exporting ? 'Memproses...' : 'Save PDF'}
    </button>
);
```

---

### 4. **Optimize for Print**

```javascript
// ✅ GOOD: Add print-specific styles
.pdf-export-active {
    background: white;
    color: black;
    font-size: 12pt;
}

.pdf-export-active .hidden-on-print {
    display: none;
}

// ❌ BAD: Dark background
.report-container {
    background: #1a1a1a;  // Will waste ink
    color: white;
}
```

---

### 5. **Handle Page Breaks**

```javascript
// ✅ GOOD: Avoid breaking tables
.pdf-export-active tr {
    page-break-inside: avoid;
}

.pdf-export-active .avoid-break {
    page-break-inside: avoid;
}

// ❌ BAD: Allow breaks anywhere
table tr {
    /* No page-break handling */
}
```

---

## Configuration Options

### html2canvas Options

| Option | Default | Description |
|--------|---------|-------------|
| `scale` | 2 | Rendering scale (1-4 for quality) |
| `useCORS` | true | Allow cross-origin images |
| `logging` | false | Enable/disable console logs |
| `letterRendering` | true | Better text rendering |
| `allowTaint` | true | Allow tainted canvas |
| `backgroundColor` | null | Background color (null = transparent) |
| `width` | element.offsetWidth | Canvas width |
| `height` | element.offsetHeight | Canvas height |

### jsPDF Options

| Option | Default | Description |
|--------|---------|-------------|
| `unit` | 'mm' | Measurement unit ('mm', 'in', 'px') |
| `format` | 'a4' | Paper size ('a4', 'a5', 'letter', etc.) |
| `orientation` | 'portrait' | 'portrait' or 'landscape' |
| `compress` | true | Compress PDF file |
| `hotfixes` | null | PDF hotfixes (e.g., 'scale') |

### Page Break Options

| Option | Values | Description |
|--------|--------|-------------|
| `mode` | Array | ['avoid-all', 'css', 'legacy'] |
| `before` | string | CSS selector for before break |
| `after` | string | CSS selector for after break |
| `avoid` | string | CSS selector to avoid break |

---

## Troubleshooting

### Issue: PDF Blank/Empty

**Symptom**: PDF generated but empty/blank.

**Solution**:
1. Check element exists: `if (!element) return;`
2. Wait for content to render: `await new Promise(resolve => setTimeout(resolve, 300));`
3. Check element has content: `console.log(element.innerHTML);`
4. Verify element is visible (not `display: none`)

---

### Issue: Poor Quality/Blurry

**Symptom**: Text/images blurry in PDF.

**Solution**:
```javascript
// Increase scale
html2canvas: {
    scale: 3,  // or 4 for best quality
    useCORS: true
}

// Use PNG instead of JPEG
image: {
    type: 'png',
    quality: 1.0
}
```

---

### Issue: Cross-Origin Images

**Symptom**: Images not showing in PDF.

**Solution**:
```javascript
// Enable CORS
html2canvas: {
    useCORS: true,
    allowTaint: true
}

// Or use base64 images
<img src="data:image/png;base64,..." />
```

---

### Issue: Page Breaks in Wrong Place

**Symptom**: Table cut in middle of row.

**Solution**:
```css
/* Avoid breaks in tables */
.pdf-export-active tr {
    page-break-inside: avoid;
}

.pdf-export-active table {
    page-break-inside: auto;
}

/* Or use CSS mode */
pagebreak: {
    mode: ['css', 'legacy']
}
```

---

### Issue: Large File Size

**Symptom**: PDF file too large (>10MB).

**Solution**:
```javascript
// Reduce quality
image: {
    type: 'jpeg',
    quality: 0.8  // Lower quality
}

// Reduce scale
html2canvas: {
    scale: 1  // Lower scale
}

// Enable compression
jsPDF: {
    compress: true
}
```

---

### Issue: Styles Not Applied

**Symptom**: PDF looks different from screen.

**Solution**:
1. Use inline styles or ensure CSS is loaded
2. Clone element before converting:
   ```javascript
   const clone = element.cloneNode(true);
   clone.classList.add('pdf-export-active');
   ```
3. Apply print-specific CSS:
   ```css
   .pdf-export-active {
       /* Print styles */
   }
   ```

---

## Alternative Libraries

### 1. **react-pdf** (Pure React)

**Pros**:
- Native React components
- Better control over layout
- Smaller file size

**Cons**:
- Different API (not HTML-based)
- Steeper learning curve

**Install**:
```bash
npm install @react-pdf/renderer
```

---

### 2. **jspdf** (Direct API)

**Pros**:
- More control
- No HTML dependency
- Smaller bundle

**Cons**:
- Manual layout
- More code required

**Install**:
```bash
npm install jspdf
```

---

### 3. **puppeteer** (Backend - Node.js)

**Pros**:
- Perfect rendering
- Full Chrome engine
- Server-side generation

**Cons**:
- Requires Node.js backend
- Heavier dependency
- Slower

**Install**:
```bash
npm install puppeteer
```

---

## Backend Report Services

### 1. **reportService.ts**

**Lokasi**: `backend/src/services/reportService.ts`

**Methods**:
- `getComprehensiveReport()` - Full payroll report
- `getGangReport()` - Per gang report
- `getDivisionReport()` - Per division report

**Usage**:
```typescript
const report = await reportService.getComprehensiveReport(
    month, year, division, gang
);
```

---

### 2. **taxReportService.ts**

**Lokasi**: `backend/src/services/taxReportService.ts`

**Methods**:
- `getMonthlyTaxReport()` - Monthly tax report
- `getAnnualTaxReport()` - Annual tax report
- `getAnnualAstekBpjsReport()` - Annual BPJS report

**Usage**:
```typescript
const taxReport = await taxReportService.getMonthlyTaxReport(
    year, month, division, gang
);
```

---

### 3. **appsScriptService.ts**

**Lokasi**: `backend/src/services/appsScriptService.ts`

**Methods**:
- `generateGoogleSheetReport()` - Export to Google Sheets
- `getImpactReportData()` - Impact analysis report

---

## Complete Example

### React Component with PDF Export

```javascript
import React, { useRef, useState } from 'react';
import { generatePDF } from '../utils/pdfGenerator';

const PayrollReport = ({ data, month, year, division }) => {
    const printRef = useRef(null);
    const [exporting, setExporting] = useState(false);

    const handleExportPDF = async () => {
        setExporting(true);
        try {
            const element = printRef.current;
            const filename = `Laporan_Upah_${division}_${month}_${year}.pdf`;
            
            await generatePDF(element, filename, {
                jsPDF: {
                    format: 'a4',
                    orientation: 'landscape'
                }
            });
        } catch (err) {
            console.error('PDF export failed:', err);
            alert('Gagal export PDF: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div>
            <button 
                onClick={handleExportPDF} 
                disabled={exporting}
            >
                {exporting ? 'Memproses...' : '📄 Export PDF'}
            </button>

            <div ref={printRef} className="report-container">
                <h1>Laporan Daftar Upah</h1>
                <p>Divisi: {division}</p>
                <p>Periode: {month}/{year}</p>
                
                <table>
                    <thead>
                        <tr>
                            <th>Gang</th>
                            <th>Karyawan</th>
                            <th>Total HK</th>
                            <th>Upah Bersih</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(row => (
                            <tr key={row.gang_code}>
                                <td>{row.gang_code}</td>
                                <td>{row.total_employees}</td>
                                <td>{row.total_hk}</td>
                                <td>Rp {row.total_upah_bersih.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style>{`
                .report-container {
                    padding: 20px;
                    background: white;
                }

                .pdf-export-active table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .pdf-export-active th,
                .pdf-export-active td {
                    border: 1px solid #000;
                    padding: 8px;
                    text-align: left;
                }

                .pdf-export-active th {
                    background-color: #f0f0f0;
                    font-weight: bold;
                }
            `}</style>
        </div>
    );
};

export default PayrollReport;
```

---

## Referensi Terkait

- 📄 [`08_API_ROUTES_WAGES.md`](./08_API_ROUTES_WAGES.md) - API endpoints
- 📄 [`07_PAYROLL_DATA_SERVICE.md`](./07_PAYROLL_DATA_SERVICE.md) - Report data fetching
- 📄 [`09_DATABASE_SCHEMA.md`](./09_DATABASE_SCHEMA.md) - Database structure
- 🔗 [html2pdf.js Documentation](https://ekoopmans.github.io/html2pdf.js/)
- 🔗 [html2canvas Documentation](https://html2canvas.hertzen.com/)
- 🔗 [jsPDF Documentation](https://rawgit.com/MrRio/jsPDF/master/docs/)

---

**Versi**: 1.0  
**Terakhir Update**: Maret 2026  
**Library**: html2pdf.js v0.14.0  
**Dependencies**: html2canvas, jsPDF
