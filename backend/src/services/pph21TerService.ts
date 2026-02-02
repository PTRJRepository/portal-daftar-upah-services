import * as fs from 'fs';
import * as path from 'path';

/**
 * PPH21 TER (Tarif Efektif Rata-rata) Calculation Service
 * Dynamically loaded from rule_TER_pajak.json
 */

interface TerLayer {
    no: number;
    min_bruto: number;
    max_bruto: number | null; // null represents Infinity
    tarif: number; // Percentage (e.g. 0.25 for 0.25%)
}

interface TerCategoryData {
    kategori: string;
    ptkp_status: string[];
    layers: TerLayer[];
}

interface TerRules {
    tarif_pph21_ter: {
        ter_a: TerCategoryData;
        ter_b: TerCategoryData;
        ter_c: TerCategoryData;
        [key: string]: TerCategoryData; // Allow index access
    };
}

export interface Pph21TerResult {
    ptkp_status: string;
    ter_category: string;
    gross_income: number;
    rate: number;          // Decimal format (0.05)
    rate_percent: number;  // Percentage format (5.00)
    tax_amount: number;
}

class Pph21TerService {
    private static instance: Pph21TerService;
    private rules: TerRules | null = null;
    private ptkpMap: Record<string, string> = {}; // Map PTKP -> TER Category (e.g., 'TK/0' -> 'TER A')

    private constructor() {
        this.loadRules();
    }

    public static getInstance(): Pph21TerService {
        if (!Pph21TerService.instance) {
            Pph21TerService.instance = new Pph21TerService();
        }
        return Pph21TerService.instance;
    }

    private loadRules() {
        try {
            // Absolute path based on user's environment structure
            const jsonPath = path.resolve(
                process.cwd(),
                '../Additional_services/hitung_pajak/rule_TER_pajak.json'
            );

            console.log(`[Pph21TerService] Loading tax rules from: ${jsonPath}`);

            if (!fs.existsSync(jsonPath)) {
                console.error(`[Pph21TerService] Error: Rules file not found at ${jsonPath}`);
                throw new Error(`Rules file not found at ${jsonPath}`);
            }

            const rawData = fs.readFileSync(jsonPath, 'utf-8');
            this.rules = JSON.parse(rawData);
            this.buildPtkpMap();
            console.log(`[Pph21TerService] Rules loaded successfully.`);
        } catch (error) {
            console.error(`[Pph21TerService] Failed to load rules:`, error);
            // Don't crash immediately, but subsequent calls will fail or need fallback
            // For now, we'll throw to ensure visibility of the issue
            throw error;
        }
    }

    private buildPtkpMap() {
        if (!this.rules) return;

        const cats = this.rules.tarif_pph21_ter;
        for (const key in cats) {
            const catData = cats[key];
            const categoryName = catData.kategori; // e.g., "TER A"
            for (const ptkp of catData.ptkp_status) {
                this.ptkpMap[ptkp.toUpperCase()] = key; // Map "TK/0" -> "ter_a" (key in json)
            }
        }
    }

    /**
     * Determine TER Category key (ter_a, ter_b, ter_c) based on PTKP
     */
    public getTerCategoryKey(ptkpStatus: string): string {
        const normalized = (ptkpStatus || '').toUpperCase().trim();
        const key = this.ptkpMap[normalized];
        if (!key) {
            // Default fallback logic if not found in JSON map
            if (['TK/0', 'TK/1', 'K/0'].includes(normalized)) return 'ter_a';
            if (['K/3'].includes(normalized)) return 'ter_c';
            return 'ter_b'; // Default
        }
        return key;
    }

    /**
     * Get TER Rate based on category and gross income
     */
    public getTerRate(categoryKey: string, grossIncome: number): number {
        if (!this.rules) {
            this.loadRules();
        }
        if (!this.rules) throw new Error("Tax rules not loaded");

        const categoryData = this.rules.tarif_pph21_ter[categoryKey];
        if (!categoryData) {
            throw new Error(`Unknown category key: ${categoryKey}`);
        }

        for (const layer of categoryData.layers) {
            // Check if income is within range [min, max]
            // max_bruto can be null (infinity)
            const max = layer.max_bruto === null ? Infinity : layer.max_bruto;

            if (grossIncome >= layer.min_bruto && grossIncome <= max) {
                return layer.tarif; // Returns value like 0.25 (meaning 0.25%)
            }
        }

        // Fallback: return max rate of the last layer
        const lastLayer = categoryData.layers[categoryData.layers.length - 1];
        return lastLayer.tarif;
    }

    public calculatePph21Ter(grossIncome: number, ptkpStatus: string): Pph21TerResult {
        const categoryKey = this.getTerCategoryKey(ptkpStatus);

        // Helper to get friendly name
        const categoryName = this.rules?.tarif_pph21_ter[categoryKey]?.kategori || categoryKey.toUpperCase().replace('_', ' ');

        const ratePercent = this.getTerRate(categoryKey, grossIncome); // e.g. 0.25
        const rateDecimal = ratePercent / 100; // e.g. 0.0025
        const taxAmount = Math.round(grossIncome * rateDecimal);

        return {
            ptkp_status: ptkpStatus,
            ter_category: categoryName,
            gross_income: grossIncome,
            rate: rateDecimal,
            rate_percent: ratePercent,
            tax_amount: taxAmount
        };
    }
}

// Export singleton method wrappers for backward compatibility
export const calculatePph21Ter = (grossIncome: number, ptkpStatus: string) => {
    return Pph21TerService.getInstance().calculatePph21Ter(grossIncome, ptkpStatus);
};

export const getTerCategoryOnly = (ptkpStatus: string) => {
    const service = Pph21TerService.getInstance();
    const key = service.getTerCategoryKey(ptkpStatus);
    // Needed to access private/protected rules if we want the friendly name "TER A"
    // Since getTerCategoryKey returns 'ter_a', let's map it back to friendly name or just return 'TER X'
    // For compatibility with previous simple function:
    if (key === 'ter_a') return 'TER A';
    if (key === 'ter_c') return 'TER C';
    return 'TER B';
};

export const pph21TerService = {
    calculatePph21Ter,
    getTerCategory: getTerCategoryOnly
};

// 64 layers - up to 34% for income > Rp612.000.000
// =============================================================================
const TER_A_BRACKETS: TerBracket[] = [
    { upperLimit: 5400000, rate: 0.0 },       // 1. s.d. 5.400.000 → 0%
    { upperLimit: 5650000, rate: 0.0025 },    // 2. > 5.400.000 – 5.650.000 → 0,25%
    { upperLimit: 5950000, rate: 0.005 },     // 3. > 5.650.000 – 5.950.000 → 0,5%
    { upperLimit: 6300000, rate: 0.0075 },    // 4. > 5.950.000 – 6.300.000 → 0,75%
    { upperLimit: 6750000, rate: 0.01 },      // 5. > 6.300.000 – 6.750.000 → 1%
    { upperLimit: 7500000, rate: 0.0125 },    // 6. > 6.750.000 – 7.500.000 → 1,25%
    { upperLimit: 8550000, rate: 0.015 },     // 7. > 7.500.000 – 8.550.000 → 1,5%
    { upperLimit: 9650000, rate: 0.0175 },    // 8. > 8.550.000 – 9.650.000 → 1,75%
    { upperLimit: 10650000, rate: 0.02 },     // 9. > 9.650.000 – 10.650.000 → 2%
    { upperLimit: 11150000, rate: 0.0225 },   // 10. > 10.650.000 – 11.150.000 → 2,25%
    { upperLimit: 11650000, rate: 0.025 },    // 11. > 11.150.000 – 11.650.000 → 2,5%
    { upperLimit: 12150000, rate: 0.0275 },   // 12. > 11.650.000 – 12.150.000 → 2,75%
    { upperLimit: 12650000, rate: 0.03 },     // 13. > 12.150.000 – 12.650.000 → 3%
    { upperLimit: 13200000, rate: 0.0325 },   // 14. > 12.650.000 – 13.200.000 → 3,25%
    { upperLimit: 13750000, rate: 0.035 },    // 15. > 13.200.000 – 13.750.000 → 3,5%
    { upperLimit: 14350000, rate: 0.0375 },   // 16. > 13.750.000 – 14.350.000 → 3,75%
    { upperLimit: 14950000, rate: 0.04 },     // 17. > 14.350.000 – 14.950.000 → 4%
    { upperLimit: 15550000, rate: 0.0425 },   // 18. > 14.950.000 – 15.550.000 → 4,25%
    { upperLimit: 16200000, rate: 0.045 },    // 19. > 15.550.000 – 16.200.000 → 4,5%
    { upperLimit: 16850000, rate: 0.0475 },   // 20. > 16.200.000 – 16.850.000 → 4,75%
    { upperLimit: 17550000, rate: 0.05 },     // 21. > 16.850.000 – 17.550.000 → 5%
    { upperLimit: 18250000, rate: 0.0525 },   // 22. > 17.550.000 – 18.250.000 → 5,25%
    { upperLimit: 18950000, rate: 0.055 },    // 23. > 18.250.000 – 18.950.000 → 5,5%
    { upperLimit: 19700000, rate: 0.0575 },   // 24. > 18.950.000 – 19.700.000 → 5,75%
    { upperLimit: 20450000, rate: 0.06 },     // 25. > 19.700.000 – 20.450.000 → 6%
    { upperLimit: 21250000, rate: 0.0625 },   // 26. > 20.450.000 – 21.250.000 → 6,25%
    { upperLimit: 22050000, rate: 0.065 },    // 27. > 21.250.000 – 22.050.000 → 6,5%
    { upperLimit: 22850000, rate: 0.0675 },   // 28. > 22.050.000 – 22.850.000 → 6,75%
    { upperLimit: 23700000, rate: 0.07 },     // 29. > 22.850.000 – 23.700.000 → 7%
    { upperLimit: 24550000, rate: 0.0725 },   // 30. > 23.700.000 – 24.550.000 → 7,25%
    { upperLimit: 25450000, rate: 0.075 },    // 31. > 24.550.000 – 25.450.000 → 7,5%
    { upperLimit: 26350000, rate: 0.0775 },   // 32. > 25.450.000 – 26.350.000 → 7,75%
    { upperLimit: 27300000, rate: 0.08 },     // 33. > 26.350.000 – 27.300.000 → 8%
    { upperLimit: 28250000, rate: 0.0825 },   // 34. > 27.300.000 – 28.250.000 → 8,25%
    { upperLimit: 29250000, rate: 0.085 },    // 35. > 28.250.000 – 29.250.000 → 8,5%
    { upperLimit: 30250000, rate: 0.0875 },   // 36. > 29.250.000 – 30.250.000 → 8,75%
    { upperLimit: 31300000, rate: 0.09 },     // 37. > 30.250.000 – 31.300.000 → 9%
    { upperLimit: 32350000, rate: 0.0925 },   // 38. > 31.300.000 – 32.350.000 → 9,25%
    { upperLimit: 33450000, rate: 0.095 },    // 39. > 32.350.000 – 33.450.000 → 9,5%
    { upperLimit: 34550000, rate: 0.0975 },   // 40. > 33.450.000 – 34.550.000 → 9,75%
    { upperLimit: 35700000, rate: 0.10 },     // 41. > 34.550.000 – 35.700.000 → 10%
    { upperLimit: 36850000, rate: 0.1025 },   // 42. > 35.700.000 – 36.850.000 → 10,25%
    { upperLimit: 38050000, rate: 0.105 },    // 43. > 36.850.000 – 38.050.000 → 10,5%
    { upperLimit: 39250000, rate: 0.1075 },   // 44. > 38.050.000 – 39.250.000 → 10,75%
    { upperLimit: 40500000, rate: 0.11 },     // 45. > 39.250.000 – 40.500.000 → 11%
    { upperLimit: 41800000, rate: 0.1125 },   // 46. > 40.500.000 – 41.800.000 → 11,25%
    { upperLimit: 43100000, rate: 0.115 },    // 47. > 41.800.000 – 43.100.000 → 11,5%
    { upperLimit: 44450000, rate: 0.1175 },   // 48. > 43.100.000 – 44.450.000 → 11,75%
    { upperLimit: 45850000, rate: 0.12 },     // 49. > 44.450.000 – 45.850.000 → 12%
    { upperLimit: 47250000, rate: 0.1225 },   // 50. > 45.850.000 – 47.250.000 → 12,25%
    { upperLimit: 48700000, rate: 0.125 },    // 51. > 47.250.000 – 48.700.000 → 12,5%
    { upperLimit: 50200000, rate: 0.1275 },   // 52. > 48.700.000 – 50.200.000 → 12,75%
    { upperLimit: 51700000, rate: 0.13 },     // 53. > 50.200.000 – 51.700.000 → 13%
    { upperLimit: 53250000, rate: 0.1325 },   // 54. > 51.700.000 – 53.250.000 → 13,25%
    { upperLimit: 54850000, rate: 0.135 },    // 55. > 53.250.000 – 54.850.000 → 13,5%
    { upperLimit: 56500000, rate: 0.1375 },   // 56. > 54.850.000 – 56.500.000 → 13,75%
    { upperLimit: 58150000, rate: 0.14 },     // 57. > 56.500.000 – 58.150.000 → 14%
    { upperLimit: 59850000, rate: 0.1425 },   // 58. > 58.150.000 – 59.850.000 → 14,25%
    { upperLimit: 61600000, rate: 0.145 },    // 59. > 59.850.000 – 61.600.000 → 14,5%
    { upperLimit: 63350000, rate: 0.1475 },   // 60. > 61.600.000 – 63.350.000 → 14,75%
    { upperLimit: 65150000, rate: 0.15 },     // 61. > 63.350.000 – 65.150.000 → 15%
    { upperLimit: 67000000, rate: 0.1525 },   // 62. > 65.150.000 – 67.000.000 → 15,25%
    { upperLimit: 68900000, rate: 0.155 },    // 63. > 67.000.000 – 68.900.000 → 15,5%
    { upperLimit: 70850000, rate: 0.1575 },   // 64. > 68.900.000 – 70.850.000 → 15,75%
    { upperLimit: 72850000, rate: 0.16 },     // 65. > 70.850.000 – 72.850.000 → 16%
    { upperLimit: 74900000, rate: 0.1625 },   // 66. > 72.850.000 – 74.900.000 → 16,25%
    { upperLimit: 77000000, rate: 0.165 },    // 67. > 74.900.000 – 77.000.000 → 16,5%
    { upperLimit: 79150000, rate: 0.1675 },   // 68. > 77.000.000 – 79.150.000 → 16,75%
    { upperLimit: 81350000, rate: 0.17 },     // 69. > 79.150.000 – 81.350.000 → 17%
    { upperLimit: 83600000, rate: 0.1725 },   // 70. > 81.350.000 – 83.600.000 → 17,25%
    { upperLimit: 85900000, rate: 0.175 },    // 71. > 83.600.000 – 85.900.000 → 17,5%
    { upperLimit: 88250000, rate: 0.1775 },   // 72. > 85.900.000 – 88.250.000 → 17,75%
    { upperLimit: 90650000, rate: 0.18 },     // 73. > 88.250.000 – 90.650.000 → 18%
    { upperLimit: 93100000, rate: 0.1825 },   // 74. > 90.650.000 – 93.100.000 → 18,25%
    { upperLimit: 95600000, rate: 0.185 },    // 75. > 93.100.000 – 95.600.000 → 18,5%
    { upperLimit: 98150000, rate: 0.1875 },   // 76. > 95.600.000 – 98.150.000 → 18,75%
    { upperLimit: 100750000, rate: 0.19 },    // 77. > 98.150.000 – 100.750.000 → 19%
    { upperLimit: 103400000, rate: 0.1925 },  // 78. > 100.750.000 – 103.400.000 → 19,25%
    { upperLimit: 106100000, rate: 0.195 },   // 79. > 103.400.000 – 106.100.000 → 19,5%
    { upperLimit: 108850000, rate: 0.1975 },  // 80. > 106.100.000 – 108.850.000 → 19,75%
    { upperLimit: 111700000, rate: 0.20 },    // 81. > 108.850.000 – 111.700.000 → 20%
    { upperLimit: 114600000, rate: 0.2025 },  // 82. > 111.700.000 – 114.600.000 → 20,25%
    { upperLimit: 117550000, rate: 0.205 },   // 83. > 114.600.000 – 117.550.000 → 20,5%
    { upperLimit: 120550000, rate: 0.2075 },  // 84. > 117.550.000 – 120.550.000 → 20,75%
    { upperLimit: 123600000, rate: 0.21 },    // 85. > 120.550.000 – 123.600.000 → 21%
    { upperLimit: 126700000, rate: 0.2125 },  // 86. > 123.600.000 – 126.700.000 → 21,25%
    { upperLimit: 129850000, rate: 0.215 },   // 87. > 126.700.000 – 129.850.000 → 21,5%
    { upperLimit: 133050000, rate: 0.2175 },  // 88. > 129.850.000 – 133.050.000 → 21,75%
    { upperLimit: 136300000, rate: 0.22 },    // 89. > 133.050.000 – 136.300.000 → 22%
    { upperLimit: 139600000, rate: 0.2225 },  // 90. > 136.300.000 – 139.600.000 → 22,25%
    { upperLimit: 142950000, rate: 0.225 },   // 91. > 139.600.000 – 142.950.000 → 22,5%
    { upperLimit: 146350000, rate: 0.2275 },  // 92. > 142.950.000 – 146.350.000 → 22,75%
    { upperLimit: 149800000, rate: 0.23 },    // 93. > 146.350.000 – 149.800.000 → 23%
    { upperLimit: 153300000, rate: 0.2325 },  // 94. > 149.800.000 – 153.300.000 → 23,25%
    { upperLimit: 156850000, rate: 0.235 },   // 95. > 153.300.000 – 156.850.000 → 23,5%
    { upperLimit: 160450000, rate: 0.2375 },  // 96. > 156.850.000 – 160.450.000 → 23,75%
    { upperLimit: 164100000, rate: 0.24 },    // 97. > 160.450.000 – 164.100.000 → 24%
    { upperLimit: 167800000, rate: 0.2425 },  // 98. > 164.100.000 – 167.800.000 → 24,25%
    { upperLimit: 171550000, rate: 0.245 },   // 99. > 167.800.000 – 171.550.000 → 24,5%
    { upperLimit: 175350000, rate: 0.2475 },  // 100. > 171.550.000 – 175.350.000 → 24,75%
    { upperLimit: 179200000, rate: 0.25 },    // 101. > 175.350.000 – 179.200.000 → 25%
    { upperLimit: 183100000, rate: 0.2525 },  // 102. > 179.200.000 – 183.100.000 → 25,25%
    { upperLimit: 187050000, rate: 0.255 },   // 103. > 183.100.000 – 187.050.000 → 25,5%
    { upperLimit: 191050000, rate: 0.2575 },  // 104. > 187.050.000 – 191.050.000 → 25,75%
    { upperLimit: 195100000, rate: 0.26 },    // 105. > 191.050.000 – 195.100.000 → 26%
    { upperLimit: 199200000, rate: 0.2625 },  // 106. > 195.100.000 – 199.200.000 → 26,25%
    { upperLimit: 203350000, rate: 0.265 },   // 107. > 199.200.000 – 203.350.000 → 26,5%
    { upperLimit: 207550000, rate: 0.2675 },  // 108. > 203.350.000 – 207.550.000 → 26,75%
    { upperLimit: 211800000, rate: 0.27 },    // 109. > 207.550.000 – 211.800.000 → 27%
    { upperLimit: 216100000, rate: 0.2725 },  // 110. > 211.800.000 – 216.100.000 → 27,25%
    { upperLimit: 220450000, rate: 0.275 },   // 111. > 216.100.000 – 220.450.000 → 27,5%
    { upperLimit: 224850000, rate: 0.2775 },  // 112. > 220.450.000 – 224.850.000 → 27,75%
    { upperLimit: 229300000, rate: 0.28 },    // 113. > 224.850.000 – 229.300.000 → 28%
    { upperLimit: 233800000, rate: 0.2825 },  // 114. > 229.300.000 – 233.800.000 → 28,25%
    { upperLimit: 238350000, rate: 0.285 },   // 115. > 233.800.000 – 238.350.000 → 28,5%
    { upperLimit: 242950000, rate: 0.2875 },  // 116. > 238.350.000 – 242.950.000 → 28,75%
    { upperLimit: 247600000, rate: 0.29 },    // 117. > 242.950.000 – 247.600.000 → 29%
    { upperLimit: 252300000, rate: 0.2925 },  // 118. > 247.600.000 – 252.300.000 → 29,25%
    { upperLimit: 257050000, rate: 0.295 },   // 119. > 252.300.000 – 257.050.000 → 29,5%
    { upperLimit: 261850000, rate: 0.2975 },  // 120. > 257.050.000 – 261.850.000 → 29,75%
    { upperLimit: 266700000, rate: 0.30 },    // 121. > 261.850.000 – 266.700.000 → 30%
    { upperLimit: 271600000, rate: 0.3025 },  // 122. > 266.700.000 – 271.600.000 → 30,25%
    { upperLimit: 276550000, rate: 0.305 },   // 123. > 271.600.000 – 276.550.000 → 30,5%
    { upperLimit: 281550000, rate: 0.3075 },  // 124. > 276.550.000 – 281.550.000 → 30,75%
    { upperLimit: 286600000, rate: 0.31 },    // 125. > 281.550.000 – 286.600.000 → 31%
    { upperLimit: 291700000, rate: 0.3125 },  // 126. > 286.600.000 – 291.700.000 → 31,25%
    { upperLimit: 296850000, rate: 0.315 },   // 127. > 291.700.000 – 296.850.000 → 31,5%
    { upperLimit: 302050000, rate: 0.3175 },  // 128. > 296.850.000 – 302.050.000 → 31,75%
    { upperLimit: 307300000, rate: 0.32 },    // 129. > 302.050.000 – 307.300.000 → 32%
    { upperLimit: 312600000, rate: 0.3225 },  // 130. > 307.300.000 – 312.600.000 → 32,25%
    { upperLimit: 317950000, rate: 0.325 },   // 131. > 312.600.000 – 317.950.000 → 32,5%
    { upperLimit: 323350000, rate: 0.3275 },  // 132. > 317.950.000 – 323.350.000 → 32,75%
    { upperLimit: 328800000, rate: 0.33 },    // 133. > 323.350.000 – 328.800.000 → 33%
    { upperLimit: 334300000, rate: 0.3325 },  // 134. > 328.800.000 – 334.300.000 → 33,25%
    { upperLimit: 339850000, rate: 0.335 },   // 135. > 334.300.000 – 339.850.000 → 33,5%
    { upperLimit: 345450000, rate: 0.3375 },  // 136. > 339.850.000 – 345.450.000 → 33,75%
    { upperLimit: 351100000, rate: 0.34 },    // 137. > 345.450.000 – 351.100.000 → 34%
    { upperLimit: 612000000, rate: 0.34 },     // > 351.100.000 → 34%
    { upperLimit: Infinity, rate: 0.34 }      // Fallback
];

// =============================================================================
// TER B Brackets: TK/2, TK/3, K/1, K/2
// 40 layers - up to 35% for income > Rp1.4 miliar
// =============================================================================
const TER_B_BRACKETS: TerBracket[] = [
    { upperLimit: 6200000, rate: 0.0 },       // 1. s.d. 6.200.000 → 0%
    { upperLimit: 6500000, rate: 0.0025 },    // 2. > 6.200.000 – 6.500.000 → 0,25%
    { upperLimit: 6850000, rate: 0.005 },     // 3. > 6.500.000 – 6.850.000 → 0,5%
    { upperLimit: 7300000, rate: 0.0075 },    // 4. > 6.850.000 – 7.300.000 → 0,75%
    { upperLimit: 9200000, rate: 0.01 },      // 5. > 7.300.000 – 9.200.000 → 1%
    { upperLimit: 10750000, rate: 0.015 },    // 6. > 9.200.000 – 10.750.000 → 1,5%
    { upperLimit: 11250000, rate: 0.02 },     // 7. > 10.750.000 – 11.250.000 → 2%
    { upperLimit: 11600000, rate: 0.025 },    // 8. > 11.250.000 – 11.600.000 → 2,5%
    { upperLimit: 12000000, rate: 0.025 },    // 9. > 11.600.000 – 12.000.000 → 2,5%
    { upperLimit: 12600000, rate: 0.03 },     // 10. > 12.000.000 – 12.600.000 → 3%
    { upperLimit: 13600000, rate: 0.04 },     // 11. > 12.600.000 – 13.600.000 → 4%
    { upperLimit: 14650000, rate: 0.045 },    // 12. > 13.600.000 – 14.650.000 → 4,5%
    { upperLimit: 15750000, rate: 0.05 },     // 13. > 14.650.000 – 15.750.000 → 5%
    { upperLimit: 16900000, rate: 0.055 },    // 14. > 15.750.000 – 16.900.000 → 5,5%
    { upperLimit: 18100000, rate: 0.06 },     // 15. > 16.900.000 – 18.100.000 → 6%
    { upperLimit: 19350000, rate: 0.065 },    // 16. > 18.100.000 – 19.350.000 → 6,5%
    { upperLimit: 20650000, rate: 0.07 },     // 17. > 19.350.000 – 20.650.000 → 7%
    { upperLimit: 22000000, rate: 0.075 },    // 18. > 20.650.000 – 22.000.000 → 7,5%
    { upperLimit: 23400000, rate: 0.08 },     // 19. > 22.000.000 – 23.400.000 → 8%
    { upperLimit: 24850000, rate: 0.085 },    // 20. > 23.400.000 – 24.850.000 → 8,5%
    { upperLimit: 26350000, rate: 0.09 },     // 21. > 24.850.000 – 26.350.000 → 9%
    { upperLimit: 27900000, rate: 0.095 },    // 22. > 26.350.000 – 27.900.000 → 9,5%
    { upperLimit: 29500000, rate: 0.10 },     // 23. > 27.900.000 – 29.500.000 → 10%
    { upperLimit: 31150000, rate: 0.105 },    // 24. > 29.500.000 – 31.150.000 → 10,5%
    { upperLimit: 32850000, rate: 0.11 },     // 25. > 31.150.000 – 32.850.000 → 11%
    { upperLimit: 34600000, rate: 0.115 },    // 26. > 32.850.000 – 34.600.000 → 11,5%
    { upperLimit: 36400000, rate: 0.12 },     // 27. > 34.600.000 – 36.400.000 → 12%
    { upperLimit: 38250000, rate: 0.125 },    // 28. > 36.400.000 – 38.250.000 → 12,5%
    { upperLimit: 40150000, rate: 0.13 },     // 29. > 38.250.000 – 40.150.000 → 13%
    { upperLimit: 42100000, rate: 0.135 },    // 30. > 40.150.000 – 42.100.000 → 13,5%
    { upperLimit: 44100000, rate: 0.14 },     // 31. > 42.100.000 – 44.100.000 → 14%
    { upperLimit: 46150000, rate: 0.145 },    // 32. > 44.100.000 – 46.150.000 → 14,5%
    { upperLimit: 48250000, rate: 0.15 },     // 33. > 46.150.000 – 48.250.000 → 15%
    { upperLimit: 50400000, rate: 0.155 },    // 34. > 48.250.000 – 50.400.000 → 15,5%
    { upperLimit: 52600000, rate: 0.16 },     // 35. > 50.400.000 – 52.600.000 → 16%
    { upperLimit: 54850000, rate: 0.165 },    // 36. > 52.600.000 – 54.850.000 → 16,5%
    { upperLimit: 57150000, rate: 0.17 },     // 37. > 54.850.000 – 57.150.000 → 17%
    { upperLimit: 59500000, rate: 0.175 },    // 38. > 57.150.000 – 59.500.000 → 17,5%
    { upperLimit: 61900000, rate: 0.18 },     // 39. > 59.500.000 – 61.900.000 → 18%
    { upperLimit: 64350000, rate: 0.185 },    // 40. > 61.900.000 – 64.350.000 → 18,5%
    { upperLimit: 66850000, rate: 0.19 },     // 41. > 64.350.000 – 66.850.000 → 19%
    { upperLimit: 69400000, rate: 0.195 },    // 42. > 66.850.000 – 69.400.000 → 19,5%
    { upperLimit: 72000000, rate: 0.20 },     // 43. > 69.400.000 – 72.000.000 → 20%
    { upperLimit: 74650000, rate: 0.205 },    // 44. > 72.000.000 – 74.650.000 → 20,5%
    { upperLimit: 77350000, rate: 0.21 },     // 45. > 74.650.000 – 77.350.000 → 21%
    { upperLimit: 80100000, rate: 0.215 },    // 46. > 77.350.000 – 80.100.000 → 21,5%
    { upperLimit: 82900000, rate: 0.22 },     // 47. > 80.100.000 – 82.900.000 → 22%
    { upperLimit: 85750000, rate: 0.225 },    // 48. > 82.900.000 – 85.750.000 → 22,5%
    { upperLimit: 88650000, rate: 0.23 },     // 49. > 85.750.000 – 88.650.000 → 23%
    { upperLimit: 91600000, rate: 0.235 },    // 50. > 88.650.000 – 91.600.000 → 23,5%
    { upperLimit: 94600000, rate: 0.24 },     // 51. > 91.600.000 – 94.600.000 → 24%
    { upperLimit: 97650000, rate: 0.245 },    // 52. > 94.600.000 – 97.650.000 → 24,5%
    { upperLimit: 100750000, rate: 0.25 },    // 53. > 97.650.000 – 100.750.000 → 25%
    { upperLimit: 103900000, rate: 0.255 },   // 54. > 100.750.000 – 103.900.000 → 25,5%
    { upperLimit: 107100000, rate: 0.26 },    // 55. > 103.900.000 – 107.100.000 → 26%
    { upperLimit: 110350000, rate: 0.265 },   // 56. > 107.100.000 – 110.350.000 → 26,5%
    { upperLimit: 113700000, rate: 0.27 },    // 57. > 110.350.000 – 113.700.000 → 27%
    { upperLimit: 117100000, rate: 0.275 },   // 58. > 113.700.000 – 117.100.000 → 27,5%
    { upperLimit: 120550000, rate: 0.28 },    // 59. > 117.100.000 – 120.550.000 → 28%
    { upperLimit: 124050000, rate: 0.285 },   // 60. > 120.550.000 – 124.050.000 → 28,5%
    { upperLimit: 127600000, rate: 0.29 },    // 61. > 124.050.000 – 127.600.000 → 29%
    { upperLimit: 131200000, rate: 0.295 },   // 62. > 127.600.000 – 131.200.000 → 29,5%
    { upperLimit: 134850000, rate: 0.30 },    // 63. > 131.200.000 – 134.850.000 → 30%
    { upperLimit: 138550000, rate: 0.305 },   // 64. > 134.850.000 – 138.550.000 → 30,5%
    { upperLimit: 142300000, rate: 0.31 },    // 65. > 138.550.000 – 142.300.000 → 31%
    { upperLimit: 146100000, rate: 0.315 },   // 66. > 142.300.000 – 146.100.000 → 31,5%
    { upperLimit: 149950000, rate: 0.32 },    // 67. > 146.100.000 – 149.950.000 → 32%
    { upperLimit: 153850000, rate: 0.325 },   // 68. > 149.950.000 – 153.850.000 → 32,5%
    { upperLimit: 157800000, rate: 0.33 },    // 69. > 153.850.000 – 157.800.000 → 33%
    { upperLimit: 161800000, rate: 0.335 },   // 70. > 157.800.000 – 161.800.000 → 33,5%
    { upperLimit: 165850000, rate: 0.34 },    // 71. > 161.800.000 – 165.850.000 → 34%
    { upperLimit: 169950000, rate: 0.345 },   // 72. > 165.850.000 – 169.950.000 → 34,5%
    { upperLimit: 174100000, rate: 0.35 },    // 73. > 169.950.000 – 174.100.000 → 35%
    { upperLimit: 1400000000, rate: 0.35 },   // > 174.100.000 → 35%
    { upperLimit: Infinity, rate: 0.35 }      // Fallback
];

// =============================================================================
// TER C Brackets: K/3
// 26 layers - up to 35% for income > Rp619.000.000
// =============================================================================
const TER_C_BRACKETS: TerBracket[] = [
    { upperLimit: 6600000, rate: 0.0 },       // 1. s.d. 6.600.000 → 0%
    { upperLimit: 6950000, rate: 0.0025 },    // 2. > 6.600.000 – 6.950.000 → 0,25%
    { upperLimit: 7350000, rate: 0.005 },     // 3. > 6.950.000 – 7.350.000 → 0,5%
    { upperLimit: 7800000, rate: 0.0075 },    // 4. > 7.350.000 – 7.800.000 → 0,75%
    { upperLimit: 8850000, rate: 0.01 },      // 5. > 7.800.000 – 8.850.000 → 1%
    { upperLimit: 9800000, rate: 0.0125 },    // 6. > 8.850.000 – 9.800.000 → 1,25%
    { upperLimit: 10950000, rate: 0.015 },    // 7. > 9.800.000 – 10.950.000 → 1,5%
    { upperLimit: 11200000, rate: 0.0175 },   // 8. > 10.950.000 – 11.200.000 → 1,75%
    { upperLimit: 12050000, rate: 0.02 },     // 9. > 11.200.000 – 12.050.000 → 2%
    { upperLimit: 12450000, rate: 0.0225 },   // 10. > 12.050.000 – 12.450.000 → 2,25%
    { upperLimit: 12850000, rate: 0.025 },    // 11. > 12.450.000 – 12.850.000 → 2,5%
    { upperLimit: 13250000, rate: 0.0275 },   // 12. > 12.850.000 – 13.250.000 → 2,75%
    { upperLimit: 13650000, rate: 0.03 },     // 13. > 13.250.000 – 13.650.000 → 3%
    { upperLimit: 14050000, rate: 0.0325 },   // 14. > 13.650.000 – 14.050.000 → 3,25%
    { upperLimit: 14500000, rate: 0.035 },    // 15. > 14.050.000 – 14.500.000 → 3,5%
    { upperLimit: 14950000, rate: 0.0375 },   // 16. > 14.500.000 – 14.950.000 → 3,75%
    { upperLimit: 15450000, rate: 0.04 },     // 17. > 14.950.000 – 15.450.000 → 4%
    { upperLimit: 15950000, rate: 0.0425 },   // 18. > 15.450.000 – 15.950.000 → 4,25%
    { upperLimit: 16500000, rate: 0.045 },    // 19. > 15.950.000 – 16.500.000 → 4,5%
    { upperLimit: 17050000, rate: 0.0475 },   // 20. > 16.500.000 – 17.050.000 → 4,75%
    { upperLimit: 17650000, rate: 0.05 },     // 21. > 17.050.000 – 17.650.000 → 5%
    { upperLimit: 18250000, rate: 0.0525 },   // 22. > 17.650.000 – 18.250.000 → 5,25%
    { upperLimit: 18900000, rate: 0.055 },    // 23. > 18.250.000 – 18.900.000 → 5,5%
    { upperLimit: 19550000, rate: 0.0575 },   // 24. > 18.900.000 – 19.550.000 → 5,75%
    { upperLimit: 20250000, rate: 0.06 },     // 25. > 19.550.000 – 20.250.000 → 6%
    { upperLimit: 20950000, rate: 0.0625 },   // 26. > 20.250.000 – 20.950.000 → 6,25%
    { upperLimit: 21700000, rate: 0.065 },    // 27. > 20.950.000 – 21.700.000 → 6,5%
    { upperLimit: 22450000, rate: 0.0675 },   // 28. > 21.700.000 – 22.450.000 → 6,75%
    { upperLimit: 23250000, rate: 0.07 },     // 29. > 22.450.000 – 23.250.000 → 7%
    { upperLimit: 24050000, rate: 0.0725 },   // 30. > 23.250.000 – 24.050.000 → 7,25%
    { upperLimit: 24900000, rate: 0.075 },    // 31. > 24.050.000 – 24.900.000 → 7,5%
    { upperLimit: 25750000, rate: 0.0775 },   // 32. > 24.900.000 – 25.750.000 → 7,75%
    { upperLimit: 26650000, rate: 0.08 },     // 33. > 25.750.000 – 26.650.000 → 8%
    { upperLimit: 27550000, rate: 0.0825 },   // 34. > 26.650.000 – 27.550.000 → 8,25%
    { upperLimit: 28500000, rate: 0.085 },    // 35. > 27.550.000 – 28.500.000 → 8,5%
    { upperLimit: 29450000, rate: 0.0875 },   // 36. > 28.500.000 – 29.450.000 → 8,75%
    { upperLimit: 30450000, rate: 0.09 },     // 37. > 29.450.000 – 30.450.000 → 9%
    { upperLimit: 31450000, rate: 0.0925 },   // 38. > 30.450.000 – 31.450.000 → 9,25%
    { upperLimit: 32500000, rate: 0.095 },    // 39. > 31.450.000 – 32.500.000 → 9,5%
    { upperLimit: 33550000, rate: 0.0975 },   // 40. > 32.500.000 – 33.550.000 → 9,75%
    { upperLimit: 34650000, rate: 0.10 },     // 41. > 33.550.000 – 34.650.000 → 10%
    { upperLimit: 35750000, rate: 0.1025 },   // 42. > 34.650.000 – 35.750.000 → 10,25%
    { upperLimit: 36900000, rate: 0.105 },    // 43. > 35.750.000 – 36.900.000 → 10,5%
    { upperLimit: 38050000, rate: 0.1075 },   // 44. > 36.900.000 – 38.050.000 → 10,75%
    { upperLimit: 39250000, rate: 0.11 },     // 45. > 38.050.000 – 39.250.000 → 11%
    { upperLimit: 40450000, rate: 0.1125 },   // 46. > 39.250.000 – 40.450.000 → 11,25%
    { upperLimit: 41700000, rate: 0.115 },    // 47. > 40.450.000 – 41.700.000 → 11,5%
    { upperLimit: 42950000, rate: 0.1175 },   // 48. > 41.700.000 – 42.950.000 → 11,75%
    { upperLimit: 44250000, rate: 0.12 },     // 49. > 42.950.000 – 44.250.000 → 12%
    { upperLimit: 45550000, rate: 0.1225 },   // 50. > 44.250.000 – 45.550.000 → 12,25%
    { upperLimit: 46900000, rate: 0.125 },    // 51. > 45.550.000 – 46.900.000 → 12,5%
    { upperLimit: 48250000, rate: 0.1275 },   // 52. > 46.900.000 – 48.250.000 → 12,75%
    { upperLimit: 49650000, rate: 0.13 },     // 53. > 48.250.000 – 49.650.000 → 13%
    { upperLimit: 51050000, rate: 0.1325 },   // 54. > 49.650.000 – 51.050.000 → 13,25%
    { upperLimit: 52500000, rate: 0.135 },    // 55. > 51.050.000 – 52.500.000 → 13,5%
    { upperLimit: 53950000, rate: 0.1375 },   // 56. > 52.500.000 – 53.950.000 → 13,75%
    { upperLimit: 55450000, rate: 0.14 },     // 57. > 53.950.000 – 55.450.000 → 14%
    { upperLimit: 56950000, rate: 0.1425 },   // 58. > 55.450.000 – 56.950.000 → 14,25%
    { upperLimit: 58500000, rate: 0.145 },    // 59. > 56.950.000 – 58.500.000 → 14,5%
    { upperLimit: 60050000, rate: 0.1475 },   // 60. > 58.500.000 – 60.050.000 → 14,75%
    { upperLimit: 61650000, rate: 0.15 },     // 61. > 60.050.000 – 61.650.000 → 15%
    { upperLimit: 63250000, rate: 0.1525 },   // 62. > 61.650.000 – 63.250.000 → 15,25%
    { upperLimit: 64900000, rate: 0.155 },    // 63. > 63.250.000 – 64.900.000 → 15,5%
    { upperLimit: 66550000, rate: 0.1575 },   // 64. > 64.900.000 – 66.550.000 → 15,75%
    { upperLimit: 68250000, rate: 0.16 },     // 65. > 66.550.000 – 68.250.000 → 16%
    { upperLimit: 69950000, rate: 0.1625 },   // 66. > 68.250.000 – 69.950.000 → 16,25%
    { upperLimit: 71700000, rate: 0.165 },    // 67. > 69.950.000 – 71.700.000 → 16,5%
    { upperLimit: 73450000, rate: 0.1675 },   // 68. > 71.700.000 – 73.450.000 → 16,75%
    { upperLimit: 75250000, rate: 0.17 },     // 69. > 73.450.000 – 75.250.000 → 17%
    { upperLimit: 77050000, rate: 0.1725 },   // 70. > 75.250.000 – 77.050.000 → 17,25%
    { upperLimit: 78900000, rate: 0.175 },    // 71. > 77.050.000 – 78.900.000 → 17,5%
    { upperLimit: 80750000, rate: 0.1775 },   // 72. > 78.900.000 – 80.750.000 → 17,75%
    { upperLimit: 82650000, rate: 0.18 },     // 73. > 80.750.000 – 82.650.000 → 18%
    { upperLimit: 84550000, rate: 0.1825 },   // 74. > 82.650.000 – 84.550.000 → 18,25%
    { upperLimit: 86500000, rate: 0.185 },    // 75. > 84.550.000 – 86.500.000 → 18,5%
    { upperLimit: 88450000, rate: 0.1875 },   // 76. > 86.500.000 – 88.450.000 → 18,75%
    { upperLimit: 90450000, rate: 0.19 },     // 77. > 88.450.000 – 90.450.000 → 19%
    { upperLimit: 92450000, rate: 0.1925 },   // 78. > 90.450.000 – 92.450.000 → 19,25%
    { upperLimit: 94500000, rate: 0.195 },    // 79. > 92.450.000 – 94.500.000 → 19,5%
    { upperLimit: 96550000, rate: 0.1975 },   // 80. > 94.500.000 – 96.550.000 → 19,75%
    { upperLimit: 98650000, rate: 0.20 },     // 81. > 96.550.000 – 98.650.000 → 20%
    { upperLimit: 100750000, rate: 0.2025 },  // 82. > 98.650.000 – 100.750.000 → 20,25%
    { upperLimit: 102900000, rate: 0.205 },   // 83. > 100.750.000 – 102.900.000 → 20,5%
    { upperLimit: 105050000, rate: 0.2075 },  // 84. > 102.900.000 – 105.050.000 → 20,75%
    { upperLimit: 107250000, rate: 0.21 },    // 85. > 105.050.000 – 107.250.000 → 21%
    { upperLimit: 109500000, rate: 0.2125 },  // 86. > 107.250.000 – 109.500.000 → 21,25%
    { upperLimit: 111800000, rate: 0.215 },   // 87. > 109.500.000 – 111.800.000 → 21,5%
    { upperLimit: 114150000, rate: 0.2175 },  // 88. > 111.800.000 – 114.150.000 → 21,75%
    { upperLimit: 116550000, rate: 0.22 },    // 89. > 114.150.000 – 116.550.000 → 22%
    { upperLimit: 119000000, rate: 0.2225 },  // 90. > 116.550.000 – 119.000.000 → 22,25%
    { upperLimit: 121500000, rate: 0.225 },   // 91. > 119.000.000 – 121.500.000 → 22,5%
    { upperLimit: 124050000, rate: 0.2275 },  // 92. > 121.500.000 – 124.050.000 → 22,75%
    { upperLimit: 126650000, rate: 0.23 },    // 93. > 124.050.000 – 126.650.000 → 23%
    { upperLimit: 129300000, rate: 0.2325 },  // 94. > 126.650.000 – 129.300.000 → 23,25%
    { upperLimit: 132000000, rate: 0.235 },   // 95. > 129.300.000 – 132.000.000 → 23,5%
    { upperLimit: 134750000, rate: 0.2375 },  // 96. > 132.000.000 – 134.750.000 → 23,75%
    { upperLimit: 137550000, rate: 0.24 },    // 97. > 134.750.000 – 137.550.000 → 24%
    { upperLimit: 140400000, rate: 0.2425 },  // 98. > 137.550.000 – 140.400.000 → 24,25%
    { upperLimit: 143300000, rate: 0.245 },   // 99. > 140.400.000 – 143.300.000 → 24,5%
    { upperLimit: 146250000, rate: 0.2475 },  // 100. > 143.300.000 – 146.250.000 → 24,75%
    { upperLimit: 149250000, rate: 0.25 },    // 101. > 146.250.000 – 149.250.000 → 25%
    { upperLimit: 152300000, rate: 0.2525 },  // 102. > 149.250.000 – 152.300.000 → 25,25%
    { upperLimit: 155400000, rate: 0.255 },   // 103. > 152.300.000 – 155.400.000 → 25,5%
    { upperLimit: 158550000, rate: 0.2575 },  // 104. > 155.400.000 – 158.550.000 → 25,75%
    { upperLimit: 161750000, rate: 0.26 },    // 105. > 158.550.000 – 161.750.000 → 26%
    { upperLimit: 165000000, rate: 0.2625 },  // 106. > 161.750.000 – 165.000.000 → 26,25%
    { upperLimit: 168300000, rate: 0.265 },   // 107. > 165.000.000 – 168.300.000 → 26,5%
    { upperLimit: 171650000, rate: 0.2675 },  // 108. > 168.300.000 – 171.650.000 → 26,75%
    { upperLimit: 175050000, rate: 0.27 },    // 109. > 171.650.000 – 175.050.000 → 27%
    { upperLimit: 178500000, rate: 0.2725 },  // 110. > 175.050.000 – 178.500.000 → 27,25%
    { upperLimit: 182000000, rate: 0.275 },   // 111. > 178.500.000 – 182.000.000 → 27,5%
    { upperLimit: 185550000, rate: 0.2775 },  // 112. > 182.000.000 – 185.550.000 → 27,75%
    { upperLimit: 189150000, rate: 0.28 },    // 113. > 185.550.000 – 189.150.000 → 28%
    { upperLimit: 192800000, rate: 0.2825 },  // 114. > 189.150.000 – 192.800.000 → 28,25%
    { upperLimit: 196500000, rate: 0.285 },   // 115. > 192.800.000 – 196.500.000 → 28,5%
    { upperLimit: 200250000, rate: 0.2875 },  // 116. > 196.500.000 – 200.250.000 → 28,75%
    { upperLimit: 204050000, rate: 0.29 },    // 117. > 200.250.000 – 204.050.000 → 29%
    { upperLimit: 207900000, rate: 0.2925 },  // 118. > 204.050.000 – 207.900.000 → 29,25%
    { upperLimit: 211800000, rate: 0.295 },   // 119. > 207.900.000 – 211.800.000 → 29,5%
    { upperLimit: 215750000, rate: 0.2975 },  // 120. > 211.800.000 – 215.750.000 → 29,75%
    { upperLimit: 219750000, rate: 0.30 },    // 121. > 215.750.000 – 219.750.000 → 30%
    { upperLimit: 223800000, rate: 0.3025 },  // 122. > 219.750.000 – 223.800.000 → 30,25%
    { upperLimit: 227900000, rate: 0.305 },   // 123. > 223.800.000 – 227.900.000 → 30,5%
    { upperLimit: 232050000, rate: 0.3075 },  // 124. > 227.900.000 – 232.050.000 → 30,75%
    { upperLimit: 236250000, rate: 0.31 },    // 125. > 232.050.000 – 236.250.000 → 31%
    { upperLimit: 240500000, rate: 0.3125 },  // 126. > 236.250.000 – 240.500.000 → 31,25%
    { upperLimit: 244800000, rate: 0.315 },   // 127. > 240.500.000 – 244.800.000 → 31,5%
    { upperLimit: 249150000, rate: 0.3175 },  // 128. > 244.800.000 – 249.150.000 → 31,75%
    { upperLimit: 253550000, rate: 0.32 },    // 129. > 249.150.000 – 253.550.000 → 32%
    { upperLimit: 258000000, rate: 0.3225 },  // 130. > 253.550.000 – 258.000.000 → 32,25%
    { upperLimit: 262500000, rate: 0.325 },   // 131. > 258.000.000 – 262.500.000 → 32,5%
    { upperLimit: 267050000, rate: 0.3275 },  // 132. > 262.500.000 – 267.050.000 → 32,75%
    { upperLimit: 271650000, rate: 0.33 },    // 133. > 267.050.000 – 271.650.000 → 33%
    { upperLimit: 276300000, rate: 0.3325 },  // 134. > 271.650.000 – 276.300.000 → 33,25%
    { upperLimit: 281000000, rate: 0.335 },   // 135. > 276.300.000 – 281.000.000 → 33,5%
    { upperLimit: 285750000, rate: 0.3375 },  // 136. > 281.000.000 – 285.750.000 → 33,75%
    { upperLimit: 290550000, rate: 0.34 },    // 137. > 285.750.000 – 290.550.000 → 34%
    { upperLimit: 295400000, rate: 0.3425 },  // 138. > 290.550.000 – 295.400.000 → 34,25%
    { upperLimit: 300300000, rate: 0.345 },   // 139. > 295.400.000 – 300.300.000 → 34,5%
    { upperLimit: 305250000, rate: 0.3475 },  // 140. > 300.300.000 – 305.250.000 → 34,75%
    { upperLimit: 310250000, rate: 0.35 },    // 141. > 305.250.000 – 310.250.000 → 35%
    { upperLimit: 619000000, rate: 0.35 },    // > 310.250.000 → 35%
    { upperLimit: Infinity, rate: 0.35 }      // Fallback
];


