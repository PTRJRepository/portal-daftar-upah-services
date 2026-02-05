
// Mock logic from updated DataExtractorService

function normalizePotonganName(docDesc: string, taskDesc?: string | null): { key: string; title: string } {
    const upper = docDesc.toUpperCase().trim();
    const upperTask = taskDesc ? taskDesc.toUpperCase().trim() : "";
    const cleanTitle = docDesc.trim();

    // [RULE 1] Handle KOREKSI variations separately
    if (upper.includes("KOREKSI")) {
        const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        return { key, title: cleanTitle };
    }

    // [RULE 2] Static: PPH (but NOT if it contains PREMI - handled earlier)
    if (upper.includes("PPH") || upper.includes("PAJAK")) {
        // Double check: if contains PREMI in either DocDesc or TaskDesc, don't treat as PPH21
        if (upper.includes("PREMI") || upperTask.includes("PREMI")) {
            const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
            return { key, title: cleanTitle };
        }
        return { key: "PPH21", title: "PPH21" };
    }

    // [RULE 3] Static: SPSI
    if (upper.includes("SPSI")) {
        return { key: "SPSI", title: "SPSI" };
    }

    // [RULE 4] Dynamic POTONGAN X patterns
    if (upper.startsWith("POTONGAN") || upper.startsWith("POT ") || upper.startsWith("POT_")) {
        const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        return { key, title: cleanTitle };
    }

    // [RULE 5] Default
    const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
    return { key, title: cleanTitle };
}

const testCases = [
    { doc: "PPH PASAL 21", task: null, expected: "PPH21" },
    { doc: "POTONGAN PPH", task: null, expected: "PPH21" },
    { doc: "PREMI PPH", task: null, expected: "PREMI_PPH" }, // Should NOT be PPH21
    { doc: "POTONGAN PPH", task: "POTONGAN PREMI", expected: "POTONGAN_PPH" }, // Should NOT be PPH21 due to TaskDesc
    { doc: "PPH 21", task: "(DE) POTONGAN PREMI", expected: "PPH_21" }, // Should NOT be PPH21 due to TaskDesc
    { doc: "PAJAK PPH", task: null, expected: "PPH21" },
    { doc: "KOREKSI PPH", task: null, expected: "KOREKSI_PPH" }
];

console.log("Testing Updated Normalization Logic:");
let allPassed = true;
testCases.forEach(c => {
    const result = normalizePotonganName(c.doc, c.task);
    const passed = result.key === c.expected;
    console.log(`Input: Doc="${c.doc}", Task="${c.task}" -> Key: "${result.key}" | Expected: "${c.expected}" | ${passed ? "PASS" : "FAIL"}`);
    if (!passed) allPassed = false;
});

if (allPassed) {
    console.log("\nAll tests passed!");
} else {
    console.error("\nSome tests failed.");
    process.exit(1);
}
