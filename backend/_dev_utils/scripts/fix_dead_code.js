const fs = require('fs');
const f = 'd:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/backend/src/api/taxReportRoutes.ts';
let lines = fs.readFileSync(f, 'utf8').split('\n');
console.log('Total lines before:', lines.length);

// Lines 1113-1208 (0-indexed: 1112-1207) are the dead DataExtractor block
// Replace with clean code
const replace = [
    '            // Ensure BRONDOL in premi_detail from top-level fields',
    '            employees.forEach((emp: any) => {',
    '                if (!emp.premi_detail) emp.premi_detail = {};',
    "                const hasBrondol = Object.keys(emp.premi_detail).some(k => k.toUpperCase() === 'BRONDOL');",
    '                if (!hasBrondol) {',
    '                    const bVal = Number(emp.premi_brondol_total) || Number(emp.premi_brondol) || 0;',
    "                    if (bVal > 0) emp.premi_detail['BRONDOL'] = bVal;",
    '                }',
    '            });',
    '',
    '            // Inject TAX_COMPONENT_METADATA for AccCode rows (static)',
    '            const { TAX_COMPONENT_METADATA: MTD } = await import("../services/taxReportService");',
    '            const metaToInject = MTD || TAX_COMPONENT_METADATA;',
    '            employees.forEach((emp: any) => { emp.component_metadata = metaToInject; });',
    "            console.log(`[TaxReport DOM FAST] Injected metadata keys: ${Object.keys(metaToInject || {}).join(', ')}`);"
];

// splice: start at index 1112, delete 96 lines, insert replacement
lines.splice(1112, 96, ...replace);
fs.writeFileSync(f, lines.join('\n'));
console.log('Total lines after:', lines.length);
console.log('Done.');
