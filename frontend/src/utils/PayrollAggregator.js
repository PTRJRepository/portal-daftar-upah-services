/**
 * PayrollAggregator.js
 * Client-side aggregation engine for Payroll Report.
 * Moves calculation logic from Backend to Frontend ("Dumb Backend, Smart Frontend").
 */

export const PayrollAggregator = {
  /**
   * Calculate derived fields for a single employee row.
   * Replicates backend logic for Total Tunjangan, Total Premi, etc.
   * @param {Object} emp - Employee data object
   * @param {Object} dynamicHeaders - Map of { headerName: fieldName } for dynamic columns
   */
  calculateEmployeeFields: (emp, dynamicHeaders = {}) => {
    const val = (v) => Number(v) || 0;

    // 1. FLATTEN NESTED STRUCTURES
    // This is critical for handling data that might be nested in the backend response

    // Flatten nested 'premi' object if it exists
    // Add 'premi_' prefix to each key so it matches column field names (e.g., premi_brondol, premi_tbs)
    if (emp.premi && typeof emp.premi === 'object') {
      Object.entries(emp.premi).forEach(([key, value]) => {
        // Create flat field with 'premi_' prefix if not already present
        const flatKey = key.startsWith('premi_') ? key : `premi_${key}`;
        emp[flatKey] = val(value);
        // Also keep the original key for backward compatibility
        emp[key] = val(value);
      });
    }

    // Flatten 'potongan_upah_kotor'
    if (emp.potongan_upah_kotor && typeof emp.potongan_upah_kotor === 'object') {
      // Flatten 'dynamic' sub-object if it exists
      if (emp.potongan_upah_kotor.dynamic && typeof emp.potongan_upah_kotor.dynamic === 'object') {
        Object.assign(emp, emp.potongan_upah_kotor.dynamic);
      }
      // Flatten direct properties of potongan_upah_kotor (like 'koreksi', 'total')
      // Be careful not to overwrite root fields if they already exist with better values
      Object.entries(emp.potongan_upah_kotor).forEach(([k, v]) => {
        if (k !== 'dynamic' && typeof v !== 'object') {
          // For 'koreksi', check if pot_koreksi already exists at root level (from backend)
          // Use root value first, only fallback to nested if root is missing/zero
          if (k === 'koreksi') {
            // If pot_koreksi doesn't exist at root or is 0, use nested value
            if (!emp.pot_koreksi || emp.pot_koreksi === 0) {
              emp.pot_koreksi = val(v);
            }
          }
        }
      });
      // DEBUG: Log pot_koreksi value after flattening
      if (emp.pot_koreksi > 0) {
        console.log(`[KOREKSI DEBUG] ${emp.nik}: pot_koreksi=${emp.pot_koreksi}, nested.koreksi=${emp.potongan_upah_kotor?.koreksi}`);
      }
    }

    // Flatten 'potongan_upah_bersih'
    if (emp.potongan_upah_bersih && typeof emp.potongan_upah_bersih === 'object') {
      if (emp.potongan_upah_bersih.dynamic && typeof emp.potongan_upah_bersih.dynamic === 'object') {
        Object.assign(emp, emp.potongan_upah_bersih.dynamic);
      }
    }

    // 2. MAP DYNAMIC HEADERS TO FIELDS
    // Ensure that if a dynamic header exists, its corresponding field ID is populated
    // This fixes the mismatch where backend sends 'pot_dynamic_1' but data might be keyed by 'POTONGAN X'
    if (dynamicHeaders && Object.keys(dynamicHeaders).length > 0) {
      Object.entries(dynamicHeaders).forEach(([headerName, fieldId]) => {
        // If the fieldId (e.g. 'pot_dynamic_1') is missing or 0
        if (!emp[fieldId]) {
          // Check if the data exists under the Header Name (e.g. 'POTONGAN PREMI HARVESTING')
          // This happens if the flattening above put the value at emp['POTONGAN PREMI HARVESTING']
          const valueByHeader = emp[headerName] || emp[headerName.toUpperCase()];

          if (valueByHeader !== undefined) {
            emp[fieldId] = val(valueByHeader);
          }
        }
      });
    }

    // 0. Calculate BPJS & Aggregate Potongan Fields
    const bpjsKesPek = val(emp.pot_bpjs_kesehatan_pekerja);
    const bpjsKesMaj = val(emp.pot_bpjs_kesehatan_majikan);
    const bpjsPenPek = val(emp.pot_bpjs_pensiun_pekerja);
    const bpjsPenMaj = val(emp.pot_bpjs_pensiun_majikan);

    emp.pot_bpjs_pekerja_total = bpjsKesPek + bpjsPenPek;
    emp.pot_bpjs_kesehatan_total = bpjsKesPek + bpjsKesMaj;
    emp.pot_bpjs_pensiun_total = bpjsPenPek + bpjsPenMaj;

    // pot_bpjs_jumlah = pekerja total + majikan total
    // Note: pot_bpjs_maj might be a separate field from backend or sum of majikan components
    const bpjsMajTotal = val(emp.pot_bpjs_maj) || (bpjsKesMaj + bpjsPenMaj);
    emp.pot_bpjs_jumlah = emp.pot_bpjs_pekerja_total + bpjsMajTotal;

    // pot_total_4 (Potongan Lainnya)
    // Formula: pph21 + kontan + thr + pinjam + kl + tiket + alat + spsi + koreksi + bpjs_pekerja_total + astek
    emp.pot_total_4 = val(emp.pot_pph21) +
      val(emp.pot_kontan) +
      val(emp.pot_thr) +
      val(emp.pot_pinjam) +
      val(emp.pot_kl) +
      val(emp.pot_tiket) +
      val(emp.pot_alat) +
      val(emp.pot_spsi) +
      val(emp.pot_koreksi) +
      emp.pot_bpjs_pekerja_total +
      val(emp.pot_astek);

    // 1. Total Tunjangan
    // Use backend provided value
    const total_tunjangan = val(emp.total_tunjangan);

    // 2. Total Premi
    // DIRECT FROM BACKEND - As requested by user.
    // We rely entirely on the backend's calculation for total_premi.
    // We do NOT recalculate it on the frontend to avoid mismatches.
    const total_premi = val(emp.total_premi);

    // 3. Potongan Upah Kotor
    // Use backend provided value
    let potongan_upah_kotor_total = val(emp.potongan_upah_kotor_total);

    // 4. Jumlah Upah Kotor (Gross Wage)
    // Use backend provided value
    const jumlah_upah_kotor = val(emp.jumlah_upah_kotor);

    // 5. Total Potongan (Total Potongan Upah Bersih)
    // Use backend provided value to avoid double counting and ensure consistency with documentation.
    let total_potongan = val(emp.total_potongan);

    // 6. Upah Bersih (Net Wage)
    // Use backend provided value
    const upah_bersih = val(emp.upah_bersih);

    // Return enriched object with calculated fields
    return {
      ...emp,
      total_tunjangan,
      total_premi,
      potongan_upah_kotor_total,
      jumlah_upah_kotor,
      upah_kotor_premi: jumlah_upah_kotor, // Alias often used
      total_potongan,
      upah_bersih
    };
  },

  /**
   * Flatten nested division/gang data into a flat array for AG Grid.
   * Applies calculation logic to each row.
   * @param {Object} data - Nested JSON from backend { division, gangs: [{ gang_code, employees: [] }] }
   * @param {Object} dynamicHeaders - Optional map of dynamic headers to fields
   * @param {boolean} hideZeroHK - If true, exclude employees with jumlah_hk = 0 (default: true)
   * @returns {Array} Flat array of employee objects
   */
  flattenData: (data, dynamicHeaders = {}, hideZeroHK = true) => {
    if (!data || !data.gangs) return [];

    const flatRows = [];
    data.gangs.forEach(gang => {
      if (gang.employees && Array.isArray(gang.employees)) {
        gang.employees.forEach(emp => {
          // Calculate derived fields
          const calculatedEmp = PayrollAggregator.calculateEmployeeFields(emp, dynamicHeaders);
          // Add gang code
          const processedEmp = { ...calculatedEmp, gang_code: gang.gang_code };
          flatRows.push(processedEmp);
        });
      }
    });

    // Filter out employees with 0 HK if hideZeroHK is enabled
    if (hideZeroHK) {
      return flatRows.filter(row => (row.jumlah_hk || 0) > 0);
    }
    return flatRows;
  },

  /**
   * Calculate totals for a specific gang.
   * @param {string} gangCode 
   * @param {Array} rows - Flat array of all rows
   * @returns {Object} Object containing sum of all numeric fields for the gang
   */
  calculateGangTotals: (gangCode, rows) => {
    const gangRows = rows.filter(r => r.gang_code === gangCode);
    return PayrollAggregator._sumRows(gangRows);
  },

  /**
   * Calculate Grand Total for all rows.
   * @param {Array} allRows 
   * @returns {Object} Object containing sum of all numeric fields
   */
  calculateGrandTotal: (allRows) => {
    return PayrollAggregator._sumRows(allRows);
  },

  /**
   * Internal helper to sum an array of rows.
   * Dynamically sums all numeric keys found in ALL rows (handles sparse data).
   */
  _sumRows: (rows) => {
    if (!rows || rows.length === 0) return {};

    // 1. Identify ALL unique numeric keys across ALL rows
    const numericKeysSet = new Set();

    rows.forEach(row => {
      // SAFETY CHECK: Skip header/total/footer rows to prevent double counting
      if (row.isTotal || row.isHeader || row.isGrandTotal || row.isDivisionTotal) return;
      if (row.nama && (String(row.nama).startsWith('TOTAL') || String(row.nama).startsWith('GRAND TOTAL'))) return;

      Object.keys(row).forEach(key => {
        const val = row[key];
        // Check if value is number or string that looks like number
        // AND exclude non-numeric fields and specific ID fields
        if ((typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val)))
          && !['nik', 'no', 'id', 'year', 'month'].includes(key.toLowerCase())
          && !key.toLowerCase().includes('code')
          && !key.toLowerCase().includes('name')
          && !key.toLowerCase().includes('phone')) {
          numericKeysSet.add(key);
        }
      });
    });

    const numericKeys = Array.from(numericKeysSet);

    // Initialize totals
    const totals = {};
    numericKeys.forEach(key => totals[key] = 0);

    // Sum up
    rows.forEach(row => {
      // SAFETY CHECK: Skip header/total/footer rows
      if (row.isTotal || row.isHeader || row.isGrandTotal || row.isDivisionTotal) return;
      if (row.nama && (String(row.nama).startsWith('TOTAL') || String(row.nama).startsWith('GRAND TOTAL'))) return;

      numericKeys.forEach(key => {
        const val = parseFloat(row[key]) || 0;
        totals[key] += val;
      });
    });

    return totals;
  }
};