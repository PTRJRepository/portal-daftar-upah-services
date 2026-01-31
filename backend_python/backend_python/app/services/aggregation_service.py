from typing import List, Dict, Any, Optional, Tuple
import logging
import time
from datetime import datetime
from ..models.aggregated_response import (
    PayrollSummary,
    PayrollStatistics,
    AggregatedPayrollResponse,
    ColumnAggregationConfig,
    AggregationRule,
    BusinessRulesResponse
)
from ..models.payroll import PayrollRow
import json

logger = logging.getLogger(__name__)

class AggregationService:
    """Centralized aggregation service for payroll calculations"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def load_aggregation_config(self) -> Dict[str, Any]:
        """Load aggregation configuration from JSON file"""
        try:
            config_path = '../struktur/struktur_header_report.json'
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load aggregation config: {e}")
            return {}

    def create_column_aggregation_configs(self) -> List[ColumnAggregationConfig]:
        """Create column aggregation configurations based on header structure"""
        config = self.load_aggregation_config()
        if not config:
            return []

        column_configs = []

        # Define column aggregation rules based on the header structure
        aggregation_rules = {
            # Attendance columns (count numeric)
            'hari_kerja': {'type': 'sum', 'monetary': False},
            'cuti_tahunan_hari': {'type': 'sum', 'monetary': False},
            'cuti_sakit_haid_hari': {'type': 'sum', 'monetary': False},
            'cuti_minggu_hari': {'type': 'sum', 'monetary': False},
            'cuti_nasional_hari': {'type': 'sum', 'monetary': False},
            'jumlah_hk': {'type': 'sum', 'monetary': False},
            'tidak_hadir_cth': {'type': 'sum', 'monetary': False},
            'tidak_hadir_alpa': {'type': 'sum', 'monetary': False},
            'total_ketidakhadiran': {'type': 'sum', 'monetary': False},

            # Monetary columns (sum)
            'upah_dasar': {'type': 'sum', 'monetary': True},
            'upah_pokok': {'type': 'sum', 'monetary': True},
            'gaji_pokok': {'type': 'sum', 'monetary': True},
            'beras_jumlah': {'type': 'sum', 'monetary': True},
            'jabatan_jumlah': {'type': 'sum', 'monetary': True},
            'masa_kerja_jumlah': {'type': 'sum', 'monetary': True},
            'masa_kerja_amount': {'type': 'sum', 'monetary': True},
            'lembur_jumlah': {'type': 'sum', 'monetary': True},
            'total_tunjangan': {'type': 'sum', 'monetary': True},

            # Premier columns (sum)
            'premi_brondol': {'type': 'sum', 'monetary': True},
            'premi_pruning': {'type': 'sum', 'monetary': True},
            'premi_dynamic_1': {'type': 'sum', 'monetary': True},
            'premi_dynamic_2': {'type': 'sum', 'monetary': True},
            'premi_dynamic_3': {'type': 'sum', 'monetary': True},
            'premi_dynamic_4': {'type': 'sum', 'monetary': True},
            'premi_dynamic_5': {'type': 'sum', 'monetary': True},
            'premi_dynamic_6': {'type': 'sum', 'monetary': True},
            'premi_dynamic_7': {'type': 'sum', 'monetary': True},

            # Deduction columns (sum)
            'pph21': {'type': 'sum', 'monetary': True},
            'koreksi': {'type': 'sum', 'monetary': True},
            'bpjs_pek': {'type': 'sum', 'monetary': True},
            'bpjs_maj': {'type': 'sum', 'monetary': True},
            'bpjs_jumlah': {'type': 'sum', 'monetary': True},
            'bpjs_kesehatan_pekerja': {'type': 'sum', 'monetary': True},
            'bpjs_kesehatan_majikan': {'type': 'sum', 'monetary': True},
            'bpjs_pensiun_pekerja': {'type': 'sum', 'monetary': True},
            'bpjs_pensiun_majikan': {'type': 'sum', 'monetary': True},
            'spsi': {'type': 'sum', 'monetary': True},
            'total1': {'type': 'sum', 'monetary': True},
            'total2': {'type': 'sum', 'monetary': True},
            'total3': {'type': 'sum', 'monetary': True},
            'total4': {'type': 'sum', 'monetary': True},

            # Final calculation (sum)
            'upah_bersih': {'type': 'sum', 'monetary': True},
        }

        for column_id, rules in aggregation_rules.items():
            column_configs.append(ColumnAggregationConfig(
                column_id=column_id,
                column_name=column_id.replace('_', ' ').title(),
                aggregation_type=rules['type'],
                data_type='numeric' if rules['monetary'] else 'numeric',
                is_monetary=rules['monetary'],
                is_hidden_when_empty=True
            ))

        return column_configs

    def aggregate_column(self, data_rows: List[Dict[str, Any]], column_id: str,
                      aggregation_type: str) -> Optional[float]:
        """Aggregate a single column based on specified type"""
        if not data_rows:
            return 0.0

        values = []
        for row in data_rows:
            if isinstance(row, dict):
                value = row.get(column_id, 0)
            elif hasattr(row, column_id):
                value = getattr(row, column_id)
            else:
                continue

            if value is not None and value != '':
                try:
                    # Handle string representations of numbers
                    if isinstance(value, str):
                        value = float(value.replace(',', '').replace('Rp', '').strip())
                    values.append(float(value))
                except (ValueError, TypeError):
                    continue

        if not values:
            return 0.0

        if aggregation_type == 'sum':
            return sum(values)
        elif aggregation_type == 'avg':
            return sum(values) / len(values)
        elif aggregation_type == 'count':
            return len(values)
        elif aggregation_type == 'min':
            return min(values)
        elif aggregation_type == 'max':
            return max(values)
        else:
            return 0.0

    def calculate_payroll_summary(self, data_rows: List[Dict[str, Any]]) -> PayrollSummary:
        """Calculate overall payroll summary"""
        if not data_rows:
            return PayrollSummary(
                total_employees=0,
                total_hk=0,
                total_upah_dasar=0.0,
                total_upah_pokok=0.0,
                total_gaji_pokok=0.0,
                total_tunjangan=0.0,
                total_potongan=0.0,
                total_upah_bersih=0.0,
                average_upah_bersih=0.0,
                min_upah_bersih=0.0,
                max_upah_bersih=0.0
            )

        # Extract upah_bersih values for statistics
        upah_bersih_values = []
        for row in data_rows:
            if isinstance(row, dict):
                value = row.get('upah_bersih', 0)
            elif hasattr(row, 'upah_bersih'):
                value = getattr(row, 'upah_bersih')
            else:
                continue

            if value is not None and value != '':
                try:
                    if isinstance(value, str):
                        value = float(value.replace(',', '').replace('Rp', '').strip())
                    upah_bersih_values.append(float(value))
                except (ValueError, TypeError):
                    continue

        # Calculate aggregates
        total_employees = len(data_rows)
        total_hk = self.aggregate_column(data_rows, 'jumlah_hk', 'sum') or 0
        total_upah_dasar = self.aggregate_column(data_rows, 'upah_dasar', 'sum') or 0
        total_upah_pokok = self.aggregate_column(data_rows, 'upah_pokok', 'sum') or 0
        total_gaji_pokok = self.aggregate_column(data_rows, 'gaji_pokok', 'sum') or 0
        total_tunjangan = self.aggregate_column(data_rows, 'total_tunjangan', 'sum') or 0
        total_potongan = self.calculate_total_potongan(data_rows)
        total_upah_bersih = self.aggregate_column(data_rows, 'upah_bersih', 'sum') or 0

        avg_upah_bersih = sum(upah_bersih_values) / len(upah_bersih_values) if upah_bersih_values else 0
        min_upah_bersih = min(upah_bersih_values) if upah_bersih_values else 0
        max_upah_bersih = max(upah_bersih_values) if upah_bersih_values else 0

        return PayrollSummary(
            total_employees=total_employees,
            total_hk=int(total_hk),
            total_upah_dasar=total_upah_dasar,
            total_upah_pokok=total_upah_pokok,
            total_gaji_pokok=total_gaji_pokok,
            total_tunjangan=total_tunjangan,
            total_potongan=total_potongan,
            total_upah_bersih=total_upah_bersih,
            average_upah_bersih=avg_upah_bersih,
            min_upah_bersih=min_upah_bersih,
            max_upah_bersih=max_upah_bersih
        )

    def calculate_payroll_statistics(self, data_rows: List[Dict[str, Any]]) -> PayrollStatistics:
        """Calculate detailed payroll statistics"""
        return PayrollStatistics(
            # Attendance statistics
            total_hadir=int(self.aggregate_column(data_rows, 'hari_kerja', 'sum') or 0),
            total_cuti_tahunan=int(self.aggregate_column(data_rows, 'cuti_tahunan_hari', 'sum') or 0),
            total_cuti_sakit=int(self.aggregate_column(data_rows, 'cuti_sakit_haid_hari', 'sum') or 0),
            total_cuti_minggu=int(self.aggregate_column(data_rows, 'cuti_minggu_hari', 'sum') or 0),
            total_cuti_nasional=int(self.aggregate_column(data_rows, 'cuti_nasional_hari', 'sum') or 0),
            total_tidak_hadir=int(self.aggregate_column(data_rows, 'total_ketidakhadiran', 'sum') or 0),

            # Allowance breakdowns
            total_beras=self.aggregate_column(data_rows, 'beras_jumlah', 'sum') or 0,
            total_jabatan=self.aggregate_column(data_rows, 'jabatan_jumlah', 'sum') or 0,
            total_masa_kerja=self.aggregate_column(data_rows, 'masa_kerja_amount', 'sum') or 0,
            total_lembur=self.aggregate_column(data_rows, 'lembur_jumlah', 'sum') or 0,

            # Deduction breakdowns
            total_pph21=self.aggregate_column(data_rows, 'pph21', 'sum') or 0,
            total_koreksi=self.aggregate_column(data_rows, 'koreksi', 'sum') or 0,
            total_bpjs_pekerja=self.aggregate_column(data_rows, 'bpjs_pek', 'sum') or 0,
            total_bpjs_majikan=self.aggregate_column(data_rows, 'bpjs_maj', 'sum') or 0,
            total_bpjs_pensiun_pekerja=self.aggregate_column(data_rows, 'bpjs_pensiun_pekerja', 'sum') or 0,
            total_bpjs_pensiun_majikan=self.aggregate_column(data_rows, 'bpjs_pensiun_majikan', 'sum') or 0,
            total_spsi=self.aggregate_column(data_rows, 'spsi', 'sum') or 0,

            # Premier breakdowns
            total_brondol=self.aggregate_column(data_rows, 'premi_brondol', 'sum') or 0,
            total_pruning=self.aggregate_column(data_rows, 'premi_pruning', 'sum') or 0,
            total_premi_dinamis_1=self.aggregate_column(data_rows, 'premi_dynamic_1', 'sum') or 0,
            total_premi_dinamis_2=self.aggregate_column(data_rows, 'premi_dynamic_2', 'sum') or 0,
            total_premi_dinamis_3=self.aggregate_column(data_rows, 'premi_dynamic_3', 'sum') or 0,
            total_premi_dinamis_4=self.aggregate_column(data_rows, 'premi_dynamic_4', 'sum') or 0,
            total_premi_dinamis_5=self.aggregate_column(data_rows, 'premi_dynamic_5', 'sum') or 0,
            total_premi_dinamis_6=self.aggregate_column(data_rows, 'premi_dynamic_6', 'sum') or 0,
            total_premi_dinamis_7=self.aggregate_column(data_rows, 'premi_dynamic_7', 'sum') or 0
        )

    def calculate_total_potongan(self, data_rows: List[Dict[str, Any]]) -> float:
        """
        Calculate total deductions from all deduction columns.
        Uses dynamic cell-based aggregation based on rendered headers.
        Excludes columns with 'majikan', 'total', 'jumlah'.
        """
        total_deductions = 0.0
        for row in data_rows:
            total_deductions += self.calculate_row_total_potongan_bersih(row)

        return total_deductions

    def calculate_total_tunjangan(self, data_rows: List[Dict[str, Any]]) -> float: 
        """Calculate total allowances from all allowance columns"""
        allowance_columns = [
            'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah',
            'masa_kerja_amount', 'lembur_jumlah'
        ]

        total_allowances = 0.0
        for row in data_rows:
            row_allowances = 0.0
            for column in allowance_columns:
                value = self.get_numeric_value(row, column)
                row_allowances += value
            total_allowances += row_allowances

        return total_allowances

    def calculate_total_premi(self, data_rows: List[Dict[str, Any]]) -> float:
        """Calculate total premier from all premier columns"""
        premier_columns = [
            'premi_brondol', 'premi_pruning',
            'premi_dynamic_1', 'premi_dynamic_2', 'premi_dynamic_3', 'premi_dynamic_4', 'premi_dynamic_5', 'premi_dynamic_6', 'premi_dynamic_7'
        ]

        total_premi = 0.0
        for row in data_rows:
            row_premi = 0.0
            for column in premier_columns:
                value = self.get_numeric_value(row, column)
                row_premi += value
            total_premi += row_premi

        return total_premi

    def get_numeric_value(self, row: Any, field: str) -> float:
        """Extract numeric value from row field"""
        if isinstance(row, dict):
            value = row.get(field, 0)
        elif hasattr(row, field):
            value = getattr(row, field)
        else:
            return 0.0

        if value is None or value == '':
            return 0.0

        try:
            if isinstance(value, str):
                # Remove formatting characters
                value = value.replace(',', '').replace('Rp', '').strip()
            return float(value)
        except (ValueError, TypeError):
            return 0.0

    def identify_empty_columns(self, data_rows: List[Dict[str, Any]]) -> List[str]:
        """Identify columns that are empty or contain only zeros"""
        if not data_rows:
            return []

        empty_columns = []
        sample_row = data_rows[0]

        if isinstance(sample_row, dict):
            columns = sample_row.keys()
        elif hasattr(sample_row, '__dict__'):
            columns = sample_row.__dict__.keys()
        else:
            return []

        for column in columns:
            is_empty = True
            for row in data_rows:
                value = self.get_numeric_value(row, column)
                if value != 0:
                    is_empty = False
                    break
            if is_empty:
                empty_columns.append(column)

        return empty_columns

    def apply_business_rules(self, data_rows: List[Dict[str, Any]],
                          gang_code: str, month: int, year: int) -> Dict[str, Any]:
        """Apply business rules to payroll data"""
        rules_applied = []

        # Rule 1: Filter out employees with 0 HK (hari kerja)
        original_count = len(data_rows)
        filtered_rows = [row for row in data_rows if self.get_numeric_value(row, 'jumlah_hk') > 0]
        if len(filtered_rows) < original_count:
            rules_applied.append({
                'rule': 'filter_zero_hk',
                'description': 'Filtered out employees with 0 working days',
                'original_count': original_count,
                'filtered_count': len(filtered_rows),
                'removed_count': original_count - len(filtered_rows)
            })

        # Rule 2: Calculate upah_bersih if not present
        for row in filtered_rows:
            upah_bersih = self.get_numeric_value(row, 'upah_bersih')
            if upah_bersih == 0:
                # Try to use jumlah_upah_kotor (Net Gross) directly if available
                jumlah_upah_kotor = self.get_numeric_value(row, 'jumlah_upah_kotor')
                total_potongan_bersih = self.calculate_row_total_potongan_bersih(row)

                # Calculate Potongan Upah Kotor components (Koreksi + Dynamic) to adjust calculation
                pot_koreksi = self.get_numeric_value(row, 'koreksi')
                pot_dynamic = 0.0

                # Get dynamic potongan from nested structure
                if 'potongan_upah_kotor' in row and isinstance(row['potongan_upah_kotor'], dict):
                    if 'dynamic' in row['potongan_upah_kotor'] and isinstance(row['potongan_upah_kotor']['dynamic'], dict):
                        pot_dynamic = sum(float(v or 0) for v in row['potongan_upah_kotor']['dynamic'].values())

                potongan_upah_kotor = pot_koreksi + pot_dynamic

                if jumlah_upah_kotor > 0:
                     # Adjust for the fact that total_potongan_bersih now includes ALL deductions (Cell Based)
                     # while jumlah_upah_kotor already deducted Koreksi + Dynamic.
                     # Reconstruct Base Earnings: jumlah_upah_kotor + potongan_upah_kotor
                     base_earnings = jumlah_upah_kotor + potongan_upah_kotor
                     calculated_upah_bersih = base_earnings - total_potongan_bersih
                else:
                    # Fallback calculation
                    gaji_pokok = self.get_numeric_value(row, 'gaji_pokok')
                    total_tunjangan = self.calculate_row_total_tunjangan(row)
                    total_premi = self.calculate_row_total_premi(row)
                    
                    # Net Gross (Earnings - Koreksi/Dynamic) - kept for reference or if needed
                    gross_wage = (gaji_pokok + total_tunjangan + total_premi) - potongan_upah_kotor
                    
                    # Calculate Upah Bersih
                    # Formula: (Gaji + Tunjangan + Premi) - Total Deductions (Cell Based)
                    base_earnings = gaji_pokok + total_tunjangan + total_premi
                    calculated_upah_bersih = base_earnings - total_potongan_bersih

                if isinstance(row, dict):
                    row['upah_bersih'] = calculated_upah_bersih
                elif hasattr(row, 'upah_bersih'):
                    setattr(row, 'upah_bersih', calculated_upah_bersih)

        if any(self.get_numeric_value(row, 'upah_bersih') > 0 for row in filtered_rows):
            rules_applied.append({
                'rule': 'calculate_upah_bersih',
                'description': 'Calculated upah_bersih for missing values',
                'formula': '(Gaji + Tunjangan + Premi - Potongan Kotor) - Potongan Bersih'
            })

        return {
            'gang_code': gang_code,
            'month': month,
            'year': year,
            'rules_applied': rules_applied,
            'processed_data': filtered_rows
        }

    def calculate_row_total_tunjangan(self, row: Any) -> float:
        """Calculate total tunjangan for a single row"""
        allowance_columns = ['beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah', 'lembur_jumlah']
        total = 0.0
        for column in allowance_columns:
            total += self.get_numeric_value(row, column)
        return total

    def calculate_row_total_premi(self, row: Any) -> float:
        """Calculate total premier for a single row"""
        premier_columns = ['premi_brondol', 'premi_pruning', 'premi_dynamic_1', 'premi_dynamic_2', 'premi_dynamic_3', 'premi_dynamic_4', 'premi_dynamic_5', 'premi_dynamic_6', 'premi_dynamic_7']
        total = 0.0
        for column in premier_columns:
            total += self.get_numeric_value(row, column)
        return total

    def calculate_row_total_potongan_bersih(self, row: Any) -> float:
        """
        Calculate Total Potongan Bersih for a single row using dynamic cell-based aggregation.
        Sum all deduction columns (pot_*, bpjs_*, pph21, spsi, koreksi)
        Excluding columns containing: 'majikan', 'total', 'jumlah'
        """
        total = 0.0
        
        # Get all keys/columns
        if isinstance(row, dict):
            keys = row.keys()
        elif hasattr(row, '__dict__'):
            keys = row.__dict__.keys()
        else:
            return 0.0
            
        for key in keys:
            k = key.lower()
            
            # Exclusions
            # 1. Contains 'majikan', 'total', 'jumlah'
            if 'majikan' in k or 'total' in k or 'jumlah' in k:
                continue
            
            # 2. Specific exclusion for '_maj' suffix or segment (for pot_bpjs_maj)
            if k.endswith('_maj') or '_maj_' in k:
                continue
                
            # 3. Exclude upah_kotor variants if they appear in keys
            if 'upah_kotor' in k:
                continue
                
            # 4. Exclude legacy duplicate pot_bpjs_kes (usually maps to bpjs_kesehatan_pekerja)
            if k == 'pot_bpjs_kes':
                continue
                
            # Inclusions
            # 1. Starts with 'pot_'
            # 2. Starts with 'bpjs_'
            # 3. Is specific deduction column
            is_deduction = (
                k.startswith('pot_') or 
                k.startswith('bpjs_') or 
                k in ['pph21', 'spsi', 'koreksi']
            )
            
            if is_deduction:
                total += self.get_numeric_value(row, key)
                
        return total

    def create_aggregated_response(self,
                                data_rows: List[Dict[str, Any]],
                                gang_code: str,
                                month: int,
                                year: int,
                                processing_time_ms: float = 0,
                                use_threading: bool = False,
                                include_empty_columns: bool = False) -> AggregatedPayrollResponse:
        """Create complete aggregated payroll response"""

        # Apply business rules
        business_rules_result = self.apply_business_rules(data_rows, gang_code, month, year)
        processed_data = business_rules_result['processed_data']

        # Calculate summary and statistics
        summary = self.calculate_payroll_summary(processed_data)
        statistics = self.calculate_payroll_statistics(processed_data)

        # Identify empty columns
        empty_columns = []
        if not include_empty_columns:
            empty_columns = self.identify_empty_columns(processed_data)

        # Create column information
        column_configs = self.create_column_aggregation_configs()
        columns_info = [
            {
                'column_id': config.column_id,
                'column_name': config.column_name,
                'aggregation_type': config.aggregation_type,
                'is_monetary': config.is_monetary,
                'is_hidden_when_empty': config.is_hidden_when_empty
            }
            for config in column_configs
        ]

        # Format period string
        month_names = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        period = f"{month_names[month-1]} {year}"

        return AggregatedPayrollResponse(
            gang_code=gang_code,
            month=month,
            year=year,
            period=period,
            generated_at=datetime.now(),
            total_records=len(processed_data),
            processing_time_ms=processing_time_ms,
            use_threading=use_threading,
            data_rows=processed_data,
            summary=summary,
            statistics=statistics,
            columns_info=columns_info,
            empty_columns=empty_columns,
            business_rules=business_rules_result
        )