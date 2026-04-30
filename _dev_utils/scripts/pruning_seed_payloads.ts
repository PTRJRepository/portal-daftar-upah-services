export const PERIOD_MONTH = 4;
export const PERIOD_YEAR = 2026;
export const TARGET_ESTATE = "AB1";
export const TARGET_DIVISION_CODE = "AB1";
export const PRUNING_ADJUSTMENT_NAME = "PREMI PRUNING";
export const PRUNING_AD_CODE = "AL3PM0601";
export const PRUNING_TASK_DESC = "(AL) TUNJANGAN PREMI ((PM) PRUNING)";
export const RAKING_ADJUSTMENT_NAME = "PREMI RAKING";
export const RAKING_AD_CODE = "AL3PM0106";
export const RAKING_TASK_DESC = "(AL) TUNJANGAN PREMI ((PM) WEEDING - CIRCLE RAKING)";

export interface DetailItem {
    Empcode?: string | null;
    Employee?: string | null;
    SubBlok?: string | null;
    Amount?: number | string | null;
}

export interface GangData {
    Gang?: string | null;
    Details?: DetailItem[];
}

export interface EstateData {
    Estate?: string | null;
    Gangs?: GangData[];
}

export interface PruningSeedPayload {
    period_month: number;
    period_year: number;
    emp_code: string;
    nik: string;
    emp_name: string | null;
    gang_code: string;
    division_code: string;
    adjustment_type: "PREMI";
    adjustment_name: string;
    amount: number;
    remarks: string;
    metadata_json: string;
}

export interface BuildPruningSeedPayloadOptions {
    targetEstates: string[];
    importTag?: string;
}

export interface BuildRakingSeedPayloadOptions {
    targetEstates: string[];
    importTag?: string;
    defaultGangCode?: string;
}

interface BuildSubBlockPremiumSeedPayloadOptions {
    targetEstates: string[];
    importTag?: string;
    adjustmentName: string;
    adCode: string;
    taskDesc: string;
    defaultGangCode?: string;
    defaultGangCodeByDivision?: Record<string, string>;
}

type EmployeeAccumulator = {
    emp_code: string;
    emp_name: string | null;
    gang_code: string;
    division_code: string;
    items: { subblok: string; gang_code: string; jumlah: number }[];
};

function normalizeText(value: unknown): string {
    return String(value || "").trim().toUpperCase();
}

function parseJsonValueBlock(raw: string): { parsed: unknown; remaining: string } {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let endIndex = -1;

    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (escapeNext) {
            escapeNext = false;
            continue;
        }
        if (ch === "\\") {
            escapeNext = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;

        if (ch === "[" || ch === "{") depth += 1;
        if (ch === "]" || ch === "}") {
            depth -= 1;
            if (depth === 0) {
                endIndex = i + 1;
                break;
            }
        }
    }

    if (endIndex === -1) {
        throw new Error("Failed to find a complete JSON array/object block.");
    }

    return {
        parsed: JSON.parse(raw.slice(0, endIndex)),
        remaining: raw.slice(endIndex).trim()
    };
}

function toEstateArray(value: unknown): EstateData[] {
    return Array.isArray(value) ? value as EstateData[] : [value as EstateData];
}

export function parseEstateJsonBlocks(rawJson: string): EstateData[] {
    const blocks: EstateData[][] = [];
    let remaining = String(rawJson || "").trim();

    while (remaining.length > 0) {
        try {
            const parsed = JSON.parse(remaining);
            blocks.push(toEstateArray(parsed));
            break;
        } catch {
            const block = parseJsonValueBlock(remaining);
            blocks.push(toEstateArray(block.parsed));
            remaining = block.remaining;
        }
    }

    return blocks.flat();
}

export function buildPruningRemark(totalAmount: number): string {
    return buildPremiumRemarkWithTag(PRUNING_ADJUSTMENT_NAME, PRUNING_AD_CODE, PRUNING_TASK_DESC, totalAmount, "SEED_IMPORT_AB1");
}

export function buildPruningRemarkWithTag(totalAmount: number, importTag: string): string {
    return buildPremiumRemarkWithTag(PRUNING_ADJUSTMENT_NAME, PRUNING_AD_CODE, PRUNING_TASK_DESC, totalAmount, importTag);
}

function buildPremiumRemarkWithTag(adjustmentName: string, adCode: string, taskDesc: string, totalAmount: number, importTag: string): string {
    return `${adjustmentName} | ${adCode} - ${taskDesc} | ${totalAmount} | sync:MANUAL | match:MANUAL | ${importTag}`;
}

export function normalizeSeedDivisionCode(value: unknown): string {
    const normalized = normalizeText(value).replace(/\s+/g, "_");
    const aliases: Record<string, string> = {
        PG1A: "P1A",
        PG1B: "P1B",
        PG2A: "P2A",
        PG2B: "P2B",
        ARB1: "AB1",
        ARB2: "AB2",
        INFRA: "INF",
        AREC: "ARC",
        PLASMA1A: "P1A",
        PLASMA1B: "P1B",
        PLASMA2A: "P2A",
        PLASMA2B: "P2B",
        "1A": "P1A",
        "1B": "P1B",
        "2A": "P2A",
        "2B": "P2B"
    };

    return aliases[normalized] || normalized;
}

function buildSubBlockPremiumSeedPayloads(
    estates: EstateData[],
    options: BuildSubBlockPremiumSeedPayloadOptions
): PruningSeedPayload[] {
    const targetEstateSet = new Set((options.targetEstates || []).map(normalizeSeedDivisionCode).filter(Boolean));
    const importTag = normalizeText(options.importTag || "SEED_IMPORT_PREMI_DETAIL") || "SEED_IMPORT_PREMI_DETAIL";

    if (targetEstateSet.size === 0) {
        throw new Error("Minimal satu target estate/division wajib diisi.");
    }

    const targetEstates = (estates || [])
        .filter((estate) => targetEstateSet.has(normalizeSeedDivisionCode(estate.Estate)));

    if (targetEstates.length === 0) {
        throw new Error(`Target estate ${Array.from(targetEstateSet).join(", ")} tidak ditemukan di JSON ${options.adjustmentName}.`);
    }

    const employeeMap = new Map<string, EmployeeAccumulator>();

    for (const estate of targetEstates) {
        const divisionCode = normalizeSeedDivisionCode(estate.Estate);
        for (const gang of estate.Gangs || []) {
            const fallbackGangCode = normalizeText(options.defaultGangCodeByDivision?.[divisionCode])
                || normalizeText(options.defaultGangCode);
            const gangCode = normalizeText(gang.Gang) || fallbackGangCode;
            if (!gangCode) continue;

            for (const detail of gang.Details || []) {
                const empCode = normalizeText(detail.Empcode);
                const empName = normalizeText(detail.Employee) || null;
                const subblok = normalizeText(detail.SubBlok);
                const amount = Number(detail.Amount);

                if (!empCode || !subblok || !Number.isFinite(amount) || amount <= 0) continue;

                const employeeKey = `${divisionCode}|${empCode}`;
                if (!employeeMap.has(employeeKey)) {
                    employeeMap.set(employeeKey, {
                        emp_code: empCode,
                        emp_name: empName,
                        gang_code: gangCode,
                        division_code: divisionCode,
                        items: []
                    });
                }

                const employee = employeeMap.get(employeeKey)!;
                if (!employee.emp_name && empName) {
                    employee.emp_name = empName;
                }
                employee.items.push({
                    subblok,
                    gang_code: gangCode,
                    jumlah: amount
                });
            }
        }
    }

    return Array.from(employeeMap.values())
        .filter((employee) => employee.items.length > 0)
        .map((employee) => {
            const totalAmount = employee.items.reduce((sum, item) => sum + item.jumlah, 0);
            const metadataJson = {
                input_type: "blok",
                items: employee.items,
                total_amount: totalAmount
            };

            return {
                period_month: PERIOD_MONTH,
                period_year: PERIOD_YEAR,
                emp_code: employee.emp_code,
                nik: employee.emp_code,
                emp_name: employee.emp_name,
                gang_code: employee.gang_code,
                division_code: employee.division_code,
                adjustment_type: "PREMI",
                adjustment_name: options.adjustmentName,
                amount: totalAmount,
                remarks: buildPremiumRemarkWithTag(options.adjustmentName, options.adCode, options.taskDesc, totalAmount, importTag),
                metadata_json: JSON.stringify(metadataJson)
            };
        });
}

export function buildPruningSeedPayloads(
    estates: EstateData[],
    options: BuildPruningSeedPayloadOptions
): PruningSeedPayload[] {
    return buildSubBlockPremiumSeedPayloads(estates, {
        ...options,
        adjustmentName: PRUNING_ADJUSTMENT_NAME,
        adCode: PRUNING_AD_CODE,
        taskDesc: PRUNING_TASK_DESC
    });
}

export function buildAb1PruningSeedPayloads(estates: EstateData[]): PruningSeedPayload[] {
    return buildPruningSeedPayloads(estates, {
        targetEstates: [TARGET_ESTATE],
        importTag: "SEED_IMPORT_AB1"
    });
}

export function buildRakingSeedPayloads(
    estates: EstateData[],
    options: BuildRakingSeedPayloadOptions
): PruningSeedPayload[] {
    return buildSubBlockPremiumSeedPayloads(estates, {
        ...options,
        importTag: options.importTag || "SEED_IMPORT_RAKING",
        adjustmentName: RAKING_ADJUSTMENT_NAME,
        adCode: RAKING_AD_CODE,
        taskDesc: RAKING_TASK_DESC,
        defaultGangCode: options.defaultGangCode ?? "UNKNOWN",
        defaultGangCodeByDivision: {
            P2A: "C3H"
        }
    });
}
