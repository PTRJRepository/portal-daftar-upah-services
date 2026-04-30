import ExcelJS from 'exceljs';
import { ManualAdjustmentService } from './manualAdjustmentService';
import { premiumDefinitionService } from './premiumDefinitionService';

export interface PremiumImportRow {
    empcode: string;
    gang_code: string;
    subblok: string;
    jumlah: number;
    jenis: string;
}

export interface PremiumImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    details: { empcode: string; jenis: string; totalAmount: number; itemCount: number }[];
}

const ALLOWED_JENIS = ['PREMI PRUNING', 'PREMI RAKING'];

function normalizeJenis(value: string): string {
    const cleaned = String(value || '').toUpperCase().trim();
    if (cleaned === 'PRUNING' || cleaned === 'PREMI PRUNING') return 'PREMI PRUNING';
    if (cleaned === 'RAKING' || cleaned === 'CIRCLE RAKING' || cleaned === 'PREMI RAKING') return 'PREMI RAKING';
    return cleaned;
}

export async function importPremiumExcel(
    buffer: Buffer,
    periodMonth: number,
    periodYear: number,
    divisionCode: string,
    manualAdjustmentService: ManualAdjustmentService
): Promise<PremiumImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        return { success: false, imported: 0, skipped: 0, errors: ['File Excel kosong atau tidak memiliki worksheet.'], details: [] };
    }

    const rows: PremiumImportRow[] = [];
    const errors: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        const values = row.values as any[];
        const empcode = String(values[1] || '').trim();
        const gangCode = String(values[2] || '').trim();
        const subblok = String(values[3] || '').trim();
        const jumlah = parseFloat(values[4]) || 0;
        const jenis = normalizeJenis(values[5]);

        if (!empcode) {
            errors.push(`Baris ${rowNumber}: Empcode kosong, dilewati.`);
            return;
        }
        if (!subblok) {
            errors.push(`Baris ${rowNumber}: Subblok kosong untuk ${empcode}, dilewati.`);
            return;
        }
        if (jumlah <= 0) {
            errors.push(`Baris ${rowNumber}: Jumlah tidak valid untuk ${empcode}, dilewati.`);
            return;
        }
        if (!ALLOWED_JENIS.includes(jenis)) {
            errors.push(`Baris ${rowNumber}: Jenis "${jenis}" tidak diizinkan. Hanya PREMI PRUNING dan PREMI RAKING.`);
            return;
        }

        rows.push({ empcode, gang_code: gangCode, subblok, jumlah, jenis });
    });

    if (rows.length === 0) {
        return { success: false, imported: 0, skipped: 0, errors: ['Tidak ada baris valid untuk diimport.', ...errors], details: [] };
    }

    // Group by empcode + jenis
    const groups = new Map<string, { jenis: string; gang_code: string; items: { subblok: string; gang_code: string; jumlah: number }[] }>();
    for (const row of rows) {
        const key = `${row.empcode}||${row.jenis}`;
        if (!groups.has(key)) {
            groups.set(key, { jenis: row.jenis, gang_code: row.gang_code, items: [] });
        }
        groups.get(key)!.items.push({ subblok: row.subblok, gang_code: row.gang_code, jumlah: row.jumlah });
    }

    const definitions = premiumDefinitionService.getActiveDefinitions();
    let imported = 0;
    let skipped = 0;
    const details: { empcode: string; jenis: string; totalAmount: number; itemCount: number }[] = [];

    for (const [key, group] of groups.entries()) {
        const [empcode] = key.split('||');
        const def = definitions.find((d) => d.adjustment_name === group.jenis);
        if (!def) {
            errors.push(`${empcode}: Definisi untuk "${group.jenis}" tidak ditemukan.`);
            skipped++;
            continue;
        }

        const totalAmount = group.items.reduce((sum, item) => sum + item.jumlah, 0);
        const metadataJson = {
            input_type: 'blok',
            items: group.items.map((item) => ({
                subblok: item.subblok,
                gang_code: item.gang_code,
                jumlah: item.jumlah
            })),
            total_amount: totalAmount
        };

        try {
            await manualAdjustmentService.saveAdjustment({
                period_month: periodMonth,
                period_year: periodYear,
                emp_code: empcode,
                nik: empcode,
                gang_code: group.gang_code,
                division_code: divisionCode,
                adjustment_type: 'PREMI',
                adjustment_name: group.jenis,
                amount: totalAmount,
                ad_code: def.ad_code,
                task_desc: def.task_desc,
                remarks: `${group.jenis} | ${def.ad_code} | ${totalAmount} | sync:MANUAL | match:MANUAL | IMPORT_EXCEL`,
                metadata_json: JSON.stringify(metadataJson)
            });
            imported++;
            details.push({ empcode, jenis: group.jenis, totalAmount, itemCount: group.items.length });
        } catch (e: any) {
            errors.push(`${empcode}: Gagal menyimpan — ${e.message || String(e)}`);
            skipped++;
        }
    }

    return { success: imported > 0, imported, skipped, errors, details };
}
