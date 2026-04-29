import { Database } from "../db/client";
import { employeeIdentityResolverService } from "./employeeIdentityResolverService";
import { Config } from "../config";
import { divisionConfigService } from "./config/DivisionConfigService";
import { taskCodeOptionService, type TaskCodeOption } from "./taskCodeOptionService";
import {
    normalizeStoredAdjustmentName,
    shouldDeleteStoredAdjustment
} from "./payroll/manualAdjustments/manualAdjustmentNaming";

function buildNormalizedSqlNameExpression(columnName: string): string {
    let expression = `UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(${columnName}, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' '))))`;

    for (let i = 0; i < 4; i += 1) {
        expression = `REPLACE(${expression}, '  ', ' ')`;
    }

    return expression;
}

export interface AdtransDuplicateSourceRow {
    id: number;
    doc_id: string;
    doc_date: string;
    doc_desc: string;
    emp_code: string;
    emp_name: string;
    amount: number;
}

export interface AdtransComparisonItem {
    emp_code: string;
    category: string;
    adjustment_name: string;
    source_amount: number;
    stored_amount: number | null;
    diff: number | null;
    status: 'MATCH' | 'MISMATCH' | 'MISSING';
    gang_code: string | null;
    remarks: string | null;
}

export interface ReverseAdtransComparisonItem {
    emp_code: string;
    stored_emp_identifier: string | null;
    category: string;
    adjustment_name: string;
    stored_amount: number;
    source_amount: number;
    diff: number;
    status: 'MATCH' | 'MISMATCH' | 'EXTRA_IN_ADJUSTMENTS';
    gang_code: string | null;
    division_code: string | null;
    remarks: string | null;
}

function normalizeAdtransFilter(filter: string): string {
    const filterKey = filter.toLowerCase().trim();

    if (filterKey.includes('spsi')) return 'spsi';
    if (filterKey.includes('masa')) return 'masa kerja';
    if (filterKey.includes('jabatan')) return 'jabatan';
    if (filterKey.includes('premi')) return 'premi';
    if (filterKey.includes('potongan')) return 'potongan';

    return filterKey;
}

function matchesAdtransFilter(docDesc: string, filter: string): boolean {
    const category = normalizeAdtransFilter(filter);
    const normalizedDocDesc = docDesc.toUpperCase();

    if (category === 'spsi') return normalizedDocDesc.includes('SPSI');
    if (category === 'masa kerja') return normalizedDocDesc.includes('MASA') && normalizedDocDesc.includes('KERJA');
    if (category === 'jabatan') return normalizedDocDesc.includes('JABATAN');
    if (category === 'premi') return normalizedDocDesc.includes('PREMI');
    if (category === 'potongan') return normalizedDocDesc.startsWith('POT');

    return normalizedDocDesc.includes(category.toUpperCase());
}

function normalizeAdtransDivisionLocCode(divisionCode: string): string {
    const normalized = divisionCode.trim().toUpperCase();
    const locCodeMap: Record<string, string> = {
        PG1A: 'P1A',
        PG1B: 'P1B',
        PG2A: 'P2A',
        PG2B: 'P2B',
        ARB1: 'AB1',
        ARB2: 'AB2',
        AREC: 'ARC',
        PLASMA1A: 'P1A',
        PLASMA1B: 'P1B',
        PLASMA2A: 'P2A',
        PLASMA2B: 'P2B',
        '1A': 'P1A',
        '1B': 'P1B',
        '2A': 'P2A',
        '2B': 'P2B'
    };

    return locCodeMap[normalized] || normalized;
}

/**
 * Resolve a division code (real or virtual) to the LocCode used in PR_ADTRANS.
 * Virtual divisions (e.g. NRS, INF, WKS_AR) have a sourceDivision (e.g. PG1B, PG1A, AB2)
 * that maps to the actual LocCode in db_ptrj.
 */
function resolveAdtransLocCode(divisionCode: string): string {
    const resolved = divisionCode.trim().toUpperCase();
    const sourceDivision = divisionConfigService.getSourceDivision(resolved);
    if (sourceDivision) {
        return normalizeAdtransDivisionLocCode(sourceDivision);
    }
    return normalizeAdtransDivisionLocCode(resolved);
}

function buildAdtransSqlPattern(filter: string): string {
    const category = normalizeAdtransFilter(filter);

    if (category === 'spsi') return '%SPSI%';
    if (category === 'masa kerja') return 'MASA%KERJA%';
    if (category === 'jabatan') return '%JABATAN%';
    if (category === 'premi') return '%PREMI%';
    if (category === 'potongan') return 'POT%';

    return `%${category.toUpperCase()}%`;
}

function normalizeText(value: unknown): string {
    return String(value || '').trim();
}

function resolveManualAdjustmentAdCode(data: Pick<ManualAdjustment, 'ad_code' | 'base_task_code' | 'task_code'>): string {
    return normalizeText(data.ad_code || data.base_task_code || data.task_code).toUpperCase();
}

export function manualAdjustmentRequiresAdCode(adjustmentType: string): boolean {
    return normalizeText(adjustmentType).toUpperCase() !== 'AUTO_BUFFER';
}

function isPipeDelimitedRemarks(remarks: string): boolean {
    return remarks.includes('|') && /\|\s*-?\d+\s*\|\s*sync:/i.test(remarks);
}

export function buildManualAdjustmentRemarks(data: ManualAdjustment): string | null {
    const existingRemarks = normalizeText(data.remarks);
    const adCode = resolveManualAdjustmentAdCode(data);
    const taskDesc = normalizeText(data.task_desc);

    // If remarks is already in pipe-delimited preset format, preserve it as-is
    if (existingRemarks && isPipeDelimitedRemarks(existingRemarks)) {
        return existingRemarks;
    }

    if (!adCode) {
        return existingRemarks || null;
    }

    const adCodeRemark = `AD CODE: ${adCode}${taskDesc ? ` - ${taskDesc}` : ''}`;
    if (!existingRemarks) return adCodeRemark;
    if (existingRemarks.toUpperCase().includes('AD CODE:') || existingRemarks.toUpperCase().includes('SYNC:')) return existingRemarks;

    return `${adCodeRemark}; ${existingRemarks}`;
}

function validateManualAdjustmentAdCode(data: ManualAdjustment): void {
    if (!manualAdjustmentRequiresAdCode(data.adjustment_type)) return;

    const remarks = normalizeText(data.remarks).toUpperCase();
    const isManualColumnRequest = remarks.includes('INIT_COLUMN') || remarks.includes('AD CODE:');
    if (!isManualColumnRequest) return;
    if (resolveManualAdjustmentAdCode(data)) return;

    throw new Error('ADCode wajib diisi untuk kolom manual adjustment selain auto buffer');
}

function expectedTaskDescPrefix(adjustmentType: string): "(AL)" | "(DE)" | null {
    const type = normalizeText(adjustmentType).toUpperCase();
    if (type === "PREMI") return "(AL)";
    if (type === "POTONGAN_KOTOR" || type === "POTONGAN_BERSIH") return "(DE)";
    return null;
}

function normalizeSearchWords(value: unknown): string[] {
    return normalizeText(value)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, " ")
        .split(" ")
        .filter((word) => word.length >= 3 && !["PREMI", "POTONGAN", "KOREKSI", "MANUAL", "EDIT", "SYNC", "MATCH"].includes(word));
}

function scoreTaskCodeOption(option: TaskCodeOption, searchWords: string[]): number {
    const haystack = `${option.task_desc} ${option.ad_code} ${option.task_code} ${option.base_task_code || ""}`.toUpperCase();
    return searchWords.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

export async function resolveManualAdjustmentPresetMapping(data: ManualAdjustment, adjustmentName: string): Promise<Partial<ManualAdjustment>> {
    if (resolveManualAdjustmentAdCode(data)) return {};

    const prefix = expectedTaskDescPrefix(data.adjustment_type);
    if (!prefix) return {};

    const searchWords = normalizeSearchWords(`${adjustmentName} ${data.remarks || ""}`);
    const options = await taskCodeOptionService.searchOptions({
        search: searchWords[0] || prefix,
        divisionCode: data.division_code,
        limit: 100
    });
    const matchingOptions = options.filter((option) => normalizeText(option.task_desc).toUpperCase().startsWith(prefix));
    const candidates = matchingOptions.length ? matchingOptions : options;
    const sorted = [...candidates].sort((a, b) => scoreTaskCodeOption(b, searchWords) - scoreTaskCodeOption(a, searchWords));
    const selected = sorted[0];
    if (!selected?.ad_code) return {};

    return {
        ad_code: selected.ad_code,
        task_code: selected.task_code,
        base_task_code: selected.base_task_code || selected.ad_code,
        task_desc: selected.task_desc
    };
}

export function buildAdtransDuplicateReport(rows: AdtransDuplicateSourceRow[], filters: string[]) {
    const groups = new Map<string, AdtransDuplicateSourceRow[]>();

    for (const row of rows) {
        for (const filter of filters) {
            if (!matchesAdtransFilter(row.doc_desc || '', filter)) continue;

            const category = normalizeAdtransFilter(filter);
            const key = `${row.emp_code}|${category}`;
            const groupRows = groups.get(key) || [];
            groupRows.push(row);
            groups.set(key, groupRows);
        }
    }

    const duplicates = Array.from(groups.entries())
        .map(([key, groupRows]) => {
            const [empCode, category] = key.split('|');
            const sortedRows = [...groupRows].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
            const keepRecord = sortedRows[sortedRows.length - 1];
            const deleteRecords = sortedRows.slice(0, -1);

            return {
                emp_code: empCode,
                emp_name: keepRecord?.emp_name || sortedRows[0]?.emp_name || '',
                category,
                record_count: sortedRows.length,
                keep_id: keepRecord.id,
                keep_doc_id: keepRecord.doc_id,
                delete_ids: deleteRecords.map((record) => record.id),
                delete_doc_ids: deleteRecords.map((record) => record.doc_id),
                records: sortedRows.map((record) => ({
                    id: record.id,
                    doc_id: record.doc_id,
                    doc_date: record.doc_date,
                    doc_desc: record.doc_desc,
                    amount: Number(record.amount || 0),
                    action: record.id === keepRecord.id ? 'KEEP_NEWEST' : 'DELETE_OLD'
                }))
            };
        })
        .filter((duplicate) => duplicate.record_count > 1);

    return {
        duplicate_count: duplicates.length,
        duplicates
    };
}

export interface ManualAdjustment {
    id?: number;
    period_month: number;
    period_year: number;
    nik?: string;       // Real NIK (KTP) - primary identifier
    emp_code: string;   // Emp code (B0065, etc.) - for lookup
    emp_name?: string;
    gang_code: string;
    division_code?: string;
    adjustment_type: 'PREMI' | 'POTONGAN_KOTOR' | 'POTONGAN_BERSIH' | 'PENDAPATAN_LAINNYA' | 'AUTO_BUFFER';
    adjustment_name: string;
    amount: number;
    remarks?: string;
    ad_code?: string;
    task_code?: string;
    base_task_code?: string;
    task_desc?: string;
    created_at?: Date;
    created_by?: string;
    updated_at?: Date;
    updated_by?: string;
}

export class ManualAdjustmentService {
    private static instance: ManualAdjustmentService;

    private constructor() { }

    public static getInstance(): ManualAdjustmentService {
        if (!ManualAdjustmentService.instance) {
            ManualAdjustmentService.instance = new ManualAdjustmentService();
        }
        return ManualAdjustmentService.instance;
    }

    private getDatabase(): Database {
        return Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    }

    /**
     * Get all manual adjustments for a specific period and gang
     */
    public async getAdjustments(
        month: number,
        year: number,
        gangCode?: string,
        empCode?: string,
        divisionCode?: string,
        adjustmentType?: string,
        adjustmentName?: string
    ): Promise<ManualAdjustment[]> {
        const db = this.getDatabase();
        let query = `
            SELECT * FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND adjustment_type IN ('PREMI', 'POTONGAN_KOTOR', 'POTONGAN_BERSIH', 'PENDAPATAN_LAINNYA', 'AUTO_BUFFER')
        `;
        const params: any[] = [month, year];

        if (divisionCode) {
            query += ` AND division_code = ?`;
            params.push(divisionCode);
        }

        if (gangCode && gangCode !== 'ALL') {
            query += ` AND gang_code = ?`;
            params.push(gangCode);
        }

        if (empCode) {
            query += ` AND emp_code = ?`;
            params.push(empCode);
        }

        if (adjustmentType) {
            const MANUAL_ALIAS_TYPES = ['PREMI', 'POTONGAN_KOTOR', 'POTONGAN_BERSIH', 'PENDAPATAN_LAINNYA'];
            const rawTypes = adjustmentType.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
            const resolvedTypes = rawTypes.flatMap(t =>
                t === 'MANUAL' ? MANUAL_ALIAS_TYPES : [t]
            );
            if (resolvedTypes.length === 1) {
                query += ` AND adjustment_type = ?`;
                params.push(resolvedTypes[0]);
            } else if (resolvedTypes.length > 1) {
                query += ` AND adjustment_type IN (${resolvedTypes.map(() => '?').join(', ')})`;
                params.push(...resolvedTypes);
            }
        }

        if (adjustmentName) {
            query += ` AND UPPER(adjustment_name) LIKE ?`;
            params.push(`%${adjustmentName.toUpperCase()}%`);
        }

        return await db.query<ManualAdjustment>(query, params);
    }

    /**
     * Save PENDAPATAN_LAINNYA (e.g. KONTAN) to employee_other_incomes table.
     * Uses upsert logic: update if exists (same nik/emp_code + period + income_name), insert if not.
     *
     * STORAGE STRATEGY:
     * - nik: Real NIK (KTP) - primary stable identifier for data extractor lookup
     * - emp_code: Employee code (B0065, etc.) - for emp_code-based lookup fallback
     * - Both fields stored so data extractor can find by either
     *
     * The frontend sends both `nik` (real NIK) and `emp_code` (B0065, etc.)
     * to ensure the data extractor can find the record.
     */
    private async saveOtherIncome(db: Database, data: ManualAdjustment, parsedAmount: number, user?: string): Promise<number> {
        const incomeType = data.adjustment_name; // e.g. 'KONTAN'
        const incomeName = normalizeStoredAdjustmentName(data.adjustment_name); // e.g. 'KONTAN'
        // Use real NIK for nik field, emp_code for emp_code field
        const realNik = (data.nik || '').trim().toUpperCase() || (data.emp_code || '').trim().toUpperCase();
        const empCodeVal = (data.emp_code || '').trim().toUpperCase();

        console.log(`[saveOtherIncome] Saving: nik=${realNik}, emp_code=${empCodeVal}, income=${incomeName}, amount=${parsedAmount}`);

        // Check for existing record: try by nik, then by emp_code
        let existing = await db.queryOne<{ id: number; nik: string; emp_code: string }>(`
            SELECT id, nik, emp_code FROM dbo.employee_other_incomes
            WHERE nik = ? AND period_month = ? AND period_year = ?
            AND ${buildNormalizedSqlNameExpression('income_name')} = ?
        `, [realNik, data.period_month, data.period_year, incomeName]);

        // Fallback: check by emp_code if not found by nik
        if (!existing) {
            existing = await db.queryOne<{ id: number; nik: string; emp_code: string }>(`
                SELECT id, nik, emp_code FROM dbo.employee_other_incomes
                WHERE emp_code = ? AND period_month = ? AND period_year = ?
                AND ${buildNormalizedSqlNameExpression('income_name')} = ?
            `, [empCodeVal, data.period_month, data.period_year, incomeName]);
        }

        if (existing) {
            if (parsedAmount === 0) {
                await db.query(`DELETE FROM dbo.employee_other_incomes WHERE id = ?`, [existing.id]);
                console.log(`[saveOtherIncome] Deleted ${incomeName} for nik=${realNik}, emp_code=${empCodeVal}`);
                return existing.id;
            }
            // Update existing: store BOTH nik and emp_code for consistent lookups
            await db.query(`
                UPDATE dbo.employee_other_incomes
                SET nik = ?, emp_code = ?, amount = ?, updated_at = GETDATE()
                WHERE id = ?
            `, [realNik, empCodeVal, parsedAmount, existing.id]);
            console.log(`[saveOtherIncome] Updated ${incomeName}: nik=${realNik}, emp_code=${empCodeVal}: Rp${parsedAmount}`);
            return existing.id;
        } else {
            if (parsedAmount === 0) return 0; // Don't insert zero

            // Insert new record with BOTH nik and emp_code
            const result = await db.query(`
                INSERT INTO dbo.employee_other_incomes (
                    nik, emp_code, emp_name, division_code, gang_code,
                    period_year, period_month, income_type, income_name,
                    amount, is_paid_in_thp, is_taxable,
                    created_at, updated_at
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE()
                )
            `, [
                realNik,            // nik = real NIK (KTP) - primary lookup key
                empCodeVal,         // emp_code = emp_code - secondary lookup key
                null,               // emp_name - null, enriched by data extractor
                data.division_code || null,
                data.gang_code,
                data.period_year,
                data.period_month,
                incomeType,         // income_type = 'KONTAN'
                incomeName,         // income_name = 'KONTAN'
                parsedAmount,
                0,                  // is_paid_in_thp = false (added to gross wage, not THP)
                0,                  // is_taxable = false (not taxable income)
            ]);
            const id = result[0]?.id;
            console.log(`[saveOtherIncome] Inserted ${incomeName}: nik=${realNik}, emp_code=${empCodeVal}: Rp${parsedAmount}, ID=${id}`);
            return id;
        }
    }

    /**
     * Save a manual adjustment (Insert or Update)
     *
     * Special handling for PENDAPATAN_LAINNYA:
     * - Saves to employee_other_incomes table (like THR, Bonus, Custom)
     * - is_paid_in_thp = false (added to gross wage, not THP)
     * - is_taxable = false (not taxable income)
     */
    public async saveAdjustment(data: ManualAdjustment, user?: string): Promise<number> {
        const db = this.getDatabase();

        // Ensure amount is a valid float
        const parsedAmount = parseFloat(data.amount.toString()) || 0;
        const normalizedAdjustmentName = normalizeStoredAdjustmentName(data.adjustment_name);
        const normalizedAdjustmentNameSql = buildNormalizedSqlNameExpression('adjustment_name');
        validateManualAdjustmentAdCode(data);
        const remarks = buildManualAdjustmentRemarks(data);
        const identity = await employeeIdentityResolverService.resolve(data.nik || data.emp_code);
        const empName = String(data.emp_name || identity?.emp_name || '').trim().toUpperCase() || null;

        // --- PENDAPATAN_LAINNYA: Save to employee_other_incomes ---
        if (data.adjustment_type === 'PENDAPATAN_LAINNYA') {
            console.log(`[saveAdjustment] PENDAPATAN_LAINNYA: emp_code=${data.emp_code}, gang=${data.gang_code}, name=${normalizedAdjustmentName}, amount=${parsedAmount}`);
            return await this.saveOtherIncome(db, { ...data, adjustment_name: normalizedAdjustmentName, remarks: remarks || undefined }, parsedAmount, user);
        }

        // --- Standard adjustments: Save to payroll_manual_adjustments ---

        // Check if an exact match exists
        const existing = await db.queryOne<{ id: number }>(`
            SELECT id FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ? 
            AND emp_code = ? AND adjustment_type = ?
            AND ${normalizedAdjustmentNameSql} = ?
        `, [data.period_month, data.period_year, data.emp_code, data.adjustment_type, normalizedAdjustmentName]);

        if (existing) {
            if (shouldDeleteStoredAdjustment(parsedAmount, data.remarks)) {
                // If amount is 0, delete it from the table
                await db.query(`DELETE FROM dbo.payroll_manual_adjustments WHERE id = ?`, [existing.id]);
                return existing.id;
            } else {
                // Update
                await db.query(`
                    UPDATE dbo.payroll_manual_adjustments
                    SET amount = ?, remarks = ?, emp_name = ?, updated_at = GETDATE(), updated_by = ?
                    WHERE id = ?
                `, [parsedAmount, remarks, empName, user || 'system', existing.id]);
                return existing.id;
            }
        } else {
            if (shouldDeleteStoredAdjustment(parsedAmount, data.remarks)) return 0; // Don't insert zero

            // Insert
            const result = await db.query(`
                INSERT INTO dbo.payroll_manual_adjustments (
                    period_month, period_year, emp_code, emp_name, gang_code, division_code,
                    adjustment_type, adjustment_name, amount, remarks, created_by
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            `, [
                data.period_month, data.period_year, data.emp_code, empName, data.gang_code, data.division_code || null,
                data.adjustment_type, normalizedAdjustmentName, parsedAmount, remarks, user || 'system'
            ]);

            // Auto-save as preset for recent/history (fire-and-forget)
            try {
                const { manualAdjustmentPresetService } = await import("./manualAdjustmentPresetService");
                const mappedPresetFields = await resolveManualAdjustmentPresetMapping(data, normalizedAdjustmentName);
                const presetData = { ...data, ...mappedPresetFields };
                const presetAdCode = resolveManualAdjustmentAdCode(presetData);
                if (presetAdCode) {
                    await manualAdjustmentPresetService.upsertPreset({
                        adjustment_type: data.adjustment_type,
                        adjustment_name: normalizedAdjustmentName,
                        ad_code: presetAdCode,
                        task_code: presetData.task_code,
                        base_task_code: presetData.base_task_code,
                        task_desc: presetData.task_desc,
                        division_code: data.division_code || null,
                        remarks_template: buildManualAdjustmentRemarks({
                            ...presetData,
                            adjustment_name: normalizedAdjustmentName,
                            remarks: data.remarks
                        }) || undefined
                    }, user);
                }
            } catch (e) {
                // Silent fail — preset upsert is best-effort
                console.warn('[saveAdjustment] Auto-preset upsert failed:', e);
            }

            return result[0]?.id;
        }
    }

    /**
     * Delete an adjustment by id
     */
    public async deleteAdjustment(id: number): Promise<void> {
        const db = this.getDatabase();
        await db.query(`DELETE FROM dbo.payroll_manual_adjustments WHERE id = ?`, [id]);
    }

    public async deleteAdjustmentColumn(input: {
        period_month: number;
        period_year: number;
        division_code?: string;
        adjustment_type: string;
        adjustment_name: string;
    }): Promise<number> {
        const db = this.getDatabase();
        const normalizedAdjustmentName = normalizeStoredAdjustmentName(input.adjustment_name);
        const normalizedAdjustmentNameSql = buildNormalizedSqlNameExpression('adjustment_name');
        const params: any[] = [
            input.period_month,
            input.period_year,
            input.adjustment_type,
            normalizedAdjustmentName
        ];
        let divisionFilter = '';

        if (input.division_code) {
            divisionFilter = ' AND division_code = ?';
            params.push(input.division_code);
        }

        const existing = await db.query<{ id: number }>(`
            SELECT id FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND adjustment_type = ?
              AND ${normalizedAdjustmentNameSql} = ?
              ${divisionFilter}
        `, params);

        await db.query(`
            DELETE FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND adjustment_type = ?
              AND ${normalizedAdjustmentNameSql} = ?
              ${divisionFilter}
        `, params);

        return existing.length;
    }

    /**
     * Checks PR_ADTRANS (and ARC) directly for specific employee adjustments.
     * Uses PhyMonth and PhyYear to map to the real calendar month.
     */
    public async checkAdtransDirectly(
        periodMonth: number,
        periodYear: number,
        empCodes: string[] = [],
        filters: string[],
        divisionCode?: string
    ): Promise<any> {
        const dbMain = Database.getInstance(); // db_ptrj

        if (!filters || filters.length === 0) {
            return [];
        }

        const normalizedEmpCodes = (empCodes || []).map((empCode) => empCode.trim()).filter(Boolean);
        // Virtual divisions (NRS, INF, WKS_AR, etc.) resolve to their source division's LocCode
        const normalizedDivisionCode = divisionCode ? resolveAdtransLocCode(divisionCode) : '';
        const scopeClauses: string[] = [];
        const scopeParams: any[] = [];

        if (normalizedEmpCodes.length > 0) {
            scopeClauses.push(`RTRIM(t.EmpCode) IN (${normalizedEmpCodes.map(() => '?').join(',')})`);
            scopeParams.push(...normalizedEmpCodes);
        }

        if (normalizedDivisionCode) {
            scopeClauses.push(`UPPER(RTRIM(t.LocCode)) = ?`);
            scopeParams.push(normalizedDivisionCode);
        }

        if (scopeClauses.length === 0) {
            return [];
        }

        const scopeSql = `(${scopeClauses.join(' OR ')})`;
        const normalizedFilters = filters.map(normalizeAdtransFilter);
        const caseStatements = normalizedFilters.map((filterKey) => {
            const sqlLike = buildAdtransSqlPattern(filterKey).replace(/'/g, "''");
            return `SUM(CASE WHEN UPPER(DocDesc) LIKE '${sqlLike}' THEN Amount ELSE 0 END) as [${filterKey}]`;
        }).join(", ");

        // IMPORTANT: diambil dari phymonth dan phyyear itu adalah real monthnya sesuai kalender
        const adtransQuery = `
            SELECT 
                emp_code, 
                ${caseStatements}
            FROM (
                SELECT 
                    RTRIM(t.EmpCode) as emp_code,
                    t.DocDesc,
                    ln.Amount
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE ${scopeSql} 
                  AND t.PhyMonth = ? 
                  AND t.PhyYear = ?

                UNION ALL

                SELECT 
                    RTRIM(t.EmpCode) as emp_code,
                    t.DocDesc,
                    ln.Amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE ${scopeSql} 
                  AND t.PhyMonth = ? 
                  AND t.PhyYear = ?
            ) src
            GROUP BY emp_code
        `;
        
        const duplicateQuery = `
            SELECT
                t.ID as id,
                RTRIM(t.DocID) as doc_id,
                CONVERT(varchar(10), t.DocDate, 23) as doc_date,
                RTRIM(t.DocDesc) as doc_desc,
                RTRIM(t.EmpCode) as emp_code,
                RTRIM(t.EmpName) as emp_name,
                SUM(ln.Amount) as amount
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE ${scopeSql}
              AND t.PhyMonth = ?
              AND t.PhyYear = ?
              AND (${normalizedFilters.map(() => 'UPPER(t.DocDesc) LIKE ?').join(' OR ')})
            GROUP BY t.ID, t.DocID, t.DocDate, t.DocDesc, t.EmpCode, t.EmpName

            UNION ALL

            SELECT
                t.ID as id,
                RTRIM(t.DocID) as doc_id,
                CONVERT(varchar(10), t.DocDate, 23) as doc_date,
                RTRIM(t.DocDesc) as doc_desc,
                RTRIM(t.EmpCode) as emp_code,
                RTRIM(t.EmpName) as emp_name,
                SUM(ln.Amount) as amount
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE ${scopeSql}
              AND t.PhyMonth = ?
              AND t.PhyYear = ?
              AND (${normalizedFilters.map(() => 'UPPER(t.DocDesc) LIKE ?').join(' OR ')})
            GROUP BY t.ID, t.DocID, t.DocDate, t.DocDesc, t.EmpCode, t.EmpName
        `;

        const patternParams = normalizedFilters.map((filter) => buildAdtransSqlPattern(filter));
        const [rows, duplicateRows] = await Promise.all([
            dbMain.query<any>(adtransQuery, [
                ...scopeParams,
                periodMonth,
                periodYear,
                ...scopeParams,
                periodMonth,
                periodYear
            ]),
            dbMain.query<AdtransDuplicateSourceRow>(duplicateQuery, [
                ...scopeParams,
                periodMonth,
                periodYear,
                ...patternParams,
                ...scopeParams,
                periodMonth,
                periodYear,
                ...patternParams
            ])
        ]);

        return {
            totals: rows,
            duplicate_report: buildAdtransDuplicateReport(duplicateRows, normalizedFilters)
        };
    }

    /**
     * Compare PR_ADTRANS (db_ptrj) values with payroll_manual_adjustments (extend_db_ptrj).
     * Returns per-employee per-category comparison showing source vs stored amount,
     * with match/mismatch status.
     */
    public async compareAdtransWithAdjustments(
        periodMonth: number,
        periodYear: number,
        divisionCode: string,
        filters: string[] = ['spsi', 'masa kerja', 'jabatan', 'premi', 'potongan']
    ): Promise<{
        division: string;
        period_month: number;
        period_year: number;
        compared_categories: string[];
        total_employees: number;
        match_count: number;
        mismatch_count: number;
        missing_in_adjustments: number;
        extra_in_db_ptrj: number;
        comparisons: AdtransComparisonItem[];
    }> {
        const dbPtrj = Database.getInstance(); // db_ptrj - source of truth
        const dbExtend = this.getDatabase();   // extend_db_ptrj - stored adjustments

        // Virtual divisions (NRS, INF, WKS_AR, etc.) resolve to their source division's LocCode
        const normalizedDivisionCode = resolveAdtransLocCode(divisionCode);
        const normalizedFilters = filters.map(normalizeAdtransFilter).filter(Boolean);

        if (normalizedFilters.length === 0) {
            return {
                division: divisionCode,
                period_month: periodMonth,
                period_year: periodYear,
                compared_categories: [],
                total_employees: 0,
                match_count: 0,
                mismatch_count: 0,
                missing_in_adjustments: 0,
                extra_in_db_ptrj: 0,
                comparisons: []
            };
        }

        // 1. Get PR_ADTRANS totals per employee per category from db_ptrj
        const caseStatements = normalizedFilters.map((filterKey) => {
            const sqlLike = buildAdtransSqlPattern(filterKey).replace(/'/g, "''");
            return `SUM(CASE WHEN UPPER(DocDesc) LIKE '${sqlLike}' THEN Amount ELSE 0 END) as [${filterKey}]`;
        }).join(", ");
        const requestedDivision = divisionConfigService.getDivision(divisionCode);
        const virtualGangCodes = requestedDivision?.type === 'virtual'
            ? [
                requestedDivision.code,
                ...requestedDivision.aliases.filter((alias) => requestedDivision.gangPattern?.test(alias.trim().toUpperCase()))
            ].map((code) => code.trim().toUpperCase())
            : [];
        const uniqueVirtualGangCodes = Array.from(new Set(virtualGangCodes));
        const gangJoin = uniqueVirtualGangCodes.length > 0
            ? `JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)`
            : ``;
        const gangWhere = uniqueVirtualGangCodes.length > 0
            ? `AND UPPER(RTRIM(gl.GangCode)) IN (${uniqueVirtualGangCodes.map(() => '?').join(',')})`
            : ``;

        const adtransQuery = `
            SELECT
                emp_code,
                MAX(nik) as nik,
                ${caseStatements}
            FROM (
                SELECT
                    RTRIM(t.EmpCode) as emp_code,
                    RTRIM(ISNULL(e.NewICNo, '')) as nik,
                    t.DocDesc,
                    ln.Amount
                FROM PR_ADTRANS t
                ${gangJoin}
                LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(t.EmpCode)
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE UPPER(RTRIM(t.LocCode)) = ?
                  AND t.PhyMonth = ?
                  AND t.PhyYear = ?
                  ${gangWhere}

                UNION ALL

                SELECT
                    RTRIM(t.EmpCode) as emp_code,
                    RTRIM(ISNULL(e.NewICNo, '')) as nik,
                    t.DocDesc,
                    ln.Amount
                FROM PR_ADTRANS_ARC t
                ${gangJoin}
                LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(t.EmpCode)
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE UPPER(RTRIM(t.LocCode)) = ?
                  AND t.PhyMonth = ?
                  AND t.PhyYear = ?
                  ${gangWhere}
            ) src
            GROUP BY emp_code
        `;

        const adtransRows = await dbPtrj.query<any>(adtransQuery, [
            normalizedDivisionCode, periodMonth, periodYear, ...uniqueVirtualGangCodes,
            normalizedDivisionCode, periodMonth, periodYear, ...uniqueVirtualGangCodes
        ]);

        // 2. Get payroll_manual_adjustments for AUTO_BUFFER from extend_db_ptrj
        const adjustmentDivisionCodes = Array.from(new Set([
            divisionCode.trim().toUpperCase(),
            normalizedDivisionCode
        ].filter(Boolean)));
        const adjustmentRows = await dbExtend.query<any>(`
            SELECT
                emp_code,
                adjustment_name,
                amount,
                remarks,
                gang_code,
                division_code
            FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND adjustment_type = 'AUTO_BUFFER'
              AND UPPER(RTRIM(division_code)) IN (${adjustmentDivisionCodes.map(() => '?').join(',')})
        `, [periodMonth, periodYear, ...adjustmentDivisionCodes]);

        // 3. Build map of stored adjustments: emp_code -> adjustment_name -> amount
        const storedMap = new Map<string, Map<string, { amount: number; remarks: string; gang_code: string }>>();
        for (const row of adjustmentRows) {
            const empCode = String(row.emp_code || '').trim().toUpperCase();
            const adjName = String(row.adjustment_name || '').trim().toUpperCase();
            if (!storedMap.has(empCode)) storedMap.set(empCode, new Map());
            storedMap.get(empCode)!.set(adjName, {
                amount: Number(row.amount || 0),
                remarks: String(row.remarks || ''),
                gang_code: String(row.gang_code || '')
            });
        }

        // 4. Map ADTRANS category to AUTO_BUFFER adjustment name
        const categoryToAdjustmentName: Record<string, string> = {
            'spsi': 'AUTO SPSI',
            'masa kerja': 'AUTO MASA KERJA',
            'jabatan': 'AUTO TUNJANGAN JABATAN'
        };

        // 5. Compare each employee's ADTRANS values with stored adjustments
        const comparisons: AdtransComparisonItem[] = [];
        let matchCount = 0;
        let mismatchCount = 0;
        let missingCount = 0;
        let extraInDbPtrjCount = 0;

        for (const adtransRow of adtransRows) {
            const empCode = String(adtransRow.emp_code || '').trim().toUpperCase();
            const sourceNik = String(adtransRow.nik || '').trim().toUpperCase();
            const empStored = storedMap.get(empCode) || (sourceNik ? storedMap.get(sourceNik) : undefined);

            for (const filterKey of normalizedFilters) {
                const sourceAmount = Number(adtransRow[filterKey] || 0);
                const adjustmentName = categoryToAdjustmentName[filterKey];
                if (!adjustmentName) continue; // skip non-AUTO_BUFFER categories like 'premi', 'potongan'

                const stored = empStored?.get(adjustmentName);
                if (Math.abs(sourceAmount) <= 0.01 && !stored) continue;

                const storedAmount = stored ? Number(stored.amount || 0) : null;

                const isMatch = storedAmount !== null && Math.abs(sourceAmount - storedAmount) <= 0.01;
                const isMissing = storedAmount === null;
                const status: 'MATCH' | 'MISMATCH' | 'MISSING' = isMissing ? 'MISSING' : (isMatch ? 'MATCH' : 'MISMATCH');

                if (status === 'MATCH') matchCount++;
                else if (status === 'MISMATCH') mismatchCount++;
                else missingCount++;

                if (Math.abs(sourceAmount) > 0.01 && status !== 'MATCH') {
                    extraInDbPtrjCount++;
                }

                comparisons.push({
                    emp_code: empCode,
                    category: filterKey,
                    adjustment_name: adjustmentName,
                    source_amount: sourceAmount,
                    stored_amount: storedAmount,
                    diff: storedAmount !== null ? sourceAmount - storedAmount : null,
                    status,
                    gang_code: stored?.gang_code || null,
                    remarks: stored?.remarks || null
                });
            }
        }

        return {
            division: divisionCode,
            period_month: periodMonth,
            period_year: periodYear,
            compared_categories: normalizedFilters.filter(f => categoryToAdjustmentName[f]),
            total_employees: adtransRows.length,
            match_count: matchCount,
            mismatch_count: mismatchCount,
            missing_in_adjustments: missingCount,
            extra_in_db_ptrj: extraInDbPtrjCount,
            comparisons
        };
    }

    public async reverseCompareAdtransWithAdjustments(
        periodMonth: number,
        periodYear: number,
        divisionCode: string,
        filters: string[] = ['spsi', 'masa kerja', 'jabatan']
    ): Promise<{
        division: string;
        period_month: number;
        period_year: number;
        compared_categories: string[];
        total_adjustments: number;
        match_count: number;
        mismatch_count: number;
        extra_in_adjustments: number;
        comparisons: ReverseAdtransComparisonItem[];
    }> {
        const dbExtend = this.getDatabase();
        const normalizedFilters = filters.map(normalizeAdtransFilter).filter(Boolean);
        const categoryToAdjustmentName: Record<string, string> = {
            'spsi': 'AUTO SPSI',
            'masa kerja': 'AUTO MASA KERJA',
            'jabatan': 'AUTO TUNJANGAN JABATAN'
        };
        const adjustmentNameToCategory = new Map(
            normalizedFilters
                .filter((filterKey) => categoryToAdjustmentName[filterKey])
                .map((filterKey) => [categoryToAdjustmentName[filterKey], filterKey])
        );
        const adjustmentNames = Array.from(adjustmentNameToCategory.keys());

        if (adjustmentNames.length === 0) {
            return {
                division: divisionCode,
                period_month: periodMonth,
                period_year: periodYear,
                compared_categories: [],
                total_adjustments: 0,
                match_count: 0,
                mismatch_count: 0,
                extra_in_adjustments: 0,
                comparisons: []
            };
        }

        const normalizedDivisionCode = resolveAdtransLocCode(divisionCode);
        const adjustmentDivisionCodes = Array.from(new Set([
            divisionCode.trim().toUpperCase(),
            normalizedDivisionCode
        ].filter(Boolean)));

        const adjustmentRows = await dbExtend.query<any>(`
            SELECT
                emp_code,
                adjustment_name,
                amount,
                remarks,
                gang_code,
                division_code
            FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND adjustment_type = 'AUTO_BUFFER'
              AND UPPER(RTRIM(division_code)) IN (${adjustmentDivisionCodes.map(() => '?').join(',')})
              AND UPPER(RTRIM(adjustment_name)) IN (${adjustmentNames.map(() => '?').join(',')})
            ORDER BY emp_code, adjustment_name
        `, [periodMonth, periodYear, ...adjustmentDivisionCodes, ...adjustmentNames]);

        const dbPtrj = Database.getInstance();
        const ptrjEmpCodeByStoredIdentifier = new Map<string, string>();
        for (const row of adjustmentRows) {
            const storedIdentifier = String(row.emp_code || '').trim();
            if (!storedIdentifier || ptrjEmpCodeByStoredIdentifier.has(storedIdentifier)) continue;

            const gangCode = String(row.gang_code || '').trim().toUpperCase();
            let gangScopedIdentity: any = null;
            if (gangCode) {
                gangScopedIdentity = await dbPtrj.queryOne<any>(`
                    SELECT TOP 1
                        RTRIM(ISNULL(e.NewICNo, '')) as nik,
                        RTRIM(e.EmpCode) as emp_code,
                        RTRIM(e.EmpName) as emp_name,
                        RTRIM(gl.GangCode) as gang_code
                    FROM HR_EMPLOYEE e
                    JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
                    WHERE (RTRIM(e.EmpCode) = ? OR RTRIM(ISNULL(e.NewICNo, '')) = ?)
                      AND UPPER(RTRIM(gl.GangCode)) = ?
                    ORDER BY e.EmpCode DESC
                `, [storedIdentifier, storedIdentifier, gangCode]);
            }

            const identity = gangScopedIdentity || await employeeIdentityResolverService.resolve(storedIdentifier);
            ptrjEmpCodeByStoredIdentifier.set(storedIdentifier, identity?.emp_code || storedIdentifier.toUpperCase());
        }

        // PR_ADTRANS.EmpCode is the PTRJ employee code (letter-prefixed, e.g. A0001), not numeric NIK/KTP.
        const ptrjEmpCodes = Array.from(new Set(Array.from(ptrjEmpCodeByStoredIdentifier.values()).filter(Boolean)));
        const adtransResult = ptrjEmpCodes.length > 0
            ? await this.checkAdtransDirectly(periodMonth, periodYear, ptrjEmpCodes, normalizedFilters, divisionCode)
            : { totals: [] };
        const sourceMap = new Map<string, any>();
        for (const row of adtransResult.totals || []) {
            sourceMap.set(String(row.emp_code || '').trim().toUpperCase(), row);
        }

        const comparisons: ReverseAdtransComparisonItem[] = [];
        let matchCount = 0;
        let mismatchCount = 0;
        let extraCount = 0;

        for (const row of adjustmentRows) {
            const empCode = String(row.emp_code || '').trim();
            const ptrjEmpCode = ptrjEmpCodeByStoredIdentifier.get(empCode) || empCode.toUpperCase();
            const adjustmentName = String(row.adjustment_name || '').trim().toUpperCase();
            const category = adjustmentNameToCategory.get(adjustmentName);
            if (!category) continue;

            const storedAmount = Number(row.amount || 0);
            const sourceAmount = Number(sourceMap.get(ptrjEmpCode)?.[category] || 0);
            const diff = sourceAmount - storedAmount;
            const isMatch = Math.abs(diff) <= 0.01;
            const status: 'MATCH' | 'MISMATCH' | 'EXTRA_IN_ADJUSTMENTS' = isMatch
                ? 'MATCH'
                : sourceAmount === 0 && storedAmount !== 0
                    ? 'EXTRA_IN_ADJUSTMENTS'
                    : 'MISMATCH';

            if (status === 'MATCH') matchCount++;
            else if (status === 'EXTRA_IN_ADJUSTMENTS') extraCount++;
            else mismatchCount++;

            comparisons.push({
                emp_code: ptrjEmpCode,
                stored_emp_identifier: empCode !== ptrjEmpCode ? empCode : null,
                category,
                adjustment_name: adjustmentName,
                stored_amount: storedAmount,
                source_amount: sourceAmount,
                diff,
                status,
                gang_code: row.gang_code ? String(row.gang_code).trim() : null,
                division_code: row.division_code ? String(row.division_code).trim() : null,
                remarks: row.remarks ? String(row.remarks) : null
            });
        }

        return {
            division: divisionCode,
            period_month: periodMonth,
            period_year: periodYear,
            compared_categories: normalizedFilters.filter((filterKey) => categoryToAdjustmentName[filterKey]),
            total_adjustments: comparisons.length,
            match_count: matchCount,
            mismatch_count: mismatchCount,
            extra_in_adjustments: extraCount,
            comparisons
        };
    }

    /**
     * Sync PR_ADTRANS values (db_ptrj) into payroll_manual_adjustments (extend_db_ptrj).
     * Only syncs items that are MISMATCH or MISSING from comparison.
     * Returns count of synced records.
     */
    public async syncAdtransToAdjustments(
        periodMonth: number,
        periodYear: number,
        divisionCode: string,
        filters: string[] = ['spsi', 'masa kerja', 'jabatan'],
        syncMode: 'MISSING_ONLY' | 'MISMATCH_AND_MISSING' | 'ALL' = 'MISMATCH_AND_MISSING',
        createdBy: string = 'sync_adtrans_api'
    ): Promise<{
        division: string;
        period_month: number;
        period_year: number;
        sync_mode: string;
        total_compared: number;
        synced_count: number;
        skipped_match: number;
        synced_details: { emp_code: string; category: string; adjustment_name: string; old_amount: number | null; new_amount: number; action: 'INSERT' | 'UPDATE' }[];
    }> {
        const comparison = await this.compareAdtransWithAdjustments(periodMonth, periodYear, divisionCode, filters);
        const dbExtend = this.getDatabase();

        const toSync = comparison.comparisons.filter((item) => {
            if (syncMode === 'ALL') return true;
            if (syncMode === 'MISSING_ONLY') return item.status === 'MISSING';
            if (syncMode === 'MISMATCH_AND_MISSING') return item.status === 'MISMATCH' || item.status === 'MISSING';
            return false;
        });

        const syncedDetails: { emp_code: string; category: string; adjustment_name: string; old_amount: number | null; new_amount: number; action: 'INSERT' | 'UPDATE' }[] = [];
        const remarksMap: Record<string, string> = {
            'spsi': 'potongan spsi',
            'masa kerja': 'masa kerja',
            'jabatan': 'tunjangan jabatan'
        };

        for (const item of toSync) {
            const adcode = remarksMap[item.category] || item.category;
            const remarks = `${item.adjustment_name} | ${adcode} | ${item.source_amount} | sync:SYNC | match:MATCH`;
            const identity = await employeeIdentityResolverService.resolve(item.emp_code);
            const empName = identity?.emp_name || null;

            if (item.status === 'MISSING' || item.stored_amount === null) {
                // INSERT - need gang_code, get from PR_ADTRANS or default
                const gangCode = item.gang_code || 'UNKNOWN';
                const result = await dbExtend.query<{ id: number }>(`
                    INSERT INTO dbo.payroll_manual_adjustments (
                        period_month, period_year, emp_code, emp_name, gang_code, division_code,
                        adjustment_type, adjustment_name, amount, remarks, created_by
                    ) OUTPUT INSERTED.id VALUES (
                        ?, ?, ?, ?, ?, ?,
                        'AUTO_BUFFER', ?, ?, ?, ?
                    )
                `, [
                    periodMonth, periodYear, item.emp_code, empName, gangCode, divisionCode,
                    item.adjustment_name, item.source_amount, remarks, createdBy
                ]);
                syncedDetails.push({
                    emp_code: item.emp_code,
                    category: item.category,
                    adjustment_name: item.adjustment_name,
                    old_amount: null,
                    new_amount: item.source_amount,
                    action: 'INSERT'
                });
            } else {
                // UPDATE
                const normalizedAdjNameSql = buildNormalizedSqlNameExpression('adjustment_name');
                await dbExtend.query(`
                    UPDATE dbo.payroll_manual_adjustments
                    SET amount = ?, remarks = ?, emp_name = ?, updated_at = GETDATE(), updated_by = ?
                    WHERE period_month = ? AND period_year = ?
                      AND emp_code = ?
                      AND adjustment_type = 'AUTO_BUFFER'
                      AND ${normalizedAdjNameSql} = ?
                `, [
                    item.source_amount, remarks, empName, createdBy,
                    periodMonth, periodYear,
                    item.emp_code,
                    item.adjustment_name
                ]);
                syncedDetails.push({
                    emp_code: item.emp_code,
                    category: item.category,
                    adjustment_name: item.adjustment_name,
                    old_amount: item.stored_amount,
                    new_amount: item.source_amount,
                    action: 'UPDATE'
                });
            }
        }

        return {
            division: divisionCode,
            period_month: periodMonth,
            period_year: periodYear,
            sync_mode: syncMode,
            total_compared: comparison.comparisons.length,
            synced_count: syncedDetails.length,
            skipped_match: comparison.comparisons.length - toSync.length,
            synced_details: syncedDetails
        };
    }
}

export const manualAdjustmentService = ManualAdjustmentService.getInstance();
