"""
Rate Calculator for Lembur Engine

Calculates tiered overtime payment based on day type and hours worked.

HARI KERJA (Workdays): 2-tier system
  - Jam 1: 1.5x
  - Jam 2+: 2x
  - Example: 5 jam = 1x1.5 + 4x2 = 9.5 total rate

HARI LIBUR (Holidays): 3-tier system with variable tier-1 boundary
  - Tier 1 boundary: 5 hours (if Friday) or 7 hours (other days)
  
  Sunday/Regular Holiday: 2x, 3x, 4x
  - 6 jam (long day): 6x2 = 12 (all tier 1)
  - 10 jam (short day/Friday): 5x2 + 1x3 + 4x4 = 10+3+16 = 29
  
  Religious Holiday: 3x, 4x, 4x
  - 8 jam (long day): 7x3 + 1x4 = 21+4 = 25
  - 6 jam (short day): 5x3 + 1x4 = 15+4 = 19
"""

from datetime import date
from .models import DayType, OvertimeBreakdown
from .config_loader import get_overtime_rates


def calculate_overtime_payment(
    hours: float,
    day_type: DayType,
    upj: float,
    is_short_day: bool = False,
    trx_date: date = None
) -> OvertimeBreakdown:
    """
    Calculate overtime payment with tiered rates
    
    Args:
        hours: Number of overtime hours
        day_type: Type of day (workday, sunday, holiday)
        upj: Upah per jam (hourly base wage)
        is_short_day: True if overtime is on Friday (short day) - affects holiday tier-1 boundary
        trx_date: Transaction date - used to determine if short day when is_short_day not specified
        
    Returns:
        OvertimeBreakdown with detailed payment information
    """
    rates = get_overtime_rates()
    day_rates = rates.get(day_type.value, rates['WORKDAY_LONG'])
    
    tier_1_rate = day_rates['tier_1_rate']
    tier_2_rate = day_rates['tier_2_rate']
    tier_3_rate = day_rates['tier_3_rate']
    
    # Determine tier 1 boundary
    if day_type in [DayType.WORKDAY_LONG, DayType.WORKDAY_SHORT]:
        # Workday: simple 2-tier (1 hour at tier 1, rest at tier 2)
        tier_1_boundary = day_rates.get('tier_1_boundary', 1)
        # For workdays, tier 2 continues indefinitely (no tier 3 distinction)
        tier_2_boundary = 999  # Effectively infinite
    else:
        # Holiday/Sunday: 3-tier with variable boundary based on day
        # If trx_date provided, check if it's Friday
        if trx_date is not None:
            is_short_day = trx_date.weekday() == 4  # Friday = 4
        
        if is_short_day:
            tier_1_boundary = day_rates.get('tier_1_boundary_short', 5)
        else:
            tier_1_boundary = day_rates.get('tier_1_boundary_long', 7)
        
        # Tier 2 is 1 hour after tier 1
        tier_2_boundary = tier_1_boundary + 1
    
    # Calculate hours in each tier
    if hours <= 0:
        return OvertimeBreakdown(
            tier_1_rate=tier_1_rate, tier_1_hours=0, tier_1_amount=0, tier_1_boundary=tier_1_boundary,
            tier_2_rate=tier_2_rate, tier_2_hours=0, tier_2_amount=0,
            tier_3_rate=tier_3_rate, tier_3_hours=0, tier_3_amount=0,
            total_rate=0, total_amount=0
        )
    
    # Tier 1 hours
    tier_1_hours = min(hours, tier_1_boundary)
    tier_1_amount = upj * tier_1_rate * tier_1_hours
    
    # Tier 2 hours
    remaining_after_t1 = max(0, hours - tier_1_boundary)
    if day_type in [DayType.WORKDAY_LONG, DayType.WORKDAY_SHORT]:
        # Workday: all remaining goes to tier 2
        tier_2_hours = remaining_after_t1
        tier_3_hours = 0
    else:
        # Holiday: 1 hour for tier 2, rest to tier 3
        tier_2_hours = min(remaining_after_t1, 1)
        tier_3_hours = max(0, remaining_after_t1 - 1)
    
    tier_2_amount = upj * tier_2_rate * tier_2_hours
    tier_3_amount = upj * tier_3_rate * tier_3_hours
    
    # Total
    total_rate = (tier_1_rate * tier_1_hours) + (tier_2_rate * tier_2_hours) + (tier_3_rate * tier_3_hours)
    total_amount = tier_1_amount + tier_2_amount + tier_3_amount
    
    return OvertimeBreakdown(
        tier_1_rate=tier_1_rate,
        tier_1_hours=tier_1_hours,
        tier_1_amount=round(tier_1_amount, 2),
        tier_1_boundary=tier_1_boundary,
        tier_2_rate=tier_2_rate,
        tier_2_hours=tier_2_hours,
        tier_2_amount=round(tier_2_amount, 2),
        tier_3_rate=tier_3_rate,
        tier_3_hours=tier_3_hours,
        tier_3_amount=round(tier_3_amount, 2),
        total_rate=round(total_rate, 2),
        total_amount=round(total_amount, 2)
    )


def calculate_batch(records: list, upj: float) -> list:
    """
    Calculate overtime for multiple records
    
    Args:
        records: List of OvertimeRecord objects with day_type set
        upj: Base hourly wage
        
    Returns:
        Same records list with breakdown populated
    """
    for record in records:
        if record.day_type:
            record.breakdown = calculate_overtime_payment(
                record.hours,
                record.day_type,
                upj,
                trx_date=record.trx_date  # Pass date to determine short/long day
            )
    return records


def format_currency(amount: float) -> str:
    """Format amount as Indonesian Rupiah"""
    return f"Rp {amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


if __name__ == "__main__":
    # Quick test
    from .config_loader import load_upj
    from datetime import date
    
    upj = load_upj()
    print(f"UPJ: {format_currency(upj)}")
    print()
    
    # Test cases based on user examples
    test_cases = [
        # Workday tests
        (5, DayType.WORKDAY_LONG, False, "5 jam hari kerja = 1x1.5 + 4x2 = 9.5"),
        (3, DayType.WORKDAY_LONG, False, "3 jam hari kerja = 1x1.5 + 2x2 = 5.5"),
        
        # Sunday/Holiday on long day (tier 1 = 7h)
        (6, DayType.SUNDAY, False, "6 jam minggu (long) = 6x2 = 12"),
        (10, DayType.SUNDAY, False, "10 jam minggu (long) = 7x2 + 1x3 + 2x4 = 14+3+8 = 25"),
        
        # Sunday/Holiday on short day (tier 1 = 5h) 
        (10, DayType.SUNDAY, True, "10 jam minggu (short/Fri) = 5x2 + 1x3 + 4x4 = 10+3+16 = 29"),
        
        # Religious holiday on long day
        (8, DayType.HOLIDAY_RELIGIOUS, False, "8 jam libur keagamaan (long) = 7x3 + 1x4 = 21+4 = 25"),
        
        # Religious holiday on short day
        (6, DayType.HOLIDAY_RELIGIOUS, True, "6 jam libur keagamaan (short) = 5x3 + 1x4 = 15+4 = 19"),
        (10, DayType.HOLIDAY_RELIGIOUS, True, "10 jam libur keagamaan (short) = 5x3 + 1x4 + 4x4 = 15+4+16 = 35"),
    ]
    
    for hours, day_type, is_short, desc in test_cases:
        breakdown = calculate_overtime_payment(hours, day_type, upj, is_short)
        print(f"{desc}")
        print(f"  Tier 1: {breakdown.tier_1_hours:.0f}h x {breakdown.tier_1_rate}x = {format_currency(breakdown.tier_1_amount)}")
        print(f"  Tier 2: {breakdown.tier_2_hours:.0f}h x {breakdown.tier_2_rate}x = {format_currency(breakdown.tier_2_amount)}")
        print(f"  Tier 3: {breakdown.tier_3_hours:.0f}h x {breakdown.tier_3_rate}x = {format_currency(breakdown.tier_3_amount)}")
        print(f"  Total Rate: {breakdown.total_rate} | TOTAL: {format_currency(breakdown.total_amount)}")
        print()
