/**
 * Script to normalize division codes in the users database
 * Converts: AREC -> ARC, WORKSHOP AR -> WKS_AR, WORKSHOP PG -> WKS_PG, NURSERY -> NRS, INFRA -> INF
 *
 * Run: bun run src/scripts/normalize_user_divisions.ts
 */

import { Database } from "bun:sqlite";
import { join } from "path";

// Normalization mapping (same as in authService)
function normalizeDivision(div: string): string {
    const strD = String(div).toUpperCase().trim();
    if (strD === 'AREC') return 'ARC';
    if (strD === 'WORKSHOP AR' || strD === 'WORKSHOP_AR' || strD === 'WKS AR') return 'WKS_AR';
    if (strD === 'WORKSHOP PG' || strD === 'WORKSHOP_PG' || strD === 'WKS PG' || strD === 'WORKSHOP P.G' || strD === 'WORKSHOP P.G.') return 'WKS_PG';
    if (strD === 'NURSERY') return 'NRS';
    if (strD === 'INFRA') return 'INF';
    return strD;
}

function normalizeDivisionsArray(divisions: string[]): string[] {
    const normalized = divisions.map(normalizeDivision);
    return [...new Set(normalized)]; // Deduplicate
}

async function main() {
    const dbPath = join(process.cwd(), "data", "users.db");
    console.log(`[NormalizeDivisions] Opening DB: ${dbPath}`);
    const db = new Database(dbPath);

    // Get all users
    const users = db.query("SELECT id, username, divisions FROM users").all() as any[];

    console.log(`[NormalizeDivisions] Found ${users.length} users`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
        const originalDivisions = JSON.parse(user.divisions || "[]") as string[];
        const normalizedDivisions = normalizeDivisionsArray(originalDivisions);

        // Check if any changes needed
        const needsUpdate = originalDivisions.some((d, i) => d !== normalizedDivisions[i]) ||
            originalDivisions.length !== normalizedDivisions.length;

        if (needsUpdate) {
            const newDivisionsJson = JSON.stringify(normalizedDivisions);
            db.run("UPDATE users SET divisions = ? WHERE id = ?", [newDivisionsJson, user.id]);
            console.log(`[NormalizeDivisions] Updated user ${user.username} (id=${user.id})`);
            console.log(`  Before: ${JSON.stringify(originalDivisions)}`);
            console.log(`  After:  ${JSON.stringify(normalizedDivisions)}`);
            updatedCount++;
        } else {
            skippedCount++;
        }
    }

    console.log(`\n[NormalizeDivisions] Summary:`);
    console.log(`  Updated: ${updatedCount} users`);
    console.log(`  Skipped: ${skippedCount} users (already normalized)`);

    db.close();
}

main().catch(console.error);
