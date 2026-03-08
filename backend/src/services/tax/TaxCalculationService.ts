/**
 * Tax Calculation Service
 *
 * Centralized service for all tax calculations (PTKP & PPh21 TER).
 * Provides single source of truth for:
 * - Mapping beras_rate to PTKP status
 * - Mapping PTKP status to TER category
 * - PTKP amount calculations
 * - Tax rate calculations
 *
 * This service should be used by ALL services that need tax calculations.
 */

import { Database } from "../../db/client";

/**
 * Input for tax calculation
 */
export interface TaxCalculationInput {
    empCode: string;
    berasRate: number;
    grossIncome: number;
    periodYear: number;
    periodMonth?: number;
}

/**
 * Result of tax calculation
 */
export interface TaxCalculationResult {
    ptkpStatus: string;
    terCategory: string;
    ptkpAmount: number;
    taxRate: number;
    taxAmount: number;
    netTax: number;
    isProgressive: boolean;
    breakdown?: TaxBreakdown[];
}

/**
 * Tax breakdown for progressive calculation
 */
export interface TaxBreakdown {
    tier: number;
    taxableIncome: number;
    rate: number;
    amount: number;
}

/**
 * PTKP Status enumeration
 */
export type PTKPStatus = 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3' | '-';

/**
 * TER Category enumeration
 */
export type TERCategory = 'TER A' | 'TER B' | 'TER C' | '-';

/**
 * Tax Calculation Service - Single Source of Truth for Tax Calculations
 */
export class TaxCalculationService {
    private static instance: TaxCalculationService;

    // Beras Rate → PTKP Mapping (Single Source of Truth)
    private static readonly BERAS_RATE_TO_PTKP: Record<number, PTKPStatus> = {
        // Exact mapping
        2250: 'TK/0',
        3250: 'TK/1',
        4200: 'TK/2',
        3700: 'K/0',
        4650: 'K/1',
        5500: 'K/2',
        6450: 'K/3',
        // Legacy DB mappings (150/kg formulas)
        3150: 'TK/1',
        4050: 'TK/2',
        4950: 'TK/3',
        3600: 'K/0',
        4500: 'K/1',
        5400: 'K/2',
        6300: 'K/3',
        3750: 'K/0',  // Legacy
        5550: 'K/2',  // Legacy
    };

    // PTKP Amounts by year (single source)
    private static readonly PTKP_AMOUNTS: Record<number, Record<PTKPStatus, number>> = {
        2025: {
            'TK/0': 54000000,
            'TK/1': 58500000,
            'TK/2': 63000000,
            'TK/3': 67500000,
            'K/0': 58500000,
            'K/1': 63000000,
            'K/2': 67500000,
            'K/3': 72000000,
            '-': 54000000,
        },
        2026: {
            'TK/0': 54000000,
            'TK/1': 58500000,
            'TK/2': 63000000,
            'TK/3': 67500000,
            'K/0': 58500000,
            'K/1': 63000000,
            'K/2': 67500000,
            'K/3': 72000000,
            '-': 54000000,
        },
    };

    // TER Rates (Single Source)
    private static readonly TER_RATES: Record<TERCategory, number> = {
        'TER A': 0.05,   // 5%
        'TER B': 0.15,   // 15%
        'TER C': 0.25,   // 25%
        '-': 0,          // No tax
    };

    // Progressive tax brackets (for reference)
    private static readonly PROGRESSIVE_BRACKETS = [
        { max: 60000000, rate: 0.05 },
        { max: 250000000, rate: 0.15 },
        { max: 500000000, rate: 0.25 },
        { max: Infinity, rate: 0.35 },
    ];

    private constructor() {}

    public static getInstance(): TaxCalculationService {
        if (!TaxCalculationService.instance) {
            TaxCalculationService.instance = new TaxCalculationService();
        }
        return TaxCalculationService.instance;
    }

    /**
     * Map Beras Rate to PTKP Status
     * Handles both monthly and daily rates
     *
     * @param berasRate - Rice ration rate (daily or monthly)
     * @returns PTKP status string
     */
    public mapBerasRateToPTKP(berasRate: number): PTKPStatus {
        if (!berasRate || berasRate <= 0) return 'TK/0';

        // Handle monthly bulk values (e.g. 135000 = 4500 * 30)
        const normalizedRate = berasRate >= 10000 ? berasRate / 30 : berasRate;

        return TaxCalculationService.BERAS_RATE_TO_PTKP[normalizedRate] || 'TK/0';
    }

    /**
     * Map PTKP Status to TER Category
     *
     * @param ptkpStatus - PTKP status (TK/0, TK/1, K/0, etc.)
     * @returns TER category
     */
    public mapPTKPToTER(ptkpStatus: string): TERCategory {
        if (!ptkpStatus || ptkpStatus === '-') return '-';
        if (['TK/0', 'TK/1', 'K/0'].includes(ptkpStatus)) return 'TER A';
        if (ptkpStatus === 'K/3') return 'TER C';
        return 'TER B';
    }

    /**
     * Get PTKP Amount based on status and year
     *
     * @param ptkpStatus - PTKP status
     * @param year - Tax year
     * @returns Annual PTKP amount
     */
    public getPTKPAmount(ptkpStatus: string, year: number): number {
        const yearData = TaxCalculationService.PTKP_AMOUNTS[year];
        if (!yearData) {
            // Fallback to 2025 rates if year not found
            console.warn(`[TaxCalculationService] PTKP rates for year ${year} not found, using 2025 rates`);
            return TaxCalculationService.PTKP_AMOUNTS[2025][ptkpStatus as PTKPStatus] || 54000000;
        }
        return yearData[ptkpStatus as PTKPStatus] || 54000000;
    }

    /**
     * Get tax rate based on TER category
     *
     * @param terCategory - TER category (TER A, TER B, TER C)
     * @returns Decimal tax rate
     */
    public getTaxRate(terCategory: TERCategory): number {
        return TaxCalculationService.TER_RATES[terCategory] || 0;
    }

    /**
     * Calculate complete tax for an employee using TER method
     *
     * @param input - Tax calculation input
     * @returns Complete tax calculation result
     */
    public calculate(input: TaxCalculationInput): TaxCalculationResult {
        const ptkpStatus = this.mapBerasRateToPTKP(input.berasRate);
        const terCategory = this.mapPTKPToTER(ptkpStatus);
        const ptkpAmount = this.getPTKPAmount(ptkpStatus, input.periodYear);
        const taxRate = this.getTaxRate(terCategory);

        // Calculate taxable income (monthly)
        const annualIncome = input.grossIncome * 12;
        const taxableAnnualIncome = Math.max(0, annualIncome - ptkpAmount);
        const taxableMonthlyIncome = Math.round(taxableAnnualIncome / 12);

        // Calculate tax
        const annualTax = Math.round(taxableAnnualIncome * taxRate);
        const monthlyTax = Math.round(annualTax / 12);

        return {
            ptkpStatus,
            terCategory,
            ptkpAmount,
            taxRate,
            taxAmount: monthlyTax,
            netTax: monthlyTax,
            isProgressive: false,
        };
    }

    /**
     * Calculate tax using progressive method (alternative to TER)
     *
     * @param grossMonthlyIncome - Gross monthly income
     * @param ptkpStatus - PTKP status
     * @param year - Tax year
     * @returns Progressive tax calculation result
     */
    public calculateProgressive(grossMonthlyIncome: number, ptkpStatus: string, year: number): TaxCalculationResult {
        const ptkpAmount = this.getPTKPAmount(ptkpStatus, year);
        const annualIncome = grossMonthlyIncome * 12;
        const taxableIncome = Math.max(0, annualIncome - ptkpAmount);

        // Calculate progressive tax
        const breakdown: TaxBreakdown[] = [];
        let remainingIncome = taxableIncome;
        let totalTax = 0;
        let previousMax = 0;

        for (const bracket of TaxCalculationService.PROGRESSIVE_BRACKETS) {
            const tierIncome = Math.min(remainingIncome, bracket.max - previousMax);

            if (tierIncome > 0) {
                const tierTax = Math.round(tierIncome * bracket.rate);
                totalTax += tierTax;

                breakdown.push({
                    tier: breakdown.length + 1,
                    taxableIncome: tierIncome,
                    rate: bracket.rate,
                    amount: tierTax,
                });

                remainingIncome -= tierIncome;
                previousMax = bracket.max;
            }

            if (remainingIncome <= 0) break;
        }

        return {
            ptkpStatus,
            terCategory: 'TER A', // Not applicable for progressive
            ptkpAmount,
            taxRate: 0, // Not applicable
            taxAmount: Math.round(totalTax / 12),
            netTax: Math.round(totalTax / 12),
            isProgressive: true,
            breakdown,
        };
    }

    /**
     * Get all PTKP statuses for dropdown/form
     */
    public getAllPTKPStatuses(): PTKPStatus[] {
        return ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'];
    }

    /**
     * Get all TER categories
     */
    public getTERCategories(): TERCategory[] {
        return ['TER A', 'TER B', 'TER C'];
    }

    /**
     * Validate PTKP status
     */
    public isValidPTKP(status: string): boolean {
        return ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'].includes(status);
    }
}

// Export singleton instance
export const taxCalculationService = TaxCalculationService.getInstance();
