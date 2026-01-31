"""
Query methods untuk mendapatkan data tunjangan (beras, jabatan, masa kerja, lembur)
Berdasarkan analisis backend_lama - menggunakan pattern yang sama untuk consistency
"""

class TunjanganQueries:
    @staticmethod
    def get_beras_rate_query(gang_code: str, start_date: str, end_date: str) -> dict:
        """Query untuk mendapatkan rate tunjangan beras per employee"""
        return {
            'sql': '''
                SELECT DISTINCT
                    e.EmpCode,
                    p.RiceRation as beras_rate
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                WHERE g.GangCode = ? OR ? = 'ALL'
            ''',
            'params': [gang_code, gang_code.upper()]
        }

    @staticmethod
    def get_jabatan_query(gang_code: str, start_date: str, end_date: str) -> dict:
        """Query untuk mendapatkan jumlah tunjangan jabatan"""
        return {
            'sql': '''
                SELECT DISTINCT
                    t.EmpCode,
                    SUM(ln.Amount) as jabatan_jumlah
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                JOIN HR_EMPLOYEE e ON e.EmpCode = t.EmpCode
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                WHERE (g.GangCode = ? OR ? = 'ALL')
                  AND t.DocDate >= ?
                  AND t.DocDate < ?
                  AND t.DocDesc = 'TUNJANGAN JABATAN'
                GROUP BY t.EmpCode
            ''',
            'params': [gang_code, gang_code.upper(), start_date, end_date]
        }

    @staticmethod
    def get_masa_kerja_tahun_query(gang_code: str, start_date: str, end_date: str) -> dict:
        """Query untuk mendapatkan tahun masa kerja employee"""
        return {
            'sql': '''
                SELECT DISTINCT
                    e.EmpCode,
                    CASE
                        WHEN MONTH(e.AppJoinGrpDate) > MONTH(GETDATE()) OR
                             (MONTH(e.AppJoinGrpDate) = MONTH(GETDATE()) AND DAY(e.AppJoinGrpDate) > DAY(GETDATE()))
                        THEN DATEDIFF(year, e.AppJoinGrpDate, GETDATE()) - 1
                        ELSE DATEDIFF(year, e.AppJoinGrpDate, GETDATE())
                    END AS masa_kerja_tahun
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                WHERE g.GangCode = ? OR ? = 'ALL'
            ''',
            'params': [gang_code, gang_code.upper()]
        }

    @staticmethod
    def get_masa_kerja_jumlah_query(gang_code: str, start_date: str, end_date: str) -> dict:
        """Query untuk mendapatkan jumlah tunjangan masa kerja"""
        return {
            'sql': '''
                SELECT DISTINCT
                    t.EmpCode,
                    SUM(ln.Amount) as masa_kerja_jumlah
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                JOIN HR_EMPLOYEE e ON e.EmpCode = t.EmpCode
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                WHERE (g.GangCode = ? OR ? = 'ALL')
                  AND t.DocDate >= ?
                  AND t.DocDate < ?
                  AND t.DocDesc = 'TUNJANGAN MASA KERJA'
                GROUP BY t.EmpCode
            ''',
            'params': [gang_code, gang_code.upper(), start_date, end_date]
        }

    @staticmethod
    def get_lembur_query(gang_code: str, start_date: str, end_date: str) -> dict:
        """Query untuk mendapatkan data lembur/overtime"""
        return {
            'sql': '''
                SELECT DISTINCT
                    t.EmpCode,
                    SUM(trl.Amount) as lembur_jumlah,
                    SUM(trl.Hours) as lembur_jam
                FROM PR_TASKREG_ARC t
                JOIN PR_TASKREGLN_ARC trl ON t.id = trl.masterId
                JOIN HR_EMPLOYEE e ON e.EmpCode = trl.EmpCode
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                WHERE (g.GangCode = ? OR ? = 'ALL')
                  AND t.DocDate >= ?
                  AND t.DocDate < ?
                  AND trl.OT = 1
                GROUP BY t.EmpCode
            ''',
            'params': [gang_code, gang_code.upper(), start_date, end_date]
        }

    @staticmethod
    def extract_scalar_value(row, index=0, default=0.0):
        """Extract scalar value dari database row dengan null handling"""
        if not row or index >= len(row):
            return default
        value = row[index]
        return float(value) if value is not None else default

    @staticmethod
    def paramify_query(sql: str, emp_code: str, start_date: str = None, end_date: str = None):
        """Parameterisasi query untuk security - mengganti hardcoded values dengan ?"""
        import re
        s = sql
        s = re.sub(r"(?i)([\"\[]?EmpCode[\"\]]?\s*(?:=|LIKE)\s*)'[^']*'", r"\1?", s)
        if start_date and end_date:
            s = re.sub(r"(?i)([\w\.\"\[\]]*DocDate)\s*>=\s*'[^']*'", r"\1 >= ?", s)
            s = re.sub(r"(?i)([\w\.\"\[\]]*DocDate)\s*<\s*'[^']*'", r"\1 < ?", s)
        return s