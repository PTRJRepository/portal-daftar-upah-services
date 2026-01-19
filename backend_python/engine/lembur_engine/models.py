"""
Data Models for Lembur Engine

Defines data structures for overtime records and calculations
"""

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import List, Optional


class DayType(Enum):
    """Classification of day types for overtime calculation"""
    
    WORKDAY_LONG = "WORKDAY_LONG"       # Mon, Tue, Wed, Thu, Sat (7+ hours before OT)
    WORKDAY_SHORT = "WORKDAY_SHORT"     # Friday (5+ hours before OT)
    SUNDAY = "SUNDAY"                   # Sunday (OT from first hour)
    HOLIDAY_REGULAR = "HOLIDAY_REGULAR" # Non-religious public holiday
    HOLIDAY_RELIGIOUS = "HOLIDAY_RELIGIOUS"  # Religious public holiday (IsRegionPH=1)

    def get_display_name(self) -> str:
        """Return user-friendly display name"""
        names = {
            DayType.WORKDAY_LONG: "Hari Kerja",
            DayType.WORKDAY_SHORT: "Jumat",
            DayType.SUNDAY: "Minggu",
            DayType.HOLIDAY_REGULAR: "Libur Umum",
            DayType.HOLIDAY_RELIGIOUS: "Libur Keagamaan"
        }
        return names.get(self, self.value)


@dataclass
class HolidayInfo:
    """Holiday information from HR_GPH table"""
    code: str                   # GPHCode
    description: str            # Description
    holiday_date: date          # HolidayDate
    is_religious: bool          # IsRegionPH = 1


@dataclass
class OvertimeBreakdown:
    """Breakdown of overtime payment calculation (3-tier system)"""
    # Tier 1 (first tier - hours depend on day type)
    tier_1_rate: float          # Rate multiplier for tier 1
    tier_1_hours: float         # Hours at tier 1
    tier_1_amount: float        # Payment for tier 1
    tier_1_boundary: float      # Max hours in tier 1 (1h workday, 5-7h holiday)
    
    # Tier 2 (second tier - 1 hour for holidays)
    tier_2_rate: float          # Rate multiplier for tier 2
    tier_2_hours: float         # Hours at tier 2
    tier_2_amount: float        # Payment for tier 2
    
    # Tier 3 (remaining hours)
    tier_3_rate: float          # Rate multiplier for tier 3
    tier_3_hours: float         # Hours at tier 3
    tier_3_amount: float        # Payment for tier 3
    
    # Totals
    total_rate: float           # Sum of all rate multipliers (for display)
    total_amount: float         # Total payment
    
    def to_dict(self) -> dict:
        return {
            'tier_1_rate': self.tier_1_rate,
            'tier_1_hours': self.tier_1_hours,
            'tier_1_amount': self.tier_1_amount,
            'tier_1_boundary': self.tier_1_boundary,
            'tier_2_rate': self.tier_2_rate,
            'tier_2_hours': self.tier_2_hours,
            'tier_2_amount': self.tier_2_amount,
            'tier_3_rate': self.tier_3_rate,
            'tier_3_hours': self.tier_3_hours,
            'tier_3_amount': self.tier_3_amount,
            'total_rate': self.total_rate,
            'total_amount': self.total_amount
        }


@dataclass
class OvertimeRecord:
    """Single overtime record from database"""
    id: int                     # Record ID
    emp_code: str               # Employee code
    emp_name: str               # Employee name
    trx_date: date              # Transaction date
    hours: float                # Overtime hours
    day_type: Optional[DayType] = None  # Classified day type
    breakdown: Optional[OvertimeBreakdown] = None  # Payment breakdown
    
    # Additional database fields
    task_code: Optional[str] = None
    shift_code: Optional[str] = None
    charge_to: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'emp_code': self.emp_code,
            'emp_name': self.emp_name,
            'trx_date': self.trx_date.isoformat() if self.trx_date else None,
            'hours': self.hours,
            'day_type': self.day_type.value if self.day_type else None,
            'day_type_display': self.day_type.get_display_name() if self.day_type else None,
            'breakdown': self.breakdown.to_dict() if self.breakdown else None,
            'task_code': self.task_code,
            'shift_code': self.shift_code,
            'charge_to': self.charge_to
        }


@dataclass
class LemburResult:
    """Result of lembur calculation for an employee"""
    emp_code: str
    emp_name: str
    month: int
    year: int
    upj: float                  # UPJ used for calculation
    records: List[OvertimeRecord] = field(default_factory=list)
    
    @property
    def total_hours(self) -> float:
        """Total overtime hours"""
        return sum(r.hours for r in self.records)
    
    @property
    def total_payment(self) -> float:
        """Total overtime payment"""
        return sum(r.breakdown.total_amount for r in self.records if r.breakdown)
    
    @property
    def record_count(self) -> int:
        """Number of overtime records"""
        return len(self.records)
    
    def to_dict(self) -> dict:
        return {
            'emp_code': self.emp_code,
            'emp_name': self.emp_name,
            'period': f"{self.year}-{self.month:02d}",
            'upj': self.upj,
            'total_hours': self.total_hours,
            'total_payment': self.total_payment,
            'record_count': self.record_count,
            'records': [r.to_dict() for r in self.records]
        }
    
    def get_summary(self) -> dict:
        """Get summary without detailed records"""
        return {
            'emp_code': self.emp_code,
            'emp_name': self.emp_name,
            'period': f"{self.year}-{self.month:02d}",
            'upj': self.upj,
            'total_hours': self.total_hours,
            'total_payment': self.total_payment,
            'record_count': self.record_count
        }
