import * as fs from 'fs';

const docPath = 'D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/docs/MANUAL_ADJUSTMENT_API.md';
let docContent = fs.readFileSync(docPath, 'utf8');

const newDoc = `

### 4. Check Adtrans Sync (Direct DB Query)
**Endpoint:** \`POST /payroll/manual-adjustment/check-adtrans/by-api-key\`
**Access:** Protected (Requires \`X-API-Key\`)

Checks real data stored in \`db_ptrj.dbo.PR_ADTRANS\` (and \`PR_ADTRANS_ARC\`) for a specific set of employees based on \`DocDesc\` filters.

**IMPORTANT NOTE ON DATE MAPPING:**
> Query filter ini *diambil dari \`PhyMonth\` dan \`PhyYear\`* pada tabel \`PR_ADTRANS\`, di mana \`PhyMonth\` dan \`PhyYear\` merupakan **real month sesuai kalender**. Ini membedakannya dari \`AccMonth\`/\`AccYear\` atau mapping date period lainnya.

**Request Body:**
\`\`\`json
{
  "period_month": 4,
  "period_year": 2026,
  "emp_codes": ["EMP001", "EMP002"],
  "filters": ["spsi", "masa kerja", "jabatan", "premi", "potongan"]
}
\`\`\`

**Pattern Mapping Explanation:**
- \`"spsi"\` -> \`UPPER(t.DocDesc) LIKE '%SPSI%'\`
- \`"masa kerja"\` -> \`UPPER(t.DocDesc) LIKE 'MASA%KERJA%'\`
- \`"jabatan"\` -> \`UPPER(t.DocDesc) LIKE '%JABATAN%'\`
- \`"premi"\` -> \`UPPER(t.DocDesc) LIKE '%PREMI%'\`
- \`"potongan"\` -> \`UPPER(t.DocDesc) LIKE 'POT%'\`
- Any other string will map to \`UPPER(t.DocDesc) LIKE '%{FILTER}%'\`

**Success Response:**
\`\`\`json
{
  "success": true,
  "message": "Adtrans check completed successfully",
  "data": [
    {
      "emp_code": "EMP001",
      "spsi": 4000,
      "masa kerja": 200000,
      "jabatan": 0,
      "premi": 150000,
      "potongan": 10000
    }
  ]
}
\`\`\`
`;

docContent += newDoc;
fs.writeFileSync(docPath, docContent);
console.log("Updated documentation.");
