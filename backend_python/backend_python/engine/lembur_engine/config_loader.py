"""
Configuration Loader for Lembur Engine

Loads UPJ (Upah Per Jam) and other constants from backend/config.json
"""

import json
import os
from pathlib import Path
from typing import Dict, Any


def get_config_path() -> Path:
    """Get the path to config.json relative to this module"""
    # Navigate to the main backend directory which contains config.json
    current_dir = Path(__file__).parent
    config_path = current_dir.parent.parent / "config.json"

    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found at: {config_path}")

    return config_path


def load_config() -> Dict[str, Any]:
    """Load the full configuration from config.json"""
    config_path = get_config_path()
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_upj() -> float:
    """
    Load UPJ (Upah Per Jam / Hourly Wage) from config.json
    
    Returns:
        float: The base hourly wage for overtime calculations
    """
    config = load_config()
    
    try:
        upj = config['constants']['upah_per_jam']['dasar']
        return float(upj)
    except KeyError:
        raise KeyError("upah_per_jam.dasar not found in config.json constants")


def load_database_config(profile: str = None) -> Dict[str, Any]:
    """
    Load database configuration
    
    Args:
        profile: Database profile name (local, remote, remote_2)
                 If None, uses environment variable DB_PROFILE or default
    
    Returns:
        dict: Database configuration
    """
    config = load_config()
    
    if profile is None:
        profile = os.getenv('DB_PROFILE', 'remote')
    
    if profile in config.get('database_profiles', {}):
        return config['database_profiles'][profile]
    
    # Fallback to default database config
    return config.get('database', {})


# Rate tables for overtime calculation
# 
# HARI KERJA (Workdays): 2-tier system
#   - Jam 1: 1.5x
#   - Jam 2+: 2x
#
# HARI LIBUR (Holidays): 3-tier system with variable tier-1 boundary
#   - Tier 1 boundary: 5 hours (Friday) or 7 hours (other days)
#   - Sunday/Regular Holiday: 2x, 3x, 4x
#   - Religious Holiday: 3x, 4x, 4x
#
OVERTIME_RATES = {
    # Hari Kerja (2-tier: 1.5x / 2x)
    'WORKDAY_LONG': {
        'tier_1_rate': 1.5,
        'tier_2_rate': 2.0,
        'tier_3_rate': 2.0,  # Same as tier 2 for workday
        'tier_1_boundary': 1,  # First hour only
    },
    'WORKDAY_SHORT': {
        'tier_1_rate': 1.5,
        'tier_2_rate': 2.0,
        'tier_3_rate': 2.0,  # Same as tier 2 for workday
        'tier_1_boundary': 1,  # First hour only
    },
    
    # Minggu / Libur Non-Keagamaan (3-tier: 2x / 3x / 4x)
    'SUNDAY': {
        'tier_1_rate': 2.0,
        'tier_2_rate': 3.0,
        'tier_3_rate': 4.0,
        'tier_1_boundary_long': 7,   # 0-7 jam if long day
        'tier_1_boundary_short': 5,  # 0-5 jam if Friday
    },
    'HOLIDAY_REGULAR': {
        'tier_1_rate': 2.0,
        'tier_2_rate': 3.0,
        'tier_3_rate': 4.0,
        'tier_1_boundary_long': 7,
        'tier_1_boundary_short': 5,
    },
    
    # Libur Keagamaan (3-tier: 3x / 4x / 4x)
    'HOLIDAY_RELIGIOUS': {
        'tier_1_rate': 3.0,
        'tier_2_rate': 4.0,
        'tier_3_rate': 4.0,
        'tier_1_boundary_long': 7,
        'tier_1_boundary_short': 5,
    },
}


def get_overtime_rates() -> Dict[str, Dict[str, float]]:
    """Get overtime rate multipliers by day type"""
    return OVERTIME_RATES.copy()


if __name__ == "__main__":
    # Quick test
    print(f"UPJ: Rp {load_upj():,.2f}")
    print(f"Overtime Rates: {get_overtime_rates()}")
