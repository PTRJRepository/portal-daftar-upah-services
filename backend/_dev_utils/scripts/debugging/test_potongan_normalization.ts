// Test potongan name normalization

function normalizePotonganName(docDesc: string, taskDesc?: string | null, taskCode?: string | null): { key: string; title: string } {
    const upper = docDesc.toUpperCase().trim();
    const upperTask = taskDesc ? taskDesc.toUpperCase().trim() : "";
    const upperCode = taskCode ? taskCode.toUpperCase().trim() : "";
    const cleanTitle = docDesc.trim();

    // [RULE 1.5] Specific for Potongan PPh21
    if (upperCode.includes("DEPH21") || upperTask.includes("POTONGAN PPH21") || upper.includes("POTONGAN PPH21") || (upper.includes("PPH21") && upper.includes("POTONGAN"))) {
        return { key: "PPH21", title: "Potongan PPh21" };
    }

    // [RULE 2] Static: PPH21
    if (upper.includes("PPH") || upper.includes("PAJAK")) {
        if (upper.includes("PREMI") || upperTask.includes("PREMI")) {
            const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
            return { key, title: cleanTitle };
        }
        return { key: "PPH21", title: "PPH21" };
    }

    const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
    return { key, title: cleanTitle };
}

// Test cases from actual database
const testCases = [
    "Potongan Pph21",
    "Potongan PPH21",
    "POTONGAN PPH21",
    "POTONGAN PPH 21",        // With space
    "POTONGAN PAJAK PPH 21",
    "PPH21",
    "PPh 21",
];

console.log("Testing potongan name normalization:\n");
for (const docDesc of testCases) {
    const result = normalizePotonganName(docDesc);
    console.log(`"${docDesc}" → key="${result.key}", title="${result.title}"`);
}
