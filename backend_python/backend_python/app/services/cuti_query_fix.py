def _get_cuti_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Get real cuti data from database using TaskCode classification with ARC tables
    Based on reference queries get_cuti_tahunan.sql and get_cuti_sakit.sql
    """
    return {
        'sql': """
            WITH cuti_tahunan AS (
                SELECT
                    tr.EmpCode,
                    COUNT(*) as cuti_tahunan_hari
                FROM PR_TASKREGLN_ARC tr
                WHERE tr.TaskCode = 'GA9129AB2'
                  AND tr.CreatedDate >= ?
                  AND tr.CreatedDate < ?
                  AND tr.EmpCode IN (
                      SELECT g.GangMember
                      FROM HR_GANGLN g
                      WHERE g.GangCode = ? OR ? = 'ALL'
                  )
                GROUP BY tr.EmpCode
            ),
            cuti_sakit AS (
                SELECT
                    tr.EmpCode,
                    COUNT(*) as cuti_sakit_haid_hari
                FROM PR_TASKREGLN_ARC tr
                WHERE tr.TaskCode = 'GA9126AB2'
                  AND tr.CreatedDate >= ?
                  AND tr.CreatedDate < ?
                  AND tr.EmpCode IN (
                      SELECT g.GangMember
                      FROM HR_GANGLN g
                      WHERE g.GangCode = ? OR ? = 'ALL'
                  )
                GROUP BY tr.EmpCode
            )
            SELECT DISTINCT
                e.EmpCode,
                COALESCE(ct.cuti_tahunan_hari, 0) as cuti_tahunan_hari,
                COALESCE(cs.cuti_sakit_haid_hari, 0) as cuti_sakit_haid_hari,
                0 as cuti_haid_hari,
                0 as cuti_minggu_hari,
                0 as cuti_nasional_hari,
                0 as cuti_izin_hari
            FROM HR_EMPLOYEE e
            JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
            LEFT JOIN cuti_tahunan ct ON ct.EmpCode = e.EmpCode
            LEFT JOIN cuti_sakit cs ON cs.EmpCode = e.EmpCode
            WHERE (g.GangCode = ? OR ? = 'ALL')
            ORDER BY e.EmpCode
        """,
        'params': [start_date, end_date, gang_code, gang_code.upper(),
                  start_date, end_date, gang_code, gang_code.upper(),
                  gang_code, gang_code.upper()]
    }