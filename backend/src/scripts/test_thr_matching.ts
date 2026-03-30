import { Database } from "../db/client";
import { gangService } from "../services/gangService";

const db = Database.getExtendedInstance();

function cleanName(name: string): string {
    if (!name) return '';
    // Remove everything inside parentheses
    let cleaned = name.replace(/\([^)]*\)/g, '');
    // Remove non-alphanumeric except spaces, and squish spaces
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    return cleaned;
}

// Simple Levenshtein distance for fuzzy matching
function getLevenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

async function runTest() {
    console.log("=== Testing THR Mapping Fallbacks ===");
    
    // Get all gangs
    const rowGangs = await db.query(`SELECT DISTINCT GangCode FROM HR_GANGLN WHERE Inactive = 0`);
    const gangs = rowGangs.map((g: any) => g.GangCode);
    console.log(`Found ${gangs.length} active gangs`);

    // Fetch all THR data for month 3, year 2026 (or what is applicable)
    // Wait, the user said "month 3 year 2026", let's check which month THR was imported.
    const month = 3;
    const year = 2026;
    
    // User says "di history atau other incomes"
    const dbOtherIncomes = await db.query(`
        SELECT nik, emp_code, emp_name, amount, income_type 
        FROM employee_other_incomes 
        WHERE period_year = @year AND period_month = @month AND income_type = 'THR'
    `, { year, month });

    console.log(`Found ${dbOtherIncomes.length} THR records in DB for ${month}/${year}`);

    // Create maps
    const thrByEmpCode = new Map();
    const thrByNikName = new Map();

    for (const inc of dbOtherIncomes) {
        const empCode = String(inc.emp_code || '').trim().toUpperCase();
        const nik = String(inc.nik || '').trim().toUpperCase();
        const dbName = String(inc.emp_name || '').trim().toUpperCase();
        
        if (empCode) thrByEmpCode.set(empCode, inc);
        if (nik) {
            thrByNikName.set(nik, inc); // Primary by Nik
        }
    }

    let totalMuslims = 0;
    let totalMappedExact = 0;
    let totalMappedFuzzy = 0;
    let totalUnmapped = 0;

    // Get all active employees with religion Muslim
    const employeesData = await db.query(`
        SELECT pm.EmpCode, pm.ActualNIK, pm.EmpName, pm.Religion, gl.GangCode, he.IsInactive
        FROM HR_PAYROLL pm
        JOIN HR_EMPHST he ON pm.EmpCode = he.EmpCode AND he.IsInactive = 0
        LEFT JOIN HR_GANGLN gl ON pm.EmpCode = gl.EmpCode
        WHERE pm.Religion = 'ISLAM' OR pm.Religion = '1'
    `);
    
    console.log(`Found ${employeesData.length} active muslim employees`);

    for (const emp of employeesData) {
        totalMuslims++;
        const empCode = String(emp.EmpCode || '').trim().toUpperCase();
        const nik = String(emp.ActualNIK || '').trim().toUpperCase();
        const empName = String(emp.EmpName || '').trim().toUpperCase();
        const group = emp.GangCode || 'UNKNOWN';

        let mapped = thrByEmpCode.has(empCode);
        let mappedType = mapped ? 'EMP_CODE' : 'UNMAPPED';
        
        if (!mapped && nik) {
            // Priority 2: Try NIK
            if (thrByNikName.has(nik)) {
                mapped = true;
                mappedType = 'NIK';
                totalMappedExact++;
            } else {
                // Priority 3: Fuzzy check
                // Is there any THR record that doesn't map perfectly but has clean name matching?
                const cleanEmp = cleanName(empName);
                
                let bestMatch = null;
                let bestScore = 999;
                
                for (const inc of dbOtherIncomes) {
                    const cleanDb = cleanName(inc.emp_name);
                    const incNik = String(inc.nik || '').trim().toUpperCase();
                    
                    if (incNik === nik || (nik && incNik.includes(nik)) || cleanEmp === cleanDb) {
                        bestMatch = inc;
                        bestScore = 0;
                        break;
                    }
                    
                    // Or if they sound similar
                    const dist = getLevenshteinDistance(cleanEmp, cleanDb);
                    if (dist < 4 && dist < bestScore) {
                        bestScore = dist;
                        bestMatch = inc;
                    }
                }

                if (bestMatch && bestScore < 4) {
                    mapped = true;
                    mappedType = \`FUZZY (dist \${bestScore}, DB: \${bestMatch.emp_name})\`;
                    totalMappedFuzzy++;
                }
            }
        } else if (mapped) {
            totalMappedExact++;
        }

        if (!mapped) {
            console.log(\`UNMAPPED: gang=\${group}, empCode=\${empCode}, NIK=\${nik}, Name=\${empName}\`);
            totalUnmapped++;
        } else if (mappedType.startsWith('FUZZY') || mappedType === 'NIK') {
            console.log(\`RECOVERED (\${mappedType}): gang=\${group}, empCode=\${empCode}, NIK=\${nik}, Name=\${empName}\`);
        }
    }

    console.log("\\n=== SUMMARY ===");
    console.log(\`Total Muslim Employees: \${totalMuslims}\`);
    console.log(\`Exact Matches: \${totalMappedExact}\`);
    console.log(\`Fuzzy Recovered: \${totalMappedFuzzy}\`);
    console.log(\`Unmapped: \${totalUnmapped}\`);
}

runTest().catch(console.error).finally(() => process.exit());
