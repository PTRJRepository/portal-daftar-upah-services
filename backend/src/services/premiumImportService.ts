import ExcelJS from 'exceljs';
import { ManualAdjustmentService } from './manualAdjustmentService';
import { premiumDefinitionService, PremiumInputType, PremiumDefinition } from './premiumDefinitionService';
import { Database } from '../db/client';

// ── Column Mapping Engine ──

export interface ColumnMappingConfig {
    required_cols: string[];
    optional_cols: string[];
    header_aliases: Record<string, string[]>;
}

export interface ColumnMappingResult {
    mapping: Map<string, number>;
    missing_required: string[];
    warnings: string[];
}

export interface PremiumImportRow {
    empcode: string;
    gang_code: string;
    subblok: string;
    jumlah: number;
    jenis: string;
    [key: string]: any;
}

export interface PremiumImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    details: { empcode: string; jenis: string; totalAmount: number; itemCount: number }[];
    processed_rows?: number;
    total_rows?: number;
}

// ── Dry-Run Types ──

export type PremiumDryRunAction =
    | 'READY_INSERT'
    | 'WOULD_UPDATE'
    | 'DUPLICATE_SAME'
    | 'DUPLICATE_DIFFERENT'
    | 'SKIP_INVALID_EMPCODE'
    | 'SKIP_INVALID_EMPCODE_NOT_FOUND'
    | 'SKIP_INVALID_PREMIUM_TYPE'
    | 'SKIP_ZERO_AMOUNT';

export interface PremiumDryRunRow {
    row: number;
    empcode: string;
    emp_name: string;
    premium_type: string;
    gang_code: string;
    amount: number;
    item_count: number;
    existing_id: number | null;
    existing_amount: number | null;
    action: PremiumDryRunAction;
    reason: string;
}

export interface PremiumDryRunSummary {
    dry_run: true;
    total_rows: number;
    total_amount: number;
    action_breakdown: Record<PremiumDryRunAction, number>;
    rows: PremiumDryRunRow[];
    errors: string[];
}

// ── Seeder Progress ──

export interface SeederProgress {
    is_running: boolean;
    current_step: string;
    total_rows: number;
    processed_rows: number;
    imported: number;
    skipped: number;
    errors_count: number;
    started_at: number;
}

// ── Column Config Registry ──

const INPUT_TYPE_COLUMN_CONFIGS: Record<string, ColumnMappingConfig> = {
    blok: {
        required_cols: ['empcode', 'subblok', 'jumlah'],
        optional_cols: ['gang_code', 'jenis'],
        header_aliases: {
            empcode: ['empcode', 'emp_code', 'emp code', 'kode', 'kode karyawan', 'nik'],
            gang_code: ['gang_code', 'gang code', 'gang', 'regu', 'kode regu'],
            subblok: ['subblok', 'blok', 'block', 'kode blok'],
            jumlah: ['jumlah', 'amount', 'total', 'nominal', 'nilai'],
            jenis: ['jenis', 'premi', 'premi jenis', 'nama premi', 'tipe', 'type'],
        },
    },
};

function normalizeHeader(raw: string): string {
    return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function resolveHeaderName(header: string, config: ColumnMappingConfig): string | null {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(config.header_aliases)) {
        if (aliases.map(a => normalizeHeader(a)).includes(normalized)) {
            return field;
        }
    }
    return null;
}

export function buildColumnMapping(
    headerValues: any[],
    inputType: PremiumInputType
): ColumnMappingResult {
    const config = INPUT_TYPE_COLUMN_CONFIGS[inputType];
    if (!config) {
        return {
            mapping: new Map(),
            missing_required: [],
            warnings: [`Input type "${inputType}" tidak memiliki column config.`],
        };
    }

    const mapping = new Map<string, number>();
    const warnings: string[] = [];
    const unrecognized: string[] = [];

    for (let i = 0; i < headerValues.length; i++) {
        const val = headerValues[i];
        if (val === undefined || val === null) continue;
        const resolved = resolveHeaderName(String(val), config);
        if (resolved) {
            if (mapping.has(resolved)) {
                warnings.push(`Kolom "${String(val).trim()}" di indeks ${i} duplikat dengan field "${resolved}", menggunakan yang pertama.`);
            } else {
                mapping.set(resolved, i);
            }
        } else if (String(val).trim()) {
            unrecognized.push(String(val).trim());
        }
    }

    if (unrecognized.length > 0) {
        warnings.push(`Kolom tidak dikenali: ${unrecognized.join(', ')}. Kolom ini akan diabaikan.`);
    }

    const missing_required = config.required_cols.filter(col => !mapping.has(col));
    return { mapping, missing_required, warnings };
}

export function parseRowByHeaders(
    rowValues: any[],
    columnMapping: Map<string, number>,
    rowNumber: number
): { row: PremiumImportRow | null; errors: string[] } {
    const errors: string[] = [];
    const get = (field: string): string => {
        const idx = columnMapping.get(field);
        if (idx === undefined || idx >= rowValues.length) return '';
        return String(rowValues[idx] || '').trim();
    };
    const getNum = (field: string): number => {
        const idx = columnMapping.get(field);
        if (idx === undefined || idx >= rowValues.length) return 0;
        return parseFloat(rowValues[idx]) || 0;
    };

    const empcode = get('empcode');
    const gang_code = get('gang_code');
    const subblok = get('subblok');
    const jumlah = getNum('jumlah');
    const jenis = get('jenis');

    if (!empcode) {
        errors.push(`Baris ${rowNumber}: Empcode kosong, dilewati.`);
        return { row: null, errors };
    }
    if (!subblok) {
        errors.push(`Baris ${rowNumber}: Subblok kosong untuk ${empcode}, dilewati.`);
        return { row: null, errors };
    }
    if (jumlah <= 0) {
        errors.push(`Baris ${rowNumber}: Jumlah tidak valid untuk ${empcode}, dilewati.`);
        return { row: null, errors };
    }

    return { row: { empcode, gang_code, subblok, jumlah, jenis }, errors };
}

// ── Row Parsing (no validation, returns all parsed rows with warnings) ──

interface ParsedRow {
    row: PremiumImportRow | null;
    errors: string[];
    rowNumber: number;
}

function parseAllRows(worksheet: ExcelJS.Worksheet, colMapping: Map<string, number>): ParsedRow[] {
    const result: ParsedRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowValues = row.values as any[];
        const hasContent = rowValues.some((v, i) => i > 0 && v !== null && v !== undefined && String(v).trim() !== '');
        if (!hasContent) return;
        const parsed = parseRowByHeaders(rowValues, colMapping, rowNumber);
        result.push({ ...parsed, rowNumber });
    });
    return result;
}

// ── Employee Identity Resolution ──

interface EmployeeInfo {
    emp_code: string;
    nik: string;
    emp_name: string;
}

async function resolveEmployee(empcode: string): Promise<EmployeeInfo | null> {
    try {
        const db = Database.getVenusInstance();
        const result = await db.query(`
            SELECT TOP 1 EmpCode, NIK, EmpName
            FROM Employee
            WHERE EmpCode = @empcode
        `, { empcode });
        if (result.recordset && result.recordset.length > 0) {
            return {
                emp_code: result.recordset[0].EmpCode,
                nik: result.recordset[0].NIK,
                emp_name: result.recordset[0].EmpName,
            };
        }
        return null;
    } catch {
        return null;
    }
}

async function getExistingAdjustments(
    empCode: string,
    periodMonth: number,
    periodYear: number,
    adjustmentName: string
): Promise<{ id: number; amount: number } | null> {
    try {
        const db = Database.getExtendedInstance();
        const result = await db.query(`
            SELECT TOP 1 id, amount
            FROM payroll_manual_adjustments
            WHERE emp_code = @empCode
              AND period_month = @periodMonth
              AND period_year = @periodYear
              AND adjustment_name = @adjustmentName
        `, { empCode, periodMonth, periodYear, adjustmentName });
        if (result.recordset && result.recordset.length > 0) {
            return { id: result.recordset[0].id, amount: result.recordset[0].amount };
        }
        return null;
    } catch {
        return null;
    }
}

// ── TASK-002: Dry-Run Preview ──

export async function dryRunPremiumExcel(
    buffer: Buffer,
    periodMonth: number,
    periodYear: number,
    divisionCode: string,
    premiumType?: string
): Promise<PremiumDryRunSummary> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        return {
            dry_run: true,
            total_rows: 0, total_amount: 0,
            action_breakdown: {} as Record<PremiumDryRunAction, number>,
            rows: [],
            errors: ['File Excel kosong atau tidak memiliki worksheet.'],
        };
    }

    const headerRow = worksheet.getRow(1);
    const headerValues = headerRow.values as any[];

    let inputType: PremiumInputType = 'blok';
    let def: PremiumDefinition | null = null;
    if (premiumType) {
        def = premiumDefinitionService.getDefinitionByName(premiumType);
        if (!def) {
            return {
                dry_run: true,
                total_rows: 0, total_amount: 0,
                action_breakdown: {} as Record<PremiumDryRunAction, number>,
                rows: [],
                errors: [`Tipe premi "${premiumType}" tidak ditemukan.`],
            };
        }
        inputType = def.input_type;
    }

    const colResult = buildColumnMapping(headerValues, inputType);
    const errors: string[] = [...colResult.warnings];

    if (colResult.missing_required.length > 0) {
        return {
            dry_run: true,
            total_rows: 0, total_amount: 0,
            action_breakdown: {} as Record<PremiumDryRunAction, number>,
            rows: [],
            errors: [
                `Kolom wajib tidak ditemukan: ${colResult.missing_required.join(', ')}. ` +
                `Header tersedia: ${headerValues.filter(v => v).map(v => String(v).trim()).join(', ')}`,
                ...errors,
            ],
        };
    }

    const parsed = parseAllRows(worksheet, colResult.mapping);
    const rows: PremiumDryRunRow[] = [];
    const breakdown: Record<string, number> = {};
    let totalRows = 0;
    let totalAmount = 0;

    // Collect valid rows first
    const validParsed = parsed.filter(p => p.row !== null);
    const uniqueEmpcodes = [...new Set(validParsed.map(p => p.row!.empcode))];

    // Batch-resolve employees
    const employeeCache = new Map<string, EmployeeInfo | null>();
    for (const ec of uniqueEmpcodes) {
        employeeCache.set(ec, await resolveEmployee(ec));
    }

    for (const p of parsed) {
        if (!p.row) {
            errors.push(...p.errors);
            continue;
        }

        const { empcode, gang_code, jumlah, jenis } = p.row;
        const resolvedJenis = jenis || premiumType || '';
        const effectiveDef = def || premiumDefinitionService.getDefinitionByName(resolvedJenis) || null;

        let action: PremiumDryRunAction;
        let reason: string;
        let empName = '';

        // Resolve employee
        const emp = employeeCache.get(empcode);
        if (!emp) {
            action = 'SKIP_INVALID_EMPCODE_NOT_FOUND';
            reason = `EmpCode "${empcode}" tidak ditemukan di database karyawan.`;
        } else {
            empName = emp.emp_name;

            if (!effectiveDef) {
                action = 'SKIP_INVALID_PREMIUM_TYPE';
                reason = `Tipe premi "${resolvedJenis}" tidak ditemukan dalam definisi aktif.`;
            } else if (jumlah <= 0) {
                action = 'SKIP_ZERO_AMOUNT';
                reason = 'Jumlah premi 0 atau negatif.';
            } else {
                // Check existing records
                const existing = await getExistingAdjustments(empcode, periodMonth, periodYear, effectiveDef.adjustment_name);
                if (existing) {
                    if (Math.abs(existing.amount - jumlah) < 0.01) {
                        action = 'DUPLICATE_SAME';
                        reason = `Data sudah ada dengan jumlah sama (Rp ${existing.amount.toLocaleString('id-ID')}).`;
                    } else {
                        action = 'DUPLICATE_DIFFERENT';
                        reason = `Data sudah ada dengan jumlah berbeda. Existing: Rp ${existing.amount.toLocaleString('id-ID')}, New: Rp ${jumlah.toLocaleString('id-ID')}.`;
                    }
                } else {
                    action = 'READY_INSERT';
                    reason = 'Data baru, siap diimport.';
                }
            }
        }

        breakdown[action] = (breakdown[action] || 0) + 1;
        totalRows++;
        if (jumlah > 0) totalAmount += jumlah;

        rows.push({
            row: p.rowNumber,
            empcode,
            emp_name: empName,
            premium_type: resolvedJenis,
            gang_code,
            amount: jumlah,
            item_count: 1,
            existing_id: null,
            existing_amount: null,
            action,
            reason,
        });
    }

    return {
        dry_run: true,
        total_rows: totalRows,
        total_amount: totalAmount,
        action_breakdown: breakdown as Record<PremiumDryRunAction, number>,
        rows,
        errors,
    };
}

// ── TASK-003: Import with Progress & UPSERT ──

const IMPORT_TIMEOUT_MS = 180_000;

let importProgress: SeederProgress | null = null;

export function getPremiumImportProgress(): SeederProgress | null {
    return importProgress;
}

export function resetPremiumImportProgress(): void {
    importProgress = null;
}

export async function importPremiumExcel(
    buffer: Buffer,
    periodMonth: number,
    periodYear: number,
    divisionCode: string,
    manualAdjustmentService: ManualAdjustmentService,
    premiumType?: string,
    dryRunConfirmationId?: string
): Promise<PremiumImportResult> {
    const startTime = Date.now();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        return { success: false, imported: 0, skipped: 0, errors: ['File Excel kosong atau tidak memiliki worksheet.'], details: [] };
    }

    const headerRow = worksheet.getRow(1);
    const headerValues = headerRow.values as any[];

    let inputType: PremiumInputType = 'blok';
    if (premiumType) {
        const def = premiumDefinitionService.getDefinitionByName(premiumType);
        if (!def) {
            return { success: false, imported: 0, skipped: 0, errors: [`Tipe premi "${premiumType}" tidak ditemukan.`], details: [] };
        }
        inputType = def.input_type;
    }

    const colResult = buildColumnMapping(headerValues, inputType);
    const errors: string[] = [...colResult.warnings];

    if (colResult.missing_required.length > 0) {
        return {
            success: false, imported: 0, skipped: 0,
            errors: [`Kolom wajib tidak ditemukan: ${colResult.missing_required.join(', ')}. ` +
                `Header tersedia: ${headerValues.filter(v => v).map(v => String(v).trim()).join(', ')}. ` +
                `${colResult.warnings.join(' ')}`],
            details: [],
        };
    }

    const parsed = parseAllRows(worksheet, colResult.mapping);
    const validRows = parsed.filter(p => p.row !== null).map(p => ({ ...p.row!, rowNumber: p.rowNumber }));
    errors.push(...parsed.filter(p => p.row === null).flatMap(p => p.errors));

    // Init progress
    importProgress = {
        is_running: true,
        current_step: 'Memproses baris Excel...',
        total_rows: validRows.length,
        processed_rows: 0,
        imported: 0,
        skipped: 0,
        errors_count: 0,
        started_at: startTime,
    };

    if (validRows.length === 0) {
        importProgress.is_running = false;
        return { success: false, imported: 0, skipped: 0, errors: ['Tidak ada baris valid untuk diimport.', ...errors], details: [] };
    }

    // Resolve jenis: use column value or override with premiumType parameter
    for (const row of validRows) {
        if (premiumType && (!row.jenis || row.jenis.trim() === '')) {
            row.jenis = premiumType;
        }
    }

    // Group by empcode + jenis
    const groups = new Map<string, { jenis: string; gang_code: string; items: { subblok: string; gang_code: string; jumlah: number }[] }>();
    for (const row of validRows) {
        const key = `${row.empcode}||${row.jenis}`;
        if (!groups.has(key)) {
            groups.set(key, { jenis: row.jenis, gang_code: row.gang_code, items: [] });
        }
        groups.get(key)!.items.push({ subblok: row.subblok, gang_code: row.gang_code, jumlah: row.jumlah });
    }

    const definitions = premiumDefinitionService.getActiveDefinitions();
    let imported = 0;
    let skipped = 0;
    let processed = 0;
    const total = groups.size;
    const details: { empcode: string; jenis: string; totalAmount: number; itemCount: number }[] = [];

    for (const [key, group] of groups.entries()) {
        // Timeout check
        if (Date.now() - startTime > IMPORT_TIMEOUT_MS) {
            errors.push(`Timeout setelah ${IMPORT_TIMEOUT_MS / 1000}s. ${total - processed} dari ${total} grup tersisa.`);
            importProgress.current_step = `Timeout. ${processed}/${total} grup diproses.`;
            break;
        }

        const [empcode] = key.split('||');
        const def = definitions.find((d) => d.adjustment_name === group.jenis);
        if (!def) {
            errors.push(`${empcode}: Definisi untuk "${group.jenis}" tidak ditemukan.`);
            skipped++;
            processed++;
            continue;
        }

        const totalAmount = group.items.reduce((sum, item) => sum + item.jumlah, 0);
        const metadataJson = {
            input_type: def.input_type,
            items: group.items.map((item) => ({
                subblok: item.subblok,
                gang_code: item.gang_code,
                jumlah: item.jumlah,
            })),
            total_amount: totalAmount,
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
                metadata_json: JSON.stringify(metadataJson),
            });
            imported++;
            details.push({ empcode, jenis: group.jenis, totalAmount, itemCount: group.items.length });
        } catch (e: any) {
            errors.push(`${empcode}: Gagal menyimpan — ${e.message || String(e)}`);
            skipped++;
        }

        processed++;
        importProgress.processed_rows = processed;
        importProgress.imported = imported;
        importProgress.skipped = skipped;
        importProgress.errors_count = errors.length;
        importProgress.current_step = `Menyimpan ${processed}/${total} grup data...`;
    }

    importProgress.is_running = false;
    importProgress.current_step = 'Selesai.';
    importProgress.total_rows = total;

    return {
        success: imported > 0,
        imported,
        skipped,
        errors,
        details,
        processed_rows: processed,
        total_rows: total,
    };
}

// ── TASK-004: Template Generator ──

export async function generatePremiumTemplate(
    premiumTypes?: string[]
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistem Daftar Upah PT Rebinmas';

    const types = premiumTypes && premiumTypes.length > 0
        ? premiumTypes
        : premiumDefinitionService.getActivePremiumDefinitions()
            .filter(d => d.input_type === 'blok')
            .map(d => d.adjustment_name);

    for (const typeName of types) {
        const def = premiumDefinitionService.getDefinitionByName(typeName);
        if (!def) continue;

        const config = INPUT_TYPE_COLUMN_CONFIGS[def.input_type] || INPUT_TYPE_COLUMN_CONFIGS['blok'];
        // Build column list: required first, then optional
        const columns = [...config.required_cols, ...config.optional_cols];
        const columnLabels: Record<string, string> = {
            empcode: 'EmpCode',
            gang_code: 'Gang Code',
            subblok: 'Subblok',
            jumlah: 'Jumlah',
            jenis: 'Jenis Premi',
        };
        const columnDescriptions: Record<string, string> = {
            empcode: 'Masukkan kode karyawan (EmpCode)',
            gang_code: 'Masukkan kode regu/gang (opsional)',
            subblok: 'Masukkan kode subblok/blok',
            jumlah: 'Masukkan jumlah premi (angka)',
            jenis: 'Masukkan jenis premi (opsional jika template per jenis)',
        };

        const sheet = workbook.addWorksheet(def.adjustment_name.substring(0, 31));
        const colCount = columns.length;

        // Title row (row 1)
        sheet.mergeCells(1, 1, 1, colCount);
        const titleCell = sheet.getCell('A1');
        titleCell.value = `TEMPLATE PREMI ${def.adjustment_name} — Periode: ___/____`;
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4E79' },
        };
        titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).height = 30;

        // Header row (row 2)
        const headerRow = sheet.getRow(2);
        headerRow.height = 25;
        columns.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = columnLabels[col] || col;
            cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF333333' },
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
        });

        // Helper row (row 3)
        const helperRow = sheet.getRow(3);
        helperRow.height = 35;
        columns.forEach((col, idx) => {
            const cell = helperRow.getCell(idx + 1);
            cell.value = columnDescriptions[col] || '';
            cell.font = { italic: true, size: 9, color: { argb: 'FF888888' } };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });

        // Column widths
        const colWidths: Record<string, number> = {
            empcode: 18,
            gang_code: 14,
            subblok: 16,
            jumlah: 16,
            jenis: 26,
        };
        columns.forEach((col, idx) => {
            sheet.getColumn(idx + 1).width = colWidths[col] || 15;
        });

        // Data rows (rows 4-103, 100 rows for data entry)
        for (let r = 4; r <= 103; r++) {
            const row = sheet.getRow(r);
            columns.forEach((col, idx) => {
                const cell = row.getCell(idx + 1);
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
                if (col === 'jumlah') {
                    cell.numFmt = '#,##0';
                }
            });
        }

        // Footer
        const footerRow = sheet.getRow(105);
        sheet.mergeCells(105, 1, 105, colCount);
        const footerCell = footerRow.getCell(1);
        footerCell.value = `Didukung oleh Sistem Daftar Upah PT Rebinmas — ${new Date().toLocaleDateString('id-ID')}`;
        footerCell.font = { italic: true, size: 8, color: { argb: 'FFAAAAAA' } };
        footerCell.alignment = { horizontal: 'center' };

        // Freeze panes below header + helper rows
        sheet.views = [
            {
                state: 'frozen',
                ySplit: 3,
            },
        ];
    }

    return (await workbook.xlsx.writeBuffer()) as Buffer;
}
