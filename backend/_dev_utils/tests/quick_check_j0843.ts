const DB_API_URL = "http://10.0.0.110:8001";
const DB_API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6";

async function q(sql: string, params: any[] = []) {
    let s = sql;
    const np: Record<string, any> = {};
    let i = 0;
    s = s.replace(/\?/g, () => { const k = 'p' + i; np[k] = params[i]; i++; return '@' + k; });
    const r = await fetch(`${DB_API_URL}/v1/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': DB_API_KEY },
        body: JSON.stringify({ sql: s, params: np, server: 'SERVER_PROFILE_2', database: 'db_ptrj' })
    });
    const res = await r.json() as any;
    if (!res.success) throw new Error(res.error);
    return res.data?.recordset || [];
}

// Cek absensi Feb 2026
const feb = await q(`SELECT COUNT(*) as cnt FROM PR_TASKREGLN_ARC WHERE RTRIM(EmpCode)=? AND TrxDate>=? AND TrxDate<?`, ['J0843', '2026-02-01', '2026-03-01']);
console.log('====== ABSENSI FEB 2026 J0843 ======');
console.log('Count:', feb[0].cnt);

const jan = await q(`SELECT COUNT(*) as cnt FROM PR_TASKREGLN_ARC WHERE RTRIM(EmpCode)=? AND TrxDate>=? AND TrxDate<?`, ['J0843', '2026-01-01', '2026-02-01']);
console.log('====== ABSENSI JAN 2026 J0843 ======');
console.log('Count:', jan[0].cnt);

// Duplicate description check
const dups = await q(`SELECT RTRIM(Description) as desc2, COUNT(*) as cnt FROM HR_GANG WHERE LocCode='ARC' GROUP BY Description`);
console.log('====== SEMUA DESCRIPTION ARC ======');
dups.forEach((d: any) => console.log(`  '${d.desc2?.trim()}': ${d.cnt} gang`));

// Latest TrxDate
const latest = await q(`SELECT TOP 1 TrxDate FROM PR_TASKREGLN_ARC ORDER BY TrxDate DESC`);
console.log('====== LATEST TrxDate di system ======');
console.log(latest[0]);
