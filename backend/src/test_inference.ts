import { describe, expect, it } from "bun:test";

// Mock implementation of the inference logic from AuthService.ts
function inferDivisions(targetStr: string): string[] {
    const divisions: string[] = [];
    const upperTarget = targetStr.toUpperCase();

    if (upperTarget.includes("INFRA") || upperTarget.includes("INF")) {
        divisions.push("INFRA");
    }
    if (upperTarget.includes("NURSERY") || upperTarget.includes("BIBITAN") || upperTarget.includes("NRS")) {
        divisions.push("NURSERY");
    }
    if (upperTarget.includes("WORKSHOP") || upperTarget.includes("BENGKEL") || upperTarget.includes("WKS")) {
        divisions.push("WORKSHOP");
    }

    const patterns = [
        /\b(PGE?\s*\d+[A-Z]?)\b/i,
        /\b(DIV\s*\d+[A-Z]?)\b/i,
        /\b(PG\d+[A-Z]?)\b/i,
        /\b(ARB?\s*\d+[A-Z]?)\b/i,
        /\b([A-Z]{2,3}\d+[A-Z]?)\b/i
    ];

    for (const pat of patterns) {
        const match = targetStr.match(pat);
        if (match) {
            let inferred = match[1].toUpperCase().replace(/\s+/g, "");

            if (/^PG\d[A-Z]$/.test(inferred)) {
                inferred = inferred.replace("PG", "P");
            }
            if (inferred.startsWith("ARB")) {
                inferred = inferred.replace("ARB", "AB");
            }

            divisions.push(inferred);
        }
    }

    return [...new Set(divisions)];
}

console.log("Testing Division Inference:");
const testCases = [
    "User ARC",
    "User ARA",
    "User DME",
    "User IJL",
    "User PG1A",
    "User P1A",
    "User with nothing"
];

testCases.forEach(input => {
    console.log(`'${input}' ->`, inferDivisions(input));
});
