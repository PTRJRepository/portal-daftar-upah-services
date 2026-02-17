/**
 * Tax Engine - PPh 21 Calculation
 * Implements TER (Tarif Efektif Rata-rata) and Annual Tax Calculation
 * Based on PP 58 Tahun 2023
 */

// ============================================
// TER TAX BRACKETS (PP 58 Tahun 2023)
// ============================================

const TER_BRACKETS = {
    TER_A: [
        { min: 0, max: 5400000, rate: 0.0 },
        { min: 5400001, max: 5650000, rate: 0.0025 },
        { min: 5650001, max: 5950000, rate: 0.005 },
        { min: 5950001, max: 6300000, rate: 0.0075 },
        { min: 6300001, max: 6750000, rate: 0.01 },
        { min: 6750001, max: 7500000, rate: 0.0125 },
        { min: 7500001, max: 8550000, rate: 0.015 },
        { min: 8550001, max: 9650000, rate: 0.0175 },
        { min: 9650001, max: 10050000, rate: 0.02 },
        { min: 10050001, max: 10350000, rate: 0.0225 },
        { min: 10350001, max: 10700000, rate: 0.025 },
        { min: 10700001, max: 11050000, rate: 0.03 },
        { min: 11050001, max: 11600000, rate: 0.035 },
        { min: 11600001, max: 12500000, rate: 0.04 },
        { min: 12500001, max: 13750000, rate: 0.05 },
        { min: 13750001, max: 15100000, rate: 0.06 },
        { min: 15100001, max: 16950000, rate: 0.07 },
        { min: 16950001, max: 19750000, rate: 0.08 },
        { min: 19750001, max: 24150000, rate: 0.09 },
        { min: 24150001, max: 26450000, rate: 0.10 },
        { min: 26450001, max: 28000000, rate: 0.11 },
        { min: 28000001, max: 30050000, rate: 0.12 },
        { min: 30050001, max: 32400000, rate: 0.13 },
        { min: 32400001, max: 35400000, rate: 0.14 },
        { min: 35400001, max: 39100000, rate: 0.15 },
        { min: 39100001, max: 43850000, rate: 0.16 },
        { min: 43850001, max: 47800000, rate: 0.17 },
        { min: 47800001, max: 51400000, rate: 0.18 },
        { min: 51400001, max: 56300000, rate: 0.19 },
        { min: 56300001, max: 62200000, rate: 0.20 },
        { min: 62200001, max: 68600000, rate: 0.21 },
        { min: 68600001, max: 77500000, rate: 0.22 },
        { min: 77500001, max: 89000000, rate: 0.23 },
        { min: 89000001, max: 103000000, rate: 0.24 },
        { min: 103000001, max: 125000000, rate: 0.25 },
        { min: 125000001, max: 157000000, rate: 0.26 },
        { min: 157000001, max: 206000000, rate: 0.27 },
        { min: 206000001, max: 337000000, rate: 0.28 },
        { min: 337000001, max: 454000000, rate: 0.29 },
        { min: 454000001, max: 550000000, rate: 0.30 },
        { min: 550000001, max: 695000000, rate: 0.31 },
        { min: 695000001, max: 910000000, rate: 0.32 },
        { min: 910000001, max: 1400000000, rate: 0.33 },
        { min: 1400000001, max: null, rate: 0.34 }
    ],
    TER_B: [
        { min: 0, max: 6200000, rate: 0.0 },
        { min: 6200001, max: 6500000, rate: 0.0025 },
        { min: 6500001, max: 6850000, rate: 0.005 },
        { min: 6850001, max: 7300000, rate: 0.0075 },
        { min: 7300001, max: 9200000, rate: 0.01 },
        { min: 9200001, max: 10750000, rate: 0.015 },
        { min: 10750001, max: 11250000, rate: 0.02 },
        { min: 11250001, max: 11600000, rate: 0.025 },
        { min: 11600001, max: 12600000, rate: 0.03 },
        { min: 12600001, max: 13600000, rate: 0.04 },
        { min: 13600001, max: 14950000, rate: 0.05 },
        { min: 14950001, max: 16400000, rate: 0.06 },
        { min: 16400001, max: 18450000, rate: 0.07 },
        { min: 18450001, max: 21850000, rate: 0.08 },
        { min: 21850001, max: 26000000, rate: 0.09 },
        { min: 26000001, max: 27700000, rate: 0.10 },
        { min: 27700001, max: 29350000, rate: 0.11 },
        { min: 29350001, max: 31450000, rate: 0.12 },
        { min: 31450001, max: 33950000, rate: 0.13 },
        { min: 33950001, max: 37100000, rate: 0.14 },
        { min: 37100001, max: 41100000, rate: 0.15 },
        { min: 41100001, max: 45800000, rate: 0.16 },
        { min: 45800001, max: 49500000, rate: 0.17 },
        { min: 49500001, max: 53800000, rate: 0.18 },
        { min: 53800001, max: 58500000, rate: 0.19 },
        { min: 58500001, max: 64000000, rate: 0.20 },
        { min: 64000001, max: 71000000, rate: 0.21 },
        { min: 71000001, max: 80000000, rate: 0.22 },
        { min: 80000001, max: 93000000, rate: 0.23 },
        { min: 93000001, max: 109000000, rate: 0.24 },
        { min: 109000001, max: 129000000, rate: 0.25 },
        { min: 129000001, max: 163000000, rate: 0.26 },
        { min: 163000001, max: 211000000, rate: 0.27 },
        { min: 211000001, max: 374000000, rate: 0.28 },
        { min: 374000001, max: 459000000, rate: 0.29 },
        { min: 459000001, max: 555000000, rate: 0.30 },
        { min: 555000001, max: 704000000, rate: 0.31 },
        { min: 704000001, max: 957000000, rate: 0.32 },
        { min: 957000001, max: 1405000000, rate: 0.33 },
        { min: 1405000001, max: null, rate: 0.34 }
    ],
    TER_C: [
        { min: 0, max: 6600000, rate: 0.0 },
        { min: 6600001, max: 6950000, rate: 0.0025 },
        { min: 6950001, max: 7350000, rate: 0.005 },
        { min: 7350001, max: 7800000, rate: 0.0075 },
        { min: 7800001, max: 8850000, rate: 0.01 },
        { min: 8850001, max: 9800000, rate: 0.0125 },
        { min: 9800001, max: 10950000, rate: 0.015 },
        { min: 10950001, max: 11200000, rate: 0.0175 },
        { min: 11200001, max: 12050000, rate: 0.02 },
        { min: 12050001, max: 12950000, rate: 0.03 },
        { min: 12950001, max: 14150000, rate: 0.04 },
        { min: 14150001, max: 15500000, rate: 0.05 },
        { min: 15500001, max: 17050000, rate: 0.06 },
        { min: 17050001, max: 19500000, rate: 0.07 },
        { min: 19500001, max: 22700000, rate: 0.08 },
        { min: 22700001, max: 26600000, rate: 0.09 },
        { min: 26600001, max: 28100000, rate: 0.10 },
        { min: 28100001, max: 30100000, rate: 0.11 },
        { min: 30100001, max: 32600000, rate: 0.12 },
        { min: 32600001, max: 35400000, rate: 0.13 },
        { min: 35400001, max: 38900000, rate: 0.14 },
        { min: 38900001, max: 43000000, rate: 0.15 },
        { min: 43000001, max: 47400000, rate: 0.16 },
        { min: 47400001, max: 51200000, rate: 0.17 },
        { min: 51200001, max: 55800000, rate: 0.18 },
        { min: 55800001, max: 60400000, rate: 0.19 },
        { min: 60400001, max: 66700000, rate: 0.20 },
        { min: 66700001, max: 74500000, rate: 0.21 },
        { min: 74500001, max: 83200000, rate: 0.22 },
        { min: 83200001, max: 95600000, rate: 0.23 },
        { min: 95600001, max: 110000000, rate: 0.24 },
        { min: 110000001, max: 134000000, rate: 0.25 },
        { min: 134000001, max: 169000000, rate: 0.26 },
        { min: 169000001, max: 221000000, rate: 0.27 },
        { min: 221000001, max: 390000000, rate: 0.28 },
        { min: 390000001, max: 463000000, rate: 0.29 },
        { min: 463000001, max: 561000000, rate: 0.30 },
        { min: 561000001, max: 709000000, rate: 0.31 },
        { min: 709000001, max: 965000000, rate: 0.32 },
        { min: 965000001, max: 1419000000, rate: 0.33 },
        { min: 1419000001, max: null, rate: 0.34 }
    ]
};

// PTKP Values (Penghasilan Tidak Kena Pajak)
const PTKP_VALUES = {
    'TK/0': 54000000,
    'TK/1': 58500000,
    'TK/2': 63000000,
    'TK/3': 67500000,
    'K/0': 58500000,
    'K/1': 63000000,
    'K/2': 67500000,
    'K/3': 72000000
};

// Annual Tax Brackets (Progressive)
const ANNUAL_BRACKETS = [
    { limit: 60000000, rate: 0.05 },
    { limit: 250000000, rate: 0.15 },
    { limit: 500000000, rate: 0.25 },
    { limit: 5000000000, rate: 0.30 },
    { limit: Infinity, rate: 0.35 }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return 'Rp 0';
    return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}

function formatRate(rate) {
    return (rate * 100).toFixed(2).replace('.', ',') + '%';
}

function parseCurrency(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    return parseInt(value.toString().replace(/[^\d]/g, '')) || 0;
}

// ============================================
// TER CALCULATION FUNCTIONS
// ============================================

/**
 * Get TER Category based on PTKP status
 */
function getTERCategory(ptkpStatus) {
    const status = ptkpStatus.toUpperCase().trim();

    // TER A: TK/0, TK/1, K/0
    if (['TK/0', 'TK/1', 'K/0'].includes(status)) {
        return 'TER_A';
    }

    // TER C: K/3
    if (status === 'K/3') {
        return 'TER_C';
    }

    // TER B: Default (TK/2, TK/3, K/1, K/2)
    return 'TER_B';
}

/**
 * Get TER rate based on gross income and category
 */
function getTERRate(grossIncome, category) {
    const brackets = TER_BRACKETS[category];
    if (!brackets) return 0;

    for (const bracket of brackets) {
        if (bracket.max === null) {
            if (grossIncome >= bracket.min) return bracket.rate;
        } else {
            if (grossIncome >= bracket.min && grossIncome <= bracket.max) {
                return bracket.rate;
            }
        }
    }

    return 0;
}

/**
 * Get bracket info for display
 */
function getTERBracketInfo(grossIncome, category) {
    const brackets = TER_BRACKETS[category];
    if (!brackets) return null;

    for (let i = 0; i < brackets.length; i++) {
        const bracket = brackets[i];
        if (bracket.max === null) {
            if (grossIncome >= bracket.min) {
                return { ...bracket, layer: i + 1 };
            }
        } else {
            if (grossIncome >= bracket.min && grossIncome <= bracket.max) {
                return { ...bracket, layer: i + 1 };
            }
        }
    }

    return null;
}

/**
 * Calculate monthly PPh 21 using TER method
 */
function calculateMonthlyTER(grossIncome, ptkpStatus) {
    const category = getTERCategory(ptkpStatus);
    const rate = getTERRate(grossIncome, category);
    const bracketInfo = getTERBracketInfo(grossIncome, category);
    const tax = Math.round(grossIncome * rate);

    return {
        grossIncome,
        ptkpStatus,
        category: category.replace('_', ' '),
        rate,
        rateFormatted: formatRate(rate),
        tax,
        taxFormatted: formatCurrency(tax),
        bracketInfo
    };
}

// ============================================
// ANNUAL TAX CALCULATION
// ============================================

/**
 * Calculate annual PPh 21 using progressive rates
 */
function calculateAnnualTax(annualNetIncome, ptkpStatus) {
    const ptkp = PTKP_VALUES[ptkpStatus] || 54000000;
    let pkp = Math.max(0, annualNetIncome - ptkp);

    // Round down to nearest thousand
    pkp = Math.floor(pkp / 1000) * 1000;

    const brackets = [];
    let remainingPKP = pkp;
    let previousLimit = 0;
    let totalTax = 0;

    for (const bracket of ANNUAL_BRACKETS) {
        if (remainingPKP <= 0) break;

        const bracketSize = bracket.limit === Infinity ? remainingPKP : Math.min(remainingPKP, bracket.limit - previousLimit);
        const bracketTax = Math.round(bracketSize * bracket.rate);

        brackets.push({
            layer: brackets.length + 1,
            from: previousLimit,
            to: previousLimit + bracketSize,
            rate: bracket.rate,
            rateFormatted: formatRate(bracket.rate),
            pkpInLayer: bracketSize,
            tax: bracketTax
        });

        totalTax += bracketTax;
        remainingPKP -= bracketSize;
        previousLimit = bracket.limit;
    }

    return {
        annualNetIncome,
        ptkp,
        pkp,
        totalTax,
        totalTaxFormatted: formatCurrency(totalTax),
        brackets
    };
}

/**
 * Calculate December tax adjustment
 */
function calculateDecemberAdjustment(annualTaxResult, taxPaidJanNov) {
    const decemberTax = Math.max(0, annualTaxResult.totalTax - taxPaidJanNov);

    return {
        annualTax: annualTaxResult.totalTax,
        taxPaidJanNov,
        decemberTax,
        decemberTaxFormatted: formatCurrency(decemberTax),
        isOverpaid: taxPaidJanNov > annualTaxResult.totalTax,
        overpayment: Math.max(0, taxPaidJanNov - annualTaxResult.totalTax)
    };
}

// ============================================
// COMPLETE TAX CALCULATION
// ============================================

/**
 * Calculate complete tax for an employee
 */
function calculateEmployeeTax(employee) {
    const monthlyIncome = employee.monthlyIncome || {};
    const monthlyComponents = employee.monthlyComponents || {};
    const ptkpStatus = employee.status || 'TK/0';

    // Calculate monthly taxes (Jan-Nov using TER)
    const monthlyTaxes = {};
    let totalTaxJanNov = 0;
    let totalIncomeJanNov = 0;
    let totalComponentsJanNov = 0;

    const months = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november'];

    for (const month of months) {
        const income = parseCurrency(monthlyIncome[month]) || 0;
        const component = parseCurrency(monthlyComponents[month]) || 0;

        totalIncomeJanNov += income;
        totalComponentsJanNov += component;

        if (income > 0) {
            const taxResult = calculateMonthlyTER(income, ptkpStatus);
            monthlyTaxes[month] = taxResult;
            totalTaxJanNov += taxResult.tax;
        } else {
            monthlyTaxes[month] = null;
        }
    }

    // December income
    const decemberIncome = parseCurrency(monthlyIncome.december) || 0;
    const decemberComponent = parseCurrency(monthlyComponents.december) || 0;

    // Irregular income
    const thr = parseCurrency(employee.thr) || 0;
    const bonus = parseCurrency(employee.bonus) || 0;
    const tantiem = parseCurrency(employee.tantiem) || 0;
    const totalIrregular = thr + bonus + tantiem;

    // Annual calculations
    const totalGajiPokok = totalIncomeJanNov + decemberIncome;
    const totalPremiAsuransi = totalComponentsJanNov + decemberComponent;
    const penghasilanBrutoSetahun = totalGajiPokok + totalPremiAsuransi + totalIrregular;

    // Deductions
    const biayaJabatan = Math.min(6000000, Math.round(penghasilanBrutoSetahun * 0.05));
    const iuranJHTJP = Math.round(totalGajiPokok * 0.03); // 2% JHT + 1% JP

    const penghasilanNettoSetahun = penghasilanBrutoSetahun - biayaJabatan - iuranJHTJP;

    // Annual tax calculation
    const annualTaxResult = calculateAnnualTax(penghasilanNettoSetahun, ptkpStatus);

    // December adjustment
    const decemberAdjustment = calculateDecemberAdjustment(annualTaxResult, totalTaxJanNov);

    return {
        // Monthly summary
        monthlyTaxes,
        totalTaxJanNov,
        totalTaxJanNovFormatted: formatCurrency(totalTaxJanNov),

        // Income summary
        totalIncomeJanNov,
        totalIncomeJanNovFormatted: formatCurrency(totalIncomeJanNov),
        decemberIncome,
        decemberIncomeFormatted: formatCurrency(decemberIncome),
        totalGajiPokok,
        totalGajiPokokFormatted: formatCurrency(totalGajiPokok),

        // Irregular income
        thr,
        thrFormatted: formatCurrency(thr),
        bonus,
        bonusFormatted: formatCurrency(bonus),
        tantiem,
        tantiemFormatted: formatCurrency(tantiem),
        totalIrregular,
        totalIrregularFormatted: formatCurrency(totalIrregular),

        // Components (ASTEK)
        totalComponentsJanNov,
        totalComponentsJanNovFormatted: formatCurrency(totalComponentsJanNov),
        decemberComponent,
        decemberComponentFormatted: formatCurrency(decemberComponent),
        totalPremiAsuransi,
        totalPremiAsuransiFormatted: formatCurrency(totalPremiAsuransi),

        // Annual calculation
        penghasilanBrutoSetahun,
        penghasilanBrutoSetahunFormatted: formatCurrency(penghasilanBrutoSetahun),
        biayaJabatan,
        biayaJabatanFormatted: formatCurrency(biayaJabatan),
        iuranJHTJP,
        iuranJHTJPFormatted: formatCurrency(iuranJHTJP),
        penghasilanNettoSetahun,
        penghasilanNettoSetahunFormatted: formatCurrency(penghasilanNettoSetahun),

        // Tax results
        ptkp: annualTaxResult.ptkp,
        ptkpFormatted: formatCurrency(annualTaxResult.ptkp),
        pkp: annualTaxResult.pkp,
        pkpFormatted: formatCurrency(annualTaxResult.pkp),
        annualTax: annualTaxResult.totalTax,
        annualTaxFormatted: formatCurrency(annualTaxResult.totalTax),
        taxBrackets: annualTaxResult.brackets,

        // December adjustment
        decemberTax: decemberAdjustment.decemberTax,
        decemberTaxFormatted: decemberAdjustment.decemberTaxFormatted,
        isOverpaid: decemberAdjustment.isOverpaid,
        overpayment: decemberAdjustment.overpayment,
        overpaymentFormatted: formatCurrency(decemberAdjustment.overpayment),

        // Total
        totalTaxYear: annualTaxResult.totalTax,
        totalTaxYearFormatted: formatCurrency(annualTaxResult.totalTax)
    };
}

// ============================================
// ASTEK CALCULATION
// ============================================

/**
 * Calculate ASTEK components breakdown
 */
function calculateASTEKBREAKDOWN(monthlyGrossSalary) {
    // JHT: Jaminan Hari Tua (Old Age Security)
    // Employee: 2%, Employer: 3.7%
    const jhtEmployee = Math.round(monthlyGrossSalary * 0.02);
    const jhtEmployer = Math.round(monthlyGrossSalary * 0.037);

    // JP: Jaminan Pensiun (Pension Security)
    // Employee: 1%, Employer: 2%
    // Max salary base: Rp 9,560,600 (as of 2024)
    const jpBase = Math.min(monthlyGrossSalary, 9560600);
    const jpEmployee = Math.round(jpBase * 0.01);
    const jpEmployer = Math.round(jpBase * 0.02);

    // JKK: Jaminan Kecelakaan Kerja (Work Accident Insurance)
    // Employer only: 0.24% - 1.74% (varies by risk level, using 0.89% as average)
    const jkkEmployer = Math.round(monthlyGrossSalary * 0.0089);

    // JKM: Jaminan Kematian (Death Insurance)
    // Employer only: 0.3%
    const jkmEmployer = Math.round(monthlyGrossSalary * 0.003);

    // BPJS Kesehatan (Health Insurance)
    // Employee: 1%, Employer: 4%
    // Max salary base: Rp 12,000,000
    const kesBase = Math.min(monthlyGrossSalary, 12000000);
    const kesEmployee = Math.round(kesBase * 0.01);
    const kesEmployer = Math.round(kesBase * 0.04);

    return {
        jhtEmployee,
        jhtEmployer,
        jpEmployee,
        jpEmployer,
        jkkEmployer,
        jkmEmployer,
        kesEmployee,
        kesEmployer,
        totalEmployee: jhtEmployee + jpEmployee + kesEmployee,
        totalEmployer: jhtEmployer + jpEmployer + jkkEmployer + jkmEmployer + kesEmployer,
        total: jhtEmployee + jpEmployee + kesEmployee + jhtEmployer + jpEmployer + jkkEmployer + jkmEmployer + kesEmployer
    };
}

// ============================================
// EXPORT
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TER_BRACKETS,
        PTKP_VALUES,
        ANNUAL_BRACKETS,
        formatCurrency,
        formatRate,
        parseCurrency,
        getTERCategory,
        getTERRate,
        getTERBracketInfo,
        calculateMonthlyTER,
        calculateAnnualTax,
        calculateDecemberAdjustment,
        calculateEmployeeTax,
        calculateASTEKBREAKDOWN
    };
}