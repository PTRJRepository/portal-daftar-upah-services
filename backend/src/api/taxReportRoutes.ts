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
import { taxReportService } from "../services/taxReportService";
import { generateMonthlyTaxExcel, generateDecemberTaxExcel } from "../services/taxReportExcelService";
import { ptkpTaxService } from "../services/ptkpTaxService";
import { EmployeeEstateService } from "../services/employeeEstateService";

const authService = AuthService.getInstance();

async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    return authService.verifyToken(token);
}

export const taxReportRoutes = new Elysia({ prefix: "/tax-report" })
    .derive(async ({ headers }) => {
        const authHeader = headers["authorization"];
        console.log(`[TaxReport] Auth header: ${authHeader ? 'present' : 'missing'}`);
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
    // ========================================================
    .get("/monthly", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;
            const useHistory = query.use_history === 'true';

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year || !month || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            const result = await taxReportService.getMonthlyTaxReport(year, month, division, gang, gangPrefix, useHistory);
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
            use_history: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel
    // Download Monthly PPH21 tax report as Excel with formulas
    // ========================================================
    .get("/monthly/excel", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;
            const useHistory = query.use_history === 'true';

            console.log(`[TaxReport Excel] Request: year=${year}, month=${month}, division=${division}, gang=${gang}, useHistory=${useHistory}`);
            console.log(`[TaxReport Excel] currentUser: ${currentUser ? 'authenticated' : 'not auth'}`);

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year || !month || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            // Fetch the base data
            const data = await taxReportService.getMonthlyTaxReport(year, month, division, gang, gangPrefix, useHistory);

            console.log(`[TaxReport Excel] Data fetched: ${data?.employees?.length || 0} employees`);

            if (!data || data.employees.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            const gangLabel = gang || gangPrefix || 'ALL';

            // Generate Excel Buffer (pass premiKeys for dynamic column headers)
            const excelBuffer = await generateMonthlyTaxExcel(data, year, month, division || 'ALL', gangLabel, data.premiKeys);

            console.log(`[TaxReport Excel] Excel generated: ${excelBuffer?.length || 0} bytes, type: ${typeof excelBuffer}`);

            if (!excelBuffer || excelBuffer.length === 0) {
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            return new Response(excelBuffer, {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="PPH21_${division || 'ALL'}_${gangLabel}_${month}_${year}.xlsx"`
                }
            });
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
            use_history: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel/progressive
    // Download Monthly PPH21 using progressive extraction (avoids timeout)
    // Uses dataExtractorService.extractPayrollDataProgressive() + direct tax transformation
    // ========================================================
    .get("/monthly/excel/progressive", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;
            const useHistory = query.use_history === 'true';

            console.log(`[TaxReport Excel Progressive] Request: year=${year}, month=${month}, division=${division}, gang=${gang}, gangPrefix=${gangPrefix}, useHistory=${useHistory}`);

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year || !month || month < 1 || month > 12) {
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
            const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
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
            const dbOtherIncomesYear = await OtherIncomesService.getIncomesForYear(year, effectiveDivision, gang);
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
                month, year, targetGangCode, effectiveDivision,
                Config.DB_PROFILE, targetGangCode === "ALL" ? effectiveGangPrefix : undefined
            );

            for await (const chunk of progressiveStream) {
                // Accumulate all employees from all phases
                for (const [gangCode, gangEmployees] of chunk.gangs) {
                    // If user selected a specific gang, only process that gang
                    if (targetGangCode !== "ALL" && gangCode.toUpperCase() !== targetGangCode) {
                        continue;
                    }
                    for (const emp of gangEmployees) {
                        if (!processedEmpCodes.has(emp.emp_code)) {
                            processedEmpCodes.add(emp.emp_code);
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

            // Generate Excel
            const excelBuffer = await generateMonthlyTaxExcel(
                { employees, period: { month, year }, total_pph21: totalPph21 },
                year, month, division || 'ALL', gangLabel
            );

            if (!excelBuffer || excelBuffer.length === 0) {
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            return new Response(excelBuffer, {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="PPH21_${division || 'ALL'}_${gangLabel}_${month}_${year}.xlsx"`
                }
            });
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
            use_history: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel/fast
    // FAST tax report using pre-computed history data (no streaming)
    // Reads directly from payroll_history_detail table - MUCH faster than progressive
    // ========================================================
    .get("/monthly/excel/fast", async ({ query, set, currentUser }) => {
        try {
            const startTime = Date.now();
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;
            const useHistory = query.use_history === 'true';

            console.log(`[TaxReport Excel FAST] Request: year=${year}, month=${month}, division=${division}, gang=${gang}, useHistory=${useHistory}`);

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year || !month || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            // Import services
            const { HistoryDatabaseService } = await import("../services/historyDatabaseService");
            const { mapPTKPToTER } = await import("../services/ptkpTaxService");
            const { getCarumanForPph21 } = await import("../services/carumanDefinitions");
            const { EmployeeEstateService } = await import("../services/employeeEstateService");
            const { OtherIncomesService } = await import("../services/otherIncomesService");
            const { ptkpTaxService } = await import("../services/ptkpTaxService");
            const { divisionDefinition } = await import("../services/divisionDefinition");

            const historyDb = HistoryDatabaseService.getInstance();

            // Resolve gang/division
            const targetGangCode = gang && gang.trim() !== '' && gang !== 'ALL' ? gang.trim().toUpperCase() : undefined;

            // Determine effective division for gang resolution
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
            }

            console.log(`[TaxReport Excel FAST] Fetching from history: gang=${targetGangCode || 'ALL'}, division=${effectiveDivision || 'ALL'}`);

            // FAST: Read directly from pre-computed history tables
            const historyData = await historyDb.getHistoricalPayrollDataAsExtractorFormat(
                month, year,
                targetGangCode || "ALL",
                effectiveDivision,
                null, // no specific emp code
                effectiveGangPrefix
            );

            if (!historyData || !historyData.data_rows || historyData.data_rows.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            console.log(`[TaxReport Excel FAST] History query completed in ${Date.now() - startTime}ms, rows: ${historyData.data_rows.length}`);

            // Get PTKP data
            const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
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
                console.warn('[TaxReport Excel FAST] Failed to get jabatan map:', e);
            }

            // Get other incomes for the year
            const dbOtherIncomesYear = await OtherIncomesService.getIncomesForYear(year, effectiveDivision, gang);
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

            // Filter active employees (jumlah_hk > 0 OR Income > 0)
            // This matches the filtering logic in the Wages Report UI (PayrollAggregator).
            const activeEmployees = historyData.data_rows.filter((r: any) => {
                const hk = Number(r.jumlah_hk || r.hk || 0);
                const hasIncome = Number(r.jumlah_upah_kotor || 0) > 0;
                return hk > 0 || hasIncome;
            });

            console.log(`[TaxReport Excel FAST] Active employees (HK > 0 OR Income > 0): ${activeEmployees.length}`);

            // Transform to MonthlyTaxRow format — ALIGNED with progressive endpoint & Excel generator
            const employees: any[] = [];
            let totalPph21 = 0;

            for (let idx = 0; idx < activeEmployees.length; idx++) {
                const row = activeEmployees[idx];
                const empCodeTrimmed = (row.emp_code || '').trim();
                const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
                const kategoriTer = mapPTKPToTER(masterPtkp);

                // [DEBUG] Log first row to help diagnose
                if (idx === 0) {
                    console.log(`[TaxReport FAST DEBUG] First row keys (sample):`, 
                        Object.keys(row).filter(k => k.includes('pph') || k.includes('premi') || k.includes('pot') || k.includes('beras') || k.includes('bruto')));
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
                // Replicates the progressive endpoint logic for consistency
                // ============================================================
                const premiDetail: Record<string, number> = {};
                let consolidatedBrondol = 0;
                let hasBrondolFromDetail = false;

                // SOURCE 1: row.premi (nested object from DataExtractor)
                if (row.premi && typeof row.premi === 'object' && !Array.isArray(row.premi)) {
                    for (const [key, value] of Object.entries(row.premi)) {
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        if (skipKeys.includes(key)) continue;
                        const upperKey = normalizePremiKey(key);
                        if (isBrondolSubKey(key)) { consolidatedBrondol += val; continue; }
                        if (upperKey === 'BRONDOL') { consolidatedBrondol += val; hasBrondolFromDetail = true; continue; }
                        premiDetail[upperKey] = (premiDetail[upperKey] || 0) + val;
                    }
                }

                // SOURCE 2: row.premi_detail (from history database)
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
                        const upperKey = normalizePremiKey(key);
                        if (isBrondolSubKey(key)) { consolidatedBrondol += val; continue; }
                        if (upperKey === 'BRONDOL' && !hasBrondolFromDetail) { consolidatedBrondol += val; hasBrondolFromDetail = true; continue; }
                        if (!premiDetail[upperKey]) { premiDetail[upperKey] = val; }
                    }
                }

                // SOURCE 3: row.premi_* flattened fields (fallback)
                if (Object.keys(premiDetail).length === 0) {
                    for (const [key, value] of Object.entries(row)) {
                        if (!key.startsWith('premi_')) continue;
                        if (key === 'premi_brondol' || key === 'premi_pph' || key === 'premi_detail' || key === 'premi_koreksi') continue;
                        const val = Number(value) || 0;
                        if (val <= 0) continue;
                        const label = normalizePremiKey(key.replace(/^premi_/, ''));
                        if (isBrondolSubKey(label)) { consolidatedBrondol += val; continue; }
                        if (label === 'BRONDOL') { if (!hasBrondolFromDetail) consolidatedBrondol += val; continue; }
                        if (!premiDetail[label]) { premiDetail[label] = val; }
                    }
                }

                // BRONDOL: use consolidated value, fallback to row.premi_brondol
                const brondolFinal = consolidatedBrondol > 0 ? consolidatedBrondol : (row.premi_brondol || 0);
                if (brondolFinal > 0) {
                    premiDetail['BRONDOL'] = brondolFinal;
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
                    
                    // Pendapatan Lainnya
                    thr_amount: empThrAmount,                    // Was: missing
                    exgratia_amount: empKontanAmount,             // Was: missing
                    other_incomes: empOtherIncomes,
                    pendapatan_tidak_tetap_thp: empThrAmount + empKontanAmount + empOtherIncomeAmount,
                    
                    // GL Metadata
                    component_metadata: row.component_metadata || {},
                });
            }

            console.log(`[TaxReport Excel FAST] Transformed ${employees.length} employees, total_pph21=${totalPph21} in ${Date.now() - startTime}ms`);

            const gangLabel = gang || gangPrefix || 'ALL';

            // Generate Excel
            const excelBuffer = await generateMonthlyTaxExcel(
                { employees, period: { month, year }, total_pph21: totalPph21 },
                year, month, division || 'ALL', gangLabel
            );

            if (!excelBuffer || excelBuffer.length === 0) {
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            console.log(`[TaxReport Excel FAST] Total time: ${Date.now() - startTime}ms`);

            return new Response(excelBuffer, {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="PPH21_${division || 'ALL'}_${gangLabel}_${month}_${year}.xlsx"`
                }
            });
        } catch (error: any) {
            console.error("[TaxReport Excel FAST] Error:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate tax report" };
        }
    }, {
        query: t.Object({
            year: t.String(),
            month: t.String(),
            division: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            gangPrefix: t.Optional(t.String()),
            use_history: t.Optional(t.String())
        })
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

            // Generate Excel Buffer
            const excelBuffer = await generateDecemberTaxExcel(data, year, division || 'ALL', gangLabel);

            return new Response(excelBuffer, {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="PAJAK_DESEMBER_${division || 'ALL'}_${gangLabel}_${year}.xlsx"`
                }
            });
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
