import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import sys
import json
import csv
from pathlib import Path
from datetime import datetime

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from db_connection import get_extend_db_connection, test_connection

class EditRecordDialog(tk.Toplevel):
    """
    Dialog to edit a single aggregation record with Tabs for categories
    """
    def __init__(self, parent, record_data, on_save_callback):
        super().__init__(parent)
        self.title(f"Edit Record: {record_data['gang_code']} - {record_data['period_month']}/{record_data['period_year']}")
        self.geometry("900x700")
        self.record_data = record_data
        self.on_save = on_save_callback
        self.entries = {}
        
        self._create_layout()
        self._populate_fields()
        
    def _create_layout(self):
        # Top Info
        info_frame = ttk.Frame(self, padding="10")
        info_frame.pack(fill=tk.X)
        ttk.Label(info_frame, text=f"Gang: {self.record_data['gang_code']}", font=("Segoe UI", 12, "bold")).pack(side=tk.LEFT, padx=10)
        ttk.Label(info_frame, text=f"Desc: {self.record_data['gang_description']}", font=("Segoe UI", 10)).pack(side=tk.LEFT, padx=10)
        
        # Tabs
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        # Define Tabs
        self.tab_attendance = ttk.Frame(self.notebook, padding=10)
        self.tab_income = ttk.Frame(self.notebook, padding=10)
        self.tab_premi = ttk.Frame(self.notebook, padding=10)
        self.tab_deductions = ttk.Frame(self.notebook, padding=10)
        self.tab_json = ttk.Frame(self.notebook, padding=10)
        
        self.notebook.add(self.tab_attendance, text="Attendance & Count")
        self.notebook.add(self.tab_income, text="Basic Income & Allowances")
        self.notebook.add(self.tab_premi, text="Premi")
        self.notebook.add(self.tab_deductions, text="Deductions & Net")
        self.notebook.add(self.tab_json, text="JSON Data")
        
        # Buttons
        btn_frame = ttk.Frame(self, padding="10")
        btn_frame.pack(fill=tk.X, side=tk.BOTTOM)
        ttk.Button(btn_frame, text="Cancel", command=self.destroy).pack(side=tk.RIGHT, padx=5)
        ttk.Button(btn_frame, text="Save Changes", command=self._save, style="Accent.TButton").pack(side=tk.RIGHT, padx=5)

    def _add_field(self, parent, label_text, key, row, col, type_hint="float"):
        ttk.Label(parent, text=label_text).grid(row=row, column=col, sticky=tk.W, pady=2, padx=5)
        entry = ttk.Entry(parent, width=25)
        entry.grid(row=row, column=col+1, sticky=tk.W, pady=2, padx=5)
        self.entries[key] = (entry, type_hint)
        return entry

    def _populate_fields(self):
        # --- Tab 1: Attendance ---
        f = self.tab_attendance
        self._add_field(f, "Total Employees:", "total_employees", 0, 0, "int")
        self._add_field(f, "Total HK:", "total_hk", 1, 0, "float")
        self._add_field(f, "Hari Kerja:", "total_hari_kerja", 2, 0, "int")
        
        ttk.Separator(f, orient=tk.HORIZONTAL).grid(row=3, column=0, columnspan=4, sticky="ew", pady=10)
        
        self._add_field(f, "Cuti Tahunan:", "total_cuti_tahunan", 4, 0, "int")
        self._add_field(f, "Cuti Sakit:", "total_cuti_sakit", 5, 0, "int")
        self._add_field(f, "Cuti Minggu:", "total_cuti_minggu", 6, 0, "int")
        self._add_field(f, "Cuti Nasional:", "total_cuti_nasional", 7, 0, "int")
        
        # --- Tab 2: Income ---
        f = self.tab_income
        self._add_field(f, "Upah Dasar:", "total_upah_dasar", 0, 0)
        self._add_field(f, "Upah Pokok:", "total_upah_pokok", 1, 0)
        self._add_field(f, "Gaji Pokok:", "total_gaji_pokok", 2, 0)
        
        ttk.Separator(f, orient=tk.HORIZONTAL).grid(row=3, column=0, columnspan=4, sticky="ew", pady=10)
        
        self._add_field(f, "Tunj. Beras:", "total_beras", 4, 0)
        self._add_field(f, "Tunj. Jabatan:", "total_jabatan", 5, 0)
        self._add_field(f, "Tunj. Masa Kerja:", "total_masa_kerja", 6, 0)
        self._add_field(f, "Lembur:", "total_lembur", 7, 0)
        self._add_field(f, "Total Tunjangan:", "total_tunjangan", 8, 0)
        self._add_field(f, "Total FFB Weight (Ton):", "total_ffb_weight", 9, 0)

        # --- Tab 3: Premi ---
        f = self.tab_premi
        self._add_field(f, "Premi Brondol:", "total_premi_brondol", 0, 0)
        self._add_field(f, "Premi Prunning:", "total_premi_prunning", 1, 0)
        self._add_field(f, "Total Premi:", "total_premi", 2, 0)
        
        # --- Tab 4: Deductions ---
        f = self.tab_deductions
        self._add_field(f, "Pot. PPh21:", "total_pph21", 0, 0)
        self._add_field(f, "Pot. BPJS Pekerja:", "total_bpjs_pekerja", 1, 0)
        self._add_field(f, "Pot. BPJS Majikan:", "total_bpjs_majikan", 2, 0)
        self._add_field(f, "Pot. SPSI:", "total_spsi", 3, 0)
        self._add_field(f, "Total Potongan:", "total_potongan", 4, 0)
        
        ttk.Separator(f, orient=tk.HORIZONTAL).grid(row=5, column=0, columnspan=4, sticky="ew", pady=10)
        
        self._add_field(f, "Upah Kotor:", "total_upah_kotor", 6, 0)
        self._add_field(f, "Upah Bersih:", "total_upah_bersih", 7, 0)

        # --- Tab 5: JSON ---
        f = self.tab_json
        ttk.Label(f, text="Dynamic Premi Data (JSON Array):").pack(anchor=tk.W)
        self.json_premi = scrolledtext.ScrolledText(f, height=8, width=80)
        self.json_premi.pack(fill=tk.X, pady=(0, 10))
        
        # Fill Values
        for key, (entry, type_hint) in self.entries.items():
            val = self.record_data.get(key)
            if val is None:
                val = 0
            
            # Format display
            if type_hint == "int":
                entry.insert(0, str(int(float(val))))
            else:
                entry.insert(0, f"{float(val):.2f}")
        
        # Fill JSON
        json_str = self.record_data.get('dynamic_premi_data')
        if json_str:
            try:
                # Pretty print
                parsed = json.loads(json_str)
                self.json_premi.insert(tk.END, json.dumps(parsed, indent=2))
            except:
                self.json_premi.insert(tk.END, str(json_str))
        else:
             self.json_premi.insert(tk.END, "[]")

    def _save(self):
        new_data = {}
        
        # Validate and collect basic fields
        for key, (entry, type_hint) in self.entries.items():
            raw_val = entry.get().strip()
            try:
                if type_hint == "int":
                    new_data[key] = int(float(raw_val))
                else:
                    new_data[key] = float(raw_val)
            except ValueError:
                messagebox.showerror("Validation Error", f"Invalid value for {key}: {raw_val}")
                return
        
        # Validate JSON
        json_raw = self.json_premi.get("1.0", tk.END).strip()
        try:
            if json_raw:
                json.loads(json_raw) # Check validity
                new_data['dynamic_premi_data'] = json_raw
            else:
                new_data['dynamic_premi_data'] = None
        except json.JSONDecodeError as e:
            messagebox.showerror("JSON Error", f"Invalid JSON in Dynamic Premi:\n{e}")
            return

        # Add IDs
        new_data['id'] = self.record_data['id']
        new_data['gang_code'] = self.record_data['gang_code']
        
        if self.on_save(new_data):
            self.destroy()

class ManualAggregationEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Manual Aggregation Editor")
        self.root.geometry("1400x800")
        
        # Default divisions as fallback
        self.divisions = ["PG1A", "PG1B", "PG2A", "PG2B", "DME", "ARA", "ARB1", "ARB2", "INFRA", "AREC", "IJL", "MILL", "Mill_PKS"]
        self._fetch_available_divisions()
        
        # Define ALL columns to display
        self.columns_config = [
            ("gang_code", "Gang", 80),
            ("gang_description", "Description", 150),
            ("total_employees", "Emp", 50),
            ("total_hk", "HK", 50),
            ("total_hari_kerja", "HariKerja", 70),
            ("total_upah_bersih", "Upah Bersih", 100),
            ("total_premi", "Tot Premi", 100),
            ("total_lembur", "Lembur", 80),
            ("total_ffb_weight", "FFB (Ton)", 80),
            # Detailed Breakdown
            ("total_upah_dasar", "Upah Dasar", 80),
            ("total_upah_pokok", "Upah Pokok", 80),
            ("total_gaji_pokok", "Gaji Pokok", 80),
            ("total_beras", "Beras", 70),
            ("total_jabatan", "Jabatan", 70),
            ("total_masa_kerja", "Masa Kerja", 70),
            ("total_tunjangan", "Tunjangan", 80),
            ("total_premi_brondol", "P. Brondol", 80),
            ("total_premi_prunning", "P. Prunning", 80),
            ("total_potongan", "Potongan", 80),
            ("total_pph21", "PPh21", 70),
            ("total_bpjs_pekerja", "BPJS Pkj", 70),
            ("total_bpjs_majikan", "BPJS Mjk", 70),
            ("total_spsi", "SPSI", 60),
            ("total_upah_kotor", "Upah Kotor", 100),
            ("total_cuti_tahunan", "C.Thn", 50),
            ("total_cuti_sakit", "C.Skt", 50),
            ("total_cuti_minggu", "C.Mgg", 50),
            ("total_cuti_nasional", "C.Nas", 50),
        ]
        
        self.tree_columns = [col[0] for col in self.columns_config]
        self.records_map = {} # id -> row_data
        
        self._create_widgets()

    def _fetch_available_divisions(self):
        """Fetch distinct division codes from the database"""
        try:
            print("Fetching available divisions...")
            conn = get_extend_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT division_code FROM dbo.daftar_upah_aggregation_history ORDER BY division_code")
            rows = cursor.fetchall()
            conn.close()
            
            if rows:
                fetched_divs = [row[0] for row in rows if row[0]]
                if fetched_divs:
                    self.divisions = fetched_divs
                    print(f"Found divisions: {self.divisions}")
        except Exception as e:
            print(f"Could not fetch divisions (using defaults): {e}")

    def _test_connection(self):
        """Test database connection explicitly"""
        success, msg = test_connection()
        if success:
            messagebox.showinfo("Connection Test", f"Success!\n{msg}")
            # Refresh divisions on success
            self._fetch_available_divisions()
            self.div_combo['values'] = self.divisions
        else:
            messagebox.showerror("Connection Test", f"Failed!\n{msg}")

    def _force_save_msg(self):
        """Message to clarify saving behavior"""
        messagebox.showinfo("Save", "Changes made in the grid are SAVED AUTOMATICALLY to the database when you press ENTER or click another cell.\n\nThere is no need to manually save.")

    def _export_to_csv(self):
        """Export current grid data to CSV"""
        if not self.records_map:
            messagebox.showwarning("Export", "No data to export!")
            return
            
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV Files", "*.csv"), ("All Files", "*.*")],
            title="Export Data"
        )
        
        if not filename:
            return
            
        try:
            with open(filename, 'w', newline='') as f:
                writer = csv.writer(f)
                
                # Header
                headers = [col[1] for col in self.columns_config]
                writer.writerow(headers)
                
                # Rows
                # Use tree children to respect sort order if any (though currently no sort implemented)
                for item_id in self.tree.get_children():
                    record = self.records_map.get(int(item_id))
                    if record:
                        row_data = []
                        for col_id, _, _ in self.columns_config:
                            val = record.get(col_id, 0)
                            if val is None: val = 0
                            row_data.append(val)
                        writer.writerow(row_data)
                        
            messagebox.showinfo("Export", f"Successfully exported to {filename}")
            
        except Exception as e:
            messagebox.showerror("Export Error", f"Failed to export:\n{e}")
        
    def _create_widgets(self):
        # --- Top Filter Bar ---
        top_frame = ttk.LabelFrame(self.root, text="Filter Options", padding="10")
        top_frame.pack(fill=tk.X, padx=10, pady=5)
        
        # Division
        ttk.Label(top_frame, text="Division:").pack(side=tk.LEFT, padx=5)
        self.div_var = tk.StringVar(value=self.divisions[0] if self.divisions else "PG1A")
        self.div_combo = ttk.Combobox(top_frame, textvariable=self.div_var, values=self.divisions, width=10)
        self.div_combo.pack(side=tk.LEFT, padx=5)
        
        # Month
        ttk.Label(top_frame, text="Month:").pack(side=tk.LEFT, padx=5)
        self.month_var = tk.StringVar(value=str(datetime.now().month))
        ttk.Combobox(top_frame, textvariable=self.month_var, values=[str(i) for i in range(1, 13)], width=5).pack(side=tk.LEFT, padx=5)
        
        # Year
        ttk.Label(top_frame, text="Year:").pack(side=tk.LEFT, padx=5)
        self.year_var = tk.StringVar(value=str(datetime.now().year))
        ttk.Combobox(top_frame, textvariable=self.year_var, values=[str(i) for i in range(2023, 2030)], width=8).pack(side=tk.LEFT, padx=5)
        
        # Buttons
        ttk.Button(top_frame, text="Load Data", command=self._load_data).pack(side=tk.LEFT, padx=20)
        ttk.Button(top_frame, text="Test DB Connection", command=self._test_connection).pack(side=tk.LEFT, padx=5)
        
        ttk.Separator(top_frame, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        ttk.Button(top_frame, text="Export CSV", command=self._export_to_csv).pack(side=tk.LEFT, padx=5)
        ttk.Button(top_frame, text="Save Changes", command=self._force_save_msg).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(top_frame, text="Help", command=self._show_help).pack(side=tk.RIGHT, padx=5)
        
        # --- Main Table ---
        table_frame = ttk.Frame(self.root, padding="10")
        table_frame.pack(fill=tk.BOTH, expand=True)
        
        self.tree = ttk.Treeview(table_frame, columns=self.tree_columns, show="headings", selectmode="browse")
        
        # Define Columns
        for col_id, col_name, width in self.columns_config:
            self.tree.heading(col_id, text=col_name)
            self.tree.column(col_id, width=width, anchor="e" if col_id not in ["gang_code", "gang_description"] else "w")
        
        # Scrollbars
        vsb = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(table_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        
        self.tree.grid(column=0, row=0, sticky='nsew')
        vsb.grid(column=1, row=0, sticky='ns')
        hsb.grid(column=0, row=1, sticky='ew')
        
        table_frame.grid_columnconfigure(0, weight=1)
        table_frame.grid_rowconfigure(0, weight=1)
        
        # Events
        self.tree.bind("<Double-1>", self._on_double_click)
        
        # Context Menu
        self.context_menu = tk.Menu(self.root, tearoff=0)
        self.context_menu.add_command(label="Edit Full Record", command=self._open_full_edit_dialog)
        self.tree.bind("<Button-3>", self._show_context_menu)
        
        # Status Bar
        self.status_var = tk.StringVar(value="Ready. Double-click a cell to edit. Changes save automatically.")
        ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W).pack(side=tk.BOTTOM, fill=tk.X)

    def _show_help(self):
        messagebox.showinfo("Help", "Select Division, Month, and Year then click 'Load Data'.\n\nDouble-click a CELL to edit that specific value.\nRight-click a row and select 'Edit Full Record' for the detailed form.")

    def _load_data(self):
        div = self.div_var.get()
        month = self.month_var.get()
        year = self.year_var.get()
        
        self.status_var.set(f"Loading data for {div} {month}/{year}...")
        self.tree.delete(*self.tree.get_children())
        self.records_map.clear()
        
        try:
            print(f"Connecting to DB to load data: Div={div}, Month={month}, Year={year}")
            conn = get_extend_db_connection()
            cursor = conn.cursor()
            
            query = """
                SELECT * FROM dbo.daftar_upah_aggregation_history 
                WHERE period_month = ? AND period_year = ? AND division_code = ?
                ORDER BY gang_code
            """
            
            print(f"Executing query: {query}")
            print(f"Params: {(month, year, div)}")
            
            cursor.execute(query, (month, year, div))
            
            columns = [column[0] for column in cursor.description]
            rows = cursor.fetchall()
            
            print(f"Rows fetched: {len(rows)}")
            
            for row in rows:
                record = dict(zip(columns, row))
                row_id = record['id']
                self.records_map[row_id] = record
                
                # Prepare values for tree
                values = []
                for col_id, _, _ in self.columns_config:
                    val = record.get(col_id, 0)
                    if val is None: val = 0
                    
                    if isinstance(val, (int, float)):
                        if col_id in ["total_employees", "total_cuti_tahunan", "total_cuti_sakit", "total_cuti_minggu", "total_cuti_nasional", "total_hari_kerja"]:
                             values.append(f"{int(val)}")
                        elif col_id == "total_hk":
                             values.append(f"{float(val):.2f}") # HK can be float
                        else:
                             values.append(f"{float(val):,.2f}")
                    else:
                        values.append(str(val))
                        
                self.tree.insert("", "end", iid=str(row_id), values=values)
            
            conn.close()
            self.status_var.set(f"Loaded {len(rows)} records.")
            
            if len(rows) == 0:
                 messagebox.showinfo("Info", "No records found for this period/division.")
            
        except Exception as e:
            print(f"ERROR LOADING DATA: {e}")
            messagebox.showerror("Error", f"Failed to load data:\n{e}")
            self.status_var.set("Error loading data.")

    def _show_context_menu(self, event):
        item = self.tree.identify_row(event.y)
        if item:
            self.tree.selection_set(item)
            self.context_menu.post(event.x_root, event.y_root)

    def _open_full_edit_dialog(self):
        item_id = self.tree.selection()
        if not item_id: return
        
        item_id = item_id[0]
        record = self.records_map.get(int(item_id))
        
        if record:
            EditRecordDialog(self.root, record, self._save_record_to_db)

    def _on_double_click(self, event):
        """Handle in-cell editing"""
        region = self.tree.identify("region", event.x, event.y)
        if region != "cell": return
        
        column = self.tree.identify_column(event.x) # Returns #1, #2 etc
        row_id = self.tree.identify_row(event.y)
        
        if not row_id or not column: return
        
        # Get column name
        col_idx = int(column.replace("#", "")) - 1
        col_name = self.tree_columns[col_idx]
        
        # Check if editable
        if col_name in ["gang_code", "gang_description"]:
            return # Don't edit these inline
            
        # Get current value
        current_record = self.records_map.get(int(row_id))
        current_val = current_record.get(col_name, 0)
        
        # Create entry widget
        x, y, w, h = self.tree.bbox(row_id, column)
        
        entry = ttk.Entry(self.tree)
        entry.place(x=x, y=y, width=w, height=h)
        entry.insert(0, str(current_val))
        entry.select_range(0, tk.END)
        entry.focus()
        
        def save_edit(event=None):
            new_val_str = entry.get()
            
            # Check if value actually changed
            try:
                if float(new_val_str) == float(current_val):
                     entry.destroy()
                     return
            except:
                pass # Continue to validation if non-numeric comparison fails
                
            try:
                new_val = float(new_val_str)
                # Update DB
                # Create a mini record with just ID and changed field
                update_data = {
                    'id': int(row_id),
                    'gang_code': current_record['gang_code'],
                    col_name: new_val
                }
                
                if self._save_record_to_db(update_data):
                    entry.destroy()
                
            except ValueError:
                if event and event.type == tk.EventType.FocusOut:
                     # Revert on bad input during focus out
                     entry.destroy()
                else:
                    messagebox.showerror("Invalid Value", "Please enter a valid number")
                    entry.focus()

        def cancel_edit(event=None):
            entry.destroy()
            
        entry.bind("<Return>", save_edit)
        entry.bind("<Escape>", cancel_edit)
        # On focus out, try to save. If invalid, it cancels.
        entry.bind("<FocusOut>", save_edit)

    def _save_record_to_db(self, new_data):
        row_id = new_data['id']
        
        try:
            conn = get_extend_db_connection()
            cursor = conn.cursor()
            
            # Construct UPDATE query dynamically
            exclude_keys = {'id', 'gang_code'}
            
            set_clauses = []
            values = []
            
            for key, val in new_data.items():
                if key not in exclude_keys:
                    set_clauses.append(f"{key} = ?")
                    values.append(val)
            
            set_clauses.append("updated_at = GETDATE()")
            values.append(row_id)
            
            query = f"UPDATE dbo.daftar_upah_aggregation_history SET {', '.join(set_clauses)} WHERE id = ?"
            
            cursor.execute(query, values)
            conn.commit()
            conn.close()
            
            # Update local memory and tree
            if int(row_id) in self.records_map:
                self.records_map[int(row_id)].update(new_data)
                
                # Refresh Tree Row
                record = self.records_map[int(row_id)]
                tree_values = []
                for col_id, _, _ in self.columns_config:
                    val = record.get(col_id, 0)
                    if val is None: val = 0
                    
                    if isinstance(val, (int, float)):
                         if col_id in ["total_employees", "total_cuti_tahunan", "total_cuti_sakit", "total_cuti_minggu", "total_cuti_nasional", "total_hari_kerja"]:
                             tree_values.append(f"{int(val)}")
                         elif col_id == "total_hk":
                             tree_values.append(f"{float(val):.2f}")
                         else:
                             tree_values.append(f"{float(val):,.2f}")
                    else:
                        tree_values.append(str(val))
                
                self.tree.item(str(row_id), values=tree_values)
                
            self.status_var.set(f"Saved update for {new_data['gang_code']}")
            return True
            
        except Exception as e:
            messagebox.showerror("Database Error", f"Failed to save:\n{e}")
            return False

if __name__ == "__main__":
    root = tk.Tk()
    # Try to set theme if available
    try:
        root.tk.call("source", "azure.tcl")
        root.tk.call("set_theme", "light")
    except:
        pass
        
    app = ManualAggregationEditor(root)
    root.mainloop()
