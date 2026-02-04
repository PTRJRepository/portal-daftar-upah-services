export interface ColumnAggregationConfig {
    column_id: string;
    column_name: string;
    aggregation_type: 'sum' | 'avg' | 'count' | 'min' | 'max';
    data_type: 'numeric' | 'string';
    is_monetary: boolean;
    is_hidden_when_empty: boolean;
}

export interface PayrollSummary {
    total_employees: number;
    total_hk: number;
    total_upah_dasar: number;
    total_upah_pokok: number;
    total_gaji_pokok: number;
    total_tunjangan: number;
    total_potongan: number;
    total_upah_bersih: number;
    average_upah_bersih: number;
    min_upah_bersih: number;
    max_upah_bersih: number;
}

export interface PayrollStatistics {
    total_hadir: number;
    total_cuti_tahunan: number;
    total_cuti_sakit: number;
    total_cuti_minggu: number;
    total_cuti_nasional: number;
    total_tidak_hadir: number;

    total_beras: number;
    total_jabatan: number;
    total_masa_kerja: number;
    total_lembur: number;

    total_pph21: number;
    total_koreksi: number;
    total_bpjs_pekerja: number;
    total_bpjs_majikan: number;
    total_bpjs_pensiun_pekerja: number;
    total_bpjs_pensiun_majikan: number;
    total_spsi: number;

    total_brondol: number;
    total_pruning: number;
    total_premi_dinamis_1: number;
    total_premi_dinamis_2: number;
    total_premi_dinamis_3: number;
    total_premi_dinamis_4: number;
    total_premi_dinamis_5: number;
    total_premi_dinamis_6: number;
    total_premi_dinamis_7: number;
}

export interface BusinessRulesResponse {
    gang_code: string;
    month: number;
    year: number;
    rules_applied: any[];
    processed_data: any[];
}

export interface AggregatedPayrollResponse {
    gang_code: string;
    month: number;
    year: number;
    period: string;
    generated_at: Date;
    total_records: number;
    processing_time_ms: number;
    use_threading: boolean;
    data_rows: any[];
    summary: PayrollSummary;
    statistics: PayrollStatistics;
    columns_info: ColumnAggregationConfig[];
    empty_columns: string[];
    business_rules: BusinessRulesResponse;
}

export class AggregationService {
    private static instance: AggregationService;

    private constructor() { }

    public static getInstance(): AggregationService {
        if (!AggregationService.instance) {
            AggregationService.instance = new AggregationService();
        }
        return AggregationService.instance;
    }

    public createColumnAggregationConfigs(): ColumnAggregationConfig[] {
        // Defined based on Python service
        const aggregationRules: Record<string, { type: 'sum' | 'avg' | 'count' | 'min' | 'max'; monetary: boolean }> = {
            'hari_kerja': { type: 'sum', monetary: false },
            'cuti_tahunan_hari': { type: 'sum', monetary: false },
            'cuti_sakit_haid_hari': { type: 'sum', monetary: false },
            'cuti_minggu_hari': { type: 'sum', monetary: false },
            'cuti_nasional_hari': { type: 'sum', monetary: false },
            'jumlah_hk': { type: 'sum', monetary: false },
            'tidak_hadir_cth': { type: 'sum', monetary: false },
            'tidak_hadir_alpa': { type: 'sum', monetary: false },
            'total_ketidakhadiran': { type: 'sum', monetary: false },

            'upah_dasar': { type: 'sum', monetary: true },
            'upah_pokok': { type: 'sum', monetary: true },
            'gaji_pokok': { type: 'sum', monetary: true },
            'beras_jumlah': { type: 'sum', monetary: true },
            'jabatan_jumlah': { type: 'sum', monetary: true },
            'masa_kerja_jumlah': { type: 'sum', monetary: true },
            'masa_kerja_amount': { type: 'sum', monetary: true },
            'lembur_jumlah': { type: 'sum', monetary: true },
            'total_tunjangan': { type: 'sum', monetary: true },

            'premi_brondol': { type: 'sum', monetary: true },
            'premi_pruning': { type: 'sum', monetary: true },
            'premi_dynamic_1': { type: 'sum', monetary: true },
            'premi_dynamic_2': { type: 'sum', monetary: true },
            'premi_dynamic_3': { type: 'sum', monetary: true },
            'premi_dynamic_4': { type: 'sum', monetary: true },
            'premi_dynamic_5': { type: 'sum', monetary: true },
            'premi_dynamic_6': { type: 'sum', monetary: true },
            'premi_dynamic_7': { type: 'sum', monetary: true },

            'pph21': { type: 'sum', monetary: true },
            'koreksi': { type: 'sum', monetary: true },
            'bpjs_pek': { type: 'sum', monetary: true },
            'bpjs_maj': { type: 'sum', monetary: true },
            'bpjs_jumlah': { type: 'sum', monetary: true },
            'bpjs_kesehatan_pekerja': { type: 'sum', monetary: true },
            'bpjs_kesehatan_majikan': { type: 'sum', monetary: true },
            'bpjs_pensiun_pekerja': { type: 'sum', monetary: true },
            'bpjs_pensiun_majikan': { type: 'sum', monetary: true },
            'spsi': { type: 'sum', monetary: true },
            'total1': { type: 'sum', monetary: true },
            'total2': { type: 'sum', monetary: true },
            'total3': { type: 'sum', monetary: true },
            'total4': { type: 'sum', monetary: true },

            'upah_bersih': { type: 'sum', monetary: true },
        };

        return Object.entries(aggregationRules).map(([id, rules]) => ({
            column_id: id,
            column_name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            aggregation_type: rules.type,
            data_type: 'numeric',
            is_monetary: rules.monetary,
            is_hidden_when_empty: true
        }));
    }

    private getNumericValue(row: any, field: string): number {
        const val = row[field];
        if (val === null || val === undefined || val === '') return 0.0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const parsed = parseFloat(val.replace(/,/g, '').replace(/Rp/g, '').trim());
            return isNaN(parsed) ? 0.0 : parsed;
        }
        return 0.0;
    }

    private aggregateColumn(dataRows: any[], columnId: string, type: string): number {
        if (!dataRows.length) return 0.0;

        const values = dataRows
            .map(row => this.getNumericValue(row, columnId))
            .filter(val => val !== 0); // Optimization: usually 0s don't affect sum, but affect avg/min/max logic depending on implementation. Python version filters nulls/empty strings before appending.

        if (!values.length) return 0.0;

        if (type === 'sum') return values.reduce((a, b) => a + b, 0);
        if (type === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
        if (type === 'count') return values.length;
        if (type === 'min') return Math.min(...values);
        if (type === 'max') return Math.max(...values);
        return 0.0;
    }

    private calculateTotalPotongan(dataRows: any[]): number {
        return dataRows.reduce((sum, row) => sum + this.calculateRowTotalPotonganBersih(row), 0);
    }

    private calculateRowTotalPotonganBersih(row: any): number {
        let total = 0.0;
        for (const key of Object.keys(row)) {
            const k = key.toLowerCase();
            if (k.includes('majikan') || k.includes('total') || k.includes('jumlah')) continue;
            if (k.endsWith('_maj') || k.includes('_maj_')) continue;
            if (k.includes('upah_kotor')) continue;
            if (k === 'pot_bpjs_kes') continue;

            if (k.startsWith('pot_') || k.startsWith('bpjs_') || ['pph21', 'spsi', 'koreksi'].includes(k)) {
                total += this.getNumericValue(row, key);
            }
        }
        return total;
    }

    private calculateRowTotalTunjangan(row: any): number {
        return ['beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah', 'lembur_jumlah']
            .reduce((sum, col) => sum + this.getNumericValue(row, col), 0);
    }

    private calculateRowTotalPremi(row: any): number {
        const premiCols = ['premi_brondol', 'premi_pruning', 'premi_dynamic_1', 'premi_dynamic_2', 'premi_dynamic_3', 'premi_dynamic_4', 'premi_dynamic_5', 'premi_dynamic_6', 'premi_dynamic_7'];
        return premiCols.reduce((sum, col) => sum + this.getNumericValue(row, col), 0);
    }

    public applyBusinessRules(dataRows: any[], gangCode: string, month: number, year: number): BusinessRulesResponse {
        const rulesApplied: any[] = [];
        const originalCount = dataRows.length;

        // Rule 1: Filter zero HK
        const filteredRows = dataRows.filter(row => this.getNumericValue(row, 'jumlah_hk') > 0);

        if (filteredRows.length < originalCount) {
            rulesApplied.push({
                rule: 'filter_zero_hk',
                description: 'Filtered out employees with 0 working days',
                original_count: originalCount,
                filtered_count: filteredRows.length,
                removed_count: originalCount - filteredRows.length
            });
        }

        // Rule 2: Calculate upah_bersih if missing
        // Formula matches dataExtractorService.ts:400
        // upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph
        let calculatedCount = 0;
        for (const row of filteredRows) {
            const upahBersih = this.getNumericValue(row, 'upah_bersih');
            if (upahBersih === 0) {
                const jumlahUpahKotor = this.getNumericValue(row, 'jumlah_upah_kotor');
                const totalPotonganBersih = this.calculateRowTotalPotonganBersih(row);
                const potPremiPph = this.getNumericValue(row, 'premi_pph');

                let calculatedUpahBersih = 0;
                if (jumlahUpahKotor > 0) {
                    // Use the standard formula: upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph
                    calculatedUpahBersih = jumlahUpahKotor - totalPotonganBersih + potPremiPph;
                } else {
                    // Fallback: calculate from scratch if jumlah_upah_kotor is not available
                    const gajiPokok = this.getNumericValue(row, 'gaji_pokok');
                    const totalTunjangan = this.calculateRowTotalTunjangan(row);
                    const totalPremi = this.calculateRowTotalPremi(row);
                    const potKoreksi = this.getNumericValue(row, 'koreksi');
                    // jumlah_upah_kotor = (gaji_pokok + total_tunjangan + total_premi) - pot_koreksi
                    const calculatedJumlahUpahKotor = (gajiPokok + totalTunjangan + totalPremi) - potKoreksi;
                    calculatedUpahBersih = calculatedJumlahUpahKotor - totalPotonganBersih + potPremiPph;
                }

                row['upah_bersih'] = calculatedUpahBersih;
                calculatedCount++;
            }
        }

        if (calculatedCount > 0) {
            rulesApplied.push({
                rule: 'calculate_upah_bersih',
                description: 'Calculated upah_bersih for missing values',
                count: calculatedCount
            });
        }

        return {
            gang_code: gangCode,
            month,
            year,
            rules_applied: rulesApplied,
            processed_data: filteredRows
        };
    }

    private calculatePayrollSummary(dataRows: any[]): PayrollSummary {
        const upahBersihValues = dataRows.map(r => this.getNumericValue(r, 'upah_bersih'));
        
        return {
            total_employees: dataRows.length,
            total_hk: this.aggregateColumn(dataRows, 'jumlah_hk', 'sum'),
            total_upah_dasar: this.aggregateColumn(dataRows, 'upah_dasar', 'sum'),
            total_upah_pokok: this.aggregateColumn(dataRows, 'upah_pokok', 'sum'),
            total_gaji_pokok: this.aggregateColumn(dataRows, 'gaji_pokok', 'sum'),
            total_tunjangan: this.aggregateColumn(dataRows, 'total_tunjangan', 'sum'),
            total_potongan: this.calculateTotalPotongan(dataRows),
            total_upah_bersih: this.aggregateColumn(dataRows, 'upah_bersih', 'sum'),
            average_upah_bersih: upahBersihValues.length ? upahBersihValues.reduce((a, b) => a + b, 0) / upahBersihValues.length : 0,
            min_upah_bersih: upahBersihValues.length ? Math.min(...upahBersihValues) : 0,
            max_upah_bersih: upahBersihValues.length ? Math.max(...upahBersihValues) : 0
        };
    }

    private calculatePayrollStatistics(dataRows: any[]): PayrollStatistics {
        return {
            total_hadir: this.aggregateColumn(dataRows, 'hari_kerja', 'sum'),
            total_cuti_tahunan: this.aggregateColumn(dataRows, 'cuti_tahunan_hari', 'sum'),
            total_cuti_sakit: this.aggregateColumn(dataRows, 'cuti_sakit_haid_hari', 'sum'),
            total_cuti_minggu: this.aggregateColumn(dataRows, 'cuti_minggu_hari', 'sum'),
            total_cuti_nasional: this.aggregateColumn(dataRows, 'cuti_nasional_hari', 'sum'),
            total_tidak_hadir: this.aggregateColumn(dataRows, 'total_ketidakhadiran', 'sum'),

            total_beras: this.aggregateColumn(dataRows, 'beras_jumlah', 'sum'),
            total_jabatan: this.aggregateColumn(dataRows, 'jabatan_jumlah', 'sum'),
            total_masa_kerja: this.aggregateColumn(dataRows, 'masa_kerja_amount', 'sum'),
            total_lembur: this.aggregateColumn(dataRows, 'lembur_jumlah', 'sum'),

            total_pph21: this.aggregateColumn(dataRows, 'pph21', 'sum'),
            total_koreksi: this.aggregateColumn(dataRows, 'koreksi', 'sum'),
            total_bpjs_pekerja: this.aggregateColumn(dataRows, 'bpjs_pek', 'sum'),
            total_bpjs_majikan: this.aggregateColumn(dataRows, 'bpjs_maj', 'sum'),
            total_bpjs_pensiun_pekerja: this.aggregateColumn(dataRows, 'bpjs_pensiun_pekerja', 'sum'),
            total_bpjs_pensiun_majikan: this.aggregateColumn(dataRows, 'bpjs_pensiun_majikan', 'sum'),
            total_spsi: this.aggregateColumn(dataRows, 'spsi', 'sum'),

            total_brondol: this.aggregateColumn(dataRows, 'premi_brondol', 'sum'),
            total_pruning: this.aggregateColumn(dataRows, 'premi_pruning', 'sum'),
            total_premi_dinamis_1: this.aggregateColumn(dataRows, 'premi_dynamic_1', 'sum'),
            total_premi_dinamis_2: this.aggregateColumn(dataRows, 'premi_dynamic_2', 'sum'),
            total_premi_dinamis_3: this.aggregateColumn(dataRows, 'premi_dynamic_3', 'sum'),
            total_premi_dinamis_4: this.aggregateColumn(dataRows, 'premi_dynamic_4', 'sum'),
            total_premi_dinamis_5: this.aggregateColumn(dataRows, 'premi_dynamic_5', 'sum'),
            total_premi_dinamis_6: this.aggregateColumn(dataRows, 'premi_dynamic_6', 'sum'),
            total_premi_dinamis_7: this.aggregateColumn(dataRows, 'premi_dynamic_7', 'sum'),
        };
    }

    private identifyEmptyColumns(dataRows: any[]): string[] {
        if (!dataRows.length) return [];
        const sample = dataRows[0];
        const emptyCols: string[] = [];
        
        for (const key of Object.keys(sample)) {
            let isEmpty = true;
            for (const row of dataRows) {
                if (this.getNumericValue(row, key) !== 0) {
                    isEmpty = false;
                    break;
                }
            }
            if (isEmpty) emptyCols.push(key);
        }
        return emptyCols;
    }

    public createAggregatedResponse(
        dataRows: any[],
        gangCode: string,
        month: number,
        year: number,
        processingTimeMs: number = 0,
        useThreading: boolean = false
    ): AggregatedPayrollResponse {
        const businessRulesResult = this.applyBusinessRules(dataRows, gangCode, month, year);
        const processedData = businessRulesResult.processed_data;
        
        const summary = this.calculatePayrollSummary(processedData);
        const statistics = this.calculatePayrollStatistics(processedData);
        const emptyColumns = this.identifyEmptyColumns(processedData);
        const columnsInfo = this.createColumnAggregationConfigs();

        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        return {
            gang_code: gangCode,
            month,
            year,
            period: `${monthNames[month - 1]} ${year}`,
            generated_at: new Date(),
            total_records: processedData.length,
            processing_time_ms: processingTimeMs,
            use_threading: useThreading,
            data_rows: processedData,
            summary,
            statistics,
            columns_info: columnsInfo,
            empty_columns: emptyColumns,
            business_rules: businessRulesResult
        };
    }
}

export const aggregationService = AggregationService.getInstance();
