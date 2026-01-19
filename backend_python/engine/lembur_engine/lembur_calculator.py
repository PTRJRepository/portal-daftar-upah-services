"""
Lembur Calculator - Main Orchestrator

Coordinates all components to calculate overtime payments for employees.
"""

from datetime import date
from typing import Optional

from .config_loader import load_upj
from .models import DayType, OvertimeRecord, LemburResult
from .day_classifier import classify_day
from .rate_calculator import calculate_overtime_payment
from .db_service import LemburDBService


class LemburCalculator:
    """
    Main calculator class for overtime payment calculations
    
    Usage:
        calculator = LemburCalculator()
        result = calculator.calculate('B0497', 11, 2025)
        print(f"Total: {result.total_payment}")
    """
    
    def __init__(self, db_profile: str = None):
        """
        Initialize calculator
        
        Args:
            db_profile: Database profile to use (default from env)
        """
        self.db_service = LemburDBService(db_profile)
        self._upj = None
        self._holidays_cache = {}  # Cache holidays by year
    
    @property
    def upj(self) -> float:
        """Get UPJ (Upah Per Jam), cached after first load"""
        if self._upj is None:
            self._upj = load_upj()
        return self._upj
    
    def _get_holidays(self, year: int):
        """Get holidays for a year with caching"""
        if year not in self._holidays_cache:
            self._holidays_cache[year] = self.db_service.get_holidays(year)
        return self._holidays_cache[year]
    
    def calculate(
        self,
        emp_code: str,
        month: int,
        year: int
    ) -> LemburResult:
        """
        Calculate overtime payment for an employee in a specific month
        
        Args:
            emp_code: Employee code
            month: Month (1-12)
            year: Year
            
        Returns:
            LemburResult with all overtime records and calculations
        """
        # Fetch overtime records from database
        records = self.db_service.get_overtime_records(emp_code, month, year)
        
        # Get holidays for the year
        holidays = self._get_holidays(year)
        
        # Get employee name (from first record or database)
        emp_name = ""
        if records:
            emp_name = records[0].emp_name
        if not emp_name:
            emp_name = self.db_service.get_employee_name(emp_code) or emp_code
        
        # Process each record
        for record in records:
            # Classify the day type
            record.day_type = classify_day(record.trx_date, holidays)
            
            # Calculate payment breakdown
            record.breakdown = calculate_overtime_payment(
                record.hours,
                record.day_type,
                self.upj
            )
        
        # Build result
        result = LemburResult(
            emp_code=emp_code,
            emp_name=emp_name,
            month=month,
            year=year,
            upj=self.upj,
            records=records
        )
        
        return result
    
    def calculate_hours_only(
        self,
        hours: float,
        day_type: DayType
    ) -> dict:
        """
        Calculate payment for a specific number of hours (engine-only mode)
        
        This is useful for quick calculations without database access.
        
        Args:
            hours: Number of overtime hours
            day_type: Type of day
            
        Returns:
            Dictionary with breakdown and total
        """
        breakdown = calculate_overtime_payment(hours, day_type, self.upj)
        return {
            'hours': hours,
            'day_type': day_type.value,
            'upj': self.upj,
            **breakdown.to_dict()
        }
    
    def calculate_batch(
        self,
        emp_codes: list,
        month: int,
        year: int
    ) -> dict:
        """
        Calculate overtime payment for MULTIPLE employees in ONE call (batch mode)
        
        This is significantly faster than calling calculate() for each employee
        because it uses a single batch query to fetch all overtime records.
        
        Args:
            emp_codes: List of employee codes
            month: Month (1-12)
            year: Year
            
        Returns:
            Dictionary mapping emp_code to LemburResult
        """
        if not emp_codes:
            return {}
        
        # Fetch ALL overtime records in ONE query
        all_records = self.db_service.get_overtime_records_batch(emp_codes, month, year)
        
        # Get holidays for the year (cached)
        holidays = self._get_holidays(year)
        
        # Process each employee's records
        results = {}
        for emp_code in emp_codes:
            records = all_records.get(emp_code, [])
            
            # Process each record
            for record in records:
                # Classify the day type
                record.day_type = classify_day(record.trx_date, holidays)
                
                # Calculate payment breakdown
                record.breakdown = calculate_overtime_payment(
                    record.hours,
                    record.day_type,
                    self.upj
                )
            
            # Build result
            result = LemburResult(
                emp_code=emp_code,
                emp_name=emp_code,  # Skip name lookup for batch mode (performance)
                month=month,
                year=year,
                upj=self.upj,
                records=records
            )
            
            results[emp_code] = result
        
        return results
    
    def calculate_batch_amounts(
        self,
        emp_codes: list,
        month: int,
        year: int
    ) -> dict:
        """
        Calculate ONLY the total payment amounts for multiple employees (fastest mode)
        
        Use this when you only need the final amounts, not full LemburResult objects.
        
        Args:
            emp_codes: List of employee codes
            month: Month (1-12)
            year: Year
            
        Returns:
            Dictionary mapping emp_code to total payment amount (float)
        """
        batch_results = self.calculate_batch(emp_codes, month, year)
        return {
            emp_code: result.total_payment
            for emp_code, result in batch_results.items()
        }
    
    def close(self):
        """Close database connections"""
        self.db_service.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def quick_calculate(hours: float, day_type_str: str = "WORKDAY_LONG", is_short_day: bool = False) -> dict:
    """
    Quick calculation without database (engine only)
    
    Args:
        hours: Overtime hours
        day_type_str: Day type string (WORKDAY_LONG, WORKDAY_SHORT, SUNDAY, 
                      HOLIDAY_REGULAR, HOLIDAY_RELIGIOUS)
        is_short_day: True if this is a short day (Friday) - affects holiday tier boundaries
    
    Returns:
        Calculation result dictionary
    """
    try:
        day_type = DayType(day_type_str)
    except ValueError:
        day_type = DayType.WORKDAY_LONG
    
    upj = load_upj()
    breakdown = calculate_overtime_payment(hours, day_type, upj, is_short_day)
    
    return {
        'hours': hours,
        'day_type': day_type.value,
        'day_type_display': day_type.get_display_name(),
        'upj': upj,
        'is_short_day': is_short_day,
        **breakdown.to_dict()
    }


if __name__ == "__main__":
    # Quick test
    print("=== Lembur Calculator Test (3-Tier System) ===\n")
    
    # Test workday
    print("1. 5 jam hari kerja (1x1.5 + 4x2 = 9.5):")
    result = quick_calculate(5, "WORKDAY_LONG")
    print(f"   Tier 1: {result['tier_1_hours']:.0f}h x {result['tier_1_rate']}x = Rp {result['tier_1_amount']:,.2f}")
    print(f"   Tier 2: {result['tier_2_hours']:.0f}h x {result['tier_2_rate']}x = Rp {result['tier_2_amount']:,.2f}")
    print(f"   Total Rate: {result['total_rate']} | TOTAL: Rp {result['total_amount']:,.2f}")
    
    # Test Sunday on long day
    print("\n2. 10 jam minggu (long: 7x2 + 1x3 + 2x4 = 25):")
    result = quick_calculate(10, "SUNDAY", is_short_day=False)
    print(f"   Tier 1: {result['tier_1_hours']:.0f}h x {result['tier_1_rate']}x = Rp {result['tier_1_amount']:,.2f}")
    print(f"   Tier 2: {result['tier_2_hours']:.0f}h x {result['tier_2_rate']}x = Rp {result['tier_2_amount']:,.2f}")
    print(f"   Tier 3: {result['tier_3_hours']:.0f}h x {result['tier_3_rate']}x = Rp {result['tier_3_amount']:,.2f}")
    print(f"   Total Rate: {result['total_rate']} | TOTAL: Rp {result['total_amount']:,.2f}")
    
    # Test Sunday on short day (Friday)
    print("\n3. 10 jam minggu (short/Fri: 5x2 + 1x3 + 4x4 = 29):")
    result = quick_calculate(10, "SUNDAY", is_short_day=True)
    print(f"   Tier 1: {result['tier_1_hours']:.0f}h x {result['tier_1_rate']}x = Rp {result['tier_1_amount']:,.2f}")
    print(f"   Tier 2: {result['tier_2_hours']:.0f}h x {result['tier_2_rate']}x = Rp {result['tier_2_amount']:,.2f}")
    print(f"   Tier 3: {result['tier_3_hours']:.0f}h x {result['tier_3_rate']}x = Rp {result['tier_3_amount']:,.2f}")
    print(f"   Total Rate: {result['total_rate']} | TOTAL: Rp {result['total_amount']:,.2f}")
    
    # Test religious holiday
    print("\n4. 8 jam libur keagamaan (long: 7x3 + 1x4 = 25):")
    result = quick_calculate(8, "HOLIDAY_RELIGIOUS", is_short_day=False)
    print(f"   Tier 1: {result['tier_1_hours']:.0f}h x {result['tier_1_rate']}x = Rp {result['tier_1_amount']:,.2f}")
    print(f"   Tier 2: {result['tier_2_hours']:.0f}h x {result['tier_2_rate']}x = Rp {result['tier_2_amount']:,.2f}")
    print(f"   Tier 3: {result['tier_3_hours']:.0f}h x {result['tier_3_rate']}x = Rp {result['tier_3_amount']:,.2f}")
    print(f"   Total Rate: {result['total_rate']} | TOTAL: Rp {result['total_amount']:,.2f}")

