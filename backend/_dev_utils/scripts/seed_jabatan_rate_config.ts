import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { Config } from "../../src/config";
import { Database } from "../../src/db/client";
import { dataExtractorService } from "../../src/services/dataExtractorService";
import { divisionConfigService } from "../../src/services/config/DivisionConfigService";

type PayrollRateRow = {
    jabatan: string;
    effective_rate: number | string | null;
    emp_code: string;
};

type RoleRateEntry = {
    jabatan: string;
    rate_tunjangan_jabatan: number;
    sample_count: number;
    support_pct: number;
    candidate_rates: Array<{
        rate: number;
        count: number;
        pct: number;
    }>;
};

type SourceMode = "history" | "live_extractor";
type DivisionFailure = { division: string; error: string };

const OUTPUT_PATH = resolve(import.meta.dir, "../../data/rate_tunjagan_jabatan.json");
const MONTH_NAMES = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
];

function parseNumberArg(name: string, fallback: number): number {
    const keyEq = `--${name}=`;
    const fromEq = process.argv.find((arg) => arg.startsWith(keyEq));
    if (fromEq) {
        const parsed = Number(fromEq.slice(keyEq.length));
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    const index = process.argv.findIndex((arg) => arg === `--${name}`);
    if (index >= 0 && process.argv[index + 1]) {
        const parsed = Number(process.argv[index + 1]);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
}

function normalizeJabatan(value: string): string {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ");
}

function normalizeRoleGroup(jabatan: string): string {
    const cleaned = normalizeJabatan(jabatan)
        .toLowerCase()
        .replace(/^\([^)]*\)\s*/g, "");

    if (!cleaned) return "";
    if (cleaned.includes("kerani")) return "kerani";
    if (cleaned.includes("mandor")) return "mandor";
    if (cleaned.includes("operator")) return "operator";
    if (cleaned.includes("karyawan")) return "karyawan";
    if (cleaned.includes("helper")) return "helper";
    if (cleaned.includes("driver")) return "driver";
    if (cleaned.includes("bunch counter")) return "bunch counter";
    return cleaned;
}

function toRoundedRate(value: unknown): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
    }
    return Math.round(numeric * 100) / 100;
}

async function generateJabatanRateConfig(month: number, year: number): Promise<void> {
    if (month < 1 || month > 12) {
        throw new Error(`Month invalid: ${month}. Gunakan 1-12.`);
    }

    const db = Database.getExtendedInstance();

    const historyRows = await db.query<PayrollRateRow>(
        `
        SELECT
            LTRIM(RTRIM(COALESCE(
                NULLIF(ee.jabatan, ''),
                NULLIF(d.jabatan, ''),
                NULLIF(he.jabatan, ''),
                NULLIF(he.position, ''),
                NULLIF(d.task_desc, ''),
                ''
            ))) AS jabatan,
            CAST(
                COALESCE(
                    NULLIF(CAST(COALESCE(d.jabatan_rate, 0) AS DECIMAL(18, 4)), 0),
                    CASE
                        WHEN COALESCE(NULLIF(CAST(COALESCE(d.hari_kerja, 0) AS DECIMAL(18, 4)), 0), NULLIF(CAST(COALESCE(d.jumlah_hk, 0) AS DECIMAL(18, 4)), 0)) > 0
                             AND CAST(COALESCE(d.jabatan_jumlah, 0) AS DECIMAL(18, 4)) > 0
                        THEN CAST(COALESCE(d.jabatan_jumlah, 0) AS DECIMAL(18, 4))
                             / COALESCE(NULLIF(CAST(COALESCE(d.hari_kerja, 0) AS DECIMAL(18, 4)), 0), NULLIF(CAST(COALESCE(d.jumlah_hk, 0) AS DECIMAL(18, 4)), 0))
                        ELSE NULL
                    END
                ) AS DECIMAL(18, 4)
            ) AS effective_rate,
            RTRIM(LTRIM(COALESCE(d.emp_code, ''))) AS emp_code
        FROM dbo.payroll_history_detail d
        INNER JOIN dbo.payroll_history_header h ON h.id = d.master_id
        OUTER APPLY (
            SELECT TOP 1 RTRIM(COALESCE(es.jabatan, '')) AS jabatan
            FROM dbo.employee_estate es
            WHERE RTRIM(COALESCE(es.empcode, '')) IN (
                RTRIM(COALESCE(d.emp_code, '')),
                RTRIM(COALESCE(d.nik, ''))
            )
              AND RTRIM(COALESCE(es.jabatan, '')) <> ''
            ORDER BY
                CASE
                    WHEN RTRIM(COALESCE(es.empcode, '')) = RTRIM(COALESCE(d.emp_code, '')) THEN 0
                    ELSE 1
                END,
                es.updated_at DESC
        ) ee
        LEFT JOIN dbo.history_hr_employee he
            ON RTRIM(COALESCE(he.emp_code, '')) = RTRIM(COALESCE(d.emp_code, ''))
           AND he.period_month = h.period_month
           AND he.period_year = h.period_year
        WHERE h.period_month = ?
          AND h.period_year = ?
          AND (COALESCE(d.jabatan_rate, 0) > 0 OR COALESCE(d.jabatan_jumlah, 0) > 0)
        `,
        [month, year],
        Config.DB_SEEDER_TIMEOUT
    );

    let rows: PayrollRateRow[] = [...historyRows];
    let sourceMode: SourceMode = "history";
    const divisionFailures: DivisionFailure[] = [];

    if (rows.length === 0) {
        sourceMode = "live_extractor";
        console.warn("[Seeder] History rows kosong, fallback ke live extractor per divisi...");

        const divisionCodes = divisionConfigService
            .getAllDivisionCodes()
            .filter((code) => !divisionConfigService.isVirtualDivision(code));

        for (const divisionCode of divisionCodes) {
            try {
                const result = await dataExtractorService.extractPayrollData(
                    month,
                    year,
                    "ALL",
                    divisionCode,
                    null,
                    Config.DB_PROFILE,
                    false,
                    false,
                    undefined,
                    true,
                    true
                );

                const mappedRows: PayrollRateRow[] = (result.data_rows || []).map((row: any) => {
                    const jabatanRate = Number(row?.jabatan_rate) || 0;
                    const jabatanJumlah = Number(row?.jabatan_jumlah) || 0;
                    const attendance = Number(row?.hari_kerja || row?.jumlah_hk || row?.kehadiran || 0);
                    const effectiveRate = jabatanRate > 0
                        ? jabatanRate
                        : (attendance > 0 && jabatanJumlah > 0 ? (jabatanJumlah / attendance) : null);

                    return {
                        jabatan: String(row?.jabatan || row?.jabatan_estate || "").trim(),
                        effective_rate: effectiveRate,
                        emp_code: String(row?.emp_code || "").trim()
                    };
                });

                rows.push(...mappedRows);
                console.log(`[Seeder] ${divisionCode}: ${mappedRows.length} rows`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                divisionFailures.push({ division: divisionCode, error: message });
                console.error(`[Seeder] ${divisionCode} gagal: ${message}`);
            }
        }
    }

    const roleBuckets = new Map<string, { jabatan: string; samples: number; rates: Map<number, number> }>();
    let validRows = 0;

    for (const row of rows) {
        const jabatan = normalizeJabatan(row.jabatan);
        const rate = toRoundedRate(row.effective_rate);
        if (!jabatan || rate === null) {
            continue;
        }

        validRows += 1;
        const key = jabatan.toUpperCase();
        if (!roleBuckets.has(key)) {
            roleBuckets.set(key, { jabatan, samples: 0, rates: new Map<number, number>() });
        }

        const bucket = roleBuckets.get(key)!;
        bucket.samples += 1;
        bucket.rates.set(rate, (bucket.rates.get(rate) || 0) + 1);
    }

    const roles: RoleRateEntry[] = [...roleBuckets.values()]
        .map((bucket) => {
            const candidateRates = [...bucket.rates.entries()]
                .map(([rate, count]) => ({
                    rate,
                    count,
                    pct: Number(((count / bucket.samples) * 100).toFixed(2))
                }))
                .sort((a, b) => (b.count - a.count) || (b.rate - a.rate));

            const selected = candidateRates[0];
            return {
                jabatan: bucket.jabatan,
                rate_tunjangan_jabatan: selected.rate,
                sample_count: bucket.samples,
                support_pct: selected.pct,
                candidate_rates: candidateRates
            };
        })
        .sort((a, b) => a.jabatan.localeCompare(b.jabatan, "id", { sensitivity: "base" }));

    const groupedBuckets = new Map<string, { role_group: string; samples: number; rates: Map<number, number> }>();
    for (const role of roles) {
        const roleGroup = normalizeRoleGroup(role.jabatan);
        if (!roleGroup) continue;
        if (!groupedBuckets.has(roleGroup)) {
            groupedBuckets.set(roleGroup, { role_group: roleGroup, samples: 0, rates: new Map<number, number>() });
        }
        const bucket = groupedBuckets.get(roleGroup)!;
        for (const candidate of role.candidate_rates) {
            bucket.samples += candidate.count;
            bucket.rates.set(candidate.rate, (bucket.rates.get(candidate.rate) || 0) + candidate.count);
        }
    }

    const role_groups = [...groupedBuckets.values()]
        .map((bucket) => {
            const candidateRates = [...bucket.rates.entries()]
                .map(([rate, count]) => ({
                    rate,
                    count,
                    pct: Number(((count / bucket.samples) * 100).toFixed(2))
                }))
                .sort((a, b) => (b.count - a.count) || (b.rate - a.rate));
            const selected = candidateRates[0];
            return {
                role_group: bucket.role_group,
                rate_tunjangan_jabatan: selected.rate,
                sample_count: bucket.samples,
                support_pct: selected.pct,
                candidate_rates: candidateRates
            };
        })
        .sort((a, b) => a.role_group.localeCompare(b.role_group, "id", { sensitivity: "base" }));

    const output = {
        period: {
            month,
            year,
            label: `${MONTH_NAMES[month - 1]} ${year}`
        },
        generated_at: new Date().toISOString(),
        source: {
            mode: sourceMode,
            database: sourceMode === "history" ? Config.DB_EXTEND_DATABASE : Config.DEFAULT_DATABASE,
            table: sourceMode === "history"
                ? "dbo.payroll_history_header + dbo.payroll_history_detail"
                : "live extraction via DataExtractorService",
            rule: "effective_rate = jabatan_rate (jika > 0), fallback jabatan_jumlah / kehadiran(hari_kerja|jumlah_hk)"
        },
        summary: {
            rows_scanned: rows.length,
            valid_rows: validRows,
            total_roles: roles.length,
            total_role_groups: role_groups.length,
            history_rows: historyRows.length,
            division_failures: divisionFailures.length
        },
        division_failures: divisionFailures,
        roles,
        role_groups,
        rate_by_role_group: Object.fromEntries(
            role_groups.map((entry) => [entry.role_group, entry.rate_tunjangan_jabatan])
        ),
        rate_by_jabatan: Object.fromEntries(
            roles.map((entry) => [entry.jabatan, entry.rate_tunjangan_jabatan])
        )
    };

    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

    console.log(`✅ File generated: ${OUTPUT_PATH}`);
    console.log(`📊 Total role: ${roles.length}, valid rows: ${validRows}, scanned rows: ${rows.length}`);
}

async function main() {
    const currentYear = new Date().getFullYear();
    const month = parseNumberArg("month", 3);
    const year = parseNumberArg("year", currentYear);

    console.log(`[Seeder] Generate jabatan rate config untuk ${MONTH_NAMES[month - 1]} ${year}`);
    await generateJabatanRateConfig(month, year);
}

main().catch((error) => {
    console.error("❌ Seeder gagal:", error);
    process.exit(1);
});
