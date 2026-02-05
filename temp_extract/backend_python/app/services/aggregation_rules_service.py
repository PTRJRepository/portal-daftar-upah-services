"""
Aggregation Rules Service
Service to load and manage aggregation rules configuration.
Backend provides these rules to frontend for client-side calculation.
"""

import json
import logging
import os
from typing import List, Dict, Any, Optional
from pathlib import Path

from .header_service import HeaderService
from ..models.aggregation_rules import (
    AggregationRulesConfig,
    AggregationFormula,
    RowCalculationRule,
    FilterRule,
    AggregationRulesResponse
)

logger = logging.getLogger(__name__)


class AggregationRulesService:
    """Service to generate and manage aggregation rules"""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the aggregation rules service
        
        Args:
            config_path: Optional path to configuration file. 
                        If not provided, uses default path.
        """
        self.logger = logging.getLogger(__name__)
        
        if config_path:
            self.config_path = Path(config_path)
        else:
            # Default path relative to backend directory
            backend_dir = Path(__file__).parent.parent.parent
            self.config_path = backend_dir / "config" / "aggregation_rules.json"
        
        self.logger.info(f"Aggregation rules config path: {self.config_path}")
        
        # Cache the loaded config
        self._cached_config: Optional[AggregationRulesConfig] = None
    
    def load_rules_config(self, force_reload: bool = False) -> AggregationRulesConfig:
        """
        Load aggregation rules from centralized configuration file
        
        Args:
            force_reload: If True, reload from file even if cached
            
        Returns:
            AggregationRulesConfig object with all rules
        """
        if self._cached_config is not None and not force_reload:
            return self._cached_config
        
        try:
            if not self.config_path.exists():
                self.logger.error(f"Config file not found: {self.config_path}")
                return self._get_default_config()
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            
            # Convert dict to Pydantic model
            config = AggregationRulesConfig(**config_data)
            
            self._cached_config = config
            self.logger.info(f"Loaded aggregation rules config version {config.version}")
            self.logger.info(f"  - {len(config.column_aggregations)} column aggregations")
            self.logger.info(f"  - {len(config.row_calculations)} row calculations")
            self.logger.info(f"  - {len(config.filter_rules)} filter rules")
            
            return config
        
        except FileNotFoundError:
            self.logger.error(f"Configuration file not found: {self.config_path}")
            return self._get_default_config()
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON configuration: {e}")
            return self._get_default_config()
        except Exception as e:
            self.logger.error(f"Failed to load aggregation config: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> AggregationRulesConfig:
        """Get default configuration if file cannot be loaded"""
        self.logger.warning("Using default aggregation rules configuration")
        
        return AggregationRulesConfig(
            version="1.0.0",
            column_aggregations=[
                AggregationFormula(
                    column_id="upah_bersih",
                    aggregation_type="sum",
                    is_monetary=True,
                    is_hidden_when_empty=False,
                    description="Net salary"
                ),
                AggregationFormula(
                    column_id="jumlah_hk",
                    aggregation_type="sum",
                    is_monetary=False,
                    is_hidden_when_empty=False,
                    description="Total working days"
                )
            ],
            row_calculations=[
                RowCalculationRule(
                    target_field="upah_bersih",
                    formula="(gaji_pokok || 0) + (total_tunjangan || 0) + (total_premi || 0) - (total_potongan || 0)",
                    description="Calculate net salary",
                    execution_order=5
                )
            ],
            filter_rules=[
                FilterRule(
                    field="jumlah_hk",
                    operator="gt",
                    value=0,
                    description="Filter employees with 0 working days"
                )
            ],
            summary_fields=["total_upah_bersih"],
            statistics_fields=["average_upah_bersih"],
            metadata={"source": "default_config"}
        )
    
    def get_column_aggregation_rules(self) -> List[AggregationFormula]:
        """
        Get all column-level aggregation formulas
        
        Returns:
            List of AggregationFormula objects
        """
        config = self.load_rules_config()
        return config.column_aggregations
    
    def get_row_calculation_rules(self) -> List[RowCalculationRule]:
        """
        Get all row-level calculation formulas
        
        Returns:
            List of RowCalculationRule objects sorted by execution_order
        """
        config = self.load_rules_config()
        # Sort by execution order
        return sorted(config.row_calculations, key=lambda x: x.execution_order)
    
    def get_filter_rules(self) -> List[FilterRule]:
        """
        Get all data filter rules
        
        Returns:
            List of FilterRule objects
        """
        config = self.load_rules_config()
        return config.filter_rules
    
    def create_rules_response(
        self,
        raw_data: List[Dict[str, Any]],
        gang_code: str,
        month: int,
        year: int,
        division: Optional[str] = None
    ) -> AggregationRulesResponse:
        """
        Create complete response with rules + raw data for frontend
        
        Args:
            raw_data: Raw payroll data (unprocessed)
            gang_code: Gang code
            month: Month of payroll period
            year: Year of payroll period
            division: Optional division name
            
        Returns:
            AggregationRulesResponse with rules and raw data
        """
        config = self.load_rules_config()
        
        # Inject dynamic header names from HeaderService
        try:
            header_service = HeaderService()
            dynamic_headers = header_service.generate_dynamic_headers(month=month, year=year, gang_code=gang_code)
            
            # Get dynamic premi names
            dyn_premi = dynamic_headers.get('table_structure', {}).get('dynamic_docdesc_premi', [])
            for i, name in enumerate(dyn_premi):
                col_id = f"premi_dynamic_{i+1}"
                for rule in config.column_aggregations:
                    if rule.column_id == col_id:
                        rule.description = name
                        break
            
            # Get dynamic potongan names
            dyn_potongan = dynamic_headers.get('table_structure', {}).get('dynamic_docdesc_potongan', [])
            for i, name in enumerate(dyn_potongan):
                col_id = f"pot_dynamic_{i+1}"
                for rule in config.column_aggregations:
                    if rule.column_id == col_id:
                        rule.description = name
                        break
                        
        except Exception as e:
            self.logger.error(f"Failed to inject dynamic header names: {e}")

        response = AggregationRulesResponse(
            aggregation_rules=config,
            raw_data=raw_data,
            gang_code=gang_code,
            month=month,
            year=year,
            division=division,
            total_records=len(raw_data)
        )
        
        self.logger.info(
            f"Created aggregation rules response: {len(raw_data)} records, "
            f"{len(config.column_aggregations)} column rules, "
            f"{len(config.row_calculations)} row calculations"
        )
        
        return response
    
    def get_column_rule(self, column_id: str) -> Optional[AggregationFormula]:
        """
        Get aggregation rule for specific column
        
        Args:
            column_id: Column identifier
            
        Returns:
            AggregationFormula if found, None otherwise
        """
        config = self.load_rules_config()
        
        for rule in config.column_aggregations:
            if rule.column_id == column_id:
                return rule
        
        return None
    
    def validate_config(self) -> tuple[bool, List[str]]:
        """
        Validate the aggregation rules configuration
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        try:
            config = self.load_rules_config()
            
            # Check for duplicate column IDs
            column_ids = [col.column_id for col in config.column_aggregations]
            if len(column_ids) != len(set(column_ids)):
                duplicates = [cid for cid in column_ids if column_ids.count(cid) > 1]
                errors.append(f"Duplicate column IDs found: {set(duplicates)}")
            
            # Check for duplicate target fields in row calculations
            target_fields = [calc.target_field for calc in config.row_calculations]
            if len(target_fields) != len(set(target_fields)):
                duplicates = [tf for tf in target_fields if target_fields.count(tf) > 1]
                errors.append(f"Duplicate row calculation target fields: {set(duplicates)}")
            
            # Check for circular dependencies (basic check)
            for calc in config.row_calculations:
                if calc.target_field in calc.formula:
                    errors.append(f"Potential circular dependency in {calc.target_field}")
            
            # Check aggregation types
            valid_agg_types = ["sum", "avg", "count", "min", "max", "formula", "none"]
            for col in config.column_aggregations:
                if col.aggregation_type not in valid_agg_types:
                    errors.append(f"Invalid aggregation type '{col.aggregation_type}' for {col.column_id}")
            
            return (len(errors) == 0, errors)
        
        except Exception as e:
            errors.append(f"Configuration validation failed: {str(e)}")
            return (False, errors)
    
    def reload_config(self) -> AggregationRulesConfig:
        """
        Force reload configuration from file
        
        Returns:
            Reloaded AggregationRulesConfig
        """
        self.logger.info("Force reloading aggregation rules configuration")
        return self.load_rules_config(force_reload=True)
