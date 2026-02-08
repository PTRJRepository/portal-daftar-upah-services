/**
 * PPH21 TER Component Service
 *
 * Calculates PPH21 tax using TER (Tarif Efektif Ringan) method
 */

import { BasePayrollComponentService } from '../BasePayrollComponentService';
import { calculatePph21Ter } from '../../pph21TerService';
import { PayrollCalculationInput, PayrollCalculationResult, BatchPayrollCalculationResult } from '../../../types/payroll/BasePayrollTypes';
import { PayrollComponent } from '../../../types/payroll/PayrollComponent';

export interface Pph21Input extends PayrollCalculationInput {
    penghasilan_bruto: number;
    beras_rate?: number;
}

export interface Pph21Output {
    ptkp_status: string;
    ter_category: string;
    gross_income: number;
    rate_percent: number;
    rate_decimal: number;
    tax_amount: number;
}

export class Pph21TerService extends BasePayrollComponentService<Pph21Input, Pph21Output> {
    public readonly componentName = 'pph21_ter';
    protected db = this.db; // Using parent's db

    protected async calculateSingle(input: Pph21Input): Promise<PayrollCalculationResult<Pph21Output>> {
        try {
            const { penghasilan_bruto, beras_rate: providedBerasRate } = input;

            // Get beras_rate if not provided
            let beras_rate = providedBerasRate;
            if (beras_rate === undefined) {
                beras_rate = await this.getBerasRate(input.emp_code, input.server_profile);
            }

            // Calculate PPH21 using existing service
            const tax_amount = await calculatePph21Ter(penghasilan_bruto, beras_rate);

            // Determine PTKP status and TER category
            const ptkp_status = this.getPtkpStatus(beras_rate);
            const ter_category = this.getTerCategory(beras_rate);
            const rate_decimal = this.getTerRate(ter_category);

            const output: Pph21Output = {
                ptkp_status,
                ter_category,
                gross_income: penghasilan_bruto,
                rate_percent: rate_decimal * 100,
                rate_decimal,
                tax_amount,
            };

            return {
                component_name: this.componentName,
                input,
                output: {
                    ...output,
                    meta: this.buildMetadata('CALCULATION', 'PPH21 Tax using TER Method', {
                        calculation_basis: `penghasilan_bruto × rate_decimal (${rate_decimal} = ${this.getTerCategoryName(ter_category)})`,
                        dependencies: ['penghasilan_bruto', 'beras_rate'],
                        version: 1,
                        taxable: false,
                    }),
                },
            };
        } catch (error) {
            return this.createErrorResult(input, error as Error);
        }
    }

    protected async calculateBatch(inputs: Pph21Input[]): Promise<BatchPayrollCalculationResult<Pph21Output>> {
        const results = new Map<string, PayrollCalculationResult<Pph21Output>>();
        let cachedCount = 0;

        // Batch fetch beras_rates first
        const empCodes = inputs.map(i => i.emp_code);
        const berasRates = await this.batchGetBerasRate(empCodes, inputs[0].server_profile);

        for (const input of inputs) {
            const inputWithRate = { ...input, beras_rate: berasRates[input.emp_code] };
            const result = await this.calculateSingle(inputWithRate);
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
            meta: this.buildMetadata('CALCULATION', 'Batch PPH21 calculation'),
        };
    }

    protected getCalculationBasis(input: Pph21Input): string {
        return 'TER Method: penghasilan_bruto × rate (based on beras_rate → PTKP status)';
    }

    protected getCacheKey(input: Pph21Input): string {
        return `pph21_ter:${input.emp_code}:${input.month}:${input.year}:${input.penghasilan_bruto}`;
    }

    protected getCacheTTL(): number {
        return 3600;
    }

    // Helper methods
    private async getBerasRate(empCode: string, serverProfile?: string): Promise<number> {
        const { Database } = await import('../../db/client');
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : Database.getInstance();

        const rows = await db.query<{ beras_rate: number }>(`
            SELECT beras_rate FROM HR_PAYROLL WHERE EmpCode = ?
        `, [empCode]);

        return rows[0]?.beras_rate || 0;
    }

    private async batchGetBerasRate(empCodes: string[], serverProfile?: string): Promise<Record<string, number>> {
        const { Database } = await import('../../db/client');
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : Database.getInstance();

        const empList = empCodes.map(e => `'${e}'`).join(',');
        const rows = await db.query<{ EmpCode: string; beras_rate: number }>(`
            SELECT EmpCode, beras_rate FROM HR_PAYROLL WHERE RTRIM(EmpCode) IN (${empList})
        `);

        const result: Record<string, number> = {};
        for (const row of rows) {
            result[row.EmpCode?.trim() || ''] = row.beras_rate || 0;
        }
        return result;
    }

    private getPtkpStatus(beras_rate: number): string {
        const ptkpMap: Record<number, string> = {
            2250: 'TK/0',
            3250: 'TK/1',
            4200: 'TK/2',
            3750: 'K/0',
            4650: 'K/1',
            5550: 'K/2',
            6450: 'K/3',
        };
        return ptkpMap[beras_rate] || 'TK/0';
    }

    private getTerCategory(beras_rate: number): string {
        const terMap: Record<number, string> = {
            2250: 'TER_A',  // TK/0
            3250: 'TER_A',  // TK/1
            4200: 'TER_B',  // TK/2
            3750: 'TER_A',  // K/0
            4650: 'TER_B',  // K/1
            5550: 'TER_B',  // K/2
            6450: 'TER_C',  // K/3
        };
        return terMap[beras_rate] || 'TER_A';
    }

    private getTerRate(ter_category: string): number {
        const rateMap: Record<string, number> = {
            'TER_A': 0.05,
            'TER_B': 0.15,
            'TER_C': 0.25,
        };
        return rateMap[ter_category] || 0.05;
    }

    private getTerCategoryName(ter_category: string): string {
        const nameMap: Record<string, string> = {
            'TER_A': '5%',
            'TER_B': '15%',
            'TER_C': '25%',
        };
        return nameMap[ter_category] || '5%';
    }
}

export const pph21TerService = new Pph21TerService();
