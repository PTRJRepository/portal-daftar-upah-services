
import unittest
from typing import Optional, Dict, Any, List

# Mocking the necessary parts of PayrollService for testing logic
class MockPayrollService:
    def _scalar_optional(self, cur_row, idx=0, default=None):
        if not cur_row:
            return default
        try:
            v = cur_row[idx]
            return float(v) if v is not None else default
        except (IndexError, ValueError, TypeError):
            return default

    def calculate_total_tunjangan(self, hk_count: int, beras_payrate: float,
                                 jabatan_amount: float, masa_kerja_amount: float,
                                 lembur_amount: float) -> float:
        beras_jumlah = hk_count * beras_payrate if beras_payrate > 0 else 0
        return beras_jumlah + (jabatan_amount or 0) + (masa_kerja_amount or 0) + (lembur_amount or 0)

class TestAllowanceLogic(unittest.TestCase):
    def setUp(self):
        self.service = MockPayrollService()

    def test_scalar_optional_none(self):
        # Scenario: Database returns None (e.g. no record found -> None row, or row with None value)
        
        # Case 1: Row is None/Empty
        row = None
        result = self.service._scalar_optional(row, 0, default=None)
        self.assertIsNone(result, "Should return None when row is None")

        # Case 2: Row has None value
        row = (None,)
        result = self.service._scalar_optional(row, 0, default=None)
        self.assertIsNone(result, "Should return None when value is None")

        # Case 3: Row has value 0
        row = (0,)
        result = self.service._scalar_optional(row, 0, default=None)
        self.assertEqual(result, 0.0, "Should return 0.0 when value is 0")

    def test_scalar_optional_valid(self):
        row = (150000.0,)
        result = self.service._scalar_optional(row, 0)
        self.assertEqual(result, 150000.0)

        row = ("150000",)
        result = self.service._scalar_optional(row, 0)
        self.assertEqual(result, 150000.0)

    def test_total_tunjangan_calculation_with_none(self):
        # Scenario: Some allowances are None
        hk_count = 25
        beras_payrate = 1000
        jabatan = None
        masa_kerja = 50000
        lembur = None

        total = self.service.calculate_total_tunjangan(hk_count, beras_payrate, jabatan, masa_kerja, lembur)
        
        # Expected: (25 * 1000) + 0 + 50000 + 0 = 75000
        expected = 25000 + 50000
        self.assertEqual(total, expected, "Total should treat None as 0")

    def test_allowance_fields_logic(self):
        # Simulating the logic in generate_rows
        
        # 1. Tunjangan Jabatan
        # DB returns None
        jab_res = None
        jabatan_jumlah = self.service._scalar_optional(jab_res, 0)
        self.assertIsNone(jabatan_jumlah)

        # DB returns 0
        jab_res = (0,)
        jabatan_jumlah = self.service._scalar_optional(jab_res, 0)
        self.assertEqual(jabatan_jumlah, 0.0)

        # DB returns valid
        jab_res = (500000,)
        jabatan_jumlah = self.service._scalar_optional(jab_res, 0)
        self.assertEqual(jabatan_jumlah, 500000.0)

        # 2. Tunjangan Masa Kerja
        mk_amt_res = None
        masa_kerja_jumlah = self.service._scalar_optional(mk_amt_res, 0)
        self.assertIsNone(masa_kerja_jumlah)

        # 3. Tunjangan Lembur
        lembur_res = (None, None) # Amount, Jam
        lembur_jumlah = self.service._scalar_optional(lembur_res, 0)
        lembur_jam = self.service._scalar_optional(lembur_res, 1)
        self.assertIsNone(lembur_jumlah)
        self.assertIsNone(lembur_jam)

if __name__ == '__main__':
    unittest.main()
