"""
GUI Application for Payroll Aggregation Seeder
Simple Tkinter interface to trigger aggregation seeding
"""

import os
import sys
import threading
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from db_connection import get_extend_db_connection, test_connection, get_all_gang_descriptions
from aggregation_seeder import (
    login, fetch_raw_tree, calculate_gang_aggregation, 
    save_aggregation, fetch_divisions, seed_mill_division, BASE_URL,
    delete_existing_aggregation
)


class AggregationGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Payroll Aggregation Seeder")
        self.root.geometry("700x600")
        self.root.resizable(True, True)
        
        self.token = None
        self.is_running = False
        
        self._create_widgets()
        self._check_db_connection()
    
    def _create_widgets(self):
        # Title
        title_frame = ttk.Frame(self.root, padding="10")
        title_frame.pack(fill=tk.X)
        
        ttk.Label(title_frame, text="📊 Payroll Aggregation Seeder", 
                  font=("Segoe UI", 16, "bold")).pack()
        ttk.Label(title_frame, text=f"Backend: {BASE_URL}",
                  font=("Segoe UI", 9)).pack()
        
        # Connection status
        self.conn_status = ttk.Label(title_frame, text="🔌 Checking database...", 
                                      font=("Segoe UI", 9))
        self.conn_status.pack()
        
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Left panel - Parameters
        params_frame = ttk.LabelFrame(main_frame, text="Parameters", padding="10")
        params_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        
        # Division
        ttk.Label(params_frame, text="Division:").pack(anchor=tk.W)
        self.division_var = tk.StringVar(value="ALL")
        self.division_combo = ttk.Combobox(params_frame, textvariable=self.division_var,
                                           values=["ALL"], width=15, state="readonly")
        self.division_combo.pack(fill=tk.X, pady=(0, 10))
        
        # Gang (optional)
        ttk.Label(params_frame, text="Gang (optional):").pack(anchor=tk.W)
        self.gang_var = tk.StringVar()
        self.gang_entry = ttk.Entry(params_frame, textvariable=self.gang_var, width=15)
        self.gang_entry.pack(fill=tk.X, pady=(0, 10))
        ttk.Label(params_frame, text="e.g., A1H, B2A", font=("Segoe UI", 8)).pack(anchor=tk.W)
        
        ttk.Separator(params_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)
        
        # Month
        ttk.Label(params_frame, text="Month:").pack(anchor=tk.W)
        self.month_var = tk.StringVar(value=str(datetime.now().month))
        self.month_combo = ttk.Combobox(params_frame, textvariable=self.month_var,
                                        values=[str(i) for i in range(1, 13)], width=15, state="readonly")
        self.month_combo.pack(fill=tk.X, pady=(0, 10))
        
        # Year
        ttk.Label(params_frame, text="Year:").pack(anchor=tk.W)
        self.year_var = tk.StringVar(value=str(datetime.now().year))
        self.year_combo = ttk.Combobox(params_frame, textvariable=self.year_var,
                                       values=[str(i) for i in range(2020, 2031)], width=15)
        self.year_combo.pack(fill=tk.X, pady=(0, 20))
        
        # Buttons
        self.run_btn = ttk.Button(params_frame, text="🚀 Run Seeder", 
                                   command=self._run_seeder, style="Accent.TButton")
        self.run_btn.pack(fill=tk.X, pady=5)
        
        self.stop_btn = ttk.Button(params_frame, text="⏹ Stop", 
                                    command=self._stop_seeder, state=tk.DISABLED)
        self.stop_btn.pack(fill=tk.X, pady=5)
        
        ttk.Separator(params_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)
        
        # Analysis buttons
        ttk.Label(params_frame, text="Analysis:", font=("Segoe UI", 9, "bold")).pack(anchor=tk.W)
        
        ttk.Button(params_frame, text="📋 View Saved Data", 
                   command=self._view_saved_data).pack(fill=tk.X, pady=2)
        
        ttk.Button(params_frame, text="📈 Division Summary", 
                   command=self._show_division_summary).pack(fill=tk.X, pady=2)
        
        # Right panel - Log
        log_frame = ttk.LabelFrame(main_frame, text="Log", padding="5")
        log_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, width=50, height=25,
                                                   font=("Consolas", 9))
        self.log_text.pack(fill=tk.BOTH, expand=True)
        
        # Progress bar
        self.progress = ttk.Progressbar(self.root, mode="indeterminate")
        self.progress.pack(fill=tk.X, padx=10, pady=10)
    
    def _check_db_connection(self):
        """Check database connection and login to backend"""
        def check():
            # Check DB connection
            success, msg = test_connection()
            if success:
                self.root.after(0, lambda: self.conn_status.config(
                    text="✅ Database connected"))
                self._log("✅ Database connection OK")
            else:
                self.root.after(0, lambda: self.conn_status.config(
                    text=f"❌ Database error: {msg}"))
                self._log(f"❌ Database error: {msg}")
            
            # Login to backend
            try:
                self.token = login()
                self._log("✅ Backend login OK")
                
                # Fetch divisions dynamically
                divisions = fetch_divisions(self.token)
                self.root.after(0, lambda: self.division_combo.config(values=["ALL"] + divisions))
                self._log(f"✅ Loaded {len(divisions)} divisions")
                
            except Exception as e:
                self._log(f"❌ Backend login failed: {e}")
        
        threading.Thread(target=check, daemon=True).start()
    
    def _log(self, message: str):
        """Add message to log"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.root.after(0, lambda: self._append_log(f"[{timestamp}] {message}\n"))
    
    def _append_log(self, text: str):
        self.log_text.insert(tk.END, text)
        self.log_text.see(tk.END)
    
    def _run_seeder(self):
        """Start seeding process in background thread"""
        if self.is_running:
            return
        
        if not self.token:
            messagebox.showerror("Error", "Not logged in to backend. Please wait or restart.")
            return
        
        division = self.division_var.get()
        gang = self.gang_var.get().strip() or None
        month = int(self.month_var.get())
        year = int(self.year_var.get())
        
        self.is_running = True
        self.run_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.progress.start()
        
        self._log(f"\n{'='*40}")
        self._log(f"🚀 Starting seeder...")
        self._log(f"Division: {division}, Gang: {gang or 'ALL'}")
        self._log(f"Period: {month}/{year}")
        
        threading.Thread(target=self._seed_thread, 
                         args=(division, gang, month, year), 
                         daemon=True).start()
    
    def _seed_thread(self, division: str, gang: str, month: int, year: int):
        """Background thread for seeding"""
        try:
            # Delete existing data first
            self._log(f"🗑️ Deleting existing data for {division} ({month}/{year})...")
            if delete_existing_aggregation(division, month, year):
                self._log("✅ Data deleted successfully")
            else:
                self._log("⚠️ Failed to delete data or no data to delete")

            if division == "ALL":
                # If ALL, use the divisions we fetched (or fetch again if needed)
                divisions_to_process = fetch_divisions(self.token)
            else:
                divisions_to_process = [division]
            
            for div in divisions_to_process:
                if not self.is_running:
                    self._log("⏹ Stopped by user")
                    break
                
                self._log(f"\n📊 Processing {div}...")
                
                try:
                    # Special handling for MILL
                    if div.upper() in ["MILL", "MILL_PKS"]:
                        seed_mill_division(self.token, month, year)
                        self._log(f"  ✅ {div} division seeded (Check console for HK details)")
                        continue

                    data = fetch_raw_tree(self.token, div, month, year)
                    gangs = data.get("gangs", [])
                    
                    source_endpoint = f"{BASE_URL}/payroll/locked/report/raw-tree?div={div}&month={month}&year={year}"
                    
                    # Load gang descriptions from HR_GANG table
                    gang_descriptions = get_all_gang_descriptions()
                    
                    for gang_data in gangs:
                        if not self.is_running:
                            break
                        
                        gang_code = gang_data.get("gang_code", "").strip()
                        gang_description = gang_descriptions.get(gang_code, "")  # Get from HR_GANG
                        
                        # Filter by specific gang if provided
                        if gang and gang_code.upper() != gang.upper():
                            continue
                        
                        employees = gang_data.get("employees", [])
                        if not employees:
                            self._log(f"  - {gang_code}: No employees, skipped")
                            continue
                        
                        # Calculate and save with gang description
                        agg = calculate_gang_aggregation(employees, gang_code, gang_description)
                        success = save_aggregation(agg, div, month, year, source_endpoint)
                        
                        if success:
                            self._log(f"  ✅ {gang_code}: {agg['total_employees']} employees, Rp {agg['total_upah_bersih']:,.0f}")
                        else:
                            self._log(f"  ❌ {gang_code}: Save failed")
                    
                except Exception as e:
                    self._log(f"  ❌ Error: {e}")
            
            self._log(f"\n{'='*40}")
            self._log("✅ Seeding complete!")
            
        except Exception as e:
            self._log(f"❌ Error: {e}")
        finally:
            self.root.after(0, self._seeder_finished)
    
    def _seeder_finished(self):
        """Called when seeding is complete"""
        self.is_running = False
        self.run_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.progress.stop()
    
    def _stop_seeder(self):
        """Stop the seeding process"""
        self.is_running = False
        self._log("⏹ Stopping...")
    
    def _view_saved_data(self):
        """Show saved aggregation data"""
        month = int(self.month_var.get())
        year = int(self.year_var.get())
        division = self.division_var.get()
        
        try:
            conn = get_extend_db_connection()
            cursor = conn.cursor()
            
            if division == "ALL":
                cursor.execute("""
                    SELECT division_code, gang_code, total_employees, total_upah_bersih 
                    FROM dbo.daftar_upah_aggregation_history 
                    WHERE period_month = ? AND period_year = ?
                    ORDER BY division_code, gang_code
                """, (month, year))
            else:
                cursor.execute("""
                    SELECT division_code, gang_code, total_employees, total_upah_bersih 
                    FROM dbo.daftar_upah_aggregation_history 
                    WHERE period_month = ? AND period_year = ? AND division_code = ?
                    ORDER BY gang_code
                """, (month, year, division))
            
            rows = cursor.fetchall()
            conn.close()
            
            self._log(f"\n📋 Saved data for {month}/{year}:")
            self._log(f"{'Div':<8} {'Gang':<8} {'Emp':>5} {'Upah Bersih':>15}")
            self._log("-" * 40)
            
            for row in rows:
                self._log(f"{row[0]:<8} {row[1]:<8} {row[2]:>5} {row[3]:>15,.0f}")
            
            self._log(f"\nTotal: {len(rows)} records")
            
        except Exception as e:
            self._log(f"❌ Error: {e}")
    
    def _show_division_summary(self):
        """Show summary per division"""
        month = int(self.month_var.get())
        year = int(self.year_var.get())
        
        try:
            conn = get_extend_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    division_code,
                    COUNT(*) as gang_count,
                    SUM(total_employees) as total_emp,
                    SUM(total_hk) as total_hk,
                    SUM(total_upah_bersih) as total_upah
                FROM dbo.daftar_upah_aggregation_history 
                WHERE period_month = ? AND period_year = ?
                GROUP BY division_code
                ORDER BY division_code
            """, (month, year))
            
            rows = cursor.fetchall()
            conn.close()
            
            self._log(f"\n📈 Division Summary for {month}/{year}:")
            self._log(f"{'Division':<10} {'Gangs':>6} {'Emp':>6} {'HK':>10} {'Total Upah':>18}")
            self._log("-" * 55)
            
            total_gangs = 0
            total_emp = 0
            total_hk = 0
            total_upah = 0
            
            for row in rows:
                self._log(f"{row[0]:<10} {row[1]:>6} {row[2]:>6} {row[3]:>10,.0f} {row[4]:>18,.0f}")
                total_gangs += row[1]
                total_emp += row[2]
                total_hk += row[3]
                total_upah += row[4]
            
            self._log("-" * 55)
            self._log(f"{'TOTAL':<10} {total_gangs:>6} {total_emp:>6} {total_hk:>10,.0f} {total_upah:>18,.0f}")
            
        except Exception as e:
            self._log(f"❌ Error: {e}")


def main():
    root = tk.Tk()
    
    # Try to set theme
    try:
        root.tk.call("source", "azure.tcl")
        root.tk.call("set_theme", "light")
    except:
        pass
    
    app = AggregationGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
