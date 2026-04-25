/**
 * Tax Report Routes
 * 
 * API endpoints for tax report data:
 * - GET /tax-report/monthly — Monthly PPH21 tax report
 * - GET /tax-report/annual — Annual tax report with PTKP & PKP calculations
 * - GET /tax-report/astek-bpjs — Annual ASTEK & BPJS report
 */

import { Elysia, t } from "elysia";
import { AuthService } from "../services/authService";
import { User } from "../types/user";
import { taxReportService, TAX_COMPONENT_METADATA } from "../services/taxReportService";
import { generateMonthlyTaxExcel, generateDecemberTaxExcel } from "../services/taxReportExcelService";
import { ptkpTaxService } from "../services/ptkpTaxService";
import { EmployeeEstateService } from "../services/employeeEstateService";
import { Database } from "../db/client";
import { gangService } from "../services/gangService";
import { resolveMonthlyTaxQuery } from "../utils/taxReportQuery";
import { getApiKeyHeader, getAuthorizationHeader, resolveUserFromHeaders } from "../utils/authBypass";

/**
 * Sanitize string for filename - remove/replace invalid filename characters
 */
function sanitizeForFilename(str: string): string {
    if (!str) return '';
    return str
        .replace(/[\\/:*?"<>|]/g, '_')  // Replace invalid filename chars
        .replace(/\s+/g, '_')            // Replace spaces with underscore
        .substring(0, 50);               // Limit length
}

const authService = AuthService.getInstance();

async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    return resolveUserFromHeaders(headers, authService);
}

export const taxReportRoutes = new Elysia({ prefix: "/tax-report" })
    .derive(async ({ headers }) => {
        const authHeader = getAuthorizationHeader(headers);
        const apiKeyHeader = getApiKeyHeader(headers);
        console.log(`[TaxReport] Auth header: ${authHeader ? 'present' : apiKeyHeader ? 'api-key' : 'missing'}`);
        const user = await getUserFromHeader(headers);
        return { currentUser: user };
    })
    .onBeforeHandle(({ currentUser, set }) => {
        console.log(`[TaxReport] currentUser: ${currentUser ? 'authenticated' : 'not authenticated'}`);
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })

    // ========================================================
    // GET /tax-report/monthly
    // Monthly PPH21 tax report for a specific period
    // Uses the same source-selection contract as Daftar Upah via use_history
    // ========================================================
    .get("/monthly", async ({ query, set, currentUser }) => {
        try {
            const resolved = resolveMonthlyTaxQuery(query as any, currentUser);

            if (!resolved.hasValidPeriod) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            const result = await taxReportService.getMonthlyTaxReport(
                resolved.year,
                resolved.month,
                resolved.division,
                resolved.gang,
                resolved.gangPrefix,
                resolved.useHistoryDb,
                resolved.snapshotVersion
            );
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching monthly tax report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch monthly tax report" };
        }
    }, {
        query: t.Object({
            year: t.String(),
            month: t.String(),
            division: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel
    // Download Monthly PPH21 tax report as Excel with formulas
    // Uses the same source-selection contract as Daftar Upah via use_history
    // ========================================================
    .get("/monthly/excel", async ({ query, set, currentUser }) => {
        try {
            const resolved = resolveMonthlyTaxQuery(query as any, currentUser);

            console.log(`[TaxReport Excel] Request: year=${resolved.year}, month=${resolved.month}, division=${resolved.division}, gang=${resolved.gang}`);

            if (!resolved.hasValidPeriod) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            const data = await taxReportService.getMonthlyTaxReport(
                resolved.year,
                resolved.month,
                resolved.division,
                resolved.gang,
                resolved.gangPrefix,
                resolved.useHistoryDb,
                resolved.snapshotVersion
            );

            console.log(`[TaxReport Excel] Data fetched: ${data?.employees?.length || 0} employees`);

            if (!data || data.employees.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            const gangLabel = resolved.gang || resolved.gangPrefix || 'ALL';

            // Get gang description for filename
            let gangDescForFilename = '';
            if (gangLabel && gangLabel !== 'ALL') {
                try {
                    const gangInfo = await gangService.getGangInfo(gangLabel);
                    if (gangInfo?.description) {
                        gangDescForFilename = '_' + sanitizeForFilename(gangInfo.description);
                    }
                } catch (e) {
                    console.warn(`[TaxReport] Could not get gang description for ${gangLabel}:`, e);
                }
            }

            // Generate Excel Buffer (pass premiKeys for dynamic column headers)
            const excelBuffer = await generateMonthlyTaxExcel(data, resolved.year, resolved.month, resolved.division || 'ALL', gangLabel, data.premiKeys);

            console.log(`[TaxReport Excel] Excel generated: ${excelBuffer?.length || 0} bytes, type: ${typeof excelBuffer}`);

            if (!excelBuffer || excelBuffer.length === 0) {
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            const isGroupOnly = resolved.gangPrefix && (!resolved.gang || resolved.gang === 'ALL');
            const displayGangLabel = isGroupOnly ? `G${resolved.gangPrefix}` : gangLabel;
            const filename = `PPH21_${resolved.division || 'ALL'}_${displayGangLabel}${gangDescForFilename}_${resolved.month}_${resolved.year}.xlsx`;
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;

            return excelBuffer;
        } catch (error: any) {
            console.error("[TaxReport] Error generating Excel report:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report" };
        }
    }, {
        query: t.Object({
            year: t.String(),
            month: t.String(),
            division: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel/progressive
    // Download Monthly PPH21 using progressive extraction (avoids timeout)
    // Uses dataExtractorService.extractPayrollDataProgressive() with the same source policy as Daftar Upah
    // ========================================================
    .get("/monthly/excel/progressive", async ({ query, set, currentUser }) => {
        try {
            const resolved = resolveMonthlyTaxQuery(query as any, currentUser);
            let division = resolved.division;
            const gang = resolved.gang;
            const gangPrefix = resolved.gangPrefix;

            console.log(`[TaxReport Excel Progressive] Request: year=${resolved.year}, month=${resolved.month}, division=${division}, gang=${gang}, gangPrefix=${gangPrefix}, useHistory=${resolved.useHistoryDb}, snapshotVersion=${resolved.snapshotVersion ?? 'latest'}`);

            if (!resolved.hasValidPeriod) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            // Import services here to avoid circular deps
            const { DataExtractorService } = await import("../services/dataExtractorService");
            const { Config } = await import("../config");
            const { mapPTKPToTER } = await import("../services/ptkpTaxService");
            const { getCarumanForPph21 } = await import("../services/carumanDefinitions");
            const { EmployeeEstateService } = await import("../services/employeeEstateService");
            const { OtherIncomesService } = await import("../services/otherIncomesService");
            const { ptkpTaxService } = await import("../services/ptkpTaxService");
            const { divisionDefinition } = await import("../services/divisionDefinition");

            const dataExtractor = DataExtractorService.getInstance();

            // Resolve virtual division
            let effectiveDivision = division;
            let effectiveGangPrefix = gangPrefix;
            if (division && divisionDefinition.isVirtualDivision(division)) {
                const sourceDivisions = await divisionDefinition.getSourceDivisionsForAggregation(division);
                effectiveDivision = sourceDivisions[0];
                if (!effectiveGangPrefix) {
                    const vConfig = divisionDefinition.getVirtualDivisionConfig(division);
                    if (vConfig?.pattern) {
                        const patternStr = vConfig.pattern.toString();
                        const alphaMatch = patternStr.match(/[\/\^]?([A-Za-z]+)/);
                        if (alphaMatch && alphaMatch[1]) {
                            effectiveGangPrefix = alphaMatch[1];
                        }
                    }
                }
                console.log(`[TaxReport Excel Progressive] Virtual division ${division} resolved to ${effectiveDivision}`);
            }

            // Get PTKP data
            const ptkpMaster = await ptkpTaxService.getPtkpByYear(resolved.year);
            const ptkpMap = new Map<string, string>();
            for (const p of ptkpMaster) {
                ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
            }

            // Get jabatan map
            const jabatanMap: Record<string, string> = {};
            try {
                const jobTitlesResult = await EmployeeEstateService.getEmployeeJobsWithNik();
                if (jobTitlesResult && jobTitlesResult.empcodeMap) {
                    for (const [empCode, jabatan] of Object.entries(jobTitlesResult.empcodeMap)) {
                        jabatanMap[empCode] = jabatan || '';
                    }
                }
            } catch (e) {
                console.warn('[TaxReport Excel Progressive] Failed to get jabatan map:', e);
            }

            // Get other incomes for the year
            const dbOtherIncomesYear = await OtherIncomesService.getIncomesForYear(resolved.year, effectiveDivision, gang);
            const dbIncomeByMonthNik = new Map<string, { thr: number; exgratia: number; custom: number }>();
            for (const inc of dbOtherIncomesYear) {
                if (inc.is_taxable) {
                    const nik = String(inc.nik || '').trim().toUpperCase();
                    const type = String(inc.income_type || '').toUpperCase();
                    const monthKey = `${inc.period_month}_${nik}`;
                    const amt = Number(inc.amount) || 0;
                    if (!dbIncomeByMonthNik.has(monthKey)) dbIncomeByMonthNik.set(monthKey, { thr: 0, exgratia: 0, custom: 0 });
                    const mData = dbIncomeByMonthNik.get(monthKey)!;
                    if (type === 'THR') mData.thr += amt;
                    else if (type === 'KONTAN' || type === 'KONTANAN') mData.exgratia += amt;
                    else if (type === 'BONUS' || type === 'EXGRATIA') mData.exgratia += amt;
                    else mData.custom += amt;
                }
            }

            // Helper: derive jabatan from gang code
            const deriveJabatanFromGang = (gangCode: string): string => {
                if (!gangCode || gangCode.trim().length === 0) return 'Karyawan';
                const lastChar = gangCode.trim().slice(-1).toUpperCase();
                switch (lastChar) {
                    case 'H': return 'Karyawan Panen';
                    case 'P': return 'Karyawan Percobaan';
                    case 'T': return 'Operator';
                    case 'N': return 'Karyawan Nursery';
                    case 'G': return 'Kerani Gudang';
                    case 'M': return 'Karyawan Perawatan';
                    default: return 'Karyawan';
                }
            };

            // Helper: extract parent name from parentheses
            const extractParentName = (rawName: string): { empName: string; parentName: string } => {
                const match = rawName.match(/^(.+?)\s*\((.+?)\)\s*$/);
                if (match) return { empName: match[1].trim(), parentName: match[2].trim() };
                return { empName: rawName, parentName: '' };
            };

            // Helper: normalize premi key
            const normalizePremiKey = (key: string): string => {
                return String(key).toUpperCase().replace(/_/g, ' ').trim();
            };

            // Determine the gang code to use
            // If user selected a specific gang (e.g., "F1BHL"), use that gang
            // Otherwise use "ALL" with gangPrefix to get all gangs in the division
            const targetGangCode = gang && gang.trim() !== '' && gang !== 'ALL' ? gang.trim().toUpperCase() : "ALL";

            console.log(`[TaxReport Excel Progressive] Target gang: ${targetGangCode} (user selected: ${gang})`);

            // Collect all employees from progressive stream
            const allEmployees: any[] = [];
            const processedEmpCodes = new Set<string>();

            // Use progressive extraction - filter by specific gang if selected
            const progressiveStream = dataExtractor.extractPayrollDataProgressive(
                resolved.month, resolved.year, targetGangCode, effectiveDivision,
                Config.DB_PROFILE, targetGangCode === "ALL" ? effectiveGangPrefix : undefined, resolved.useHistoryDb, resolved.snapshotVersion
            );

            for await (const chunk of progressiveStream) {
                // Accumulate all employees from all phases
                for (const [gangCode, gangEmployees] of chunk.gangs) {
                    // If user selected a specific gang, only process that gang
                    if (targetGangCode !== "ALL" && gangCode.toUpperCase() !== targetGangCode) {
                        continue;
                    }
                    for (const emp of gangEmployees) {
                        const dedupKey = (emp.emp_code || emp.nik || emp.actual_nik || '').trim().toUpperCase();
                        if (dedupKey && !processedEmpCodes.has(dedupKey)) {
                            processedEmpCodes.add(dedupKey);
                            allEmployees.push(emp);
                        }
                    }
                }
                console.log(`[TaxReport Excel Progressive] Stream phase ${chunk.phase}: accumulated ${allEmployees.length} employees`);
            }

            console.log(`[TaxReport Excel Progressive] Total accumulated: ${allEmployees.length} employees`);

            if (allEmployees.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            // Filter active employees (jumlah_hk > 0 OR Income > 0)
            // This matches the filtering logic in the Wages Report UI (PayrollAggregator).
            const activeEmployees = allEmployees.filter((r: any) => {
                const hk = Number(r.jumlah_hk || r.hk || 0);
                const hasIncome = Number(r.jumlah_upah_kotor || 0) > 0;
                return hk > 0 || hasIncome;
            });

            console.log(`[TaxReport Excel Progressive] Active employees (HK > 0 OR Income > 0): ${activeEmployees.length}`);

            // Transform to MonthlyTaxRow format
            const employees: any[] = [];
            let totalPph21 = 0;
            const brondolSubKeys = ['BRONDOL LOOSEFRUIT', 'BRONDOL TOTAL', 'BRONDOL ADTRANS',
                'BRONDOL_LOOSEFRUIT', 'BRONDOL_TOTAL', 'BRONDOL_ADTRANS',
                'brondol_loosefruit', 'brondol_total', 'brondol_adtrans',
                'brondol loosefruit', 'brondol total', 'brondol adtrans'];
            const skipKeys = ['koreksi', 'KOREKSI', 'total', 'TOTAL'];

            for (let idx = 0; idx < activeEmployees.length; idx++) {
                const row = activeEmployees[idx];
                const empCodeTrimmed = (row.emp_code || '').trim();
                const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
                const kategoriTer = mapPTKPToTER(masterPtkp);

                const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
                const upahDasar = row.upah_dasar || 0;
                const tunjanganBeras = row.beras_jumlah || 0;
                const tunjanganJabatan = row.jabatan_jumlah || 0;
                const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
                const tunjanganLembur = row.lembur_jumlah || 0;
                const totalPremi = row.total_premi || 0;

                const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
                const astek084 = pph21Caruman.astek_majikan_084;
                const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;
                const carumanBase = pph21Caruman.base;

                const penghasilanBruto = Number(row.penghasilan_bruto) || 0;
                // [FIXED 2026-04-08] Prioritize pph21_ter to match UI "Pajak" column exactly
                const pph21 = Number(row.pph21_ter) || Number(row.pot_pph21) || 0;
                const tarifPajakTer = Number(row.tarif_pajak_ter) || 0;
                totalPph21 += pph21;

                const rawEmpNikForBonus = String(row.nik_ktp || row.nik || '').trim().toUpperCase();

                // Build other incomes
                let empOtherIncomes: { type: string; name: string; amount: number }[] = [];
                for (const [key, mData] of dbIncomeByMonthNik) {
                    const [mStr, nikStr] = key.split('_');
                    if (nikStr === rawEmpNikForBonus && parseInt(mStr) === month) {
                        if (mData.thr > 0) empOtherIncomes.push({ type: 'THR', name: 'THR', amount: mData.thr });
                        if (mData.exgratia > 0) empOtherIncomes.push({ type: 'KONTAN', name: 'KONTAN', amount: mData.exgratia });
                        if (mData.custom > 0) empOtherIncomes.push({ type: 'CUSTOM', name: 'Custom', amount: mData.custom });
                    }
                }

                const empThrAmount = empOtherIncomes.filter((i: any) => i.type === 'THR').reduce((s: number, i: any) => s + i.amount, 0);
                const empKontanAmount = empOtherIncomes.filter((i: any) => i.type === 'KONTAN').reduce((s: number, i: any) => s + i.amount, 0);
                const empOtherIncomeAmount = empOtherIncomes.filter((i: any) => i.type === 'CUSTOM').reduce((s: number, i: any) => s + i.amount, 0);

                // Build premi detail
                const premiDetail: Record<string, number> = {};
                let consolidatedBrondol = 0;
                let hasBrondolFromDetail = false;

                if (row.premi && typeof row.premi === 'object' && !Array.isArray(row.premi)) {
                    for (const [key, value] of Object.entries(row.premi)) {
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        if (skipKeys.includes(key)) continue;
                        const upperKey = normalizePremiKey(key);
                        if (brondolSubKeys.some(bk => upperKey === bk.toUpperCase())) {
                            consolidatedBrondol += val;
                            continue;
                        }
                        if (upperKey === 'BRONDOL') {
                            consolidatedBrondol += val;
                            hasBrondolFromDetail = true;
                            continue;
                        }
                        premiDetail[upperKey] = (premiDetail[upperKey] || 0) + val;
                    }
                }

                if (row.premi_detail && typeof row.premi_detail === 'object' && !Array.isArray(row.premi_detail)) {
                    for (const [key, value] of Object.entries(row.premi_detail)) {
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        const upperKey = normalizePremiKey(key);
                        if (brondolSubKeys.some(bk => upperKey === bk.toUpperCase())) {
                            consolidatedBrondol += val;
                            continue;
                        }
                        if (upperKey === 'BRONDOL' && !hasBrondolFromDetail) {
                            consolidatedBrondol += val;
                            hasBrondolFromDetail = true;
                            continue;
                        }
                        if (!premiDetail[upperKey]) {
                            premiDetail[upperKey] = val;
                        }
                    }
                }

                const brondolFinal = consolidatedBrondol > 0 ? consolidatedBrondol : (row.premi_brondol || 0);
                if (brondolFinal > 0) {
                    premiDetail['BRONDOL'] = brondolFinal;
                }

                // Resolve jabatan
                let resolvedJabatan = jabatanMap[empCodeTrimmed] || '';
                if (!resolvedJabatan) {
                    resolvedJabatan = deriveJabatanFromGang(row.gang_code || '');
                }

                const { empName, parentName } = extractParentName(row.nama || row.emp_name || '');

                employees.push({
                    no: idx + 1,
                    emp_code: row.emp_code,
                    emp_name: empName,
                    parent_name: parentName,
                    nik: row.actual_nik || row.nik || '',
                    npwp: row.pajak_npwp || '',
                    alamat: row.res_address || '',
                    jabatan: resolvedJabatan,
                    gender: String(row.jenis_kelamin || row.gender || '1'),
                    status_ptkp: masterPtkp,
                    kategori_ter: kategoriTer,
                    gang_code: row.gang_code || '',
                    upah_kotor: row.jumlah_upah_kotor || row.upah_kotor || 0,
                    penghasilan_bruto: row.penghasilan_bruto || penghasilanBruto,
                    tarif_pajak_ter: row.tarif_pajak_ter || tarifPajakTer,
                    pph21_ter: pph21,
                    pot_pph21: row.pot_pph21 || 0,
                    hk: row.jumlah_hk || row.hk || 0,
                    gaji_pokok_aktual: gajiPokokAktual,
                    koreksi_hk: row.koreksi_hk || 0,
                    tunjangan_beras: tunjanganBeras,
                    tunjangan_jabatan: tunjanganJabatan,
                    tunjangan_masa_kerja: tunjanganMasaKerja,
                    tunjangan_lembur: tunjanganLembur,
                    total_tunjangan: row.total_tunjangan || 0,
                    premi_detail: premiDetail,
                    premi_brondol: row.premi_brondol || 0,
                    premi_pph: row.premi_pph || 0,
                    total_premi: totalPremi,
                    pot_spsi: row.pot_spsi || 0,
                    pot_koreksi: row.pot_koreksi || 0,
                    total_potongan_kotor: row.pot_koreksi || 0,
                    bpjs_kes_majikan: bpjsKesehatanMajikan4Pct,
                    astek_jht_majikan: astek084,
                    other_incomes: empOtherIncomes,
                    thr_amount: empThrAmount,
                    exgratia_amount: empKontanAmount,
                    other_income_amount: empOtherIncomeAmount,
                    pendapatan_tidak_tetap_thp: empThrAmount + empKontanAmount + empOtherIncomeAmount,
                    upah_dasar: upahDasar,
                    gaji_pokok_ideal: row.gaji_pokok_ideal || 0,
                    carumanBase: carumanBase
                });
            }

            console.log(`[TaxReport Excel Progressive] Transformed ${employees.length} employees, total_pph21=${totalPph21}`);

            const gangLabel = gang || gangPrefix || 'ALL';

            // Get gang description for filename
            let gangDescForFilename = '';
            if (gangLabel && gangLabel !== 'ALL') {
                try {
                    const gangInfo = await gangService.getGangInfo(gangLabel);
                    if (gangInfo?.description) {
                        gangDescForFilename = '_' + sanitizeForFilename(gangInfo.description);
                    }
                } catch (e) {
                    console.warn(`[TaxReport] Could not get gang description for ${gangLabel}:`, e);
                }
            }

            // Generate Excel
            const excelBuffer = await generateMonthlyTaxExcel(
                { employees, period: { month, year }, total_pph21: totalPph21 },
                year, month, division || 'ALL', gangLabel
            );

            if (!excelBuffer || excelBuffer.length === 0) {
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            const isGroupOnly = gangPrefix && (!gang || gang === 'ALL');
            const displayGangLabel = isGroupOnly ? `G${gangPrefix}` : gangLabel;
            const filename = `PPH21_${division || 'ALL'}_${displayGangLabel}${gangDescForFilename}_${month}_${year}.xlsx`;
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;

            return excelBuffer;
        } catch (error: any) {
            console.error("[TaxReport Excel Progressive] Error:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report" };
        }
    }, {
        query: t.Object({
            year: t.String(),
            month: t.String(),
            division: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel/fast
    // FAST tax report using DataExtractorService (same as Daftar Upah)
    // Respects use_history parameter to ensure data consistency with Daftar Upah
    // ========================================================
    .get("/monthly/excel/fast", async ({ query, set, currentUser }) => {
        try {
            const startTime = Date.now();
            const resolved = resolveMonthlyTaxQuery(query as any, currentUser);
            const year = resolved.year;
            const month = resolved.month;
            const division = resolved.division;
            const gang = resolved.gang;
            const gangPrefix = resolved.gangPrefix;
            const useHistoryDb = resolved.useHistoryDb;
            const snapshotVersion = resolved.snapshotVersion;

            console.log(`[TaxReport Excel FAST] Request: year=${year}, month=${month}, division=${division}, gang=${gang}, useHistory=${useHistoryDb}, snapshotVersion=${snapshotVersion ?? 'latest'}`);

            if (!resolved.hasValidPeriod) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            // Import services
            const { mapPTKPToTER } = await import("../services/ptkpTaxService");
            const { getCarumanForPph21 } = await import("../services/carumanDefinitions");
            const { EmployeeEstateService } = await import("../services/employeeEstateService");
            const { OtherIncomesService } = await import("../services/otherIncomesService");
            const { ptkpTaxService } = await import("../services/ptkpTaxService");
            const { DataExtractorService } = await import("../services/dataExtractorService");
            const { Config } = await import("../config");

            // Resolve gang/division
            const targetGangCode = gang && gang.trim() !== '' && gang !== 'ALL' ? gang.trim().toUpperCase() : undefined;

            console.log(`[TaxReport Excel FAST] Using DataExtractorService (same as Daftar Upah): gang=${targetGangCode || 'ALL'}, division=${division || 'ALL'}, prefix=${gangPrefix || 'none'}, useHistory=${useHistoryDb}, snapshotVersion=${snapshotVersion ?? 'latest'}`);

            // Use DataExtractorService EXACTLY like Daftar Upah - same data source, same logic
            // This ensures Excel export matches exactly what appears in Daftar Upah
            const extractorResult = await DataExtractorService.getInstance().extractPayrollData(
                month, year,
                targetGangCode || "ALL",
                division,
                null,
                Config.DB_PROFILE,
                false, // skipDetailRecords
                useHistoryDb, // Use the same useHistoryDb parameter as Daftar Upah
                gangPrefix,
                false,  // skipHarvest [FIXED 2026-04-08]: Must match UI logic
                false,
                snapshotVersion
            );

            if (!extractorResult.data_rows || extractorResult.data_rows.length === 0) {
                console.error(`[TaxReport Excel FAST] No data returned from DataExtractorService!`);
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            const historyData = {
                data_rows: extractorResult.data_rows,
                dynamic_premi_headers: extractorResult.dynamic_premi_headers || [],
                dynamic_potongan_headers: extractorResult.dynamic_potongan_headers || [],
                premi_title_map: extractorResult.premi_title_map || {},
                potongan_title_map: extractorResult.potongan_title_map || {},
                meta: {
                    execution_time_ms: 0,
                    row_count: extractorResult.data_rows.length,
                    is_history_snapshot: Boolean(extractorResult.meta?.is_history_snapshot),
                    snapshot_version: extractorResult.meta?.snapshot_version ?? null,
                    requested_snapshot_version: extractorResult.meta?.requested_snapshot_version ?? null,
                    available_snapshot_versions: extractorResult.meta?.available_snapshot_versions ?? []
                }
            };
            console.log(`[TaxReport Excel FAST] DataExtractor: ${historyData.data_rows.length} rows, same as Daftar Upah`);

            // Effective division for other incomes lookup
            const effectiveDivisionForSecondary = division;

            // Get PTKP data
            console.log(`[TaxReport Excel FAST] Fetching PTKP data for year ${year}...`);
            const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
            const ptkpMap = new Map<string, string>();
            for (const p of ptkpMaster) {
                ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
            }
            console.log(`[TaxReport Excel FAST] PTKP map has ${ptkpMap.size} entries`);

            // COLLECT unique emp_codes for optimized lookups
            const allInitialEmpCodes = Array.from(new Set(extractorResult.data_rows.map(r => (r.emp_code || '').trim()).filter(Boolean)));
            console.log(`[TaxReport Excel FAST] Found ${allInitialEmpCodes.length} unique employee codes`);

            // Get jabatan map (OPTIMIZED with filter)
            const jabatanMap: Record<string, string> = {};
            try {
                console.log(`[TaxReport Excel FAST] Fetching jabatan for ${allInitialEmpCodes.length} employees...`);
                const jobTitlesResult = await EmployeeEstateService.getEmployeeJobsWithNik(allInitialEmpCodes);
                if (jobTitlesResult && jobTitlesResult.empcodeMap) {
                    for (const [empCode, jabatan] of Object.entries(jobTitlesResult.empcodeMap)) {
                        jabatanMap[empCode] = jabatan || '';
                    }
                }
                console.log(`[TaxReport Excel FAST] Jabatan map has ${Object.keys(jabatanMap).length} entries`);
            } catch (e: any) {
                console.warn('[TaxReport Excel FAST] Failed to get jabatan map:', e?.message || e);
            }

            // Get other incomes for the year
            console.log(`[TaxReport Excel FAST] Fetching other incomes for year ${year}, division ${effectiveDivisionForSecondary}...`);
            const dbOtherIncomesYear = await OtherIncomesService.getIncomesForYear(year, effectiveDivisionForSecondary, gang);
            console.log(`[TaxReport Excel FAST] Found ${dbOtherIncomesYear.length} other income records`);
            
            const dbIncomeByMonthNik = new Map<string, { thr: number; exgratia: number; custom: number }>();
            for (const inc of dbOtherIncomesYear) {
                if (inc.is_taxable) {
                    const nik = String(inc.nik || '').trim().toUpperCase();
                    const type = String(inc.income_type || '').toUpperCase();
                    const monthKey = `${inc.period_month}_${nik}`;
                    const amt = Number(inc.amount) || 0;
                    if (!dbIncomeByMonthNik.has(monthKey)) dbIncomeByMonthNik.set(monthKey, { thr: 0, exgratia: 0, custom: 0 });
                    const mData = dbIncomeByMonthNik.get(monthKey)!;
                    if (type === 'THR') mData.thr += amt;
                    else if (type === 'KONTAN' || type === 'KONTANAN') mData.exgratia += amt;
                    else if (type === 'BONUS' || type === 'EXGRATIA') mData.exgratia += amt;
                    else mData.custom += amt;
                }
            }
            console.log(`[TaxReport Excel FAST] Other incomes by month/NIK: ${dbIncomeByMonthNik.size} entries`);

            // Helper: derive jabatan from gang code
            const deriveJabatanFromGang = (gangCode: string): string => {
                if (!gangCode || gangCode.trim().length === 0) return 'Karyawan';
                const lastChar = gangCode.trim().slice(-1).toUpperCase();
                switch (lastChar) {
                    case 'H': return 'Karyawan Panen';
                    case 'P': return 'Karyawan Percobaan';
                    case 'T': return 'Operator';
                    case 'N': return 'Karyawan Nursery';
                    case 'G': return 'Kerani Gudang';
                    case 'M': return 'Karyawan Perawatan';
                    default: return 'Karyawan';
                }
            };

            // Helper: normalize premi key
            const normalizePremiKey = (key: string): string => {
                return String(key).toUpperCase().replace(/_/g, ' ').trim();
            };

            // Helper: extract parent name from parentheses (e.g., "JOHN DOE (JANE DOE)")
            const extractParentName = (rawName: string): { empName: string; parentName: string } => {
                const match = rawName.match(/^(.+?)\s*\((.+?)\)\s*$/);
                if (match) return { empName: match[1].trim(), parentName: match[2].trim() };
                return { empName: rawName, parentName: '' };
            };

            // Premi consolidation helpers
            const brondolSubKeys = ['BRONDOL LOOSEFRUIT', 'BRONDOL TOTAL', 'BRONDOL ADTRANS',
                'BRONDOL_LOOSEFRUIT', 'BRONDOL_TOTAL', 'BRONDOL_ADTRANS',
                'brondol_loosefruit', 'brondol_total', 'brondol_adtrans',
                'brondol loosefruit', 'brondol total', 'brondol adtrans'];
            const skipKeys = ['koreksi', 'KOREKSI', 'total', 'TOTAL'];

            const isBrondolSubKey = (key: string): boolean => {
                const upper = normalizePremiKey(key);
                return brondolSubKeys.some(bk => upper === bk.toUpperCase());
            };

            // [DE-DUPLICATION] Use a Map to focus on the LATEST record per employee (Append-Insert handling)
            // This prevents "accumulated" duplicate data from being summed erroneously.
            // We assume the extractor returns rows in natural insertion order (oldest first).
            const employeeMap = new Map<string, any>();
            for (const r of historyData.data_rows) {
                const hk = Number(r.jumlah_hk || r.hk || 0);
                const hasIncome = Number(r.jumlah_upah_kotor || 0) > 0;
                
                if (hk > 0 || hasIncome) {
                    const key = (r.emp_code || r.nik || r.actual_nik || '').trim().toUpperCase();
                    if (key) {
                        // Always overwrite with the last record seen (Latest Wins)
                        employeeMap.set(key, r);
                    }
                }
            }

            const activeEmployees = Array.from(employeeMap.values());
            console.log(`[TaxReport Excel FAST] Rows from Extractor: ${historyData.data_rows.length}`);
            console.log(`[TaxReport Excel FAST] De-duplicated down to ${activeEmployees.length} unique employees (LATEST VERSION ONLY).`);

            console.log(`[TaxReport Excel FAST] Active employees (HK > 0 OR Income > 0): ${activeEmployees.length}`);

            // Transform to MonthlyTaxRow format — ALIGNED with progressive endpoint & Excel generator
            console.log(`[TaxReport Excel FAST] Starting employee transformation...`);
            const employees: any[] = [];
            let totalPph21 = 0;

            for (let idx = 0; idx < activeEmployees.length; idx++) {
                try {
                    const row = activeEmployees[idx];
                    const empCodeTrimmed = (row.emp_code || '').trim();
                    const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
                    const kategoriTer = mapPTKPToTER(masterPtkp);

                // [DEBUG] Log first row to help diagnose premi data
                if (idx === 0) {
                    console.log(`[TaxReport FAST DEBUG] First row keys (sample):`, 
                        Object.keys(row).filter(k => k.includes('pph') || k.includes('premi') || k.includes('pot') || k.includes('beras') || k.includes('bruto') || k.includes('brondol')));
                    console.log(`[TaxReport FAST DEBUG] row.premi type=${typeof row.premi}, keys=${row.premi ? Object.keys(row.premi) : 'N/A'}`);
                    console.log(`[TaxReport FAST DEBUG] row.premi_detail type=${typeof row.premi_detail}, keys=${row.premi_detail && typeof row.premi_detail === 'object' ? Object.keys(row.premi_detail) : 'N/A'}`);
                    console.log(`[TaxReport FAST DEBUG] row.premi_brondol=${row.premi_brondol}, row.total_premi=${row.total_premi}`);
                    // Log all premi_* flat keys
                    const premiFlat = Object.entries(row).filter(([k]) => k.startsWith('premi_')).map(([k,v]) => `${k}=${v}`);
                    console.log(`[TaxReport FAST DEBUG] Flat premi_* fields: [${premiFlat.join(', ')}]`);
                }

                const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
                const upahDasar = row.upah_dasar || 0;
                const tunjanganBeras = row.beras_jumlah || 0;
                const tunjanganJabatan = row.jabatan_jumlah || 0;
                const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
                const tunjanganLembur = row.lembur_jumlah || 0;
                const totalPremi = row.total_premi || 0;

                const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
                const astek084 = pph21Caruman.astek_majikan_084;
                const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;
                const carumanBase = pph21Caruman.base;

                // [ALIGNMENT] Use values EXACTLY from Daftar Upah (same logic as progressive & monthly endpoints)
                const penghasilanBruto = Number(row.penghasilan_bruto) || 0;
                // [FIXED 2026-04-08] Prioritize pph21_ter to match UI "Pajak" column exactly
                const pph21 = Number(row.pph21_ter) || Number(row.pot_pph21) || 0;
                const tarifPajakTer = Number(row.tarif_pajak_ter) || 0;
                totalPph21 += pph21;

                // Other incomes for this employee this month
                const rawEmpNikForBonus = String(row.nik_ktp || row.nik || '').trim().toUpperCase();
                const monthKey = `${month}_${rawEmpNikForBonus}`;
                const empOtherIncome = dbIncomeByMonthNik.get(monthKey) || { thr: 0, exgratia: 0, custom: 0 };
                const empThrAmount = empOtherIncome.thr;
                const empKontanAmount = empOtherIncome.exgratia;
                const empOtherIncomeAmount = empOtherIncome.custom;

                // Build other incomes array for this employee
                let empOtherIncomes: { type: string; name: string; amount: number }[] = [];
                if (empThrAmount > 0) empOtherIncomes.push({ type: 'THR', name: 'THR', amount: empThrAmount });
                if (empKontanAmount > 0) empOtherIncomes.push({ type: 'KONTAN', name: 'Kontan', amount: empKontanAmount });
                if (empOtherIncomeAmount > 0) empOtherIncomes.push({ type: 'LAIN', name: 'Pendapatan Lain', amount: empOtherIncomeAmount });

                // Get job title
                let resolvedJabatan = jabatanMap[empCodeTrimmed] || row.jabatan || row.jabatan_estate || '';
                if (!resolvedJabatan) {
                    resolvedJabatan = deriveJabatanFromGang(row.gang_code || '');
                }

                // Extract parent name from parentheses
                const rawName = row.nama || row.emp_name || '';
                const { empName, parentName } = extractParentName(rawName);

                // ============================================================
                // Build premiDetail: extract ALL individual premi items
                // DataExtractor stores premi in row.premi as nested object
                // Keys can be: premi_angkut, premi_pruning, brondol, etc.
                // ============================================================
                const premiDetail: Record<string, number> = {};

                // SOURCE 1: row.premi (nested object from DataExtractor - PRIMARY)
                if (row.premi && typeof row.premi === 'object' && !Array.isArray(row.premi)) {
                    for (const [key, value] of Object.entries(row.premi)) {
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        if (skipKeys.includes(key)) continue;
                        
                        // Strip 'premi_' prefix if present, then normalize
                        const cleanKey = key.replace(/^premi_/i, '');
                        const upperKey = normalizePremiKey(cleanKey);
                        
                        // Skip brondol — handled separately below as single entry
                        if (upperKey === 'BRONDOL' || isBrondolSubKey(cleanKey)) continue;
                        
                        premiDetail[upperKey] = (premiDetail[upperKey] || 0) + val;
                    }
                }

                // SOURCE 2: row.premi_detail (from history database — only if SOURCE 1 was empty)
                if (Object.keys(premiDetail).length === 0) {
                    let parsedPremiDetail: Record<string, any> | null = null;
                    const rawPremiDetail = row.premi_detail;
                    if (rawPremiDetail && typeof rawPremiDetail === 'object' && !Array.isArray(rawPremiDetail)) {
                        parsedPremiDetail = rawPremiDetail;
                    } else if (rawPremiDetail && typeof rawPremiDetail === 'string') {
                        try { parsedPremiDetail = JSON.parse(rawPremiDetail); } catch (_) {}
                    }
                    if (parsedPremiDetail) {
                        for (const [key, value] of Object.entries(parsedPremiDetail)) {
                            const val = Number(value) || 0;
                            if (val <= 0) continue;
                            if (skipKeys.includes(key)) continue;
                            const cleanKey = key.replace(/^premi_/i, '');
                            const upperKey = normalizePremiKey(cleanKey);
                            if (upperKey === 'BRONDOL' || isBrondolSubKey(cleanKey)) continue;
                            if (!premiDetail[upperKey]) { premiDetail[upperKey] = val; }
                        }
                    }
                }

                // SOURCE 3: row.premi_* flattened fields (final fallback)
                if (Object.keys(premiDetail).length === 0) {
                    for (const [key, value] of Object.entries(row)) {
                        if (!key.startsWith('premi_')) continue;
                        if (['premi_brondol', 'premi_brondol_total', 'premi_brondol_loosefruit', 
                             'premi_brondol_adtrans', 'premi_pph', 'premi_detail', 'premi_details',
                             'premi_koreksi'].includes(key)) continue;
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        const cleanKey = key.replace(/^premi_/, '');
                        const label = normalizePremiKey(cleanKey);
                        if (label === 'BRONDOL' || isBrondolSubKey(cleanKey)) continue;
                        if (!premiDetail[label]) { premiDetail[label] = val; }
                    }
                }

                // BRONDOL: single source — use premi_brondol_total (already consolidated by DataExtractor)
                // This ensures brondol appears exactly ONCE, not duplicated
                const brondolFinal = Number(row.premi_brondol_total) || Number(row.premi_brondol) || 0;
                if (brondolFinal > 0) {
                    premiDetail['BRONDOL'] = brondolFinal;
                }

                // [DEBUG] Log premiDetail for first employee
                if (idx === 0) {
                    console.log(`[TaxReport FAST DEBUG] First employee premiDetail:`, JSON.stringify(premiDetail));
                    console.log(`[TaxReport FAST DEBUG] brondolFinal=${brondolFinal}, premi_brondol_total=${row.premi_brondol_total}, premi_brondol=${row.premi_brondol}`);
                }

                // ============================================================
                // Build employee object with CORRECT field names matching
                // MonthlyTaxRow interface & taxReportExcelService.ts expectations
                // ============================================================
                employees.push({
                    no: idx + 1,
                    emp_code: empCodeTrimmed,
                    emp_name: empName,                          // Was: nama (Excel reads emp_name)
                    parent_name: parentName,                    // Was: missing
                    nik: row.actual_nik || row.nik || '',
                    new_nik: row.actual_nik || row.nik || '',   // Was: missing (Excel reads new_nik)
                    npwp: row.pajak_npwp || '',                 // Was: missing
                    alamat: row.res_address || row.alamat || '', // Was: missing
                    jabatan: resolvedJabatan,
                    gender: String(row.jenis_kelamin || row.gender || '1'), // Was: missing
                    status_ptkp: masterPtkp,
                    kategori_ter: kategoriTer,
                    gang_code: row.gang_code || '',
                    
                    // Struktur Upah
                    hk: Number(row.jumlah_hk || row.hk) || 0,  // Was: missing (Excel reads hk)
                    upah_dasar: Number(upahDasar),
                    gaji_pokok_ideal: row.gaji_pokok_ideal || 0,
                    gaji_pokok_aktual: Number(gajiPokokAktual),
                    koreksi_hk: row.koreksi_hk || 0,            // Was: missing
                    
                    // Tunjangan — correct field names for Excel generator
                    tunjangan_beras: Number(tunjanganBeras),
                    tunjangan_jabatan: Number(tunjanganJabatan),
                    tunjangan_masa_kerja: Number(tunjanganMasaKerja),
                    tunjangan_lembur: Number(tunjanganLembur),   // Was: lembur (Excel reads tunjangan_lembur)
                    total_tunjangan: Number(row.total_tunjangan) || 0,
                    
                    // Premi — with detail breakdown
                    premi_detail: premiDetail,                   // Was: missing (critical for premi columns)
                    premi_brondol: row.premi_brondol || brondolFinal || 0, // Was: missing
                    premi_pph: row.premi_pph || 0,               // Was: missing
                    total_premi: Number(totalPremi),
                    
                    // Potongan
                    pot_spsi: row.pot_spsi || 0,                 // Was: missing
                    pot_koreksi: row.pot_koreksi || 0,           // Was: missing
                    total_potongan_kotor: row.pot_koreksi || 0,
                    
                    // Jaminan Majikan — correct field names
                    bpjs_kes_majikan: Number(bpjsKesehatanMajikan4Pct), // Was: bpjs_kes_m
                    astek_jht_majikan: Number(astek084),                // Was: astek_m
                    
                    // Kalkulasi PPH21 — values from Daftar Upah
                    upah_kotor: row.jumlah_upah_kotor || row.upah_kotor || 0, // Was: missing
                    penghasilan_bruto: Number(penghasilanBruto),
                    tarif_pajak_ter: tarifPajakTer,
                    pph21_ter: Number(pph21),
                    pot_pph21: Number(row.pot_pph21) || 0,
                    
                    // Pendapatan Lainnya
                    thr_amount: empThrAmount,                    // Was: missing
                    exgratia_amount: empKontanAmount,             // Was: missing
                    other_incomes: empOtherIncomes,
                    pendapatan_tidak_tetap_thp: empThrAmount + empKontanAmount + empOtherIncomeAmount,
                    
                    // GL Metadata — use TAX_COMPONENT_METADATA directly (DataExtractor doesn't provide this)
                    component_metadata: TAX_COMPONENT_METADATA,
                });
                } catch (empError: any) {
                    const empCode = activeEmployees[idx]?.emp_code || 'unknown';
                    console.error(`[TaxReport Excel FAST] Error transforming employee ${empCode} (index ${idx}):`, empError?.message || empError);
                    // Continue with next employee instead of failing completely
                }
            }

            console.log(`[TaxReport Excel FAST] Transformed ${employees.length} employees, total_pph21=${totalPph21} in ${Date.now() - startTime}ms`);

            const gangLabel = gang || gangPrefix || 'ALL';

            // Get gang description for filename
            let gangDescForFilename = '';
            if (gangLabel && gangLabel !== 'ALL') {
                try {
                    const gangInfo = await gangService.getGangInfo(gangLabel);
                    if (gangInfo?.description) {
                        gangDescForFilename = '_' + sanitizeForFilename(gangInfo.description);
                    }
                } catch (e) {
                    console.warn(`[TaxReport] Could not get gang description for ${gangLabel}:`, e);
                }
            }

            // Generate Excel
            console.log(`[TaxReport Excel FAST] Calling generateMonthlyTaxExcel with ${employees.length} employees...`);
            try {
                const excelBuffer = await generateMonthlyTaxExcel(
                    { employees, period: { month, year }, total_pph21: totalPph21 },
                    year, month, division || 'ALL', gangLabel
                );
                console.log(`[TaxReport Excel FAST] generateMonthlyTaxExcel returned buffer length=${excelBuffer?.length || 0}`);

                if (!excelBuffer || excelBuffer.length === 0) {
                    console.error('[TaxReport Excel FAST] Excel buffer is empty!');
                    set.status = 500;
                    return { error: "Failed to generate Excel buffer - empty" };
                }

                console.log(`[TaxReport Excel FAST] Total time: ${Date.now() - startTime}ms`);

                // Ensure we have a proper Buffer
                const finalBuffer = Buffer.isBuffer(excelBuffer) ? excelBuffer : Buffer.from(excelBuffer);

                if (!finalBuffer || finalBuffer.length === 0) {
                    console.error('[TaxReport Excel FAST] Excel buffer is empty after conversion!');
                    set.status = 500;
                    return { error: "Failed to generate Excel - empty buffer" };
                }

                const isGroupOnly = gangPrefix && (!gang || gang === 'ALL');
                const displayGangLabel = isGroupOnly ? `G${gangPrefix}` : gangLabel;
                const filename = `PPH21_${division || 'ALL'}_${displayGangLabel}${gangDescForFilename}_${month}_${year}.xlsx`;
                console.log(`[TaxReport Excel FAST] Returning file: ${filename} (${finalBuffer.length} bytes)`);

                // Set headers and return a native Response object
                // returning Response directly is more robust in Bun for binary data
                return new Response(finalBuffer, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "Content-Disposition": `attachment; filename="${filename}"`,
                        "Content-Length": String(finalBuffer.length),
                        "Access-Control-Expose-Headers": "Content-Disposition"
                    }
                });
            } catch (excelError: any) {
                console.error('[TaxReport Excel FAST] Excel generation failed:', excelError);
                console.error('[TaxReport Excel FAST] Stack:', excelError?.stack);
                set.status = 500;
                return { error: "Excel generation failed: " + (excelError?.message || String(excelError)) };
            }
        } catch (error: any) {
            console.error(`[TaxReport Excel FAST ERROR]`, error);
            set.status = 500;
            return { 
                error: "Internal Server Error", 
                details: error?.message || "Unknown error",
                stack: error?.stack
            };
        } finally {
            // Memory Cleaner: Bebaskan memory secara paksa setelah pemrosesan objek JSON/Excel yang besar
            try {
                if (typeof Bun !== 'undefined' && Bun.gc) {
                    Bun.gc(true); // Force synchronous GC in Bun
                } else if (global && global.gc) {
                    global.gc(); // Fallback for Node.js
                }
            } catch (e) {
                // Ignore GC errors
            }
        }
    }, {
        query: t.Object({
            year: t.String(),
            month: t.String(),
            division: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            snapshot_version: t.Optional(t.String())
        })
    })

    // ========================================================
    // POST /tax-report/monthly/excel/dom
    // Generates Tax Report directly from frontend DOM details
    // [REVISED] Use DOM data directly from UI PAJAK section
    // Only fetch premi_detail and THR from backend (not in UI table)
    // ========================================================
    .post("/monthly/excel/dom", async ({ body, set }) => {
        const t0 = performance.now();
        try {
            const { year, month, division, gang, gangPrefix, employees, premiKeys } = body as any;

            if (!year || !month || !employees || !Array.isArray(employees)) {
                set.status = 400;
                return { error: "Invalid payload: year, month, and employees are required" };
            }
            const y = parseInt(year);
            const m = parseInt(month);

            console.log(`[TaxReport DOM FAST] Request: ${division}/${gang || gangPrefix || 'ALL'} ${m}/${y}, ${employees.length} employees`);

            const empCodes = employees.map((emp: any) => (emp.emp_code || emp.ID_KARYAWAN || '').trim().toUpperCase()).filter(Boolean);

            // ─────────────────────────────────────────────────────────
            // FAST PREMI FETCH: PremiumExtractor only (2 lightweight queries)
            // Replaces: getMonthlyTaxReport + DataExtractorService
            // ─────────────────────────────────────────────────────────
            if (empCodes.length > 0) {
                try {
                    const { getPremiumExtractor } = await import("../services/payroll/extractors/PremiumExtractor");
                    const premiumExtractor = getPremiumExtractor();

                    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
                    const nextM = m === 12 ? 1 : m + 1;
                    const nextY = m === 12 ? y + 1 : y;
                    const endDate = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

                    // Run premi + brondol in PARALLEL
                    const [premiResult, brondolResult] = await Promise.all([
                        premiumExtractor.extract(empCodes, startDate, endDate),
                        premiumExtractor.extractBrondolLooseFruit(empCodes, startDate, endDate)
                    ]);

                    const t1 = performance.now();
                    console.log(`[TaxReport DOM FAST] PremiumExtractor done in ${(t1 - t0).toFixed(0)}ms`);

                    const normalizeKey = (k: string): string =>
                        k.replace(/^PREMI\s*/i, '').replace(/_/g, ' ').trim().toUpperCase() || k.toUpperCase();

                    employees.forEach((emp: any) => {
                        const empCode = (emp.emp_code || emp.ID_KARYAWAN || '').trim().toUpperCase();
                        const empPremi = premiResult.amounts[empCode] || {};
                        const empBrondol = brondolResult[empCode] || 0;
                        const detail: Record<string, number> = {};

                        for (const [docDesc, amount] of Object.entries(empPremi)) {
                            if (amount <= 0) continue;
                            const key = normalizeKey(docDesc);
                            if (key === 'BRONDOL' || key.includes('BRONDOL')) {
                                detail['BRONDOL'] = (detail['BRONDOL'] || 0) + amount;
                                continue;
                            }
                            if (key.includes('PPH') || key.includes('KOREKSI') || key.includes('ADJ')) continue;
                            detail[key] = (detail[key] || 0) + amount;
                        }

                        if (empBrondol > 0) detail['BRONDOL'] = (detail['BRONDOL'] || 0) + empBrondol;

                        if (Object.keys(detail).length > 0) {
                            emp.premi_detail = { ...detail, ...(emp.premi_detail || {}) };
                        }
                        if (detail['BRONDOL'] > 0) {
                            emp.premi_brondol = detail['BRONDOL'];
                            emp.premi_brondol_total = detail['BRONDOL'];
                        }
                    });
                } catch (premiError: any) {
                    console.error(`[TaxReport DOM FAST] PremiumExtractor failed:`, premiError.message);
                }
            }

            // Ensure BRONDOL in premi_detail from top-level fields
            employees.forEach((emp: any) => {
                if (!emp.premi_detail) emp.premi_detail = {};
                const hasBrondol = Object.keys(emp.premi_detail).some(k => k.toUpperCase() === 'BRONDOL');
                if (!hasBrondol) {
                    const bVal = Number(emp.premi_brondol_total) || Number(emp.premi_brondol) || 0;
                    if (bVal > 0) emp.premi_detail['BRONDOL'] = bVal;
                }
            });

            // Inject TAX_COMPONENT_METADATA for AccCode rows (static)
            const { TAX_COMPONENT_METADATA: MTD } = await import("../services/taxReportService");
            const metaToInject = MTD || TAX_COMPONENT_METADATA;
            employees.forEach((emp: any) => { emp.component_metadata = metaToInject; });
            console.log(`[TaxReport DOM FAST] Injected metadata keys: ${Object.keys(metaToInject || {}).join(', ')}`);



            // Pot Alpa — pure calculation from DOM fields
            employees.forEach((emp: any) => {
                if (!emp.pot_alpa_cth && !emp.pot_alpa) {
                    const ideal = Number(emp.gaji_pokok_ideal || 0);
                    const aktual = Number(emp.gaji_pokok_aktual || 0);
                    if (ideal > 0 && aktual > 0 && ideal > aktual) {
                        emp.pot_alpa_cth = -(ideal - aktual);
                    }
                }
            });

            let totalPph21 = 0;
            employees.forEach((emp: any) => {
                 totalPph21 += (Number(emp.potongan_pph21) || Number(emp.pot_pph21) || Number(emp.pph21_ter) || 0);
            });

            const gangLabel = gang || gangPrefix || 'ALL';

            // Get gang description for filename
            let gangDescForFilename = '';
            if (gangLabel && gangLabel !== 'ALL') {
                try {
                    const gangInfo = await gangService.getGangInfo(gangLabel);
                    if (gangInfo?.description) {
                        gangDescForFilename = '_' + sanitizeForFilename(gangInfo.description);
                    }
                } catch (e) {
                    console.warn(`[TaxReport] Could not get gang description for ${gangLabel}:`, e);
                }
            }

            let excelBuffer: Buffer | undefined;

            try {
                excelBuffer = await generateMonthlyTaxExcel(
                    { employees, period: { month: m, year: y }, total_pph21: totalPph21 },
                    y, m,
                    division || 'ALL',
                    gangLabel,
                    premiKeys || []
                );
                console.log(`[TaxReport Excel DOM] generateMonthlyTaxExcel completed: ${excelBuffer?.length || 0} bytes`);
            } catch (excelGenError: any) {
                console.error('[TaxReport Excel DOM] Excel generation FAILED:', excelGenError);
                console.error('[TaxReport Excel DOM] Stack trace:', excelGenError?.stack);
                set.status = 500;
                return {
                    error: "Excel generation failed",
                    details: excelGenError?.message || "Unknown error during Excel generation",
                    stack: process.env.NODE_ENV === 'development' ? excelGenError?.stack : undefined
                };
            }

            if (!excelBuffer || excelBuffer.length === 0) {
                console.error('[TaxReport Excel DOM] Excel buffer is empty!');
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            const totalMs = (performance.now() - t0).toFixed(0);
            const isGroupOnly = gangPrefix && (!gang || gang === 'ALL');
            const displayGangLabel = isGroupOnly ? `G${gangPrefix}` : gangLabel;
            const filename = `PPH21_DOM_${division || 'ALL'}_${displayGangLabel}${gangDescForFilename}_${m}_${y}.xlsx`;
            console.log(`[TaxReport DOM FAST] ✅ Done in ${totalMs}ms — ${filename} (${excelBuffer.length} bytes)`);

            // Set headers and return a native Response object
            return new Response(excelBuffer, {
                status: 200,
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Content-Length": String(excelBuffer.length),
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            });
        } catch (error: any) {
            console.error("[TaxReport DOM] Error generating Excel report from DOM:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report from DOM" };
        } finally {
            // Memory Cleaner: Bebaskan memory secara paksa setelah pemrosesan objek JSON/Excel yang besar
            try {
                if (typeof Bun !== 'undefined' && Bun.gc) {
                    Bun.gc(true); // Force synchronous garbage collection in Bun
                } else if (global && global.gc) {
                    global.gc(); // Fallback for Node.js if --expose-gc is used
                }
            } catch (e) {
                // Abaikan error misal gc tidak tersedia
            }
        }
    })

    // ========================================================
    // GET /tax-report/annual
    // Annual tax report with PTKP, Biaya Jabatan, PKP
    // ========================================================
    .get("/annual", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const monthStr = query.month as string | undefined;
            const month = monthStr ? parseInt(monthStr) : undefined;
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            const result = await taxReportService.getAnnualTaxReport(year, month, division, gang, gangPrefix);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching annual tax report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch annual tax report" };
        }
    })

    // ========================================================
    // GET /tax-report/astek-bpjs
    // Annual ASTEK & BPJS per-month report
    // ========================================================
    .get("/astek-bpjs", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const monthStr = query.month as string | undefined;
            const month = monthStr ? parseInt(monthStr) : undefined;
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            const result = await taxReportService.getAnnualAstekBpjsReport(year, month, division, gang, gangPrefix);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching ASTEK/BPJS report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch ASTEK/BPJS report" };
        }
    })

    // ========================================================
    // GET /tax-report/december
    // Dedicated December Tax Report with annualized aggregation
    // ========================================================
    .get("/december", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            const result = await taxReportService.getDecemberTaxReport(year, division, gang, gangPrefix);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching December tax report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch December tax report" };
        }
    })

    // ========================================================
    // GET /tax-report/december/excel
    // Download December tax report with monthly breakdown as Excel
    // ========================================================
    .get("/december/excel", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            // Fetch the base data
            const data = await taxReportService.getDecemberTaxReport(year, division, gang, gangPrefix);

            if (!data || data.employees.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            const gangLabel = gang || gangPrefix || 'ALL';

            // Get gang description for filename
            let gangDescForFilename = '';
            if (gangLabel && gangLabel !== 'ALL') {
                try {
                    const gangInfo = await gangService.getGangInfo(gangLabel);
                    if (gangInfo?.description) {
                        gangDescForFilename = '_' + sanitizeForFilename(gangInfo.description);
                    }
                } catch (e) {
                    console.warn(`[TaxReport] Could not get gang description for ${gangLabel}:`, e);
                }
            }

            // Generate Excel Buffer
            const excelBuffer = await generateDecemberTaxExcel(data, year, division || 'ALL', gangLabel);

            const filename = `PAJAK_DESEMBER_${division || 'ALL'}_${gangLabel}${gangDescForFilename}_${year}.xlsx`;
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;

            return excelBuffer;
        } catch (error: any) {
            console.error("[TaxReport] Error generating December Excel report:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report" };
        }
    })


    // ========================================================
    // PUT /tax-report/ptkp/:emp_code
    // Update PTKP status for a specific employee (portal edit)
    // ========================================================
    .put("/ptkp/:emp_code", async ({ params, body, set, currentUser }) => {
        try {
            const { year, ptkp_status } = body as { year: number; ptkp_status: string };
            const empCode = params.emp_code;

            if (!year || !ptkp_status) {
                set.status = 400;
                return { success: false, error: "year and ptkp_status are required" };
            }

            const validStatuses = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'];
            if (!validStatuses.includes(ptkp_status)) {
                set.status = 400;
                return { success: false, error: `Invalid PTKP status. Must be one of: ${validStatuses.join(', ')}` };
            }

            const username = currentUser?.username || 'system';
            const result = await ptkpTaxService.updatePtkpStatus(year, empCode, ptkp_status, username);

            return { success: true, updated: result, emp_code: empCode, year, ptkp_status };
        } catch (error: any) {
            console.error("[TaxReport] Error updating PTKP:", error);
            set.status = 500;
            return { success: false, error: error.message || "Failed to update PTKP status" };
        }
    }, {
        body: t.Object({
            year: t.Number(),
            ptkp_status: t.String()
        })
    });
