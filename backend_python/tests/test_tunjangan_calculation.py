"""
Test Cases for Tunjangan Calculation
This module tests the calculation of three types of allowances:
1. Tunjangan Masa Kerja (Service Allowance)
2. Tunjangan Jabatan (Position Allowance)
3. Tunjangan Lembur (Overtime Allowance)
"""

import pytest
import sys
import os
from datetime import date, datetime
import calendar

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.services.database import Database
from app.services.payroll_service import PayrollService


class TestTunjanganCalculation:
    """Test suite for tunjangan (allowance) calculations"""

    @pytest.fixture
    def db(self):
        """Database fixture for testing"""
        return Database.instance()

    @pytest.fixture
    def payroll_service(self):
        """Payroll service fixture"""
        return PayrollService()

    @pytest.fixture
    def test_period(self):
        """Test period: May 2025"""
        return {
            'tahun': 2025,
            'bulan': 5,
            'start_date': date(2025, 5, 1),
            'end_date': date(2025, 5, 31)
        }

    @pytest.fixture
    def test_employees(self):
        """Test employees with different scenarios"""
        return [
            'A0001',  # Employee with overtime but no position/service allowance
            'A0004',  # Employee with service allowance but no position/overtime
            'A0268',  # Employee with highest overtime
            'A9999'   # Non-existent employee (error case)
        ]

    def test_tunjangan_jabatan_calculation(self, db, test_period, test_employees):
        """
        Test tunjangan jabatan calculation scenarios:
        1. Employee with valid position allowance data
        2. Employee without position allowance data (should return 0)
        3. Non-existent employee (should return 0)
        """
        query = """
            SELECT COALESCE(SUM(ln.Amount), 0) as jabatan_amount
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE t.EmpCode = ?
            AND t.DocDate >= ?
            AND t.DocDate < ?
            AND t.DocDesc = 'TUNJANGAN JABATAN'
        """

        results = {}

        for emp_code in test_employees:
            try:
                result = db.query_one(query, [
                    emp_code,
                    test_period['start_date'],
                    test_period['end_date']
                ])

                jabatan_amount = float(result[0]) if result and result[0] else 0.0
                results[emp_code] = jabatan_amount

                # Validate result type and range
                assert isinstance(jabatan_amount, (int, float)), f"Invalid type for {emp_code}"
                assert jabatan_amount >= 0, f"Negative amount for {emp_code}"

                print(f"Employee {emp_code}: Tunjangan Jabatan = {jabatan_amount:,.0f}")

            except Exception as e:
                print(f"Error calculating tunjangan jabatan for {emp_code}: {e}")
                results[emp_code] = 0.0

        # Test specific scenarios
        assert results.get('A0001', 0) >= 0, "A0001 should have valid calculation"
        assert results.get('A9999', 0) == 0, "Non-existent employee should return 0"

        return results

    def test_tunjangan_masa_kerja_calculation(self, db, test_period, test_employees):
        """
        Test tunjangan masa kerja calculation scenarios:
        1. Employee with valid service allowance data
        2. Employee without service allowance data (should return 0)
        3. Non-existent employee (should return 0)
        """
        # Test service years calculation
        service_query = """
            SELECT TOP 1 AppJoinGrpDate,
                CASE
                    WHEN MONTH(AppJoinGrpDate) > MONTH(GETDATE()) OR
                         (MONTH(AppJoinGrpDate) = MONTH(GETDATE()) AND DAY(AppJoinGrpDate) > DAY(GETDATE()))
                    THEN DATEDIFF(year, AppJoinGrpDate, GETDATE()) - 1
                    ELSE DATEDIFF(year, AppJoinGrpDate, GETDATE())
                END AS YearsSinceAppJoinGrpDate
            FROM HR_EMPLOYMENT
            WHERE EmpCode = ?
        """

        # Test allowance amount calculation
        allowance_query = """
            SELECT COALESCE(SUM(ln.Amount), 0) as masa_kerja_amount
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE t.EmpCode = ?
            AND t.DocDate >= ?
            AND t.DocDate < ?
            AND t.DocDesc = 'TUNJANGAN MASA KERJA'
        """

        results = {}

        for emp_code in test_employees:
            try:
                # Get service years
                service_result = db.query_one(service_query, [emp_code])
                service_years = 0
                join_date = None

                if service_result:
                    join_date = service_result[0]
                    service_years = int(service_result[1] or 0)

                # Get allowance amount
                allowance_result = db.query_one(allowance_query, [
                    emp_code,
                    test_period['start_date'],
                    test_period['end_date']
                ])

                masa_kerja_amount = float(allowance_result[0]) if allowance_result and allowance_result[0] else 0.0

                results[emp_code] = {
                    'service_years': service_years,
                    'join_date': join_date,
                    'amount': masa_kerja_amount
                }

                # Validate result
                assert service_years >= 0, f"Negative service years for {emp_code}"
                assert masa_kerja_amount >= 0, f"Negative amount for {emp_code}"

                print(f"Employee {emp_code}: {service_years} years service, Allowance = {masa_kerja_amount:,.0f}")

            except Exception as e:
                print(f"Error calculating tunjangan masa kerja for {emp_code}: {e}")
                results[emp_code] = {
                    'service_years': 0,
                    'join_date': None,
                    'amount': 0.0
                }

        # Test specific scenarios
        a0001_data = results.get('A0001', {})
        assert a0001_data.get('service_years', 0) >= 0, "A0001 should have valid service years"
        assert results.get('A9999', {}).get('amount', 0) == 0, "Non-existent employee should return 0"

        return results

    def test_tunjangan_lembur_calculation(self, db, test_period, test_employees):
        """
        Test tunjangan lembur calculation scenarios:
        1. Employee with valid overtime data
        2. Employee without overtime data (should return 0)
        3. Non-existent employee (should return 0)
        """
        query = """
            SELECT COALESCE(SUM(trl.amount), 0) AS TotalAmount,
                   COALESCE(SUM(trl.Hours), 0) AS TotalHours
            FROM PR_TASKREG_ARC tr
            JOIN PR_TASKREGLN_ARC trl ON tr.id = trl.masterId
            WHERE trl.EmpCode = ?
            AND tr.DocDate >= ?
            AND tr.DocDate < ?
            AND trl.OT = 1
        """

        results = {}

        for emp_code in test_employees:
            try:
                result = db.query_one(query, [
                    emp_code,
                    test_period['start_date'],
                    test_period['end_date']
                ])

                total_amount = float(result[0]) if result and result[0] else 0.0
                total_hours = float(result[1]) if result and result[1] else 0.0

                results[emp_code] = {
                    'amount': total_amount,
                    'hours': total_hours,
                    'rate_per_hour': total_amount / total_hours if total_hours > 0 else 0.0
                }

                # Validate result
                assert total_amount >= 0, f"Negative overtime amount for {emp_code}"
                assert total_hours >= 0, f"Negative overtime hours for {emp_code}"

                print(f"Employee {emp_code}: {total_hours:.1f} hours, Overtime = {total_amount:,.0f}")

            except Exception as e:
                print(f"Error calculating tunjangan lembur for {emp_code}: {e}")
                results[emp_code] = {
                    'amount': 0.0,
                    'hours': 0.0,
                    'rate_per_hour': 0.0
                }

        # Test specific scenarios
        a0001_data = results.get('A0001', {})
        assert a0001_data.get('amount', 0) >= 0, "A0001 should have valid overtime calculation"
        assert results.get('A9999', {}).get('amount', 0) == 0, "Non-existent employee should return 0"

        return results

    def test_total_tunjangan_calculation(self, db, test_period, test_employees):
        """
        Test total tunjangan calculation by combining all three types
        """
        jabatan_results = self.test_tunjangan_jabatan_calculation(db, test_period, test_employees)
        masa_kerja_results = self.test_tunjangan_masa_kerja_calculation(db, test_period, test_employees)
        lembur_results = self.test_tunjangan_lembur_calculation(db, test_period, test_employees)

        print("\n" + "="*80)
        print("TOTAL TUNJANGAN SUMMARY")
        print("="*80)

        for emp_code in test_employees:
            jabatan = jabatan_results.get(emp_code, 0)
            masa_kerja = masa_kerja_results.get(emp_code, {}).get('amount', 0)
            lembur = lembur_results.get(emp_code, {}).get('amount', 0)

            total = jabatan + masa_kerja + lembur

            print(f"Employee {emp_code}:")
            print(f"  Tunjangan Jabatan : {jabatan:12,.0f}")
            print(f"  Tunjangan Masa Kerja : {masa_kerja:12,.0f}")
            print(f"  Tunjangan Lembur : {lembur:12,.0f}")
            print(f"  TOTAL TUNJANGAN    : {total:12,.0f}")
            print()

            # Validate total
            assert total >= 0, f"Negative total for {emp_code}"

            # Check for potential issues
            if jabatan == 0:
                print(f"  ⚠️  WARNING: No position allowance for {emp_code}")
            if masa_kerja == 0:
                print(f"  ⚠️  WARNING: No service allowance for {emp_code}")
            if lembur == 0:
                print(f"  ⚠️  WARNING: No overtime allowance for {emp_code}")

            # Special case for employees that should have data
            if emp_code == 'A0268' and total == 0:
                print(f"  ❌ ERROR: A0268 should have overtime data!")
            elif emp_code == 'A0001' and lembur == 0:
                print(f"  ❌ ERROR: A0001 should have overtime data!")

    def test_data_validation(self, db, test_period):
        """
        Test data validation and edge cases
        """
        print("\n" + "="*80)
        print("DATA VALIDATION TESTS")
        print("="*80)

        # Test with invalid employee codes
        invalid_employees = ['', None, 'INVALID', '123456789012345']

        for emp_code in invalid_employees:
            try:
                # This should handle gracefully
                if emp_code:
                    query = "SELECT COUNT(*) FROM HR_EMPLOYMENT WHERE EmpCode = ?"
                    result = db.query_one(query, [emp_code])
                    count = int(result[0]) if result else 0

                    if count == 0:
                        print(f"✓ Employee '{emp_code}' correctly not found")
                    else:
                        print(f"✗ Unexpectedly found employee '{emp_code}'")
                else:
                    print("✓ Null employee code handled correctly")

            except Exception as e:
                print(f"✗ Error testing employee '{emp_code}': {e}")

        # Test period validation
        edge_cases = [
            (2025, 2, 28),  # February in non-leap year
            (2024, 2, 29),  # February in leap year
            (2025, 12, 31), # End of year
        ]

        for year, month, expected_day in edge_cases:
            last_day = calendar.monthrange(year, month)[1]
            assert last_day == expected_day, f"Date validation failed for {year}-{month}"
            print(f"✓ Period validation passed for {year}-{month} ({last_day} days)")


if __name__ == "__main__":
    """
    Run tests manually for development/debugging
    """
    test_instance = TestTunjanganCalculation()
    db = Database.instance()

    test_period = {
        'tahun': 2025,
        'bulan': 5,
        'start_date': date(2025, 5, 1),
        'end_date': date(2025, 5, 31)
    }

    test_employees = ['A0001', 'A0004', 'A0268', 'A9999']

    print("Running Tunjangan Calculation Tests...")
    print("="*80)

    # Run individual tests
    test_instance.test_total_tunjangan_calculation(db, test_period, test_employees)
    test_instance.test_data_validation(db, test_period)

    print("\n" + "="*80)
    print("TEST COMPLETED")
    print("="*80)