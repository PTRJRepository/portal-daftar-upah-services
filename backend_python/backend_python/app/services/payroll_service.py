from typing import Dict, Any, List, Tuple, Optional
from app.repositories.employee_repository_db import EmployeeRepositoryDB
from app.models.payroll import PayrollRow
from datetime import datetime
from pathlib import Path
from database.services.database import Database
import time
import logging
from app.core.config import get_testing_token, is_test_mode

class PayrollService:
    """
    Payroll calculation service implementing correct formulas from reference code
    daftar_upah_engine_real_database.py
    """

    def __init__(self):
        # Load configuration
        import json
        import os
        config_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config.json')
        try:
            with open(config_path, 'r') as f:
                self.config = json.load(f)
        except Exception as e:
            print(f"Warning: Could not load config from {config_path}: {e}")
            self.config = {"constants": {"potongan_bpjs": {"gaji_pokok_min": 3876600}}}

        # Constants from reference code (can be made configurable)
        # Use upah_minimum.dasar as base for BPJS calculation
        self.gaji_pokok_min = self.config.get('constants', {}).get('upah_minimum', {}).get('dasar', 3876600)

        # Setup logging for allowance validation
        self.allowance_logger = logging.getLogger('allowance_validation')
        self.allowance_logger.setLevel(logging.INFO)

        # Create file handler for allowance logs
        handler = logging.FileHandler('logs/allowance_validation.log')
        handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        ))
        self.allowance_logger.addHandler(handler)

    def _log_allowance_warning(self, emp_code: str, allowance_type: str, message: str):
        """Log warning for allowance validation issues"""
        warning_msg = f"[{allowance_type}] {emp_code}: {message}"
        self.allowance_logger.warning(warning_msg)
        print(f"⚠️  {warning_msg}")

    def _log_allowance_error(self, emp_code: str, allowance_type: str, message: str):
        """Log error for allowance calculation issues"""
        error_msg = f"[{allowance_type}] {emp_code}: {message}"
        self.allowance_logger.error(error_msg)
        print(f"❌ {error_msg}")

    def _log_allowance_info(self, emp_code: str, allowance_type: str, message: str):
        """Log info for allowance calculations"""
        info_msg = f"[{allowance_type}] {emp_code}: {message}"
        self.allowance_logger.info(info_msg)
        print(f"ℹ️  {info_msg}")

    def validate_allowance_data(self, emp_code: str, bulan: int, tahun: int,
                            jabatan_amount: float, masa_kerja_amount: float,
                            masa_kerja_years: int, lembur_amount: float,
                            lembur_jam: float) -> Dict[str, Any]:
        """
        Validate allowance data and return validation results with recommendations
        """
        validation_results = {
            'is_valid': True,
            'warnings': [],
            'errors': [],
            'recommendations': []
        }

        # Validate tunjangan jabatan
        if jabatan_amount < 0:
            validation_results['errors'].append(
                f"Tunjangan jabatan tidak boleh negatif: {jabatan_amount}"
            )
            validation_results['is_valid'] = False
            self._log_allowance_error(emp_code, 'TUNJANGAN JABATAN',
                f"Negative amount: {jabatan_amount}")
        elif jabatan_amount == 0:
            validation_results['warnings'].append(
                "Tunjangan jabatan bernilai 0 - periksa konfigurasi posisi"
            )
            self._log_allowance_warning(emp_code, 'TUNJANGAN JABATAN',
                "No position allowance configured")

        # Validate tunjangan masa kerja
        if masa_kerja_amount < 0:
            validation_results['errors'].append(
                f"Tunjangan masa kerja tidak boleh negatif: {masa_kerja_amount}"
            )
            validation_results['is_valid'] = False
            self._log_allowance_error(emp_code, 'TUNJANGAN MASA KERJA',
                f"Negative amount: {masa_kerja_amount}")
        elif masa_kerja_amount == 0 and masa_kerja_years > 0:
            validation_results['warnings'].append(
                f"Masa kerja {masa_kerja_years} tahun tapi tunjangan 0"
            )
            validation_results['recommendations'].append(
                "Periksa transaksi TUNJANGAN MASA KERJA di PR_ADTRANS_ARC"
            )
            self._log_allowance_warning(emp_code, 'TUNJANGAN MASA KERJA',
                f"Service years: {masa_kerja_years} but amount: 0")

        # Validate tunjangan lembur
        if lembur_amount < 0:
            validation_results['errors'].append(
                f"Tunjangan lembur tidak boleh negatif: {lembur_amount}"
            )
            validation_results['is_valid'] = False
            self._log_allowance_error(emp_code, 'TUNJANGAN LEMBUR',
                f"Negative amount: {lembur_amount}")
        elif lembur_amount == 0:
            validation_results['warnings'].append(
                "Tidak ada tunjangan lembur untuk periode ini"
            )
            self._log_allowance_info(emp_code, 'TUNJANGAN LEMBUR',
                "No overtime records for period")
        elif lembur_jam == 0 and lembur_amount > 0:
            validation_results['warnings'].append(
                f"Tunjangan lembur {lembur_amount} tapi jam kerja 0"
            )
            self._log_allowance_warning(emp_code, 'TUNJANGAN LEMBUR',
                f"Amount: {lembur_amount} but hours: 0")

        # Check total tunjangan
        total_tunjangan = jabatan_amount + masa_kerja_amount + lembur_amount
        if total_tunjangan == 0:
            validation_results['warnings'].append(
                "Total tunjangan bernilai 0 - perlu investigasi"
            )
            validation_results['recommendations'].extend([
                "Periksa apakah karyawan aktif untuk periode tersebut",
                "Verifikasi data transaksi tunjangan di database",
                "Konfirmasi dengan departemen HR/Finance"
            ])
            self._log_allowance_warning(emp_code, 'TOTAL TUNJANGAN',
                f"Zero total allowances for {bulan}/{tahun}")

        return validation_results

    def _paramify(self, sql: str, emp_code: str, start_date: str = None, end_date: str = None) -> Tuple[str, Tuple]:
        import re
        s = sql
        s = re.sub(r"(?i)([\"\[]?EmpCode[\"\]]?\s*(?:=|LIKE)\s*)'[^']*'", r"\1?", s)
        if start_date and end_date:
            date_col_pattern = r"([\w\.\"\[\]]*(?:DocDate|AttnDate|CreatedDate))"
            s = re.sub(rf"(?i){date_col_pattern}\s*>=\s*'[^']*'", r"\1 >= ?", s)
            s = re.sub(rf"(?i){date_col_pattern}\s*<\s*'[^']*'", r"\1 < ?", s)
            if s.count('?') < 3:
                s = re.sub(r"'\d{4}-\d{2}-\d{2}'", '?', s, count=2)
            return s, (emp_code, start_date, end_date)
        return s, (emp_code,)

    def calculate_hari_kerja(self, hk_count: int, cuti_tahunan: int, cuti_sakit: int,
                           hk_minggu: int, hk_nasional: int) -> int:
        """
        Calculate Hari Kerja = HK - (Tahunan + Sakit + Minggu + Nasional)
        """
        total_cuti = cuti_tahunan + cuti_sakit + hk_minggu + hk_nasional
        hari_kerja = max(0, hk_count - total_cuti)
        return hari_kerja

    def calculate_gaji_pokok(self, hk_count: int, payrate: float,
                           cuti_tahunan: int = 0, cuti_sakit: int = 0,
                           hk_minggu: int = 0, hk_nasional: int = 0) -> float:
        """
        Calculate Gaji Pokok = (HK - Total Cuti) x Payrate (Rp)
        This follows standard payroll calculation where only effective working days are paid
        """
        total_cuti = cuti_tahunan + cuti_sakit + hk_minggu + hk_nasional
        hari_kerja = max(0, hk_count - total_cuti)
        return hari_kerja * float(payrate) if payrate else 0

    def calculate_gaji_pokok_jmlhk(self, hk_count: int, payrate: float) -> float:
        """
        Calculate Gaji Pokok (JML HK × Upah Dasar) - THIS IS USED FOR UPAH KOTOR CALCULATION
        """
        return hk_count * float(payrate) if payrate else 0

    def calculate_total_tunjangan(self, hk_count: int, beras_payrate: float,
                                 jabatan_amount: float, masa_kerja_amount: float,
                                 lembur_amount: float) -> float:
        """
        Calculate Total Tunjangan = Beras + Jabatan + Masa Kerja + Lembur
        """
        beras_jumlah = hk_count * beras_payrate if beras_payrate > 0 else 0
        return beras_jumlah + jabatan_amount + masa_kerja_amount + lembur_amount

    def calculate_total_premi(self, brondol_amount: float, pruning_amount: float,
                              dynamic_premi_amounts: List[float], koreksi_amount: float) -> float:
        """
        Calculate Total Premi = BRONDOL + PRUNING + Dynamic Premi
        NOTE: Koreksi is NOT included in total_premi, it's handled separately as a potongan
        """
        total_dynamic = sum(dynamic_premi_amounts)
        return brondol_amount + pruning_amount + total_dynamic  # koreksi_amount tidak diikutkan

    def calculate_bpjs_components(self, masa_kerja_jumlah: float) -> Dict[str, float]:
        """
        Calculate BPJS components based on explicit user requirement (Prompt 27-Nov-2025):
        
        BASE = Upah Minimum (config) + Masa Kerja Amount

        1. BPJS Pensiun:
           - Pekerja: BASE × 1%
           - Majikan: BASE × 2%
           
        2. BPJS Kesehatan:
           - Pekerja: BASE × 1%
           - Majikan: BASE × 4%

        Total Pekerja (Deduction) = 1% (Pensiun) + 1% (Kesehatan) = 2%
        """
        # Base calculation: Jumlah Upah Minimum (dasar) + Masa Kerja
        bpjs_base = self.gaji_pokok_min + masa_kerja_jumlah

        # Breakdown for BPJS Kesehatan (Health)
        bpjs_kesehatan_pekerja = round(bpjs_base * 0.01, 2)  # 1%
        bpjs_kesehatan_majikan = round(bpjs_base * 0.04, 2)  # 4%

        # Breakdown for BPJS Pensiun (Pension)
        bpjs_pensiun_pekerja = round(bpjs_base * 0.01, 2)    # 1%
        bpjs_pensiun_majikan = round(bpjs_base * 0.02, 2)    # 2%

        # Totals per category
        kesehatan_total = round(bpjs_kesehatan_pekerja + bpjs_kesehatan_majikan, 2)
        pensiun_total = round(bpjs_pensiun_pekerja + bpjs_pensiun_majikan, 2)

        # Grand Totals
        bpjs_pekerja_total = round(bpjs_kesehatan_pekerja + bpjs_pensiun_pekerja, 2)  # Total 2%
        bpjs_majikan_total = round(bpjs_kesehatan_majikan + bpjs_pensiun_majikan, 2)  # Total 6%
        bpjs_total_keseluruhan = round(bpjs_pekerja_total + bpjs_majikan_total, 2)    # Total 8%

        return {
            'kesehatan_pekerja': bpjs_kesehatan_pekerja,
            'kesehatan_majikan': bpjs_kesehatan_majikan,
            'kesehatan_total': kesehatan_total,
            'pensiun_pekerja': bpjs_pensiun_pekerja,
            'pensiun_majikan': bpjs_pensiun_majikan,
            'pensiun_total': pensiun_total,
            'jumlah': bpjs_total_keseluruhan,
            'pekerja_total': bpjs_pekerja_total,
            'majikan_total': bpjs_majikan_total,
            'base_amount': bpjs_base
        }

    def calculate_jumlah_upah_kotor(self, hk_count: int, payrate: float,
                                    total_tunjangan: float, total_premi: float) -> float:
        """
        Calculate Jumlah Upah Kotor = Gaji Pokok (JML HK × Upah Dasar) + Total Tunjangan + Total Premi
        """
        gaji_pokok = self.calculate_gaji_pokok_jmlhk(hk_count, payrate)
        return gaji_pokok + total_tunjangan + total_premi

    def calculate_total_potongan(self, bpjs_pekerja_total: float, spsi_amount: float,
                               pph21_amount: float) -> float:
        """  
        Calculate Total Potongan = BPJS Kesehatan Pekerja + BPJS Pensiun Pekerja + Iuran SPSI + PPH21
        """
        return bpjs_pekerja_total + spsi_amount + pph21_amount

    def calculate_upah_bersih(self, jumlah_upah_kotor: float, total_potongan: float) -> float:
        """
        Calculate Upah Bersih = Jumlah Upah Kotor - Total Potongan
        """
        return jumlah_upah_kotor - total_potongan

    async def calculate(self, upah_dasar: float, hk_count: int,
                        allowances: Dict[str, float], deductions: Dict[str, float]) -> Dict[str, Any]:
        """
        Legacy method - simplified calculation for backward compatibility
        """
        working_days = hk_count
        basic_salary = working_days * upah_dasar
        total_allowances = sum(allowances.values()) if allowances else 0
        total_deductions = sum(deductions.values()) if deductions else 0
        net_salary = basic_salary + total_allowances - total_deductions

        return {
            "hk_count": hk_count,
            "working_days": working_days,
            "basic_salary": basic_salary,
            "allowances": allowances,
            "deductions": deductions,
            "net_salary": net_salary
        }

    def _dates(self, month: int, year: int) -> Tuple[str, str]:
        s = f"{year:04d}-{month:02d}-01"
        e = f"{year+1:04d}-01-01" if month == 12 else f"{year:04d}-{month+1:02d}-01"
        return s, e

    def _scalar(self, cur_row, idx=0):
        """Extract scalar value from database result - matches backend lama exactly"""
        if not cur_row:
            return 0
        # Handle negative indices like -1 for last column
        if idx < 0:
            idx = len(cur_row) + idx
        v = cur_row[idx]
        return float(v or 0)

    def _scalar_optional(self, cur_row, idx=0, default=None):
        """
        Returns the value at idx from cur_row.
        If row is empty or value is None, returns default.
        """
        if not cur_row:
            return default
        try:
            v = cur_row[idx]
            return float(v) if v is not None else default
        except (IndexError, ValueError, TypeError):
            return default

    def _normalize_premi_field_name(self, doc_desc: str) -> str:
        """
        Normalize DocDesc to valid Python field name for dynamic premi fields.
        
        Examples:
            "TUNJANGAN PREMI KERANI PANEN" -> "premi_kerani_panen"
            "TUNJANGAN PREMI MANDOR PANEN" -> "premi_mandor_panen"
            "PREMI CUCI BUAH" -> "premi_cuci_buah"
        
        Args:
            doc_desc: Original DocDesc from database
            
        Returns:
            Normalized field name in lowercase with underscores, or empty string if invalid
        """
        if not doc_desc:
            return ""
        
        # Convert to uppercase for consistent processing
        name = doc_desc.strip().upper()
        
        # Remove common prefixes
        prefixes_to_remove = ['TUNJANGAN PREMI', 'TUNJANGAN', 'PREMI']
        original_name = name  # Keep original for fallback
        for prefix in prefixes_to_remove:
            if name.startswith(prefix):
                name = name[len(prefix):].strip()
                break
        
        # If name is empty after removing prefix (e.g. "TUNJANGAN PREMI"), use a fallback
        if not name:
            # Fallback: use the original name or a specific key
            if "TUNJANGAN PREMI" in original_name:
                name = "TUNJANGAN_PREMI"
            elif original_name == "PREMI":
                name = "PREMI"
            else:
                return ""
        
        # Convert to lowercase and replace spaces with underscores
        name = name.lower().replace(' ', '_')
        
        # Remove any special characters except underscores
        import re
        name = re.sub(r'[^a-z0-9_]', '', name)
        
        # Remove consecutive underscores
        name = re.sub(r'_+', '_', name)
        
        # Remove leading/trailing underscores
        name = name.strip('_')
        
        # If name is empty after cleanup, return empty to skip it
        if not name:
            return ""
        
        # Add premi_ prefix if not already present
        if not name.startswith('premi_'):
            name = f'premi_{name}'
        
        return name


    _cache: Dict[str, Any] = {}
    _cache_exp: Dict[str, float] = {}
    _cache_ttl: int = 300

    def clear_cache(self):
        """Clear all cache to ensure data consistency between requests"""
        self._cache.clear()
        self._cache_exp.clear()
        print(f"[CACHE] Cleared payroll service cache at {time.time()}")

    def _cache_get(self, key: str):
        exp = self._cache_exp.get(key)
        if not exp:
            return None
        if exp < time.time():
            try:
                del self._cache[key]
                del self._cache_exp[key]
            except Exception:
                pass
            return None
        return self._cache.get(key)

    def _cache_set(self, key: str, value: Any, ttl: int = None):
        t = ttl if isinstance(ttl, int) and ttl > 0 else self._cache_ttl
        self._cache[key] = value
        self._cache_exp[key] = time.time() + t

    def _chunks(self, arr: List[str], size: int) -> List[List[str]]:
        out = []
        for i in range(0, len(arr), size):
            out.append(arr[i:i+size])
        return out

    def _payrates_map(self, db: Database, emp_codes: List[str]) -> Dict[str, float]:
        if not emp_codes:
            return {}
        key = f"payrates:{hash(tuple(emp_codes))}"
        cached = self._cache_get(key)
        if isinstance(cached, dict):
            return cached
        m: Dict[str, float] = {}
        for chunk in self._chunks(emp_codes, 200):
            ph = ','.join(['?']*len(chunk))
            sql = f'SELECT "EmpCode","PayRate" FROM "HR_PAYROLL" WHERE "EmpCode" IN ({ph})'
            rows = db.query_all(sql, tuple(chunk))
            for r in rows:
                m[str(r[0]).strip()] = float(r[1] or 0)
        self._cache_set(key, m)
        return m

    def _premi_map(self, db: Database, emp_codes: List[str], start_date: str, end_date: str, pattern: str, exact_match: bool = False) -> Dict[str, float]:
        if not emp_codes:
            return {}
        match_type = "exact" if exact_match else "like"
        key = f"premi:{match_type}:{pattern}:{start_date}:{end_date}:{hash(tuple(emp_codes))}"
        cached = self._cache_get(key)
        if isinstance(cached, dict):
            return cached
        m: Dict[str, float] = {}

        operator = "=" if exact_match else "LIKE"
        for chunk in self._chunks(emp_codes, 200):
            ph = ','.join(['?']*len(chunk))
            sql = (
                f'SELECT t."EmpCode", SUM(ln."Amount") '
                f'FROM "PR_ADTRANS_ARC" t JOIN "PR_ADTRANSLN_ARC" ln ON t."ID" = ln.MasterID '
                f'WHERE t."EmpCode" IN ({ph}) AND t."DocDate" >= ? AND t."DocDate" < ? AND UPPER(t."DocDesc") {operator} UPPER(?) '
                f'GROUP BY t."EmpCode"'
            )
            params = tuple(chunk) + (start_date, end_date, pattern)
            rows = db.query_all(sql, params)
            for r in rows:
                m[str(r[0]).strip()] = float(r[1] or 0)
        self._cache_set(key, m)
        return m

    def _loosefruit_map(self, db: Database, emp_codes: List[str], start_date: str, end_date: str) -> Dict[str, float]:
        if not emp_codes:
            return {}
        key = f"loosefruit:{start_date}:{end_date}:{hash(tuple(emp_codes))}"
        cached = self._cache_get(key)
        if isinstance(cached, dict):
            return cached
        m: Dict[str, float] = {}

        for chunk in self._chunks(emp_codes, 200):
            ph = ','.join(['?']*len(chunk))
            sql = (
                f'SELECT LFLN.EmpCode, SUM(LFLN.Amount) '
                f'FROM "PR_LOOSEFRUIT_ARC" LF '
                f'JOIN "PR_LOOSEFRUITLN_ARC" LFLN ON LF.ID = LFLN.MasterID '
                f'WHERE LFLN.EmpCode IN ({ph}) '
                f'AND LF.DocDate >= ? AND LF.DocDate < ? '
                f'GROUP BY LFLN.EmpCode'
            )
            params = tuple(chunk) + (start_date, end_date)
            rows = db.query_all(sql, params)
            for r in rows:
                m[str(r[0]).strip()] = float(r[1] or 0)
        self._cache_set(key, m)
        return m

    def _cuti_maps(self, db: Database, emp_codes: List[str], start_date: str, end_date: str, cuti_tah_raw: str, cuti_sakit_raw: str, hk_minggu_raw: str, hk_nas_raw: str) -> Dict[str, Dict[str, int]]:
        key = f"cuti:{start_date}:{end_date}:{hash(tuple(emp_codes))}"
        cached = self._cache_get(key)
        if isinstance(cached, dict):
            return cached
        out: Dict[str, Dict[str, int]] = { c: { 'tahunan':0, 'sakit':0, 'minggu':0, 'nasional':0 } for c in emp_codes }
        if not emp_codes:
            return out

        print(f"[DEBUG] Processing cuti_maps for {len(emp_codes)} employees from {start_date} to {end_date}")

        for chunk in self._chunks(emp_codes, 100):
            with db.transaction() as cur:
                for nik in chunk:
                    ct_q, ct_p = self._paramify(cuti_tah_raw, nik, start_date, end_date)
                    cs_q, cs_p = self._paramify(cuti_sakit_raw, nik, start_date, end_date)
                    hm_q, hm_p = self._paramify(hk_minggu_raw, nik, start_date, end_date)
                    hn_q, hn_p = self._paramify(hk_nas_raw, nik, start_date, end_date)
                    cur.execute(ct_q, *ct_p)
                    t_rows = cur.fetchall()
                    cur.execute(cs_q, *cs_p)
                    s_rows = cur.fetchall()
                    cur.execute(hm_q, *hm_p)
                    m_rows = cur.fetchall()
                    cur.execute(hn_q, *hn_p)
                    n_rows = cur.fetchall()
                    out[nik]['tahunan'] = t_rows[0][0] if t_rows and len(t_rows) > 0 else 0
                    out[nik]['sakit'] = s_rows[0][0] if s_rows and len(s_rows) > 0 else 0
                    out[nik]['minggu'] = m_rows[0][0] if m_rows and len(m_rows) > 0 else 0
                    out[nik]['nasional'] = n_rows[0][0] if n_rows and len(n_rows) > 0 else 0

                    # Debug output for each employee
                    if out[nik]['tahunan'] > 0 or out[nik]['sakit'] > 0 or out[nik]['minggu'] > 0 or out[nik]['nasional'] > 0:
                        print(f"[DEBUG] Employee {nik}: tahunan={out[nik]['tahunan']}, sakit={out[nik]['sakit']}, minggu={out[nik]['minggu']}, nasional={out[nik]['nasional']}")

        self._cache_set(key, out)
        print(f"[DEBUG] Completed cuti_maps processing. Sample results: {dict(list(out.items())[:3])}")
        return out

    async def generate_rows(self, repo: EmployeeRepositoryDB, gang_code: str = None, division: str = None, month: int = None, year: int = None, skip: int = 0, limit: int = 1000, fields: List[str] = None) -> List[PayrollRow]:
        rows: List[PayrollRow] = []
        db = Database.instance()
        employees = repo.list(skip, limit, gang_code=gang_code)
        s, e = self._dates(month or datetime.now().month, year or datetime.now().year)
        
        want_all = fields is None or len(fields) == 0
        want = (lambda name: True) if want_all else (lambda name: name in set(fields))
        from pathlib import Path
        base = Path(__file__).resolve().parents[2] / "query"
        if not base.exists():
            base = Path(__file__).resolve().parents[4] / "Engine_HTML_Templating" / "template_report" / "query"
        with (base / "Tunjangan" / "Payrate_Beras.sql").open('r', encoding='utf-8') as f:
            beras_q_raw = f.read()
        with (base / "Tunjangan" / "Gett_Amount_Tunjangan_Jabatan.sql").open('r', encoding='utf-8') as f:
            jab_q_raw = f.read()
        with (base / "Tunjangan" / "count_masa_kerja.sql").open('r', encoding='utf-8') as f:
            mk_y_raw = f.read()
        with (base / "Tunjangan" / "get_amount_masa_kerja.sql").open('r', encoding='utf-8') as f:
            mk_amt_raw = f.read()
        with (base / "Tunjangan" / "get_amount_lembur.sql").open('r', encoding='utf-8') as f:
            lembur_raw = f.read()
        with (base / "Tunjangan" / "get_brondol_amount.sql").open('r', encoding='utf-8') as f:
            brondol_raw = f.read()
        with (base / "potongan" / "potongan_spsi.sql").open('r', encoding='utf-8') as f:
            spsi_raw = f.read()
        with (base / "potongan" / "potong_pph21.sql").open('r', encoding='utf-8') as f:
            pph_raw = f.read()
        with (base / "potongan" / "potong_koreksi.sql").open('r', encoding='utf-8') as f:
            koreksi_raw = f.read()
        with (base / "potongan" / "Premi_PPH.sql").open('r', encoding='utf-8') as f:
            premi_pph_raw = f.read()
        with (base / "get_cuti_tahunan.sql").open('r', encoding='utf-8') as f:
            cuti_tah_raw = f.read()
        with (base / "get_cuti_sakit.sql").open('r', encoding='utf-8') as f:
            cuti_sakit_raw = f.read()
        with (base / "get_HK_minggu.sql").open('r', encoding='utf-8') as f:
            hk_minggu_raw = f.read()
        with (base / "get_HK_national_holiday.sql").open('r', encoding='utf-8') as f:
            hk_nas_raw = f.read()
        with (base / "get_total_HK_each_Emp.sql").open('r', encoding='utf-8') as f:
            hk_total_raw = f.read()

        emp_codes = [ (e.get('nik') or '').strip() for e in employees ]
        payrate_map: Dict[str, float] = {}
        if want_all or want('upah_dasar') or want('upah_pokok') or want('gaji_pokok'):
            payrate_map = self._payrates_map(db, emp_codes)
        # ALWAYS query for premi data - needed for total_premi and jumlah_upah_kotor calculation
        premi_maps: Dict[str, Dict[str, float]] = {
            'brondol': self._loosefruit_map(db, emp_codes, s, e),
        }

        # Dynamic premi headers (use filtered query to align with columns) - ALWAYS query
        dyn_headers: List[str] = []
        dyn_maps: List[Dict[str, float]] = []
        try:
            from database.services.queries import Queries
            q = Queries().get('premi', 'dynamic_premi_headers_filtered')
            if q and 'sql' in q and gang_code:
                start_date = f"{year}-{str(month).zfill(2)}-01"
                end_date = f"{year+1}-01-01" if int(month) == 12 else f"{year}-{str(int(month)+1).zfill(2)}-01"
                rows_dyn = db.query_all(q['sql'], [gang_code, start_date, end_date])

                for r in rows_dyn or []:
                    if not r or r[0] is None:
                        continue
                    htxt = str(r[0]).strip()
                    if htxt:  # Only add non-empty headers
                        dyn_headers.append(htxt)
                # Keep up to 7 dynamic items
                dyn_headers = dyn_headers[:7]
            
            print(f"[DEBUG] Dynamic premi headers: {dyn_headers}")

        except Exception:
            dyn_headers = []

        for h in dyn_headers:
            # Use exact match for dynamic headers since they come from DISTINCT DocDesc
            dyn_maps.append(self._premi_map(db, emp_codes, s, e, h, exact_match=True))

        # Dynamic potongan headers (filter PPH21 and SPSI as requested) - ALWAYS query for total_potongan
        dyn_pot_headers: List[str] = []
        dyn_pot_maps: List[Dict[str, float]] = []
        try:
            from database.services.queries import Queries
            print(f"DEBUG: Processing dynamic potongan headers for gang {gang_code}")
            q_pot = Queries().get('potongan', 'dynamic_potongan_with_amounts')
            if q_pot and 'sql' in q_pot and gang_code:
                start_date = f"{year}-{str(month).zfill(2)}-01"
                end_date = f"{year+1}-01-01" if int(month) == 12 else f"{year}-{str(int(month)+1).zfill(2)}-01"
                rows_pot = db.query_all(q_pot['sql'], [gang_code, start_date, end_date])

                print(f"DEBUG: Found {len(rows_pot or [])} raw potongan records from database")
                all_raw_items = []
                for r in rows_pot or []:
                    if not r or not r[0]:
                        continue
                    raw_item = str(r[0]).strip()
                    all_raw_items.append(raw_item)

                print(f"DEBUG: Raw potongan items: {all_raw_items}")

                # Filter potongan headers: INCLUDE items with "POT" awalan, exclude PPH21 and SPSI as requested
                # Note: Allow "PREMI" in "POTONGAN PREMI" since these are potongan, not premi
                # EXCLUDE 'koreksi' because it is handled as a fixed column in "Potongan Upah Kotor" group
                excluded_pot = {'pph21', 'spsi', 'astek', 'bpjs', 'koreksi', 'sehat'}
                filtered_items = []
                excluded_items = []

                for r in rows_pot or []:
                    if not r or not r[0]:
                        continue
                    pot_name = str(r[0]).strip()
                    pot_name_lower = pot_name.lower()

                    # Debug: Check each filter condition
                    # Step 1: Must contain "POT" (case-insensitive) - requirement from prompt
                    has_pot_keyword = "pot" in pot_name_lower
                    
                    # Step 2: Check exclusions
                    has_excluded = any(exclude in pot_name_lower for exclude in excluded_pot)
                    has_tunjangan = 'tunjangan' in pot_name_lower
                    has_insentif = 'insentif' in pot_name_lower

                    # Special check: allow "premi" if it's part of "potongan premi"
                    contains_premi_but_ok = 'premi' in pot_name_lower and has_pot_keyword and 'potongan' in pot_name_lower

                    print(f"DEBUG: '{pot_name}' -> has_pot_keyword: {has_pot_keyword}, has_excluded: {has_excluded}, has_tunjangan: {has_tunjangan}, has_insentif: {has_insentif}, contains_premi_but_ok: {contains_premi_but_ok}")

                    # Untuk potongan: HARUS ada kata "POT" (sesuai prompt: "pencarian kata kunci 'Pot'")
                    # Include potongan items dengan awalan/kata "POT", exclude PPH21 dan SPSI
                    if has_pot_keyword and not has_excluded and not has_tunjangan and not has_insentif:
                        dyn_pot_headers.append(pot_name)
                        filtered_items.append(pot_name)
                        print(f"DEBUG: INCLUDED: '{pot_name}'")
                    else:
                        excluded_items.append(pot_name)
                        reason = []
                        if not has_pot_keyword: reason.append("no 'pot' keyword")
                        if has_excluded: reason.append("has_excluded")
                        if has_tunjangan: reason.append("has_tunjangan")
                        if has_insentif: reason.append("has_insentif")
                        print(f"DEBUG: EXCLUDED: '{pot_name}' ({', '.join(reason)})")

                print(f"DEBUG: Final potongan headers to include: {dyn_pot_headers}")
                print(f"DEBUG: Total excluded items: {excluded_items}")

                # Keep up to 7 dynamic potongan items
                dyn_pot_headers = dyn_pot_headers[:7]
                print(f"DEBUG: Limited to first 7 items: {dyn_pot_headers}")

                # Create potongan maps for each dynamic header
                for i, pot_header in enumerate(dyn_pot_headers):
                    pattern = f"%{pot_header}%"
                    print(f"DEBUG: Creating map {i+1} for '{pot_header}' with pattern '{pattern}'")
                    dyn_pot_maps.append(self._premi_map(db, emp_codes, s, e, pattern))
            else:
                print(f"DEBUG: No query found for potongan headers")
        except Exception as e:
            print(f"ERROR processing dynamic potongan headers: {e}")
            import traceback
            traceback.print_exc()
            dyn_pot_headers = []
            dyn_pot_maps = []
        # ALWAYS query cuti data - needed for hari_kerja, gaji_pokok, and jabatan_rate calculations
        cuti_maps: Dict[str, Dict[str, int]] = self._cuti_maps(db, emp_codes, s, e, cuti_tah_raw, cuti_sakit_raw, hk_minggu_raw, hk_nas_raw)

        for i, emp in enumerate(employees, start=1):
            nik = (emp.get("nik") or "").strip()
            hk_q, hk_params = self._paramify(hk_total_raw, nik, s, e)
            hk_res = db.query_one(hk_q, hk_params)
            hk_count = int(self._scalar(hk_res, 0))
            payrate = float(payrate_map.get(nik, 0.0))

            # Calculate Cuti & Hari Kerja EARLY (needed for Jabatan Rate calculation)
            cuti_tah_count = int(cuti_maps.get(nik, {}).get('tahunan', 0) or 0)
            cuti_sakit_count = int(cuti_maps.get(nik, {}).get('sakit', 0) or 0)
            cuti_minggu_hari = int(cuti_maps.get(nik, {}).get('minggu', 0) or 0)
            cuti_nasional_hari = int(cuti_maps.get(nik, {}).get('nasional', 0) or 0)
            cuti_izin_hari = 0

            # Hari Kerja = HK - Total Cuti (following standard payroll practice)
            # This represents effective working days after excluding various types of leave
            # Cuti Tahunan, Sakit, Minggu, and Nasional are not considered working days
            # IMPORTANT: Ensure hk_count is properly converted from database result
            hk_count = int(self._scalar(hk_res, 0))  # Use _scalar like backend lama
            hari_kerja = max(0, hk_count - (cuti_tah_count + cuti_sakit_count + cuti_minggu_hari + cuti_nasional_hari))

            # Always calculate allowance values (not just when explicitly wanted)
            # This ensures all values are available for the PayrollRow object
            beras_q, beras_params = self._paramify(beras_q_raw, nik)
            beras_rate = self._scalar(db.query_one(beras_q, beras_params))

            jab_q, jab_params = self._paramify(jab_q_raw, nik, s, e)
            jab_res = db.query_one(jab_q, jab_params)
            jabatan_jumlah = self._scalar(jab_res, 0)

            # REVISED: Calculate Jabatan Rate based on Hari Kerja (not HK count)
            # Formula: Rate = Jumlah / Hari Kerja
            _jab_val = jabatan_jumlah or 0
            jabatan_rate = (_jab_val / hari_kerja) if hari_kerja > 0 and _jab_val > 0 else 0

            mk_y_q, mk_y_params = self._paramify(mk_y_raw, nik)
            mk_years_res = db.query_one(mk_y_q, mk_y_params)
            masa_kerja_tahun = int((mk_years_res[-1] or 0) if mk_years_res else 0)
            mk_amt_q, mk_amt_params = self._paramify(mk_amt_raw, nik, s, e)
            mk_amt_res = db.query_one(mk_amt_q, mk_amt_params)
            # ln.Amount is the first column now (SUM query updated)
            # ln.Amount is the last column (matching backend lama logic)
            masa_kerja_jumlah = self._scalar(mk_amt_res, -1) if mk_amt_res else 0
            masa_kerja_amount = masa_kerja_jumlah
            lembur_q, lembur_params = self._paramify(lembur_raw, nik, s, e)
            lembur_res = db.query_one(lembur_q, lembur_params)
            lembur_jumlah = self._scalar(lembur_res, 0)
            lembur_jam = int(self._scalar(lembur_res, 1))
            # Brondol already handled by premi_maps['brondol'] above
            # premi_brondol already calculated from mapping

            def premi_amount(pattern: str) -> float:
                q = (
                    "SELECT SUM(ln.Amount) FROM PR_ADTRANS_ARC t JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID "
                    "WHERE t.EmpCode = ? AND t.DocDate >= ? AND t.DocDate < ? AND UPPER(t.DocDesc) LIKE UPPER(?)"
                )
                res = db.query_one(q, (nik, s, e, pattern))
                return self._scalar(res, 0)

            # Only brondol is static
            premi_brondol = float(premi_maps.get('brondol', {}).get(nik, 0.0))

            # Get SPSI and PPH21 amounts - ALWAYS calculate to ensure total_potongan is available
            # matching reference engine logic (lines 1036-1100)
            pot_spsi = 0.0
            pot_pph21 = 0.0
            premi_pph = 0.0  # NEW: Premi PPH that gets ADDED to net salary (not subtracted)

            # SPSI calculation - matching reference engine get_employee_spsi_amount logic
            spsi_q, spsi_params = self._paramify(spsi_raw, nik, s, e)
            try:
                spsi_res = db.query_one(spsi_q, spsi_params)
                if spsi_res and len(spsi_res) > 0:
                    # Try multiple positions for the Amount column (matching reference engine logic line 1080-1094)
                    for col_idx in [len(spsi_res)-1, len(spsi_res)-2, 7, 8]:
                        if col_idx >= 0 and col_idx < len(spsi_res):
                            try:
                                amount_val = spsi_res[col_idx]
                                if amount_val is not None:
                                    pot_spsi = float(amount_val)
                                    break
                            except (ValueError, TypeError):
                                continue
            except Exception as e:
                pot_spsi = 0.0

            # PPH21 calculation - matching reference engine get_employee_pph21_amount logic
            pph_q, pph_params = self._paramify(pph_raw, nik, s, e)
            try:
                pph_res = db.query_one(pph_q, pph_params)
                if pph_res and len(pph_res) > 0:
                    # Try multiple positions for the Amount column (matching reference engine logic)
                    for col_idx in [len(pph_res)-1, len(pph_res)-2, 7, 8]:
                        if col_idx >= 0 and col_idx < len(pph_res):
                            try:
                                amount_val = pph_res[col_idx]
                                if amount_val is not None:
                                    pot_pph21 = float(amount_val)
                                    break
                            except (ValueError, TypeError):
                                continue
            except Exception as e:
                pot_pph21 = 0.0

            # Premi PPH calculation - NEW: This is a special deduction that gets ADDED to net salary
            premi_pph_q, premi_pph_params = self._paramify(premi_pph_raw, nik, s, e)
            try:
                premi_pph_res = db.query_one(premi_pph_q, premi_pph_params)
                if premi_pph_res and len(premi_pph_res) > 0:
                    # Try multiple positions for the Amount column
                    for col_idx in [len(premi_pph_res)-1, len(premi_pph_res)-2, 7, 8]:
                        if col_idx >= 0 and col_idx < len(premi_pph_res):
                            try:
                                amount_val = premi_pph_res[col_idx]
                                if amount_val is not None:
                                    premi_pph = float(amount_val)
                                    break
                            except (ValueError, TypeError):
                                continue
            except Exception as e:
                premi_pph = 0.0

            # Correct calculation sesuai business rule:
            # Correct calculation sesuai business rule dari backend lama:
            # Gaji Pokok = jumlah_hk x upah_dasar (total HK days × upah dasar) - for gross calculation
            # Upah Pokok = hari_kerja x upah_pokok (effective working days × payrate)
            gaji_pokok = hk_count * payrate if payrate else 0
            upah_pokok = payrate * hari_kerja if (want_all or want('upah_pokok')) else 0

            # Get ALL premi from database DocDesc only - no hardcoded fields
            # ALWAYS calculate dynamic_premi_fields to ensure total_premi is always available
            dynamic_premi_fields: Dict[str, float] = {}
            # Add dynamic premi from dyn_headers (this includes PRUNING, HARVESTING, etc.)
            # Explicitly exclude BRONDOL and other STATIC items (Tunjangan/Potongan) to avoid double counting
            # 'tunjangan' is NOT in this list because "TUNJANGAN PREMI..." is valid, but "TUNJANGAN JABATAN" is caught by 'jabatan'
            excluded_keywords = {
                'brondol', 'koreksi', 'potongan', 'spsi', 'pph', 'astek', 'bpjs',
                'jabatan', 'masa kerja', 'lembur', 'beras'
            }

            for i in range(len(dyn_headers)):
                if i < len(dyn_maps):
                    raw_header = str(dyn_headers[i])
                    raw_lower = raw_header.lower()

                    # Safety check: skip if matches excluded keywords
                    if any(ex in raw_lower for ex in excluded_keywords):
                        # Log if needed, but skip to avoid double counting
                        # print(f"DEBUG: Excluded from Dynamic Premi: {raw_header}")
                        continue

                    field_name = self._normalize_premi_field_name(raw_header)
                    # Always include field even if amount is 0, but skip empty field names
                    if not field_name:
                        print(f"WARNING: Skip DocDesc '{dyn_headers[i]}' - normalized to empty field name")
                        continue
                    amount = float(dyn_maps[i].get(nik, 0.0))
                    dynamic_premi_fields[field_name] = amount
                    if amount > 0:  # Only log if has value
                        print(f"DEBUG [{nik}]: Added {field_name} = {amount}")

            # Calculate basic allowance values (always calculate these, not just when wanted)
            beras_jumlah = hk_count * beras_rate if beras_rate > 0 else 0
            total_tunjangan = 0.0 # MOVED TO FRONTEND: beras_jumlah + (jabatan_jumlah or 0) + (masa_kerja_amount or 0) + (lembur_jumlah or 0)

            # Get koreksi amount from database - ALWAYS calculate for total_potongan
            koreksi_amount = 0.0
            koreksi_q, koreksi_params = self._paramify(koreksi_raw, nik, s, e)
            koreksi_res = db.query_one(koreksi_q, koreksi_params)
            if koreksi_res and len(koreksi_res) > 0:
                total_koreksi = 0
                for col_idx in [len(koreksi_res)-1, len(koreksi_res)-2, 7, 8]:
                    if col_idx >= 0 and col_idx < len(koreksi_res):
                        try:
                            amount_val = koreksi_res[col_idx]
                            if amount_val is not None:
                                total_koreksi = float(amount_val)
                                break
                        except (ValueError, TypeError):
                            continue
                # Koreksi harus ditampilkan sebagai nilai negatif (pengurangan)
                koreksi_amount = -abs(total_koreksi)

            pot_koreksi = abs(koreksi_amount)
                        
            # Extract dynamic premi values for total calculation
            dynamic_premi_values = list(dynamic_premi_fields.values())

            # Total premi = BRONDOL + all dynamic premi values (includes PRUNING, HARVESTING, etc.)
            # Koreksi amount TIDAK termasuk dalam total_premi, karena koreksi adalah potongan
            total_premi = 0.0 # MOVED TO FRONTEND: premi_brondol + sum(dynamic_premi_values)

            # Dynamic potongan amounts - ALWAYS calculate for total_potongan
            dyn_pot_vals: List[float] = []
            iuran_dynamic_amount = 0.0
            
            # Identify "Iuran" dynamic deductions (excluding SPSI)
            for i in range(min(7, len(dyn_pot_maps))):
                amount = float(dyn_pot_maps[i].get(nik, 0.0))
                dyn_pot_vals.append(amount)
                
                # Check if this is an Iuran
                if i < len(dyn_pot_headers):
                    header = str(dyn_pot_headers[i]).upper()
                    if "IURAN" in header and "SPSI" not in header:
                        iuran_dynamic_amount += amount

            # NEW: Calculate Potongan Upah Kotor Group
            # User Requirement: "calc_pot_upah_kotor = dihitung dari koreksi + dynamic potongan upah kotor"
            # We assume 'dynamic potongan upah kotor' refers to all dynamic deductions found in dyn_pot_vals
            potongan_upah_kotor_total = 0.0 # MOVED TO FRONTEND: pot_koreksi + sum(dyn_pot_vals)

            # Correct calculation sesuai business rule:
            # User Requirement: "jumlah_upah_kotor = gaji_pokok + total_tunjangan + total_premi - Total potongan Upah Kotor"
            jumlah_upah_kotor = 0.0 # MOVED TO FRONTEND: (gaji_pokok + total_tunjangan + total_premi) - potongan_upah_kotor_total

            # Load constants from config
            config = self.config
            gaji_pokok_min = config.get('constants', {}).get('potongan_bpjs', {}).get('gaji_pokok_min', 3876600)

            # CARUMAN ASTEK - Calculate as percentage of salary base (including masa_kerja) instead of fixed amount
            # Using updated percentage rates: 2% for employee, 4.54% for employer
            caruman_base = gaji_pokok_min + masa_kerja_jumlah
            caruman_pekerja = round(caruman_base * 0.02, 2)  # 2% for employee
            caruman_majikan = round(caruman_base * 0.0454, 2)  # 4.54% for employer
            caruman_jumlah = round(caruman_pekerja + caruman_majikan, 2)

            # Map Caruman ASTEK to existing field names for compatibility
            pot_bpjs_pek = caruman_pekerja  # Caruman ASTEK Pekerja
            pot_bpjs_maj = caruman_majikan  # Caruman ASTEK Majikan
            pot_bpjs_jumlah = caruman_jumlah  # Caruman ASTEK Jumlah

            # BPJS Components - using updated formula: 
            # BPJS Pekerja = 1% Pensiun + 1% Kesehatan = 2% Total
            # BPJS Majikan = 2% Pensiun + 4% Kesehatan = 6% Total
            bpjs_components = self.calculate_bpjs_components(masa_kerja_jumlah)

            # Extract BPJS components for use in calculations
            pot_bpjs_kesehatan_pekerja = bpjs_components['kesehatan_pekerja']  # 1%
            pot_bpjs_kesehatan_majikan = bpjs_components['kesehatan_majikan']  # 4%
            pot_bpjs_pensiun_pekerja = bpjs_components['pensiun_pekerja']      # 1%
            pot_bpjs_pensiun_majikan = bpjs_components['pensiun_majikan']      # 2%
            pot_bpjs_pekerja_total = 0.0 # MOVED TO FRONTEND: bpjs_components['pekerja_total']          # Total yang dipotong (2%)
            total_bpjs_jumlah = 0.0 # MOVED TO FRONTEND: bpjs_components['jumlah']                      # Total keseluruhan untuk reporting

            # Backward compatibility fields
            pot_bpjs_kes = pot_bpjs_kesehatan_pekerja
            
            # Caruman ASTEK - Calculate as percentage of salary base (including masa_kerja) instead of fixed amount
            # Using updated percentage rates: 2% for employee, 4.54% for employer
            # pot_bpjs_pek IS pot_bpjs_pekerja_total
            pot_bpjs_pek = 0.0 # MOVED TO FRONTEND: pot_bpjs_pekerja_total
            pot_bpjs_maj = caruman_majikan  # Caruman ASTEK Majikan (Keep Backend as it's complex)
            pot_bpjs_jumlah = 0.0 # MOVED TO FRONTEND: caruman_jumlah

            # Initialize dynamic deduction accumulators
            pot_kontan = 0.0
            pot_thr = 0.0
            pot_pinjam = 0.0
            pot_kl = 0.0
            pot_tiket = 0.0
            pot_alat = 0.0

            # Extract specific deductions from dynamic values and calculate remaining
            remaining_dynamic_amount = 0.0
            for i in range(min(7, len(dyn_pot_maps))):
                val = dyn_pot_vals[i] if i < len(dyn_pot_vals) else 0.0
                is_extracted = False
                
                if i < len(dyn_pot_headers):
                    header = str(dyn_pot_headers[i]).lower()
                    
                    if "kontan" in header:
                        pot_kontan += val
                        is_extracted = True
                    elif "thr" in header:
                        pot_thr += val
                        is_extracted = True
                    elif "pot" in header and "pinjam" in header:
                        pot_pinjam += val
                        is_extracted = True
                    elif "potongan tiket" in header:
                        pot_tiket += val
                        is_extracted = True
                    elif "alat" in header:
                        pot_alat += val
                        is_extracted = True
                
                if not is_extracted:
                    remaining_dynamic_amount += val

            # Total potongan calculation with updated BPJS formula:
            # User Requirement: "Total Potongan Bersih" components:
            # Astek > Pekerja (pot_bpjs_pek)
            # Pot BPJS > Kesehatan > Pekerja (pot_bpjs_kesehatan_pekerja)
            # BPJS > Pensiun > Pekerja (pot_bpjs_pensiun_pekerja)
            # Iuran SPSI (pot_spsi)
            # PPh21 (pot_pph21)
            # Plus new optional columns

            # NEW: Premi PPH is a special deduction that gets ADDED to net salary (not subtracted)
            # So we calculate it separately and handle it differently in the final calculation
            pot_total_1 = pot_bpjs_kesehatan_pekerja  # BPJS Kesehatan Pekerja
            pot_total_2 = pot_bpjs_pensiun_pekerja      # BPJS Pensiun Pekerja
            pot_total_3 = pot_bpjs_pensiun_majikan      # BPJS Pensiun Majikan
            # pot_total_4 excluding employer BPJS contribution
            pot_total_4 = pot_pph21 + pot_kontan + pot_thr + pot_pinjam + pot_kl + pot_tiket + pot_alat + pot_spsi + pot_koreksi + pot_bpjs_pek

            # Calculate total deductions (these are subtracted from gross)
            total_potongan_bersih = pot_total_1 + pot_total_2 + pot_spsi + pot_pph21
            total_potongan = total_potongan_bersih  # Standard deductions that reduce net pay

            # Upah Kotor (Premi) matches jumlah_upah_kotor (which is Gross - Potongan Upah Kotor)
            upah_kotor_premi = jumlah_upah_kotor

            # Upah Bersih calculation
            # User Requirement: "Upah Bersih didaptkan dari Upah Kotor - Total Potongan (Bersih)"
            # BUT: Premi PPH is special - it gets ADDED to net salary (not subtracted)
            upah_bersih = upah_kotor_premi - total_potongan + premi_pph  # Add premi_pph instead of subtracting

            # Prepare nested premi dictionary
            premi_dict = {}
            
            # Add static brondol
            if premi_brondol > 0:
                premi_dict['premi_brondol'] = premi_brondol
                
            # Add dynamic fields
            for k, v in dynamic_premi_fields.items():
                if v > 0:
                    premi_dict[k] = v
            
            # Add total
            premi_dict['total_premi'] = total_premi
            # Add Upah Kotor (Premi) for frontend rendering
            premi_dict['upah_kotor_premi'] = upah_kotor_premi

            row = PayrollRow(
                no=i,
                jenis_kelamin=emp.get("jenis_kelamin", ""),
                nik=nik,
                nama=emp.get("nama", ""),
                phone=emp.get("phone", "-"),
                upah_dasar=payrate,
                hari_kerja=hari_kerja,
                upah_pokok=upah_pokok,
                cuti_tahunan_hari=int(cuti_tah_count),
                cuti_sakit_haid_hari=int(cuti_sakit_count),
                cuti_minggu_hari=int(cuti_minggu_hari),
                cuti_nasional_hari=int(cuti_nasional_hari),
                cuti_izin_hari=int(cuti_izin_hari),
                jumlah_hk=int(hk_count),
                gaji_pokok=gaji_pokok,
                beras_rate=beras_rate,
                beras_jumlah=beras_jumlah,
                jabatan_rate=jabatan_rate,
                jabatan_jumlah=jabatan_jumlah,
                masa_kerja_tahun=int(masa_kerja_tahun),
                masa_kerja_jumlah=masa_kerja_jumlah,
                masa_kerja_amount=masa_kerja_amount,
                lembur_jam=int(lembur_jam),
                lembur_jumlah=lembur_jumlah,
                total_tunjangan=total_tunjangan,
                
                premi_brondol=premi_brondol,
                
                # Nested premi dictionary (backward compatibility)
                premi=premi_dict,
                
                # Log for first employee to debug
                **( {'_debug_dyn_keys': str(list(dynamic_premi_fields.keys()))} if i == 1 and dynamic_premi_fields else {} ),
                
                # Add descriptive premi fields dynamically (e.g., premi_pruning, premi_harvesting)
                **dynamic_premi_fields,

                # Add flattened total_premi field for frontend compatibility
                total_premi=total_premi,

                jumlah_upah_kotor=jumlah_upah_kotor,
                pot_pph21=pot_pph21,
                premi_pph=premi_pph,  # NEW: Premi PPH that gets ADDED to net salary
                pot_kontan=float(emp.get('pot_kontan', 0.0)),
                pot_thr=pot_thr,
                pot_pinjam=pot_pinjam,
                pot_kl=pot_kl,
                pot_tiket=pot_tiket,
                pot_alat=pot_alat,
                pot_bpjs_kes=pot_bpjs_kes,
                pot_bpjs_pek=pot_bpjs_pek,
                pot_bpjs_maj=pot_bpjs_maj,
                pot_bpjs_kesehatan_pekerja=pot_bpjs_kesehatan_pekerja,
                pot_bpjs_kesehatan_majikan=pot_bpjs_kesehatan_majikan,
                pot_bpjs_pensiun_pekerja=pot_bpjs_pensiun_pekerja,
                pot_bpjs_pensiun_majikan=pot_bpjs_pensiun_majikan,
                # Total BPJS keseluruhan termasuk semua komponen (pekerja+majikan)
                pot_bpjs_jumlah=bpjs_components['jumlah'],
                pot_bpjs_pekerja_total=pot_bpjs_pekerja_total,  # Total BPJS Pekerja (2% dari base)
                pot_bpjs_kesehatan_total=0.0, # MOVED TO FRONTEND: bpjs_components['kesehatan_total'],  # Total BPJS Kesehatan
                pot_bpjs_pensiun_total=0.0, # MOVED TO FRONTEND: bpjs_components['pensiun_total'],  # Total BPJS Pensiun
                pot_total_1=pot_total_1,
                pot_total_2=pot_total_2,
                pot_total_3=pot_total_3,
                pot_total_4=pot_total_4,
                total_potongan=total_potongan,
                pot_spsi=pot_spsi,
                pot_koreksi=pot_koreksi,

                # New fields
                potongan_upah_kotor_total=potongan_upah_kotor_total,
                upah_kotor_premi=upah_kotor_premi,

                upah_bersih=upah_bersih
            )

            # VALIDATION (User Requirement Step 6)
            # Validation removed as aggregation is moved to frontend
            # See frontend/src/components/PayrollGrid.jsx for calculation logic

            rows.append(row)
        try:
            logger = logging.getLogger(__name__)
            fields = [
                'upah_dasar','hari_kerja','upah_pokok','beras_rate','beras_jumlah','jabatan_jumlah',
                'masa_kerja_tahun','masa_kerja_jumlah','masa_kerja_amount','lembur_jam','lembur_jumlah','total_tunjangan',
                'premi_brondol','premi_pruning','premi_angkut_material','premi_angkut_tbs','premi_harvesting',
                'premi_harvesting_incentive','premi_pupuk','total_premi','jumlah_upah_kotor','pot_pph21',
                'pot_bpjs_kes','pot_bpjs_pek','pot_bpjs_maj','total_potongan','upah_bersih'
            ]
            for f in fields:
                try:
                    values = { getattr(r, f) for r in rows }
                    if len(values) <= 1:
                        v = next(iter(values), None)
                        logger.info(f"Uniform {f} across rows: {v}")
                except Exception:
                    pass
        except Exception:
            pass
        # Filter out employees with jumlah HK = 0
        filtered_rows = [row for row in rows if getattr(row, 'jumlah_hk', 0) > 0]
        return filtered_rows

    def get_division_rows_parallel(self, division: str, month: int, year: int) -> Dict[str, List[PayrollRow]]:
        """
        Fetch payroll rows for all gangs in a division using parallel execution.
        Returns a dictionary mapping gang_code -> list of rows.
        """
        from app.services.gang_service import GangService
        from app.repositories.employee_repository_db import EmployeeRepositoryDB
        from concurrent.futures import ThreadPoolExecutor, as_completed

        gang_service = GangService()
        # Get gangs for division - use force=False to leverage cache if available
        gangs = gang_service.fetch_gangs_from_database(division=division, force=False)
        
        results = {}
        if not gangs:
            return results

        # Define a helper function for single gang execution
        def process_gang(g_code):
            # Create new repo instance for thread safety if needed (though DB singleton handles connection)
            local_repo = EmployeeRepositoryDB() 
            # Create a new loop/async runner isn't easy here since generate_rows is async.
            # However, generate_rows mostly does blocking DB calls.
            # Wait! generate_rows is async def. We cannot call it directly from ThreadPoolExecutor easily 
            # without an event loop in the thread.
            # BETTER APPROACH: generate_rows is async, so we should use asyncio.gather instead of ThreadPoolExecutor
            # if we are already in an async environment (FastAPI).
            pass

        # Since we are in FastAPI (async), we should use asyncio.gather
        # But this method is synchronous? No, let's make it async.
        return {} # Placeholder - implementation below will be async
    
    async def get_division_rows_parallel_async(self, division: str, month: int, year: int) -> Dict[str, List[PayrollRow]]:
        """
        Fetch payroll rows for all gangs in a division using asyncio.gather for concurrency.
        """
        from app.services.gang_service import GangService
        from app.repositories.employee_repository_db import EmployeeRepositoryDB
        import asyncio

        gang_service = GangService()
        gangs = gang_service.fetch_gangs_from_database(division=division, force=False)
        
        if not gangs:
            return {}

        repo = EmployeeRepositoryDB()
        tasks = []
        for gang in gangs:
            # Create task for each gang
            tasks.append(self.generate_rows(repo, gang_code=gang, month=month, year=year))

        # Run all tasks concurrently
        results_list = await asyncio.gather(*tasks, return_exceptions=True)
        
        final_results = {}
        for gang, result in zip(gangs, results_list):
            if isinstance(result, Exception):
                print(f"Error processing gang {gang}: {result}")
                final_results[gang] = []
            else:
                final_results[gang] = result
                
        return final_results
