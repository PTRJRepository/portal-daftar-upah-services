"""
Aggregation Rules Models
Models for defining aggregation formulas and rules that frontend will use to calculate aggregations.
Backend provides the rules, frontend executes the calculations.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime


class AggregationFormula(BaseModel):
    """Single aggregation formula definition for a column"""
    column_id: str = Field(..., description="Column identifier/field name")
    aggregation_type: Literal["sum", "avg", "count", "min", "max", "formula", "none"] = Field(
        ..., description="Type of aggregation to perform"
    )
    formula: Optional[str] = Field(
        None, 
        description="Custom formula for complex calculations (e.g., 'field1 + field2 * 0.5')"
    )
    is_monetary: bool = Field(False, description="Whether this is a monetary/currency field")
    is_hidden_when_empty: bool = Field(True, description="Hide column if all values are 0/empty")
    dependencies: List[str] = Field(
        default_factory=list, 
        description="Other columns this formula depends on"
    )
    description: Optional[str] = Field(None, description="Human-readable description of this aggregation")

    class Config:
        json_schema_extra = {
            "example": {
                "column_id": "upah_bersih",
                "aggregation_type": "sum",
                "formula": None,
                "is_monetary": True,
                "is_hidden_when_empty": False,
                "dependencies": [],
                "description": "Total upah bersih (net salary)"
            }
        }


class RowCalculationRule(BaseModel):
    """Rule for calculating values at row level (per employee)"""
    target_field: str = Field(..., description="Field to calculate/populate")
    formula: str = Field(
        ..., 
        description="Formula to calculate value (e.g., 'gaji_pokok + total_tunjangan - total_potongan')"
    )
    description: str = Field(..., description="Human-readable description of calculation")
    execution_order: int = Field(
        0, 
        description="Order of execution (lower numbers execute first, for dependent calculations)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "target_field": "upah_bersih",
                "formula": "gaji_pokok + total_tunjangan + total_premi - total_potongan",
                "description": "Calculate net salary from gross components minus deductions",
                "execution_order": 3
            }
        }


class FilterRule(BaseModel):
    """Rule for filtering data rows"""
    field: str = Field(..., description="Field to filter on")
    operator: Literal["gt", "gte", "lt", "lte", "eq", "ne", "in", "not_in"] = Field(
        ..., description="Comparison operator"
    )
    value: Any = Field(..., description="Value to compare against")
    description: str = Field(..., description="Description of filter rule")

    class Config:
        json_schema_extra = {
            "example": {
                "field": "jumlah_hk",
                "operator": "gt",
                "value": 0,
                "description": "Filter out employees with 0 working days"
            }
        }


class AggregationRulesConfig(BaseModel):
    """Complete aggregation rules configuration"""
    version: str = Field("1.0.0", description="Configuration version for compatibility tracking")
    column_aggregations: List[AggregationFormula] = Field(
        default_factory=list,
        description="Column-level aggregation formulas"
    )
    row_calculations: List[RowCalculationRule] = Field(
        default_factory=list,
        description="Row-level calculation formulas (applied to each employee)"
    )
    filter_rules: List[FilterRule] = Field(
        default_factory=list,
        description="Data filtering rules"
    )
    summary_fields: List[str] = Field(
        default_factory=list,
        description="Fields to include in summary row"
    )
    statistics_fields: List[str] = Field(
        default_factory=list,
        description="Fields to include in statistics calculations"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata about the configuration"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "version": "1.0.0",
                "column_aggregations": [],
                "row_calculations": [],
                "filter_rules": [],
                "summary_fields": ["total_employees", "total_upah_bersih"],
                "statistics_fields": ["avg_upah_bersih", "min_upah_bersih", "max_upah_bersih"],
                "metadata": {
                    "created_at": "2025-11-26",
                    "description": "Payroll aggregation rules configuration"
                }
            }
        }


class AggregationRulesResponse(BaseModel):
    """Complete response containing aggregation rules and raw data"""
    aggregation_rules: AggregationRulesConfig = Field(..., description="Aggregation rules configuration")
    raw_data: List[Dict[str, Any]] = Field(..., description="Raw payroll data (unprocessed)")
    gang_code: str = Field(..., description="Gang code for this data")
    month: int = Field(..., description="Month of payroll period")
    year: int = Field(..., description="Year of payroll period")
    division: Optional[str] = Field(None, description="Division name")
    total_records: int = Field(..., description="Total number of raw records")
    generated_at: datetime = Field(default_factory=datetime.now, description="Response generation timestamp")
    
    class Config:
        json_schema_extra = {
            "example": {
                "aggregation_rules": {
                    "version": "1.0.0",
                    "column_aggregations": [],
                    "row_calculations": [],
                    "filter_rules": [],
                    "summary_fields": [],
                    "statistics_fields": [],
                    "metadata": {}
                },
                "raw_data": [],
                "gang_code": "001",
                "month": 11,
                "year": 2025,
                "division": "PRODUKSI",
                "total_records": 150,
                "generated_at": "2025-11-26T23:39:00"
            }
        }
