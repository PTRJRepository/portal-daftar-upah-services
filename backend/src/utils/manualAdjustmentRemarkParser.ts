export interface ManualAdjustmentAdCodeInference {
    adCode: string | null;
    adCodeDesc: string | null;
}

export interface PipeDelimitedRemarksParts {
    adjustmentName: string | null;
    adCodePart: string | null;
    adCode: string | null;
    adCodeDesc: string | null;
    amount: number | null;
    syncStatus: string | null;
    matchStatus: string | null;
}

function normalizeSpaces(value: unknown): string {
    return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeManualAdjustmentPresetName(value: unknown): string {
    const firstSegment = normalizeSpaces(value).split("|")[0] || "";
    return normalizeSpaces(firstSegment).toUpperCase();
}

function cleanDescription(value: string | undefined): string | null {
    const cleaned = normalizeSpaces(value || "").replace(/\|.*$/, "").trim();
    return cleaned || null;
}

export function inferManualAdjustmentAdCodeFromRemarks(value: unknown): ManualAdjustmentAdCodeInference {
    const remarks = normalizeSpaces(value);
    if (!remarks) return { adCode: null, adCodeDesc: null };

    const adCodeLabelMatch = remarks.match(/AD\s*CODE\s*:\s*([A-Z]{2}\d{3,})\s*(?:-\s*([^|]+))?/i);
    if (adCodeLabelMatch) {
        return {
            adCode: adCodeLabelMatch[1].toUpperCase(),
            adCodeDesc: cleanDescription(adCodeLabelMatch[2])
        };
    }

    const pipeSegments = remarks.split("|").map((segment) => segment.trim());
    for (const segment of pipeSegments.slice(1)) {
        const match = segment.match(/^([A-Z]{2}\d{3,})\s*(?:-\s*(.+))?$/i);
        if (match) {
            return {
                adCode: match[1].toUpperCase(),
                adCodeDesc: cleanDescription(match[2])
            };
        }
    }

    return { adCode: null, adCodeDesc: null };
}

/**
 * Parse pipe-delimited remarks template into structured parts.
 * Format: ADJUSTMENT_NAME | AD_CODE - DESC | AMOUNT | sync:STATUS | match:STATUS
 */
export function parsePipeDelimitedRemarks(value: unknown): PipeDelimitedRemarksParts {
    const remarks = normalizeSpaces(value);
    if (!remarks || !remarks.includes("|")) {
        return {
            adjustmentName: null,
            adCodePart: null,
            adCode: null,
            adCodeDesc: null,
            amount: null,
            syncStatus: null,
            matchStatus: null
        };
    }

    const segments = remarks.split("|").map((s) => s.trim());
    const adjustmentName = segments[0] || null;

    // Parse second segment: AD_CODE - DESC
    let adCodePart: string | null = null;
    let adCode: string | null = null;
    let adCodeDesc: string | null = null;
    if (segments[1]) {
        adCodePart = segments[1];
        const match = segments[1].match(/^([A-Z]{2}\d{3,})\s*(?:-\s*(.+))?$/i);
        if (match) {
            adCode = match[1].toUpperCase();
            adCodeDesc = cleanDescription(match[2]);
        }
    }

    // Parse amount
    let amount: number | null = null;
    if (segments[2]) {
        const amountMatch = segments[2].match(/^(-?\d+(?:\.\d+)?)$/);
        if (amountMatch) {
            amount = parseFloat(amountMatch[1]);
        }
    }

    // Parse sync: and match: statuses
    let syncStatus: string | null = null;
    let matchStatus: string | null = null;
    for (let i = 3; i < segments.length; i++) {
        const seg = segments[i];
        const syncMatch = seg.match(/^sync:\s*(\w+)$/i);
        if (syncMatch) syncStatus = syncMatch[1].toUpperCase();
        const matchMatch = seg.match(/^match:\s*(\w+)$/i);
        if (matchMatch) matchStatus = matchMatch[1].toUpperCase();
    }

    return { adjustmentName, adCodePart, adCode, adCodeDesc, amount, syncStatus, matchStatus };
}
