"""
Lembur Engine - Overtime Payment Calculator Module

This module provides:
- LemburCalculator: Main calculator class for overtime payments
- CLI interface: Command-line tool for calculations
- GUI interface: Tkinter-based graphical interface
"""

from .lembur_calculator import LemburCalculator
from .models import DayType, OvertimeRecord, OvertimeBreakdown, LemburResult

__all__ = [
    'LemburCalculator',
    'DayType',
    'OvertimeRecord',
    'OvertimeBreakdown',
    'LemburResult'
]

__version__ = '1.0.0'
