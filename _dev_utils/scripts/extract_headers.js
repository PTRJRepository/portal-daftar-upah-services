const fs = require('fs');

try {
    const raw = fs.readFileSync('d:/Gawean Rebinmas/Monitoring Database/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/_dev_utils/scripts/tax_report_structure.json', 'utf8');
    const data = JSON.parse(raw);

    let md = '# Extracted Headers\n\n';

    const sheets = ['Jan\'24', 'PERBULAN'];
    for (const sheet of sheets) {
        if (!data.content[sheet]) continue;

        md += `## Sheet: ${sheet}\n\n`;
        const rows = data.content[sheet].rows.slice(0, 10);

        md += '| Index | ' + Object.keys(rows[0]).map(k => `Col ${k}`).join(' | ') + ' |\n';
        md += '|---|' + Object.keys(rows[0]).map(() => '---').join('|') + '|\n';

        rows.forEach((row, i) => {
            md += `| Row ${i} | ` + Object.values(row).map(v => (v || '').toString().replace(/\n/g, ' ')).join(' | ') + ' |\n';
        });

        md += '\n\n';
    }

    fs.writeFileSync('d:/Gawean Rebinmas/Monitoring Database/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/_dev_utils/scripts/parsed_headers.md', md);
    console.log("Success");
} catch (e) {
    console.error(e);
}
