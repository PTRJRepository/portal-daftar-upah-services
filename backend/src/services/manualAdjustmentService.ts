import { Database } from "../db/client";
import { Config } from "../config";
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

export function buildManualAdjustmentRemarks(data: ManualAdjustment): string | null {
    const existingRemarks = normalizeText(data.remarks);
    const adCode = resolveManualAdjustmentAdCode(data);
    const taskDesc = normalizeText(data.task_desc);

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
    const isManualColumnRequest = remarks.includes('INIT_COLUMN') || remarks.includes('AD CODE:') || remarks.includes('SYNC:');
    if (!isManualColumnRequest) return;
    if (resolveManualAdjustmentAdCode(data)) return;

    throw new Error('ADCode wajib diisi untuk kolom manual adjustment selain auto buffer');
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
            query += ` AND adjustment_type = ?`;
            params.push(adjustmentType);
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
                    SET amount = ?, remarks = ?, updated_at = GETDATE(), updated_by = ?
                    WHERE id = ?
                `, [parsedAmount, remarks, user || 'system', existing.id]);
                return existing.id;
            }
        } else {
            if (shouldDeleteStoredAdjustment(parsedAmount, data.remarks)) return 0; // Don't insert zero

            // Insert
            const result = await db.query(`
                INSERT INTO dbo.payroll_manual_adjustments (
                    period_month, period_year, emp_code, gang_code, division_code,
                    adjustment_type, adjustment_name, amount, remarks, created_by
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            `, [
                data.period_month, data.period_year, data.emp_code, data.gang_code, data.division_code || null,
                data.adjustment_type, normalizedAdjustmentName, parsedAmount, remarks, user || 'system'
            ]);
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
        const normalizedDivisionCode = divisionCode ? normalizeAdtransDivisionLocCode(divisionCode) : '';
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
}

export const manualAdjustmentService = ManualAdjustmentService.getInstance();
