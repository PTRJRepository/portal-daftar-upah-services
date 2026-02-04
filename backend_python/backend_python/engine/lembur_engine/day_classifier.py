"""
Day Classifier for Lembur Engine

Classifies dates into day types based on:
1. Day of week (Sunday, Friday, other workdays)
2. Public holidays from HR_GPH table
"""

from datetime import date
from typing import Dict, Optional

from .models import DayType, HolidayInfo


def classify_day(
    target_date: date,
    holidays: Dict[date, HolidayInfo] = None
) -> DayType:
    """
    Classify a date into a day type for overtime calculation
    
    Classification priority:
    1. Check if it's a religious public holiday (IsRegionPH=1) → HOLIDAY_RELIGIOUS
    2. Check if it's a regular public holiday → HOLIDAY_REGULAR  
    3. Check if it's Sunday → SUNDAY
    4. Check if it's Friday → WORKDAY_SHORT
    5. Otherwise → WORKDAY_LONG (Mon-Thu, Sat)
    
    Args:
        target_date: The date to classify
        holidays: Dictionary of holiday dates to HolidayInfo
        
    Returns:
        DayType enum value
    """
    holidays = holidays or {}
    
    # Check holidays first (takes precedence over day of week)
    if target_date in holidays:
        holiday = holidays[target_date]
        if holiday.is_religious:
            return DayType.HOLIDAY_RELIGIOUS
        else:
            return DayType.HOLIDAY_REGULAR
    
    # Check day of week
    day_of_week = target_date.weekday()  # 0=Monday, 6=Sunday
    
    if day_of_week == 6:  # Sunday
        return DayType.SUNDAY
    elif day_of_week == 4:  # Friday
        return DayType.WORKDAY_SHORT
    else:  # Monday-Thursday, Saturday
        return DayType.WORKDAY_LONG


def get_day_name_indonesian(target_date: date) -> str:
    """Get Indonesian day name"""
    days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
    return days[target_date.weekday()]


def is_weekend(target_date: date) -> bool:
    """Check if date is a weekend (Sunday only for overtime purposes)"""
    return target_date.weekday() == 6


def is_workday(target_date: date, holidays: Dict[date, HolidayInfo] = None) -> bool:
    """Check if date is a regular workday (not Sunday or holiday)"""
    day_type = classify_day(target_date, holidays)
    return day_type in (DayType.WORKDAY_LONG, DayType.WORKDAY_SHORT)


if __name__ == "__main__":
    # Quick test
    from datetime import date
    
    test_dates = [
        date(2025, 12, 8),   # Monday
        date(2025, 12, 12),  # Friday
        date(2025, 12, 14),  # Sunday
        date(2025, 12, 25),  # Christmas (if in holidays dict)
    ]
    
    print("Day Classification Test:")
    for d in test_dates:
        day_type = classify_day(d)
        day_name = get_day_name_indonesian(d)
        print(f"  {d} ({day_name}): {day_type.value}")
