"""
Web Aggregation Table Editor
FastAPI backend for managing payroll aggregation data
ALWAYS uses server_profile_1 for extend_db_ptrj connection
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from db_connection import get_extend_db_connection, test_connection


# ===================== MODELS =====================

class AggregationUpdate(BaseModel):
    """Model for updating aggregation record"""
    total_employees: Optional[int] = None
    total_hk: Optional[float] = None
    total_hari_kerja: Optional[int] = None
    total_cuti_tahunan: Optional[int] = None
    total_cuti_sakit: Optional[int] = None
    total_cuti_minggu: Optional[int] = None
    total_cuti_nasional: Optional[int] = None
    total_upah_dasar: Optional[float] = None
    total_upah_pokok: Optional[float] = None
    total_gaji_pokok: Optional[float] = None
    total_beras: Optional[float] = None
    total_jabatan: Optional[float] = None
    total_masa_kerja: Optional[float] = None
    total_lembur: Optional[float] = None
    total_tunjangan: Optional[float] = None
    total_premi_brondol: Optional[float] = None
    total_premi_prunning: Optional[float] = None
    total_premi: Optional[float] = None
    total_potongan: Optional[float] = None
    total_pph21: Optional[float] = None
    total_bpjs_pekerja: Optional[float] = None
    total_bpjs_majikan: Optional[float] = None
    total_spsi: Optional[float] = None
    total_upah_kotor: Optional[float] = None
    total_upah_bersih: Optional[float] = None
    total_ffb_weight: Optional[float] = None
    dynamic_premi_data: Optional[str] = None


class SeedRequest(BaseModel):
    """Model for seed request"""
    division: str = "ALL"
    gang: Optional[str] = None
    month: int
    year: int


# ===================== SEEDER STATE =====================

seeder_status = {
    "is_running": False,
    "current_division": None,
    "progress": 0,
    "total": 0,
    "logs": [],
    "completed": False,
    "error": None
}


def reset_seeder_status():
    """Reset seeder status"""
    global seeder_status
    seeder_status = {
        "is_running": False,
        "current_division": None,
        "progress": 0,
        "total": 0,
        "logs": [],
        "completed": False,
        "error": None
    }


def add_seeder_log(message: str):
    """Add log message to seeder status"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    seeder_status["logs"].append(f"[{timestamp}] {message}")
    # Keep only last 100 logs
    if len(seeder_status["logs"]) > 100:
        seeder_status["logs"] = seeder_status["logs"][-100:]


# ===================== APP SETUP =====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    success, msg = test_connection()
    if success:
        print("[OK] Database connected (server_profile_1)")
    else:
        print(f"[ERROR] Database error: {msg}")
    yield
    # Shutdown
    print("[INFO] Shutting down...")


app = FastAPI(
    title="Aggregation Table Editor",
    description="Web-based editor for payroll aggregation data using server_profile_1",
    version="2.0.0",
    lifespan=lifespan
)

# Mount static files
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


# ===================== ROUTES =====================

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main page"""
    index_path = static_path / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return HTMLResponse("<h1>Web Aggregation Editor</h1><p>Static files not found.</p>")


@app.get("/api/health")
async def health_check():
    """Health check endpoint - confirms server_profile_1 connection"""
    success, msg = test_connection()
    return {
        "status": "healthy" if success else "unhealthy",
        "database": msg,
        "profile": "server_profile_1",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/divisions")
async def get_divisions():
    """Get all available divisions from server_profile_1"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT division_code
            FROM dbo.daftar_upah_aggregation_history
            WHERE division_code IS NOT NULL
            ORDER BY division_code
        """)
        rows = cursor.fetchall()
        conn.close()

        divisions = [row[0] for row in rows if row[0]]
        return {"divisions": divisions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/periods")
async def get_periods():
    """Get all available periods (month/year combinations)"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT period_month, period_year
            FROM dbo.daftar_upah_aggregation_history
            ORDER BY period_year DESC, period_month DESC
        """)
        rows = cursor.fetchall()
        conn.close()

        periods = [{"month": row[0], "year": row[1]} for row in rows]
        return {"periods": periods}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/aggregations")
async def get_aggregations(
    division: str = Query(..., description="Division code"),
    month: int = Query(..., ge=1, le=12, description="Month"),
    year: int = Query(..., ge=2020, le=2030, description="Year")
):
    """Get aggregation records for a specific division and period"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT * FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ? AND division_code = ?
            ORDER BY gang_code
        """, (month, year, division))

        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()
        conn.close()

        records = []
        for row in rows:
            record = {}
            for i, col in enumerate(columns):
                val = row[i]
                # Convert datetime to string
                if isinstance(val, datetime):
                    val = val.isoformat()
                record[col] = val
            records.append(record)

        return {"records": records, "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/aggregations/{record_id}")
async def update_aggregation(record_id: int, update: AggregationUpdate):
    """Update a single aggregation record in server_profile_1"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()

        # Build dynamic update query
        update_fields = []
        values = []

        for field, value in update.model_dump(exclude_none=True).items():
            update_fields.append(f"{field} = ?")
            values.append(value)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_fields.append("updated_at = GETDATE()")
        values.append(record_id)

        query = f"""
            UPDATE dbo.daftar_upah_aggregation_history
            SET {', '.join(update_fields)}
            WHERE id = ?
        """

        cursor.execute(query, values)
        conn.commit()
        conn.close()

        return {"success": True, "message": f"Record {record_id} updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===================== ANALYSIS & SUMMARY =====================

@app.get("/api/summary")
async def get_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2030)
):
    """Get summary per division for a period"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                division_code,
                COUNT(*) as gang_count,
                SUM(total_employees) as total_emp,
                SUM(total_hk) as total_hk,
                SUM(total_hari_kerja) as total_hari_kerja,
                SUM(total_upah_bersih) as total_upah,
                SUM(total_premi) as total_premi,
                SUM(total_lembur) as total_lembur,
                SUM(total_ffb_weight) as total_ffb,
                SUM(total_potongan) as total_potongan,
                SUM(total_pph21) as total_pph21,
                SUM(total_bpjs_pekerja) as total_bpjs_pekerja,
                SUM(total_bpjs_majikan) as total_bpjs_majikan,
                SUM(total_spsi) as total_spsi
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
            GROUP BY division_code
            ORDER BY division_code
        """, (month, year))

        columns = ["division_code", "gang_count", "total_emp", "total_hk", "total_hari_kerja",
                   "total_upah", "total_premi", "total_lembur", "total_ffb",
                   "total_potongan", "total_pph21", "total_bpjs_pekerja", "total_bpjs_majikan", "total_spsi"]
        rows = cursor.fetchall()
        conn.close()

        summary = []
        grand_total = {
            "division_code": "GRAND TOTAL",
            "gang_count": 0,
            "total_emp": 0,
            "total_hk": 0,
            "total_hari_kerja": 0,
            "total_upah": 0,
            "total_premi": 0,
            "total_lembur": 0,
            "total_ffb": 0,
            "total_potongan": 0,
            "total_pph21": 0,
            "total_bpjs_pekerja": 0,
            "total_bpjs_majikan": 0,
            "total_spsi": 0
        }

        for row in rows:
            record = dict(zip(columns, row))
            summary.append(record)

            for key in grand_total.keys():
                if key != "division_code":
                    grand_total[key] += record[key] or 0

        return {"summary": summary, "grand_total": grand_total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/dashboard")
async def get_dashboard(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2030)
):
    """Get dashboard analytics for a period"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()

        # Get overall stats
        cursor.execute("""
            SELECT
                COUNT(DISTINCT division_code) as total_divisions,
                COUNT(*) as total_gangs,
                SUM(total_employees) as total_employees,
                SUM(total_hk) as total_hk,
                SUM(total_upah_bersih) as total_upah_bersih,
                SUM(total_premi) as total_premi,
                SUM(total_ffb_weight) as total_ffb_weight,
                SUM(total_potongan) as total_potongan
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
        """, (month, year))

        row = cursor.fetchone()

        # Calculate derived metrics
        total_employees = row[2] or 0
        total_hk = row[3] or 0
        total_upah = row[4] or 0
        total_ffb = row[6] or 0

        avg_hk_per_emp = (total_hk / total_employees) if total_employees > 0 else 0
        avg_upah_per_emp = (total_upah / total_employees) if total_employees > 0 else 0
        avg_upah_per_hk = (total_upah / total_hk) if total_hk > 0 else 0
        upah_per_ton = (total_upah / total_ffb) if total_ffb > 0 else 0

        # Get top 5 divisions by upah bersih
        cursor.execute("""
            SELECT TOP 5
                division_code,
                SUM(total_upah_bersih) as total_upah,
                SUM(total_hk) as total_hk
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
            GROUP BY division_code
            ORDER BY total_upah DESC
        """, (month, year))

        top_divisions = [
            {"division": r[0], "upah": float(r[1] or 0), "hk": float(r[2] or 0)}
            for r in cursor.fetchall()
        ]

        # Get top 5 gangs by upah bersih
        cursor.execute("""
            SELECT TOP 5
                gang_code,
                gang_description,
                division_code,
                total_upah_bersih,
                total_hk
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
            ORDER BY total_upah_bersih DESC
        """, (month, year))

        top_gangs = [
            {
                "gang": r[0],
                "description": r[1],
                "division": r[2],
                "upah": float(r[3] or 0),
                "hk": float(r[4] or 0)
            }
            for r in cursor.fetchall()
        ]

        conn.close()

        return {
            "period": {"month": month, "year": year},
            "overall": {
                "total_divisions": row[0] or 0,
                "total_gangs": row[1] or 0,
                "total_employees": float(total_employees),
                "total_hk": float(total_hk),
                "total_upah_bersih": float(total_upah),
                "total_premi": float(row[5] or 0),
                "total_ffb_weight": float(total_ffb),
                "total_potongan": float(row[7] or 0)
            },
            "metrics": {
                "avg_hk_per_employee": round(avg_hk_per_emp, 2),
                "avg_upah_per_employee": round(avg_upah_per_emp, 0),
                "avg_upah_per_hk": round(avg_upah_per_hk, 0),
                "upah_per_ton_ffb": round(upah_per_ton, 0)
            },
            "top_divisions": top_divisions,
            "top_gangs": top_gangs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/division/{division_code}")
async def get_division_analysis(
    division_code: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2030)
):
    """Get detailed analysis for a specific division"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()

        # Get division summary
        cursor.execute("""
            SELECT
                COUNT(*) as gang_count,
                SUM(total_employees) as total_employees,
                SUM(total_hk) as total_hk,
                SUM(total_upah_bersih) as total_upah_bersih,
                SUM(total_premi) as total_premi,
                SUM(total_lembur) as total_lembur,
                SUM(total_ffb_weight) as total_ffb_weight,
                SUM(total_potongan) as total_potongan,
                SUM(total_pph21) as total_pph21,
                SUM(total_bpjs_pekerja) as total_bpjs_pekerja,
                SUM(total_bpjs_majikan) as total_bpjs_majikan,
                SUM(total_spsi) as total_spsi,
                SUM(total_upah_dasar) as total_upah_dasar,
                SUM(total_upah_pokok) as total_upah_pokok,
                SUM(total_gaji_pokok) as total_gaji_pokok,
                SUM(total_beras) as total_beras,
                SUM(total_jabatan) as total_jabatan,
                SUM(total_masa_kerja) as total_masa_kerja,
                SUM(total_tunjangan) as total_tunjangan
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ? AND division_code = ?
        """, (month, year, division_code))

        summary_row = cursor.fetchone()

        # Get gang breakdown
        cursor.execute("""
            SELECT
                gang_code,
                gang_description,
                total_employees,
                total_hk,
                total_upah_bersih,
                total_premi,
                total_ffb_weight
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ? AND division_code = ?
            ORDER BY total_upah_bersih DESC
        """, (month, year, division_code))

        gangs = []
        for row in cursor.fetchall():
            gangs.append({
                "gang_code": row[0],
                "gang_description": row[1],
                "total_employees": row[2] or 0,
                "total_hk": float(row[3] or 0),
                "total_upah_bersih": float(row[4] or 0),
                "total_premi": float(row[5] or 0),
                "total_ffb_weight": float(row[6] or 0)
            })

        conn.close()

        total_emp = summary_row[1] or 0
        total_hk = summary_row[2] or 0
        total_upah = summary_row[3] or 0

        return {
            "division_code": division_code,
            "period": {"month": month, "year": year},
            "summary": {
                "gang_count": summary_row[0] or 0,
                "total_employees": total_emp,
                "total_hk": float(total_hk),
                "total_upah_bersih": float(total_upah),
                "total_premi": float(summary_row[4] or 0),
                "total_lembur": float(summary_row[5] or 0),
                "total_ffb_weight": float(summary_row[6] or 0),
                "total_potongan": float(summary_row[7] or 0),
                "total_pph21": float(summary_row[8] or 0),
                "total_bpjs_pekerja": float(summary_row[9] or 0),
                "total_bpjs_majikan": float(summary_row[10] or 0),
                "total_spsi": float(summary_row[11] or 0),
                "avg_hk_per_employee": round((total_hk / total_emp) if total_emp > 0 else 0, 2),
                "avg_upah_per_employee": round((total_upah / total_emp) if total_emp > 0 else 0, 0),
                "avg_upah_per_hk": round((total_upah / total_hk) if total_hk > 0 else 0, 0)
            },
            "gangs": gangs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/comparison")
async def get_period_comparison(
    month1: int = Query(..., ge=1, le=12),
    year1: int = Query(..., ge=2020, le=2030),
    month2: int = Query(..., ge=1, le=12),
    year2: int = Query(..., ge=2020, le=2030)
):
    """Compare two periods (e.g., current month vs previous month)"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()

        def get_period_data(m, y):
            cursor.execute("""
                SELECT
                    division_code,
                    SUM(total_employees) as total_emp,
                    SUM(total_hk) as total_hk,
                    SUM(total_upah_bersih) as total_upah,
                    SUM(total_premi) as total_premi,
                    SUM(total_ffb_weight) as total_ffb
                FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ?
                GROUP BY division_code
            """, (m, y))
            return {r[0]: {
                "emp": float(r[1] or 0),
                "hk": float(r[2] or 0),
                "upah": float(r[3] or 0),
                "premi": float(r[4] or 0),
                "ffb": float(r[5] or 0)
            } for r in cursor.fetchall()}

        period1_data = get_period_data(month1, year1)
        period2_data = get_period_data(month2, year2)

        # Get all divisions
        all_divisions = sorted(set(period1_data.keys()) | set(period2_data.keys()))

        comparison = []
        for div in all_divisions:
            p1 = period1_data.get(div, {"emp": 0, "hk": 0, "upah": 0, "premi": 0, "ffb": 0})
            p2 = period2_data.get(div, {"emp": 0, "hk": 0, "upah": 0, "premi": 0, "ffb": 0})

            # Calculate changes
            emp_change = p2["emp"] - p1["emp"]
            hk_change = p2["hk"] - p1["hk"]
            upah_change = p2["upah"] - p1["upah"]
            premi_change = p2["premi"] - p1["premi"]
            ffb_change = p2["ffb"] - p1["ffb"]

            # Calculate percentages
            emp_pct = ((p2["emp"] - p1["emp"]) / p1["emp"] * 100) if p1["emp"] > 0 else 0
            hk_pct = ((p2["hk"] - p1["hk"]) / p1["hk"] * 100) if p1["hk"] > 0 else 0
            upah_pct = ((p2["upah"] - p1["upah"]) / p1["upah"] * 100) if p1["upah"] > 0 else 0

            comparison.append({
                "division_code": div,
                "period1": {"month": month1, "year": year1, **p1},
                "period2": {"month": month2, "year": year2, **p2},
                "changes": {
                    "employees": {"value": emp_change, "percent": round(emp_pct, 2)},
                    "hk": {"value": hk_change, "percent": round(hk_pct, 2)},
                    "upah_bersih": {"value": upah_change, "percent": round(upah_pct, 2)},
                    "premi": {"value": premi_change, "percent": 0},
                    "ffb_weight": {"value": ffb_change, "percent": 0}
                }
            })

        conn.close()
        return {"comparison": comparison}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===================== SEEDER =====================

@app.get("/api/seeder/status")
async def get_seeder_status():
    """Get current seeder status"""
    return seeder_status


@app.post("/api/seeder/start")
async def start_seeder(request: SeedRequest, background_tasks: BackgroundTasks):
    """Start the seeder in background"""
    if seeder_status["is_running"]:
        raise HTTPException(status_code=400, detail="Seeder is already running")

    reset_seeder_status()
    seeder_status["is_running"] = True

    background_tasks.add_task(run_seeder, request)

    return {"success": True, "message": "Seeder started"}


@app.post("/api/seeder/stop")
async def stop_seeder():
    """Stop the running seeder"""
    if not seeder_status["is_running"]:
        return {"success": False, "message": "Seeder is not running"}

    seeder_status["is_running"] = False
    add_seeder_log("⏹ Stop requested by user")

    return {"success": True, "message": "Stop signal sent"}


async def run_seeder(request: SeedRequest):
    """Run seeder in background"""
    try:
        # Import seeder functions
        from aggregation_seeder import (
            login, fetch_divisions, seed_division, delete_existing_aggregation
        )

        add_seeder_log(f"🚀 Starting seeder for {request.division} ({request.month}/{request.year})")

        # Login
        add_seeder_log("🔐 Logging in to backend...")
        token = login()
        add_seeder_log("✅ Login successful")

        # Determine divisions to process
        if request.division == "ALL":
            divisions = fetch_divisions(token)
            add_seeder_log(f"📋 Found {len(divisions)} divisions to process")
            # Delete all data for the period
            delete_existing_aggregation("ALL", request.month, request.year)
            add_seeder_log("🗑️ Deleted existing data for ALL divisions")
        else:
            divisions = [request.division]
            delete_existing_aggregation(request.division, request.month, request.year)
            add_seeder_log(f"🗑️ Deleted existing data for {request.division}")

        seeder_status["total"] = len(divisions)

        # Process each division
        for i, div in enumerate(divisions):
            if not seeder_status["is_running"]:
                add_seeder_log("⏹ Stopped by user")
                break

            seeder_status["current_division"] = div
            seeder_status["progress"] = i + 1
            add_seeder_log(f"📊 Processing {div} ({i+1}/{len(divisions)})...")

            try:
                seed_division(token, div, request.month, request.year, request.gang)
                add_seeder_log(f"✅ {div} completed")
            except Exception as e:
                add_seeder_log(f"❌ {div} error: {str(e)}")

        seeder_status["completed"] = True
        add_seeder_log("✅ Seeding complete!")

    except Exception as e:
        seeder_status["error"] = str(e)
        add_seeder_log(f"❌ Error: {str(e)}")
    finally:
        seeder_status["is_running"] = False


# ===================== EXPORT =====================

@app.get("/api/export")
async def export_data(
    division: str = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2030)
):
    """Export aggregation data as JSON (for CSV conversion in frontend)"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                gang_code, gang_description, total_employees, total_hk, total_hari_kerja,
                total_upah_bersih, total_premi, total_lembur, total_ffb_weight,
                total_upah_dasar, total_upah_pokok, total_gaji_pokok,
                total_beras, total_jabatan, total_masa_kerja, total_tunjangan,
                total_premi_brondol, total_premi_prunning,
                total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                total_upah_kotor,
                total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu, total_cuti_nasional
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ? AND division_code = ?
            ORDER BY gang_code
        """, (month, year, division))

        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()
        conn.close()

        records = []
        for row in rows:
            record = dict(zip(columns, row))
            records.append(record)

        return {"columns": columns, "records": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===================== MAIN =====================

if __name__ == "__main__":
    print("Starting Web Aggregation Editor...")
    print("Using server_profile_1 for extend_db_ptrj")
    print("Open http://localhost:5500 in your browser")
    uvicorn.run(app, host="0.0.0.0", port=5500)
