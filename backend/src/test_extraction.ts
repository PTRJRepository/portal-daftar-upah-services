import { describe, expect, it } from "bun:test";

// Mock version of the NEW detailed extraction logic
function extractDivisions(payload: any): string[] {
    let rawDivs = payload.divisions ||
        payload.division ||
        payload.divisi ||
        payload.div ||
        payload.DIV ||
        payload.unit ||
        payload.kode_lokasi ||
        payload.location ||
        payload.loc_code ||
        [];

    let divisions: string[] = [];
    if (Array.isArray(rawDivs)) {
        divisions = rawDivs.map(d => String(d));
    } else if (typeof rawDivs === 'string') {
        if (rawDivs.includes(',')) {
            divisions = rawDivs.split(',').map(d => d.trim());
        } else if (rawDivs.trim() !== '') {
            divisions = [rawDivs.trim()];
        }
    }

    // JSON Stringified Array check
    if (divisions.length === 1 && typeof divisions[0] === 'string') {
        const first = divisions[0].trim();
        if (first.startsWith("[") && first.endsWith("]")) {
            try {
                const parsed = JSON.parse(first);
                if (Array.isArray(parsed)) {
                    divisions = parsed.map(d => String(d));
                }
            } catch (e) {
                console.warn("Mock: Failed to parse stringified");
            }
        }
    }

    return divisions;
}

console.log("Testing Extraction Logic:");

const scenarios = [
    { name: "Direct Array", payload: { divisions: ["ARC", "ARA"] }, expected: ["ARC", "ARA"] },
    { name: "Single String", payload: { division: "ARC" }, expected: ["ARC"] },
    { name: "Comma String", payload: { loc_code: "P1A, P1B" }, expected: ["P1A", "P1B"] },
    { name: "JSON String", payload: { unit: "[\"DME\", \"IJL\"]" }, expected: ["DME", "IJL"] },
    { name: "Fallback Key", payload: { kode_lokasi: "WORKSHOP" }, expected: ["WORKSHOP"] },
    { name: "Empty", payload: { random: "stuff" }, expected: [] }
];

let mistakes = 0;
scenarios.forEach(s => {
    const result = extractDivisions(s.payload);
    const resultStr = JSON.stringify(result);
    const expectedStr = JSON.stringify(s.expected);
    const passed = resultStr === expectedStr;
    console.log(`[${passed ? "PASS" : "FAIL"}] ${s.name}:`);
    console.log(`   Input: ${JSON.stringify(s.payload)}`);
    console.log(`   Got: ${resultStr} (Type: ${Array.isArray(result) ? "Array" : typeof result})`);
    console.log(`   Exp: ${expectedStr}`);
    if (!passed) mistakes++;
});

if (mistakes > 0) process.exit(1);
console.log("All tests passed");
