#!/usr/bin/env python3
"""
Aplikasi Kalkulator Pajak PPh21 TER (Tarif Efektif Rata-rata)
GUI menggunakan Tkinter untuk perhitungan pajak berdasarkan PP 58 Tahun 2023
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import os
from datetime import datetime

# ============================================
# CORE LOGIC - PPH21 TER CALCULATION
# ============================================

class PPH21TERCalculator:
    """Kelas utama untuk perhitungan PPh21 dengan metode TER"""

    def __init__(self, rule_file=None):
        """Initialize dengan memuat rule TER dari JSON"""
        self.ter_a_brackets = []
        self.ter_b_brackets = []
        self.ter_c_brackets = []
        self.ptkp_mapping = {}

        if rule_file:
            self.load_rules(rule_file)
        else:
            # Default path
            default_path = os.path.join(os.path.dirname(__file__), "rule_TER_pajak.json")
            if os.path.exists(default_path):
                self.load_rules(default_path)

    def load_rules(self, rule_file):
        """Memuat aturan TER dari file JSON"""
        with open(rule_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        tarif = data['tarif_pph21_ter']

        # Load TER A brackets
        for layer in tarif['ter_a']['layers']:
            self.ter_a_brackets.append({
                'min': layer['min_bruto'],
                'max': layer['max_bruto'],
                'rate': layer['tarif'] / 100  # Convert percent to decimal
            })

        # Load TER B brackets
        for layer in tarif['ter_b']['layers']:
            self.ter_b_brackets.append({
                'min': layer['min_bruto'],
                'max': layer['max_bruto'],
                'rate': layer['tarif'] / 100
            })

        # Load TER C brackets
        for layer in tarif['ter_c']['layers']:
            self.ter_c_brackets.append({
                'min': layer['min_bruto'],
                'max': layer['max_bruto'],
                'rate': layer['tarif'] / 100
            })

        # Build PTKP to TER mapping
        for status in tarif['ter_a']['ptkp_status']:
            self.ptkp_mapping[status] = 'TER A'
        for status in tarif['ter_b']['ptkp_status']:
            self.ptkp_mapping[status] = 'TER B'
        for status in tarif['ter_c']['ptkp_status']:
            self.ptkp_mapping[status] = 'TER C'

    def get_ter_category(self, ptkp_status):
        """Menentukan kategori TER berdasarkan status PTKP"""
        status = ptkp_status.upper().strip()
        return self.ptkp_mapping.get(status, 'Unknown')

    def get_tax_bracket_info(self, gross_income, ter_category):
        """Mendapatkan info tarif yang berlaku beserta layer info"""
        brackets = []
        if ter_category == 'TER A':
            brackets = self.ter_a_brackets
        elif ter_category == 'TER B':
            brackets = self.ter_b_brackets
        elif ter_category == 'TER C':
            brackets = self.ter_c_brackets
        else:
            return None

        # Cari bracket yang sesuai
        for bracket in brackets:
            min_val = bracket['min']
            max_val = bracket['max']

            if max_val is None:  # Highest bracket (no upper limit)
                if gross_income >= min_val:
                    return bracket
            elif min_val <= gross_income <= max_val:
                return bracket

        return None

    def calculate_pph21(self, gross_income, ptkp_status):
        """
        Menghitung PPh21 dengan metode TER

        Args:
            gross_income: Penghasilan bruto (integer)
            ptkp_status: Status PTKP (TK/0, TK/1, TK/2, TK/3, K/0, K/1, K/2, K/3)

        Returns:
            Dictionary dengan detail perhitungan
        """
        ter_category = self.get_ter_category(ptkp_status)
        bracket_info = self.get_tax_bracket_info(gross_income, ter_category)

        if bracket_info is None:
            return {
                'error': 'Cannot determine tax bracket',
                'ter_category': ter_category,
                'gross_income': gross_income
            }

        tax_rate = bracket_info['rate']
        pph21_amount = gross_income * tax_rate

        return {
            'gross_income': gross_income,
            'ptkp_status': ptkp_status,
            'ter_category': ter_category,
            'tax_rate_pct': tax_rate * 100,
            'tax_rate_decimal': tax_rate,
            'pph21_amount': round(pph21_amount),
            'bracket_min': bracket_info['min'],
            'bracket_max': bracket_info['max'],
            'bracket_layer': self._get_layer_number(gross_income, ter_category)
        }

    def _get_layer_number(self, gross_income, ter_category):
        """Mendapatkan nomor layer/kolom tabel TER"""
        brackets = []
        if ter_category == 'TER A':
            brackets = self.ter_a_brackets
        elif ter_category == 'TER B':
            brackets = self.ter_b_brackets
        elif ter_category == 'TER C':
            brackets = self.ter_c_brackets

        for i, bracket in enumerate(brackets, 1):
            min_val = bracket['min']
            max_val = bracket['max']

            if max_val is None:
                if gross_income >= min_val:
                    return i
            elif min_val <= gross_income <= max_val:
                return i
        return 0

    def format_currency(self, value):
        """Format nilai ke format mata uang Indonesia"""
        if value is None:
            return "Rp -"
        return f"Rp {value:,.0f}".replace(',', '.')

    def format_rate(self, rate_pct):
        """Format tarif persentase"""
        if rate_pct == 0:
            return "0,00%"
        return f"{rate_pct:.2f}%".replace('.', ',')


# ============================================
# GUI APPLICATION
# ============================================

class TaxCalculatorGUI:
    """GUI untuk Kalkulator Pajak PPh21 TER"""

    def __init__(self, root):
        self.root = root
        self.root.title("Kalkulator Pajak PPh21 TER - PP 58 Tahun 2023")
        self.root.geometry("1100x700")

        # Initialize calculator
        rule_path = os.path.join(os.path.dirname(__file__), "rule_TER_pajak.json")
        self.calculator = PPH21TERCalculator(rule_path)

        # Sample data storage
        self.sample_data = []
        self.load_sample_data()

        # Setup GUI
        self.setup_styles()
        self.create_widgets()

    def setup_styles(self):
        """Setup styles untuk widgets"""
        self.style = ttk.Style()
        self.style.theme_use('clam')

        # Configure styles
        self.style.configure('Title.TLabel', font=('Arial', 14, 'bold'))
        self.style.configure('Header.TLabel', font=('Arial', 11, 'bold'), foreground='#0066cc')
        self.style.configure('Result.TLabel', font=('Arial', 10))
        self.style.configure('Result.TFrame', relief='ridge', borderwidth=2)
        self.style.configure('Success.TLabel', foreground='#009900', font=('Arial', 10, 'bold'))
        self.style.configure('Info.TLabel', foreground='#666666', font=('Arial', 9))

    def load_sample_data(self):
        """Memuat data sampel karyawan"""
        sample_path = os.path.join(os.path.dirname(__file__), "sample.json")
        if os.path.exists(sample_path):
            with open(sample_path, 'r', encoding='utf-8') as f:
                self.sample_data = json.load(f)

    def create_widgets(self):
        """Membuat semua widget GUI"""
        # Main container with notebook (tabs)
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill='both', expand=True, padx=5, pady=5)

        # Tab 1: Kalkulator
        self.create_calculator_tab()

        # Tab 2: Data Sampel
        self.create_sample_tab()

        # Tab 3: Info TER
        self.create_info_tab()

    def create_calculator_tab(self):
        """Tab kalkulator utama"""
        calc_frame = ttk.Frame(self.notebook, padding="15")
        self.notebook.add(calc_frame, text="🧮 Kalkulator")

        # Title
        ttk.Label(calc_frame, text="KALKULATOR PPh21 - METODE TER", style='Title.TLabel').grid(
            row=0, column=0, columnspan=3, pady=(0, 15))

        # ============================================
        # Input Section
        # ============================================
        input_frame = ttk.LabelFrame(calc_frame, text="Input Data", padding="10")
        input_frame.grid(row=1, column=0, columnspan=3, sticky='ew', pady=(0, 15))

        # Row 1: Nama Karyawan
        ttk.Label(input_frame, text="Nama Karyawan:").grid(row=0, column=0, sticky='w', pady=5, padx=(0, 10))
        self.nama_var = tk.StringVar()
        ttk.Entry(input_frame, textvariable=self.nama_var, width=40).grid(row=0, column=1, sticky='ew', pady=5)

        # Row 2: Penghasilan Bruto
        ttk.Label(input_frame, text="Penghasilan Bruto:").grid(row=1, column=0, sticky='w', pady=5, padx=(0, 10))
        self.bruto_var = tk.StringVar()
        bruto_entry = ttk.Entry(input_frame, textvariable=self.bruto_var, width=20)
        bruto_entry.grid(row=1, column=1, sticky='w', pady=5)
        ttk.Label(input_frame, text="(contoh: 6000000)").grid(row=1, column=2, sticky='w', padx=(10, 0))

        # Row 3: Status PTKP
        ttk.Label(input_frame, text="Status PTKP:").grid(row=2, column=0, sticky='w', pady=5, padx=(0, 10))
        self.ptkp_var = tk.StringVar(value="K/0")
        ptkp_combo = ttk.Combobox(input_frame, textvariable=self.ptkp_var,
                                  values=['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'],
                                  state='readonly', width=18)
        ptkp_combo.grid(row=2, column=1, sticky='w', pady=5)

        # Calculate button
        calc_btn = ttk.Button(input_frame, text="HITUNG PAJAK", command=self.calculate_tax)
        calc_btn.grid(row=3, column=0, columnspan=2, pady=(15, 5), sticky='ew')

        # ============================================
        # Result Section
        # ============================================
        result_frame = ttk.LabelFrame(calc_frame, text="Hasil Perhitungan", padding="10")
        result_frame.grid(row=2, column=0, columnspan=3, sticky='nsew', pady=(0, 15))

        # Configure grid weights
        result_frame.columnconfigure(1, weight=1)

        # Summary result (large)
        self.summary_label = ttk.Label(result_frame, text="Silakan masukkan data dan klik HITUNG PAJAK",
                                        style='Title.TLabel', foreground='#666')
        self.summary_label.grid(row=0, column=0, columnspan=3, pady=10)

        # Detail results
        self.result_labels = {}
        result_items = [
            ('nama', 'Nama Karyawan:', '-'),
            ('bruto', 'Penghasilan Bruto:', 'Rp -'),
            ('ptkp', 'Status PTKP:', '-'),
            ('ter', 'Kategori TER:', '-'),
            ('layer', 'Layer Kolom:', '-'),
            ('bracket', 'Rentang Penghasilan:', '-'),
            ('rate', 'Tarif Pajak:', '-'),
            ('pph21', 'PPh21 (Terutang):', 'Rp -'),
        ]

        for i, (key, label, default) in enumerate(result_items, 1):
            ttk.Label(result_frame, text=label, style='Header.TLabel').grid(
                row=i, column=0, sticky='w', pady=3, padx=(0, 10))
            lbl = ttk.Label(result_frame, text=default, style='Result.TLabel')
            lbl.grid(row=i, column=1, sticky='w', pady=3)
            self.result_labels[key] = lbl

        # Breakdown section
        breakdown_frame = ttk.LabelFrame(calc_frame, text="Detail Perhitungan", padding="10")
        breakdown_frame.grid(row=3, column=0, columnspan=3, sticky='nsew')

        self.breakdown_text = tk.Text(breakdown_frame, height=8, width=100, font=('Consolas', 10),
                                      bg='#f8f8f8', relief='flat')
        self.breakdown_text.pack(fill='both', expand=True)
        self.breakdown_text.insert('1.0', "Detail perhitungan akan muncul di sini...")
        self.breakdown_text.config(state='disabled')

        # Configure grid weights for main frame
        calc_frame.columnconfigure(0, weight=1)
        calc_frame.rowconfigure(3, weight=1)

    def create_sample_tab(self):
        """Tab untuk data sampel"""
        sample_frame = ttk.Frame(self.notebook, padding="15")
        self.notebook.add(sample_frame, text="📋 Data Sampel")

        ttk.Label(sample_frame, text="DATA SAMPEL KARYAWAN", style='Title.TLabel').pack(pady=(0, 10))

        # Create treeview for sample data
        columns = ('no', 'nama', 'ptkp', 'ter', 'bruto', 'tarif', 'pph21')
        self.tree = ttk.Treeview(sample_frame, columns=columns, show='headings', height=20)

        # Define headings
        self.tree.heading('no', text='No')
        self.tree.heading('nama', text='Nama Karyawan')
        self.tree.heading('ptkp', text='PTKP')
        self.tree.heading('ter', text='TER')
        self.tree.heading('bruto', text='Penghasilan Bruto')
        self.tree.heading('tarif', text='Tarif')
        self.tree.heading('pph21', text='PPh21')

        # Define column widths
        self.tree.column('no', width=40, anchor='center')
        self.tree.column('nama', width=200, anchor='w')
        self.tree.column('ptkp', width=80, anchor='center')
        self.tree.column('ter', width=80, anchor='center')
        self.tree.column('bruto', width=150, anchor='e')
        self.tree.column('tarif', width=100, anchor='center')
        self.tree.column('pph21', width=120, anchor='e')

        # Scrollbar
        scrollbar = ttk.Scrollbar(sample_frame, orient='vertical', command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        # Pack treeview and scrollbar
        self.tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')

        # Populate with sample data
        self.populate_sample_data()

        # Bind double-click to view details
        self.tree.bind('<Double-1>', self.on_sample_double_click)

        # Info label
        info_label = ttk.Label(sample_frame, text="Klik dua kali pada baris untuk melihat detail perhitungan",
                               style='Info.TLabel')
        info_label.pack(pady=(10, 0))

    def create_info_tab(self):
        """Tab informasi tentang metode TER"""
        info_frame = ttk.Frame(self.notebook, padding="15")
        self.notebook.add(info_frame, text="ℹ️ Info TER")

        ttk.Label(info_frame, text="INFORMASI METODE TARIF EFEKTIF RATA-RATA (TER)",
                  style='Title.TLabel').pack(pady=(0, 15))

        info_text = tk.Text(info_frame, wrap='word', font=('Arial', 10),
                           bg='#f8f8f8', height=30, width=90, padx=10, pady=10)
        info_text.pack(fill='both', expand=True)

        content = """
═══════════════════════════════════════════════════════════════
TARIF EFEKTIF RATA-RATA (TER) - PP 58 TAHUN 2023
═══════════════════════════════════════════════════════════════

Apa itu METODE TER?

Metode Tarif Efektif Rata-rata (TER) adalah metode perhitungan
PPh21 yang diberlakukan sejak 1 Juli 2023 berdasarkan PP 58
Tahun 2023. Metode ini menggunakan tarif progresif berdasarkan
penghasilan bruto dan status PTKP.

═══════════════════════════════════════════════════════════════
KATEGORI TER
═══════════════════════════════════════════════════════════════

┌─────────┬─────────────────────────────────────────────────┐
│ Kategori│ Status PTKP                                     │
├─────────┼─────────────────────────────────────────────────┤
│ TER A   │ TK/0, TK/1, K/0                                │
│ TER B   │ TK/2, TK/3, K/1, K/2                           │
│ TER C   │ K/3                                            │
└─────────┴─────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
STATUS PTKP (PENGHASILAN TIDAK KENA PAJAK)
═══════════════════════════════════════════════════════════════

TK = Tidak Kawin    K = Kawin
/0 = Tanpa Tanggungan
/1 = Tanggungan 1 orang
/2 = Tanggungan 2 orang
/3 = Tanggungan 3 orang

═══════════════════════════════════════════════════════════════
RUMUS PERHITUNGAN
═══════════════════════════════════════════════════════════════

PPh21 = Penghasilan Bruto × Tarif TER

Tarif TER ditentukan berdasarkan:
1. Kategori TER (dari status PTKP)
2. Besarnya Penghasilan Bruto

═══════════════════════════════════════════════════════════════
CONTOH PERHITUNGAN
═══════════════════════════════════════════════════════════════

Contoh 1:
• Nama: ARDIYANSA
• Status: TK/0 → TER A
• Penghasilan Bruto: Rp 5.900.240
• Tarif: 0,50%
• PPh21 = Rp 5.900.240 × 0,50% = Rp 29.501

Contoh 2:
• Nama: AMRIL
• Status: K/1 → TER B
• Penghasilan Bruto: Rp 8.318.695
• Tarif: 1,00%
• PPh21 = Rp 8.318.695 × 1,00% = Rp 83.187

═══════════════════════════════════════════════════════════════
TARIF TER (RINGKASAN)
═══════════════════════════════════════════════════════════════

TER A dimulai dari: Rp 5.400.000 (0%)
TER B dimulai dari: Rp 6.200.000 (0%)
TER C dimulai dari: Rp 6.600.000 (0%)

Tarif maksimal: 34% untuk penghasilan sangat tinggi

═══════════════════════════════════════════════════════════════
"""
        info_text.insert('1.0', content)
        info_text.config(state='disabled')

    def populate_sample_data(self):
        """Mengisi treeview dengan data sampel"""
        for item in self.sample_data:
            # Format values for display
            bruto_str = f"Rp {item['penghasilan_bruto']:,.0f}".replace(',', '.')
            pph21_str = f"Rp {item['pph_21']:,.0f}".replace(',', '.')

            self.tree.insert('', 'end', values=(
                item['no'],
                item['nama_karyawan'],
                item['ptkp'],
                item['ter'],
                bruto_str,
                item['tarif_ter'],
                pph21_str
            ), tags=(str(item['no']),))

    def on_sample_double_click(self, event):
        """Handle double-click on sample data row"""
        selection = self.tree.selection()
        if selection:
            item = self.tree.item(selection[0])
            no = int(item['tags'][0])

            # Find employee data
            emp = next((e for e in self.sample_data if e['no'] == no), None)
            if emp:
                self.show_employee_detail(emp)

    def show_employee_detail(self, emp):
        """Tampilkan detail perhitungan untuk karyawan sampel"""
        # Switch to calculator tab
        self.notebook.select(0)

        # Fill in the data
        self.nama_var.set(emp['nama_karyawan'])
        self.bruto_var.set(str(emp['penghasilan_bruto']))
        self.ptkp_var.set(emp['ptkp'])

        # Calculate
        self.calculate_tax()

    def calculate_tax(self):
        """Melakukan perhitungan pajak"""
        try:
            # Get input values
            nama = self.nama_var.get().strip()
            bruto_str = self.bruto_var.get().strip()
            ptkp = self.ptkp_var.get()

            # Validate
            if not nama:
                messagebox.showwarning("Input Error", "Silakan masukkan nama karyawan")
                return

            if not bruto_str:
                messagebox.showwarning("Input Error", "Silakan masukkan penghasilan bruto")
                return

            # Clean and parse bruto
            bruto_str = bruto_str.replace('.', '').replace(',', '').replace('Rp', '').strip()
            try:
                bruto = int(bruto_str)
            except ValueError:
                messagebox.showerror("Input Error", "Penghasilan bruto harus berupa angka")
                return

            # Perform calculation
            result = self.calculator.calculate_pph21(bruto, ptkp)

            # Update display
            self.update_result_display(nama, result)

        except Exception as e:
            messagebox.showerror("Error", f"Terjadi kesalahan:\n{str(e)}")

    def update_result_display(self, nama, result):
        """Update tampilan hasil perhitungan"""
        # Update summary
        pph21_str = self.calculator.format_currency(result['pph21_amount'])
        self.summary_label.config(text=f"PPh21 Terutang: {pph21_str}", foreground='#009900')

        # Update detail labels
        self.result_labels['nama'].config(text=nama)
        self.result_labels['bruto'].config(text=self.calculator.format_currency(result['gross_income']))
        self.result_labels['ptkp'].config(text=result['ptkp_status'])
        self.result_labels['ter'].config(text=result['ter_category'])
        self.result_labels['layer'].config(text=f"Layer {result['bracket_layer']}")
        self.result_labels['rate'].config(text=self.calculator.format_rate(result['tax_rate_pct']))
        self.result_labels['pph21'].config(text=pph21_str, foreground='#009900')

        # Bracket range
        if result['bracket_max'] is None:
            bracket_str = f"≥ {self.calculator.format_currency(result['bracket_min'])}"
        else:
            bracket_str = f"{self.calculator.format_currency(result['bracket_min'])} - {self.calculator.format_currency(result['bracket_max'])}"
        self.result_labels['bracket'].config(text=bracket_str)

        # Update breakdown text
        self.update_breakdown(result)

    def update_breakdown(self, result):
        """Update teks detail perhitungan"""
        self.breakdown_text.config(state='normal')
        self.breakdown_text.delete('1.0', 'end')

        lines = [
            "┌" + "─" * 70 + "┐",
            "│" + " " * 20 + "DETAIL PERHITUNGAN PPh21 TER" + " " * 24 + "│",
            "├" + "─" * 70 + "┤",
            "",
            f"  Nama Karyawan       : {self.nama_var.get()}",
            f"  Status PTKP         : {result['ptkp_status']}",
            f"  Kategori TER        : {result['ter_category']}",
            f"  Layer Kolom         : {result['bracket_layer']}",
            "",
            "─" * 72,
            "  PERHITUNGAN PAJAK",
            "─" * 72,
            "",
            f"  Penghasilan Bruto   = {self.calculator.format_currency(result['gross_income'])}",
            f"  Tarif Pajak         = {self.calculator.format_rate(result['tax_rate_pct'])}",
            "",
            f"  PPh21 = Bruto × Tarif",
            f"  PPh21 = {result['gross_income']:,} × {result['tax_rate_decimal']:.4f}",
            f"  PPh21 = {self.calculator.format_currency(result['pph21_amount'])}",
            "",
            "─" * 72,
            f"  Rentang Penghasilan untuk {result['ter_category']} Layer {result['bracket_layer']}:",
        ]

        if result['bracket_max'] is None:
            lines.append(f"  ≥ {self.calculator.format_currency(result['bracket_min'])}")
        else:
            lines.append(f"  {self.calculator.format_currency(result['bracket_min'])} s.d. {self.calculator.format_currency(result['bracket_max'])}")

        lines.extend([
            "",
            "└" + "─" * 70 + "┘"
        ])

        self.breakdown_text.insert('1.0', '\n'.join(lines))
        self.breakdown_text.config(state='disabled')


# ============================================
# MAIN ENTRY POINT
# ============================================

def main():
    """Main function to run the application"""
    root = tk.Tk()
    app = TaxCalculatorGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
