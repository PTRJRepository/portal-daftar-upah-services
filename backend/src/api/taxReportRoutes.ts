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
import { Database } from "../db/client";

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
    // Uses DataExtractorService (same as Daftar Upah) - always uses current DB
    // ========================================================
    .get("/monthly", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year || !month || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            // Always use current DB (same as Daftar Upah)
            const result = await taxReportService.getMonthlyTaxReport(year, month, division, gang, gangPrefix, false);
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
            gangPrefix: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel
    // Download Monthly PPH21 tax report as Excel with formulas
    // Uses DataExtractorService (same as Daftar Upah) - always uses current DB
    // ========================================================
    .get("/monthly/excel", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            console.log(`[TaxReport Excel] Request: year=${year}, month=${month}, division=${division}, gang=${gang}`);

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year || !month || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            // Always use current DB (same as Daftar Upah)
            const data = await taxReportService.getMonthlyTaxReport(year, month, division, gang, gangPrefix, false);

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

            const filename = `PPH21_${division || 'ALL'}_${gangLabel}_${month}_${year}.xlsx`;
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
            gangPrefix: t.Optional(t.String())
        })
    })

    // ========================================================
    // GET /tax-report/monthly/excel/progressive
    // Download Monthly PPH21 using progressive extraction (avoids timeout)
    // Uses dataExtractorService.extractPayrollDataProgressive() (same as Daftar Upah) - always uses current DB
    // ========================================================
    .get("/monthly/excel/progressive", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;

            console.log(`[TaxReport Excel Progressive] Request: year=${year}, month=${month}, division=${division}, gang=${gang}, gangPrefix=${gangPrefix}`);

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

            // Generate Excel
            const excelBuffer = await generateMonthlyTaxExcel(
                { employees, period: { month, year }, total_pph21: totalPph21 },
                year, month, division || 'ALL', gangLabel
            );

            if (!excelBuffer || excelBuffer.length === 0) {
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            const filename = `PPH21_${division || 'ALL'}_${gangLabel}_${month}_${year}.xlsx`;
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
            gangPrefix: t.Optional(t.String())
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
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;
            const gangPrefix = query.gangPrefix as string || undefined;
            const useHistoryDb = query.use_history === '1' || query.use_history === 'true';

            console.log(`[TaxReport Excel FAST] Request: year=${year}, month=${month}, division=${division}, gang=${gang}, useHistory=${useHistoryDb}`);

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year || !month || month < 1 || month > 12) {
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

            console.log(`[TaxReport Excel FAST] Using DataExtractorService (same as Daftar Upah): gang=${targetGangCode || 'ALL'}, division=${division || 'ALL'}, prefix=${gangPrefix || 'none'}, useHistory=${useHistoryDb}`);

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
                false  // skipHarvest [FIXED 2026-04-08]: Must match UI logic
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
                meta: { execution_time_ms: 0, row_count: extractorResult.data_rows.length, is_history_snapshot: false }
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
                    pot_pph21: Number(row.pot_pph21) || 0,
                    
                    // Pendapatan Lainnya
                    thr_amount: empThrAmount,                    // Was: missing
                    exgratia_amount: empKontanAmount,             // Was: missing
                    other_incomes: empOtherIncomes,
                    pendapatan_tidak_tetap_thp: empThrAmount + empKontanAmount + empOtherIncomeAmount,
                    
                    // GL Metadata
                    component_metadata: row.component_metadata || {},
                });
                } catch (empError: any) {
                    const empCode = activeEmployees[idx]?.emp_code || 'unknown';
                    console.error(`[TaxReport Excel FAST] Error transforming employee ${empCode} (index ${idx}):`, empError?.message || empError);
                    // Continue with next employee instead of failing completely
                }
            }

            console.log(`[TaxReport Excel FAST] Transformed ${employees.length} employees, total_pph21=${totalPph21} in ${Date.now() - startTime}ms`);

            const gangLabel = gang || gangPrefix || 'ALL';

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

                const filename = `PPH21_${division || 'ALL'}_${gangLabel}_${month}_${year}.xlsx`;
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
    // POST /tax-report/monthly/excel/dom
    // Generates Tax Report directly from frontend DOM details
    // [REVISED] Use DOM data directly from UI PAJAK section
    // Only fetch premi_detail and THR from backend (not in UI table)
    // ========================================================
    .post("/monthly/excel/dom", async ({ body, set }) => {
        try {
            const { year, month, division, gang, gangPrefix, employees, premiKeys } = body as any;

            if (!year || !month || !employees || !Array.isArray(employees)) {
                set.status = 400;
                return { error: "Invalid payload: year, month, and employees are required" };
            }

            console.log(`[TaxReport Excel DOM] Request: year=${year}, month=${month}, division=${division}, gang=${gang}, employees=${employees.length}`);
            console.log(`[TaxReport Excel DOM] premiKeys from frontend: ${premiKeys ? (Array.isArray(premiKeys) ? premiKeys.join(', ') : 'NOT ARRAY') : 'NULL/UNDEFINED'}`);
            
            // Safe debug log for first employee
            if (employees.length > 0) {
                const firstEmp = employees[0];
                console.log(`[TaxReport Excel DOM] First employee summary:`, {
                    emp_name: (firstEmp.emp_name || '').substring(0, 20),
                    emp_code: firstEmp.emp_code,
                    premi_detail_keys: firstEmp.premi_detail ? Object.keys(firstEmp.premi_detail) : 'NONE',
                    total_premi: firstEmp.total_premi
                });
            }
            
            // [DEBUG] Log first employee's raw DOM data to see actual field names
            if (employees.length > 0) {
                const emp = employees[0];
                console.log(`[TaxReport Excel DOM] First employee RAW DOM data:`, {
                    emp_name: emp.emp_name,
                    emp_code: emp.emp_code,
                    // PAJAK section fields
                    ptkp: emp.ptkp,
                    kategori_ter: emp.kategori_ter,
                    gaji_pokok_ideal: emp.gaji_pokok_ideal,
                    gaji_pokok_dibayarkan: emp.gaji_pokok_dibayarkan,
                    koreksi_hk: emp.koreksi_hk,
                    astek_084: emp.astek_084,
                    pot_bpjs_kesehatan_majikan: emp.pot_bpjs_kesehatan_majikan,
                    beras_jumlah: emp.beras_jumlah,
                    jabatan_jumlah: emp.jabatan_jumlah,
                    masa_kerja_jumlah: emp.masa_kerja_jumlah,
                    lembur_jumlah: emp.lembur_jumlah,
                    total_premi: emp.total_premi,
                    pot_koreksi: emp.pot_koreksi,
                    penghasilan_bruto: emp.penghasilan_bruto,
                    tarif_pajak_ter: emp.tarif_pajak_ter,
                    pph21_ter: emp.pph21_ter,
                    // POTONGAN UPAH BERSIH section fields
                    pot_pph21: emp.pot_pph21,
                    pot_spsi: emp.pot_spsi,
                    pot_bpjs_pekerja_total: emp.pot_bpjs_pekerja_total,
                    potongan_upah_bersih: emp.potongan_upah_bersih,
                    total_potongan: emp.total_potongan,
                    // Check ALL keys that contain 'pph', 'pot', 'pajak'
                    all_keys: Object.keys(emp).filter(k => 
                        k.toLowerCase().includes('pph') || 
                        k.toLowerCase().includes('pot') ||
                        k.toLowerCase().includes('pajak') ||
                        k.toLowerCase().includes('gaji')
                    )
                });
            }
            
            // [REVISED] Use DOM data directly - map UI field names to Excel field names
            // DOM data is the single source of truth since it's what the user sees in the UI
            const empCodes = employees.map((emp: any) => (emp.emp_code || emp.ID_KARYAWAN || '').trim().toUpperCase()).filter(Boolean);

            // [ENHANCED] Only fetch backend data for fields NOT in DOM (premi_detail breakdown, alamat)
            // DO NOT overwrite THR, kontanan, premi totals that are already in DOM
            if (empCodes.length > 0) {
                try {
                    const { taxReportService } = await import("../services/taxReportService");

                    console.log(`[TaxReport Excel DOM] Fetching complete data from backend API for ${empCodes.length} employees...`);
                    const completeData = await taxReportService.getMonthlyTaxReport(
                        parseInt(year),
                        parseInt(month),
                        division || 'ALL',
                        gang || 'ALL',
                        undefined,
                        true
                    );

                    if (completeData && completeData.employees && completeData.employees.length > 0) {
                        console.log(`[TaxReport Excel DOM] ✅ Got ${completeData.employees.length} employees from backend API`);

                        // Create map: emp_code -> backend data
                        const backendMap = new Map<string, any>();
                        completeData.employees.forEach((emp: any) => {
                            const empCode = (emp.emp_code || '').trim().toUpperCase();
                            if (empCode) {
                                backendMap.set(empCode, emp);
                            }
                        });

                        // [ENHANCED MERGE] Add fields needed for DOM export that DOM doesn't have
                        // DOM has: pendapatan_thr, pendapatan_bonus, gaji_pokok_ideal, gaji_pokok_aktual
                        // Excel needs: thr_amount, exgratia_amount, pot_alpa_cth
                        let mergeCount = 0;
                        employees.forEach((domEmp: any) => {
                            const empCode = (domEmp.emp_code || domEmp.ID_KARYAWAN || '').trim().toUpperCase();
                            const backendData = backendMap.get(empCode);

                            if (backendData) {
                                mergeCount++;

                                // [1] PREMI DETAIL - individual premi breakdown (NOT in DOM, must fetch from backend)
                                // This is used for the detailed premi columns in Excel
                                if (!domEmp.premi_detail || Object.keys(domEmp.premi_detail).length === 0) {
                                    domEmp.premi_detail = backendData.premi_detail || {};
                                }

                                // [2] ALAMAT - not shown in DOM table
                                if (!domEmp.alamat && !domEmp.res_address && backendData.alamat) {
                                    domEmp.alamat = backendData.alamat;
                                    domEmp.res_address = backendData.alamat;
                                }

                                // [3] Component metadata for GL accounts
                                if (!domEmp.component_metadata && backendData.component_metadata) {
                                    domEmp.component_metadata = backendData.component_metadata;
                                }

                                // [4] THR amount - from OtherIncomes (THR type)
                                // DOM has pendapatan_thr but Excel expects thr_amount
                                if ((!domEmp.thr_amount || domEmp.thr_amount === 0) && backendData.thr_amount > 0) {
                                    domEmp.thr_amount = backendData.thr_amount;
                                }

                                // [5] KONTANAN/Exgratia amount - from OtherIncomes (KONTAN/KONTANAN type)
                                // DOM has pendapatan_bonus but Excel expects exgratia_amount
                                if ((!domEmp.exgratia_amount || domEmp.exgratia_amount === 0) && backendData.exgratia_amount > 0) {
                                    domEmp.exgratia_amount = backendData.exgratia_amount;
                                }

                                // [6] Pot Alpa & CTH - calculated from gaji difference
                                // Only set if not already in DOM and there's a valid difference
                                if (!domEmp.pot_alpa_cth && !domEmp.pot_alpa) {
                                    const domGajiIdeal = Number(domEmp.gaji_pokok_ideal || 0);
                                    const domGajiAktual = Number(domEmp.gaji_pokok_aktual || 0);
                                    if (domGajiIdeal > 0 && domGajiAktual > 0 && domGajiIdeal > domGajiAktual) {
                                        domEmp.pot_alpa_cth = -(domGajiIdeal - domGajiAktual);
                                    }
                                }
                            }
                        });

                        console.log(`[TaxReport Excel DOM] ✅ Merged ${mergeCount} employees with backend data (premi_detail, alamat, thr_amount, exgratia_amount, pot_alpa_cth)`);

                        // [DEBUG] Log first employee after merge to verify
                        if (employees.length > 0) {
                            const first = employees[0];
                            const empCode = (first.emp_code || first.ID_KARYAWAN || '').trim().toUpperCase();
                            const backendFirst = backendMap.get(empCode);
                            console.log(`[TaxReport Excel DOM] AFTER MERGE - First employee (${(first.emp_name || '').trim()}):`, {
                                emp_code: first.emp_code,
                                // DOM fields
                                dom_thr_amount: first.thr_amount,
                                dom_exgratia_amount: first.exgratia_amount,
                                dom_pendapatan_thr: first.pendapatan_thr,
                                dom_pendapatan_bonus: first.pendapatan_bonus,
                                dom_total_premi: first.total_premi,
                                dom_gaji_pokok_ideal: first.gaji_pokok_ideal,
                                dom_gaji_pokok_aktual: first.gaji_pokok_aktual,
                                dom_pot_alpa_cth: first.pot_alpa_cth,
                                // Backend fields (before merge)
                                backend_thr_amount: backendFirst?.thr_amount,
                                backend_exgratia_amount: backendFirst?.exgratia_amount,
                                backend_total_premi: backendFirst?.total_premi,
                                backend_premi_detail_keys: backendFirst?.premi_detail ? Object.keys(backendFirst.premi_detail) : [],
                                backend_premi_detail_sample: backendFirst?.premi_detail ? Object.fromEntries(Object.entries(backendFirst.premi_detail).slice(0, 5)) : {},
                                // After merge
                                after_merge_thr_amount: first.thr_amount,
                                after_merge_exgratia_amount: first.exgratia_amount,
                                after_merge_pot_alpa_cth: first.pot_alpa_cth,
                                after_merge_premi_detail_keys: first.premi_detail ? Object.keys(first.premi_detail) : []
                            });
                        }
                    } else {
                        console.log(`[TaxReport Excel DOM] ⚠️ Backend API returned NO employees`);
                    }
                } catch (fetchError: any) {
                    console.error(`[TaxReport Excel DOM] ❌ Failed to fetch backend data:`, fetchError.message);
                    // Continue with DOM data only
                }
            }
            
            // [REMOVED] No longer fetching THR/kontanan from DB - using DOM data directly
            // DOM already has the correct THR and kontanan values from the UI
            console.log(`[TaxReport Excel DOM] Using DOM data for THR, kontanan, and all displayed values`);

            let totalPph21 = 0;
            employees.forEach((emp: any) => {
                 totalPph21 += (Number(emp.potongan_pph21) || Number(emp.pot_pph21) || Number(emp.pph21_ter) || 0);
            });

            const gangLabel = gang || gangPrefix || 'ALL';

            // Generate Excel Buffer (pass premiKeys for dynamic column headers)
            console.log(`[TaxReport Excel DOM] Calling generateMonthlyTaxExcel with ${employees.length} employees...`);
            let excelBuffer: Buffer | undefined;
            
            try {
                excelBuffer = await generateMonthlyTaxExcel(
                    { employees, period: { month: parseInt(month), year: parseInt(year) }, total_pph21: totalPph21 },
                    parseInt(year),
                    parseInt(month),
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

            const filename = `PPH21_DOM_${division || 'ALL'}_${gangLabel}_${month}_${year}.xlsx`;
            console.log(`[TaxReport Excel DOM] Returning file: ${filename} (${excelBuffer.length} bytes)`);

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

            // Generate Excel Buffer
            const excelBuffer = await generateDecemberTaxExcel(data, year, division || 'ALL', gangLabel);

            const filename = `PAJAK_DESEMBER_${division || 'ALL'}_${gangLabel}_${year}.xlsx`;
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
    // POST /tax-report/monthly/excel/dom
    // Generate Monthly PPH21 Excel using data from the frontend DOM
    // ========================================================
    .post("/monthly/excel/dom", async ({ body, set }) => {
        try {
            const { year, month, division, gang, gangPrefix, employees, premiKeys } = body as any;

            console.log(`[TaxReport Excel DOM] Request: year=${year}, month=${month}, division=${division}, gang=${gang}, employees=${employees?.length}`);

            if (!year || !month || !employees || !Array.isArray(employees)) {
                set.status = 400;
                return { error: "Invalid parameters: year, month, and employees array are required" };
            }

            const y = parseInt(year);
            const m = parseInt(month);
            const gangLabel = gang || gangPrefix || 'ALL';

            // Calculate total_pph21 from whatever the DOM sent
            let total_pph21 = 0;
            employees.forEach((emp: any) => {
                 total_pph21 += Number(emp.potongan_pph21 || emp.pot_pph21 || emp.pph21_ter || 0);
            });

            const data = {
                employees: employees,
                period: { month: m, year: y },
                total_pph21: total_pph21
            };

            const excelBuffer = await generateMonthlyTaxExcel(data, y, m, division || 'ALL', gangLabel, premiKeys);

            if (!excelBuffer || excelBuffer.length === 0) {
                set.status = 500;
                return { error: "Failed to generate Excel buffer" };
            }

            const filename = `PPH21_DOM_${division || 'ALL'}_${gangLabel}_${m}_${y}.xlsx`;
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;
            
            return excelBuffer;
        } catch (error: any) {
            console.error("[TaxReport] Error generating DOM Excel report:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate DOM Excel report" };
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
