import uuid
import sys
import os
from typing import Dict
from pathlib import Path
from fastapi import BackgroundTasks

# Add path to original engine
engine_path = Path(__file__).parent.parent.parent.parent.parent / "Engine_HTML_Templating" / "template_report" / "ui"
sys.path.insert(0, str(engine_path))

jobs: Dict[str, Dict] = {}

def run_job(job_id: str, params: Dict):
    try:
        # Use ThreadedDataExtractor for consistent data extraction
        from app.services.threaded_data_extractor import ThreadedDataExtractor

        # Initialize extractor
        extractor = ThreadedDataExtractor()
        
        # Extract parameters
        month = int(params.get('month', 5))
        year = int(params.get('year', 2025))
        gang_code = params.get('gang_code', 'ALL')

        # Generate report data using the consistent threaded extractor
        jobs[job_id]["status"] = "processing"
        
        # Use extract_all_payroll_data_parallel which implements the correct 
        # hari_kerja = jumlah_hk - cuti formula
        extracted_data = extractor.extract_all_payroll_data_parallel(
            month=month,
            year=year,
            gang_code=gang_code
        )
        
        # The result from threaded extractor is a dict with 'data_rows', 'summary', etc.
        # We need to return the 'data_rows' or the full structure depending on what the consumer expects.
        # Based on the original engine.generate_report_data(), it likely returns a list of rows or a dict with rows.
        # Let's check what extract_all_payroll_data_parallel returns. 
        # It returns a dict with 'data_rows' (list of dicts).
        
        report_data = extracted_data.get('data_rows', [])

        jobs[job_id] = {
            "status": "completed",
            "result": {
                "job_id": job_id,
                "params": params,
                "data": report_data
            }
        }
    except Exception as e:
        jobs[job_id] = {
            "status": "failed",
            "error": str(e)
        }

class ReportService:
    def start(self, params: Dict, tasks: BackgroundTasks):
        job_id = uuid.uuid4().hex
        jobs[job_id] = {"status": "pending"}
        tasks.add_task(run_job, job_id, params)
        return {"job_id": job_id}

    def get(self, job_id: str):
        data = jobs.get(job_id)
        if not data:
            return {"status": "not_found"}
        return data
