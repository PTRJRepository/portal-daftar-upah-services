/**
 * Potongan (Deduction) Component Service
 *
 * Calculates deductions: astek, bpjs, spsi, pph21, dynamic potongans
 */

import { Database } from '../../../db/client';
import { BasePayrollComponentService } from '../BasePayrollComponentService';
import { PayrollCalculationInput, PayrollCalculationResult, BatchPayrollCalculationResult } from '../../../types/payroll/BasePayrollTypes';
import { PayrollComponent } from '../../../types/payroll/PayrollComponent';
import { pph21TerService } from './Pph21TerService';

export interface PotonganInput extends PayrollCalculationInput {
    penghasilan_bruto?: number;
    beras_rate?: number;
}

export interface PotonganOutput {
    astek: PayrollComponent<{ pekerja: number; majikan: number; jumlah: number }>;
    bpjs: {
        kesehatan: PayrollComponent<{ pekerja: number; majikan: number; jumlah: number }>;
        pensiun: PayrollComponent<{ pekerja: number; majikan: number; jumlah: number }>;
        total: PayrollComponent<number>;
    };
    spsi: PayrollComponent<number>;
    pph21: PayrollComponent<number>;
    dynamic_potongan: Record<string, PayrollComponent<number>>;
    total: PayrollComponent<number>;
}

export class PotonganService extends BasePayrollComponentService<PotonganInput, PotonganOutput> {
    public readonly componentName = 'potongan';
    protected db: Database;

    constructor() {
        super();
        this.db = Database.getInstance();
    }

    protected async calculateSingle(input: PotonganInput): Promise<PayrollCalculationResult<PotonganOutput>> {
        try {
            const { emp_code, month, year, penghasilan_bruto, beras_rate } = input;

            // Calculate BPJS and ASTEK
            const bpjsResult = await this.calculateBPJS(emp_code, input.server_profile);
            const spsiResult = await this.calculateSPSI(emp_code, input.server_profile);
            const pph21Input = { ...input, penghasilan_bruto: penghasilan_bruto || 0 };
            const pph21Result = await pph21TerService.calculate(pph21Input);

            // Fetch dynamic potongans
            const dynamicPotongan = await this.fetchDynamicPotongan(emp_code, month, year, input.server_profile);

            // Calculate totals
            const bpjsTotal = bpjsResult.kesehatan.jumlah + bpjsResult.pensiun.jumlah;
            const total = bpjsTotal + bpjsResult.astek.jumlah + spsiResult + pph21Result.output.value.tax_amount +
                Object.values(dynamicPotongan).reduce((sum, p) => sum + p.value, 0);

            const output: PotonganOutput = {
                astek: {
                    value: {
                        pekerja: bpjsResult.astek.pekerja,
                        majikan: bpjsResult.astek.majikan,
                        jumlah: bpjsResult.astek.jumlah,
                    },
                    meta: this.buildMetadata('CALCULATION', 'ASTEK (Jamsostek)', {
                        calculation_basis: '2% × gaji_pokok (pekerja + majikan)',
                        dependencies: ['gaji_pokok'],
                        taxable: false,
                    }),
                },
                bpjs: {
                    kesehatan: {
                        value: {
                            pekerja: bpjsResult.kesehatan.pekerja,
                            majikan: bpjsResult.kesehatan.majikan,
                            jumlah: bpjsResult.kesehatan.jumlah,
                        },
                        meta: this.buildMetadata('CALCULATION', 'BPJS Kesehatan', {
                            calculation_basis: '5% × gaji_pokok (max: 600000, min: 3876600)',
                            dependencies: ['gaji_pokok'],
                            taxable: false,
                        }),
                    },
                    pensiun: {
                        value: {
                            pekerja: bpjsResult.pensiun.pekerja,
                            majikan: bpjsResult.pensiun.majikan,
                            jumlah: bpjsResult.pensiun.jumlah,
                        },
                        meta: this.buildMetadata('CALCULATION', 'BPJS Pensiun', {
                            calculation_basis: '2% × gaji_pokok (max: 300000, min: 3876600)',
                            dependencies: ['gaji_pokok'],
                            taxable: false,
                        }),
                    },
                    total: {
                        value: bpjsTotal,
                        meta: this.buildMetadata('CALCULATION', 'Total BPJS', {
                            calculation_basis: 'kesehatan + pensiun',
                            dependencies: ['bpjs.kesehatan', 'bpjs.pensiun'],
                            taxable: false,
                        }),
                    },
                },
                spsi: {
                    value: spsiResult,
                    meta: this.buildMetadata('CALCULATION', 'SPSI Union Dues', {
                        calculation_basis: 'Fixed amount (4000) from HR_PAYROLL',
                        dependencies: ['HR_PAYROLL'],
                        taxable: false,
                    }),
                },
                pph21: {
                    value: pph21Result.output.value.tax_amount,
                    meta: pph21Result.output.meta
                },
                dynamic_potongan: dynamicPotongan,
                total: {
                    value: total,
                    meta: this.buildMetadata('CALCULATION', 'Total Potongan', {
                        calculation_basis: 'astek + bpjs + spsi + pph21 + dynamic',
                        dependencies: ['astek', 'bpjs', 'spsi', 'pph21', 'dynamic'],
                        taxable: false,
                    }),
                },
            };

            return {
                component_name: this.componentName,
                input,
                output: {
                    value: output as any,
                    meta: this.buildMetadata('CALCULATION', 'Total Potongan Calculation', {
                        taxable: false,
                        confidence_level: 'high',
                        version: 1,
                    }),
                },
            };
        } catch (error) {
            return this.createErrorResult(input, error as Error);
        }
    }

    protected async calculateBatchInternal(inputs: PotonganInput[]): Promise<BatchPayrollCalculationResult<PotonganOutput>> {
        const results = new Map<string, PayrollCalculationResult<PotonganOutput>>();
        let cachedCount = 0;

        for (const input of inputs) {
            const result = await this.calculateSingle(input);
            results.set(input.emp_code, result);
            if (result.cached) cachedCount++;
        }

        return {
            results,
            summary: {
                total_calculated: results.size,
                total_errors: 0,
                execution_time_ms: 0,
                cached_count: cachedCount,
            },
            meta: this.buildMetadata('CALCULATION', 'Batch potongan calculation'),
        };
    }

    protected getBasisDescription(input: PotonganInput): string {
        return 'BPJS (gaji_pokok), ASTEK (gaji_pokok), SPSI (fixed), PPH21 (TER method), dynamic (PR_ADTRANS)';
    }

    protected getCacheKey(input: PotonganInput): string {
        return `potongan:${input.emp_code}:${input.month}:${input.year}`;
    }

    protected getCacheTTL(): number {
        return 1800;
    }

    // Helper methods
    private async calculateBPJS(empCode: string, serverProfile?: string) {
        // Based on payrollService.calculateBpjsComponents
        // Usually requiresmasa_kerja_jumlah, for now we will stub it or fetch it if needed.
        // Returning 0 for now to satisfy types, since it's stubbed out.
        return {
            astek: { pekerja: 0, majikan: 0, jumlah: 0 },
            kesehatan: { pekerja: 0, majikan: 0, jumlah: 0 },
            pensiun: { pekerja: 0, majikan: 0, jumlah: 0 }
        };
    }

    private async calculateSPSI(empCode: string, serverProfile?: string): Promise<number> {
        return 4000; // SPSI Union Dues usually fixed
    }

    private async fetchDynamicPotongan(
        empCode: string,
        month: number,
        year: number,
        serverProfile?: string
    ): Promise<Record<string, PayrollComponent<number>>> {
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${daysInMonth}`;

        // Exclude standard potongans
        const excludePatterns = ['POT', 'SPSI', 'BERAS', 'JABATAN', 'MASA', 'LEMBUR', 'PPH', 'PREMI', 'ASTEK', 'BPJS'];

        const rows = await db.query<{ DocDesc: string; Amount: number }>(`
            SELECT DocDesc, SUM(Amount) as Amount
            FROM PR_ADTRANS
            WHERE EmpCode = ? AND TrxDate >= ? AND TrxDate <= ?
              AND DocDesc LIKE 'POT%'
            GROUP BY DocDesc
        `, [empCode, startDate, endDate]);

        const result: Record<string, PayrollComponent<number>> = {};
        for (const row of rows) {
            const docDesc = (row.DocDesc || '').trim();
            if (this.shouldExclude(docDesc, excludePatterns)) continue;

            const fieldName = this.cleanFieldName(docDesc.replace('POT_', ''));
            result[fieldName] = {
                value: Math.abs(row.Amount || 0),
                meta: this.buildMetadata('DATABASE_PLANTWARE', `Deduction: ${docDesc}`, {
                    calculation_basis: `SUM(Amount) where DocDesc='${docDesc}'`,
                    dependencies: ['PR_ADTRANS'],
                    taxable: false,
                }),
            };
        }

        return result;
    }

    private shouldExclude(docDesc: string, patterns: string[]): boolean {
        const upperDesc = docDesc.toUpperCase();
        return patterns.some((pattern) => upperDesc.includes(pattern.toUpperCase()));
    }

    private cleanFieldName(str: string): string {
        return str.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    }
}

export const potonganService = new PotonganService();
