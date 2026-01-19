from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class PayrollSummary(BaseModel):
    """Model for payroll summary statistics"""
    total_employees: int
    total_hk: int
    total_upah_dasar: float
    total_upah_pokok: float
    total_gaji_pokok: float
    total_tunjangan: float
    total_potongan: float
    total_upah_bersih: float
    average_upah_bersih: float
    min_upah_bersih: float
    max_upah_bersih: float

class PayrollStatistics(BaseModel):
    """Model for detailed payroll statistics"""
    # Attendance statistics
    total_hadir: int
    total_cuti_tahunan: int
    total_cuti_sakit: int
    total_cuti_minggu: int
    total_cuti_nasional: int
    total_tidak_hadir: int

    # Allowance breakdowns
    total_beras: float
    total_jabatan: float
    total_masa_kerja: float
    total_lembur: float

    # Deduction breakdowns
    total_pph21: float
    total_koreksi: float
    total_bpjs_pekerja: float
    total_bpjs_majikan: float
    total_bpjs_pensiun_pekerja: float
    total_bpjs_pensiun_majikan: float
    total_spsi: float

    # Premier breakdowns
    total_brondol: float
    total_pruning: float
    total_premi_dinamis_1: float
    total_premi_dinamis_2: float
    total_premi_dinamis_3: float
    total_premi_dinamis_4: float
    total_premi_dinamis_5: float
    total_premi_dinamis_6: float
    total_premi_dinamis_7: float

class AggregatedPayrollResponse(BaseModel):
    """Complete aggregated payroll response"""
    # Metadata
    gang_code: str
    month: int
    year: int
    period: str
    generated_at: datetime
    total_records: int
    processing_time_ms: float
    use_threading: bool

    # Data
    data_rows: List[Dict[str, Any]]

    # Aggregated results
    summary: PayrollSummary
    statistics: PayrollStatistics

    # Column information
    columns_info: List[Dict[str, Any]]
    empty_columns: List[str]

    # Business rules applied
    business_rules: Dict[str, Any]

    # Performance metrics
    performance_metrics: Optional[Dict[str, Any]] = None

class AggregationRequest(BaseModel):
    """Request model for aggregated payroll data"""
    gang_code: str
    month: int
    year: int
    include_empty_columns: bool = False
    include_statistics: bool = True
    include_performance_metrics: bool = False
    skip: int = 0
    limit: int = 500

class AggregationRule(BaseModel):
    """Model for aggregation business rules"""
    rule_name: str
    description: str
    calculation_method: str  # sum, avg, min, max, count
    target_field: str
    source_fields: List[str]
    conditions: Optional[Dict[str, Any]] = None

class BusinessRulesResponse(BaseModel):
    """Response model for business rules"""
    gang_code: str
    month: int
    year: int
    rules: List[AggregationRule]
    applied_rules: List[Dict[str, Any]]

class ColumnAggregationConfig(BaseModel):
    """Configuration for column-specific aggregation"""
    column_id: str
    column_name: str
    aggregation_type: str  # sum, avg, count, min, max, none
    data_type: str  # numeric, text, date
    is_monetary: bool = False
    is_hidden_when_empty: bool = False
    business_rule: Optional[str] = None