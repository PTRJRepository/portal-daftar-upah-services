import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import HierHeaderGroup from '../components/common/HierHeaderGroup'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
// Import new theme styling
import '../styles/theme.css'
import '../styles/ag-grid-professional.css'
import '../styles/report-edit-mode.css'

import { fetchReportRowsBatched, fetchReportRowsSimple, fetchReportCount, fetchReportDivisionOptimized } from '../services/payrollService'
import { fetchColumnDefinitions } from '../services/headerService'
import { login } from '../services/authService'
import { fetchGangInfo, fetchGangs } from '../services/gangService'
import LoadingScreen from '../components/common/LoadingScreen'
import SelectionStats from '../components/common/SelectionStats'
import DashboardLayout from '../components/layout/DashboardLayout'
import ReportToolbar from '../components/common/ReportToolbar'
import GangFilter from '../components/common/GangFilter'
import { GangFilterProvider } from '../context/GangFilterContext'
import { useGangFilter } from '../context/GangFilterContext'
import { exportReportToExcelPro } from '../utils/exportReportToExcelPro'

// Check if running in development mode
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true' || import.meta.env.DEV_MODE === 'true'

const GangHeaderRenderer = (params) => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: 'var(--neutral-100)',
      color: 'var(--text-main)',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '16px',
      fontSize: '13px',
      borderBottom: '1px solid var(--border-color)'
    }}>
      🏭 {params.data.gang_code}
    </div>
  )
}

// Inner component that uses the gang filter context
function ReportContent({ token, user, month, year, gang_code, division, onLoad, onBack, gangPrefix: gangPrefixProp = null }) {
  const gangFilter = useGangFilter()

  // State for overrides
  const [authToken, setAuthToken] = useState(token || null)
  const [overrideMonth, setOverrideMonth] = useState(null)
  const [overrideYear, setOverrideYear] = useState(null)
  const [overrideGangCode, setOverrideGangCode] = useState(null)

  // Database mode state
  const [useHistory, setUseHistory] = useState(false)

  // State for gang selector
  const [availableGangs, setAvailableGangs] = useState([])
  const [overrideDivision, setOverrideDivision] = useState(null)
  const [allGangs, setAllGangs] = useState([])
  const [allDivisions, setAllDivisions] = useState([])

  // In development mode, use default values if props are not provided
  const devMonth = DEV_MODE ? (month || undefined) : month
  const devYear = DEV_MODE ? (year || undefined) : year
  const devGangCode = DEV_MODE ? (gang_code || undefined) : gang_code

  // Derived values (Declared ONCE here at the top)
  const finalGangCode = overrideGangCode || devGangCode || gang_code
  const finalMonth = overrideMonth || devMonth || month
  const finalYear = overrideYear || devYear || year
  const finalDivision = overrideDivision || division

  // Normalize for hooks
  const activeMonth = typeof finalMonth === 'string' && finalMonth.includes('-') ? parseInt(finalMonth.split('-')[1], 10) : finalMonth
  const activeYear = typeof finalMonth === 'string' && finalMonth.includes('-') ? parseInt(finalMonth.split('-')[0], 10) : finalYear

  const [rows, setRows] = useState([])
  const [pinnedBottom, setPinnedBottom] = useState([])
  const [columnDefs, setColumnDefs] = useState([])
  const [error, setError] = useState('')
  const computeRulesRef = useRef({})

  // --- MISSING DEFINITIONS RESTORED ---
  const gridRef = useRef(null)
  const dataInitRef = useRef(false)
  const autoHideMapRef = useRef({})

  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [firstBatchReady, setFirstBatchReady] = useState(false)
  const [firstBatchAttempted, setFirstBatchAttempted] = useState(false)
  const [initialRowsPreview, setInitialRowsPreview] = useState([])
  const [gangInfo, setGangInfo] = useState(null)
  const [selectionStats, setSelectionStats] = useState({ count: 0, sum: 0, average: 0 })

  // --- JOB TITLE FEATURE STATE ---
  const [jobTitles, setJobTitles] = useState({})
  const [unsavedJobs, setUnsavedJobs] = useState({})
  const [isSavingJobs, setIsSavingJobs] = useState(false)

  // --- NIK EDIT MODE STATE ---
  const [editModeNik, setEditModeNik] = useState(false)
  const [pendingNikEdits, setPendingNikEdits] = useState({})
  const [isSavingNik, setIsSavingNik] = useState(false)
  const [historyModalNik, setHistoryModalNik] = useState({ isOpen: false, data: null, empCode: null, loading: false })

  const handleNikChange = useCallback((empcode, newVal, oldVal, rowData) => {
    if (newVal === oldVal) return;
    setPendingNikEdits(prev => ({
      ...prev,
      [empcode]: { emp_code: empcode, nama: rowData.nama, old_nik: oldVal, new_nik: newVal }
    }))
  }, [])

  const handleSaveNikEdits = async () => {
    if (Object.keys(pendingNikEdits).length === 0) return
    setIsSavingNik(true)
    try {
      const backendUrl = `${window.location.protocol}//${window.location.hostname}:8002`
      const promises = Object.values(pendingNikEdits).map(edit =>
        fetch(`${backendUrl}/employee-hr-data/${edit.emp_code}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : ''
          },
          body: JSON.stringify({ field: 'nik_ktp', value: String(edit.new_nik) })
        }).then(res => res.json())
      )

      const results = await Promise.all(promises)
      const failed = results.filter(r => !r.success)
      if (failed.length > 0) {
        alert(`Failed to save ${failed.length} NIK records.`)
      } else {
        setPendingNikEdits({})
        alert('Successfully saved NIK updates!')
      }
    } catch (e) {
      alert('Error saving NIK edits: ' + e.message)
    } finally {
      setIsSavingNik(false)
    }
  }

  const openNikHistory = async (empcode) => {
    setHistoryModalNik({ isOpen: true, data: null, empCode: empcode, loading: true })
    try {
      const backendUrl = `${window.location.protocol}//${window.location.hostname}:8002`
      const res = await fetch(`${backendUrl}/employee-hr-data/${empcode}/history`)
      const json = await res.json()
      if (json.success) {
        setHistoryModalNik({ isOpen: true, data: json.data, empCode: empcode, loading: false })
      } else {
        throw new Error(json.error)
      }
    } catch (e) {
      alert("Failed to load history: " + e.message)
      setHistoryModalNik(prev => ({ ...prev, loading: false }))
    }
  }

  // Refresh grid cells when edit mode toggles so the pencil icon appears immediately
  useEffect(() => {
    if (gridRef.current && gridRef.current.api) {
      // Use redrawRows to fully unmount and mount React cell renderers
      gridRef.current.api.redrawRows()
    }
  }, [editModeNik])

  // Fetch job titles
  useEffect(() => {
    async function loadJobTitles() {
      try {
        // Construct dynamic backend URL based on current hostname
        const backendUrl = `${window.location.protocol}//${window.location.hostname}:8002`
        const res = await fetch(`${backendUrl}/employee-estate`)
        const json = await res.json()
        if (json.success) {
          setJobTitles(json.data || {})
        }
      } catch (e) {
        console.error("Failed to load job titles", e)
      }
    }
    loadJobTitles()
  }, [])

  const handleJobChange = useCallback((empcode, newVal, rowData) => {
    setJobTitles(prev => ({ ...prev, [empcode]: newVal }))
    setUnsavedJobs(prev => ({
      ...prev,
      [empcode]: {
        empcode: empcode,
        employee_name: rowData.nama,
        gang: rowData.gang_code || finalGangCode, // Fallback if gang not in row
        divisi_id: rowData.divisi_id || finalDivision, // Fallback
        jabatan: newVal
      }
    }))
  }, [finalGangCode, finalDivision])

  const handleSaveJobs = async () => {
    if (Object.keys(unsavedJobs).length === 0) return
    setIsSavingJobs(true)
    try {
      const backendUrl = `${window.location.protocol}//${window.location.hostname}:8002`
      const payload = { jobs: Object.values(unsavedJobs) }

      const res = await fetch(`${backendUrl}/employee-estate/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (json.success) {
        setUnsavedJobs({})
        alert(`Successfully saved ${json.count} job titles!`)
      } else {
        alert('Failed to save: ' + json.error)
      }
    } catch (e) {
      alert('Error saving jobs: ' + e.message)
    } finally {
      setIsSavingJobs(false)
    }
  }

  const useInfinite = String(finalGangCode).toUpperCase() !== 'ALL'
  const INFINITE_BATCH_SIZE = 200

  const applyComputeToRows = (rows, rules) => {
    if (!Array.isArray(rows)) return []
    return rows
  }

  // Load gangs and divisions (reacts to finalDivision to properly fetch virtual gangs)
  useEffect(() => {
    async function loadFilterData() {
      if (!authToken) return

      try {
        gangFilter.setLoading(true)
        const backendUrl = `${window.location.protocol}//${window.location.hostname}:8002`

        // 1. Fetch divisions
        let divisionsList = []
        const divisionsResponse = await fetch(`${backendUrl}/payroll/divisions`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
        if (divisionsResponse.ok) {
          divisionsList = await divisionsResponse.json()
          setAllDivisions(divisionsList || [])
        }

        // 2. Fetch gangs specifically for the selected division
        let gangsList = []
        if (finalDivision) {
          const isKeraniUser = (user?.role || '').toLowerCase() === 'kerani'
          const isLockedMode = !user?.isAdmin && !user?.isVisitor && (user?.divisi === finalDivision || isKeraniUser)

          let url = `${backendUrl}/payroll/gangs?division=${finalDivision}&force=true`
          if (isLockedMode) {
            url = `${backendUrl}/payroll/locked/gangs?div=${finalDivision}`
          }

          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })

          if (response.ok) {
            gangsList = await response.json()
          }
        } else {
          // Fallback if no division is selected
          const response = await fetch(`${backendUrl}/payroll/gangs`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
          if (response.ok) gangsList = await response.json()
        }

        setAllGangs(gangsList || [])

        // Set available data in context so GangFilter only shows relevant Sub-Divisions
        gangFilter.setAvailableData({
          gangs: gangsList || [],
          divisions: divisionsList || []
        })

      } catch (error) {
        console.error('Failed to load gangs and divisions:', error)
        gangFilter.setError('Failed to load filter data')
      } finally {
        gangFilter.setLoading(false)
      }
    }

    loadFilterData()
  }, [authToken, finalDivision, user])

  // Load available gangs for the dropdown (filtered by GangFilter UI)
  useEffect(() => {
    if (finalDivision && authToken) {
      // Apply gang filter if active
      let gangsToLoad = allGangs
      if (gangFilter.filters.hasActiveFilter && gangFilter.filters.subDivisions.length > 0) {
        gangsToLoad = gangFilter.getFilteredGangs()
      }
      // Pass objects directly, DO NOT map to strings so ReportToolbar can read g.gang_code and g.description
      setAvailableGangs(gangsToLoad || [])
    } else {
      setAvailableGangs([])
    }
  }, [finalDivision, authToken, allGangs, gangFilter.filters])

  // Render Division Optimized Logic
  const renderDivisionOptimized = async (token, division, month, year, gangPrefix = null) => {
    try {
      setLoadingStatus(`Fetching optimized division data for ${division}...`)
      const groupedData = await fetchReportDivisionOptimized(token, { division, month, year, use_history: useHistory, gang_prefix: gangPrefix })

      let flatRows = []
      const sortedGangs = Object.keys(groupedData).sort()

      for (const gang of sortedGangs) {
        const gangRows = groupedData[gang]
        if (!gangRows || gangRows.length === 0) continue
        const computedRows = applyComputeToRows(gangRows, computeRulesRef.current)
        const filteredRows = computedRows.filter(r => (r.jumlah_hk || 0) > 0)
        if (filteredRows.length === 0) continue

        flatRows.push({
          isHeader: true,
          gang_code: gang,
          id: `HEADER_${gang}`
        })
        flatRows.push(...filteredRows)

        const agg = (field) => Math.round(filteredRows.reduce((a, b) => a + Number(b[field] || 0), 0))
        const totalRow = {
          isTotal: true,
          no: '', jenis_kelamin: '', nik: '', nama: `TOTAL ${gang}`,
          upah_dasar: '', hari_kerja: agg('hari_kerja'), upah_pokok: agg('upah_pokok'),
          cuti_tahunan_hari: agg('cuti_tahunan_hari'), cuti_sakit_haid_hari: agg('cuti_sakit_haid_hari'), cuti_minggu_hari: agg('cuti_minggu_hari'), cuti_nasional_hari: agg('cuti_nasional_hari'), jumlah_hk: agg('jumlah_hk'),
          gaji_pokok: agg('gaji_pokok'), beras_rate: '', beras_jumlah: agg('beras_jumlah'), jabatan_rate: '', jabatan_jumlah: agg('jabatan_jumlah'), masa_kerja_tahun: '', masa_kerja_jumlah: agg('masa_kerja_jumlah'), lembur_jam: '', lembur_jumlah: agg('lembur_jumlah'), total_tunjangan: agg('total_tunjangan'),
          premi_brondol: agg('premi_brondol'), premi_pruning: agg('premi_pruning'), premi_angkut_material: agg('premi_angkut_material'), premi_angkut_tbs: agg('premi_angkut_tbs'), premi_harvesting: agg('premi_harvesting'), premi_harvesting_incentive: agg('premi_harvesting_incentive'), premi_pupuk: agg('premi_pupuk'),
          pot_koreksi: agg('pot_koreksi'),
          total_premi: agg('total_premi'),
          jumlah_upah_kotor: agg('jumlah_upah_kotor'),
          pot_pph21: agg('pot_pph21'), pot_kontan: agg('pot_kontan'), pot_thr: agg('pot_thr'), pot_pinjam: agg('pot_pinjam'), pot_kl: agg('pot_kl'), pot_bpjs_kes: agg('pot_bpjs_kes'),
          // Updated Astek Keys
          pot_astek: agg('pot_astek'), pot_astek_maj: agg('pot_astek_maj'), pot_astek_jumlah: agg('pot_astek_jumlah'),
          // Legacy Keys (if needed)
          pot_bpjs_pek: agg('pot_bpjs_pek'), pot_bpjs_maj: agg('pot_bpjs_maj'),

          pot_bpjs_kesehatan_pekerja: agg('pot_bpjs_kesehatan_pekerja'),
          pot_bpjs_kesehatan_majikan: agg('pot_bpjs_kesehatan_majikan'),
          pot_bpjs_pensiun_pekerja: agg('pot_bpjs_pensiun_pekerja'),
          pot_bpjs_pensiun_majikan: agg('pot_bpjs_pensiun_majikan'),
          pot_bpjs_jumlah: agg('pot_bpjs_jumlah'),
          pot_bpjs_pekerja_total: agg('pot_bpjs_pekerja_total'),
          pot_spsi: agg('pot_spsi'),
          total_potongan: agg('total_potongan'), upah_bersih: agg('upah_bersih')
        }

        // Add dynamic premi fields from nested structure
        const sampleRow = flatRows[0] || {}
        if (sampleRow.premi && typeof sampleRow.premi === 'object') {
          Object.keys(sampleRow.premi).forEach(key => {
            if (key.startsWith('premi_')) {
              const f = `premi.${key}`
              const sum = agg(f)
              if (sum > 0) totalRow[f] = sum
            }
          })
        }

        // Add dynamic potongan fields from nested structure
        if (sampleRow.potongan_upah_kotor && sampleRow.potongan_upah_kotor.dynamic) {
          Object.keys(sampleRow.potongan_upah_kotor.dynamic).forEach(key => {
            const f = `potongan_upah_kotor.dynamic.${key}`
            const sum = agg(f)
            if (sum > 0) totalRow[f] = sum
          })
        }
        flatRows.push(totalRow)
      }
      setRows(flatRows)
      setPinnedBottom([])
      recomputeAutoHideMap(flatRows)
      setFirstBatchReady(true)
      setFirstBatchAttempted(true)

    } catch (e) {
      console.error("Division render error:", e)
      setError("Failed to render division report")
    }
  }

  // Column Types Definition
  const columnTypes = useMemo(() => ({
    rightAligned: {
      headerClass: 'ag-right-aligned-header',
      cellStyle: { textAlign: 'right' }
    },
    leftAligned: {
      headerClass: 'ag-left-aligned-header',
      cellStyle: { textAlign: 'left' }
    },
    centerAligned: {
      headerClass: 'ag-center-aligned-header',
      cellStyle: { textAlign: 'center' }
    },
    textColumn: {
      filter: 'agTextColumnFilter',
    },
    numericColumn: {
      filter: 'agNumberColumnFilter',
      type: 'rightAligned'
    }
  }), [])

  const baseCol = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    minWidth: 100,
    enableCellTextSelection: true,
    enableRangeSelection: true,
    suppressMenu: true,
    headerClass: 'ag-header-cell-text-bold',
    wrapHeaderText: true,
    autoHeaderHeight: true
  }), [])

  // Debounce ref for selection stats
  const selectionTimeoutRef = useRef(null)

  const onRangeSelectionChanged = useCallback((event) => {
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current)
    }

    selectionTimeoutRef.current = setTimeout(() => {
      const cellRanges = event.api.getCellRanges();
      if (!cellRanges || cellRanges.length === 0) {
        setSelectionStats({ count: 0, sum: 0, average: 0 });
        return;
      }

      let sum = 0;
      let count = 0;

      cellRanges.forEach(range => {
        const startRowIndex = Math.min(range.startRow.rowIndex, range.endRow.rowIndex);
        const endRowIndex = Math.max(range.startRow.rowIndex, range.endRow.rowIndex);

        for (let rowIndex = startRowIndex; rowIndex <= endRowIndex; rowIndex++) {
          const rowNode = event.api.getDisplayedRowAtIndex(rowIndex);
          if (rowNode) {
            range.columns.forEach(column => {
              const value = event.api.getValue(column, rowNode);
              const numValue = Number(value);
              if (!isNaN(numValue) && value !== null && value !== undefined && value !== '') {
                sum += numValue;
                count++;
              }
            });
          }
        }
      });

      setSelectionStats({
        count,
        sum: count > 0 ? sum : 0,
        average: count > 0 ? sum / count : 0
      });
    }, 300);
  }, []);

  const onCellClicked = useCallback((params) => {
    if (params.context.editModeNik && params.colDef.field === 'nik') return; // Do not toggle Row Selection if editing NIK

    if (params.colDef.field === 'nik' || params.colDef.field === 'nama') {
      params.node.setSelected(!params.node.isSelected())
    }
  }, [])

  const rowClassRules = useMemo(() => ({
    'row-odd': params => params.data && !params.data.isHeader && !params.data.isTotal && params.node.rowIndex % 2 === 0,
    'row-even': params => params.data && !params.data.isHeader && !params.data.isTotal && params.node.rowIndex % 2 === 1,
    'grand-total': params => params.node.footer || (params.data && params.data.isTotal),
    'gang-header': params => params.data && params.data.isHeader,
    'row-grand-total': params => params.data && (params.data.isTotal || params.data.nama === 'GRAND TOTAL')
  }), [])

  // 1. Fetch Column Definitions
  useEffect(() => {
    async function loadColumnDefinitions() {
      if (!activeMonth || !activeYear || !finalGangCode) return;

      setLoadingStatus('Loading column definitions...')
      setError('')

      let targetGangCode = finalGangCode
      if (String(finalGangCode).toUpperCase() === 'ALL') {
        targetGangCode = 'H1H'
      }

      try {
        let activeToken = authToken
        if (!activeToken && DEV_MODE) {
          try {
            const res = await login('admin', 'admin')
            setAuthToken(res.access_token)
            activeToken = res.access_token
          } catch (autoErr) { }
        }

        try {
          const cols = await fetchColumnDefinitions(activeToken, activeMonth, activeYear, targetGangCode)
          const normalized = Array.isArray(cols) ? cols : (Array.isArray(cols?.columns) ? cols.columns : [])
          const transformed = removePlaceholderPotonganHeaders(relocateDynamicPotonganHeaders(normalized))
          ensureHierarchicalOrThrow(transformed)
          const enhanced = enhanceColumnsRecursive(transformed, 0)

          // Define frontend sequence column (NO)
          const seqCol = {
            headerName: 'NO',
            field: 'frontend_no',
            width: 50,
            minWidth: 50,
            pinned: 'left',
            type: 'textColumn',
            valueGetter: params => {
              try {
                if (params.data?.nama === 'GRAND TOTAL' || params.data?.isHeader || params.data?.isTotal) return '';
                return params.node.rowIndex + 1
              } catch (e) {
                return ''
              }
            },
            cellStyle: { textAlign: 'center', color: 'var(--text-secondary)' }
          }

          const finalCols = enhanced.map(col => {
            if (col.headerName === 'IDENTITAS' || (col.children && col.children.some(c => c.field === 'nik'))) {
              const kids = col.children || []
              const nikCol = kids.find(c => c.field === 'nik')
              const namaCol = kids.find(c => c.field === 'nama')
              const lpCol = kids.find(c => c.field === 'jenis_kelamin')

              const usedFields = new Set(['nik', 'nama', 'jenis_kelamin', 'no'])

              const otherCols = kids.filter(c => !usedFields.has(c.field))

              if (nikCol) {
                nikCol.pinned = 'left';
                nikCol.width = 150;
                nikCol.minWidth = 150;

                // Edit Mode config via context so we don't need to rebuild columns
                nikCol.editable = (params) => params.context.editModeNik;
                nikCol.cellStyle = (params) => {
                  return params.context.editModeNik ? {
                    backgroundColor: '#fffbeb',
                    border: '1px solid #eab308',
                    cursor: 'text'
                  } : {};
                }
                nikCol.valueSetter = (params) => {
                  const newVal = String(params.newValue || '').trim();
                  const oldVal = String(params.oldValue || '').trim();
                  if (newVal !== oldVal) {
                    params.data[params.colDef.field] = newVal;
                    params.context.onNikChange(params.data.emp_code, newVal, oldVal, params.data);
                    return true;
                  }
                  return false;
                };

                // Cell renderer for edit and history button
                nikCol.cellRenderer = (params) => {
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: '100%' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{params.value}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {params.context.editModeNik && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              params.api.startEditingCell({
                                rowIndex: params.node.rowIndex,
                                colKey: params.column.getId()
                              });
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '12px' }}
                            title="Edit NIK"
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); params.context.openNikHistory(params.data.emp_code); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '12px', opacity: 0.6 }}
                          title="Lihat Riwayat Versi"
                        >
                          ⏱️
                        </button>
                      </div>
                    </div>
                  );
                };
              }
              if (namaCol) { namaCol.pinned = 'left'; namaCol.width = 220; }
              if (lpCol) { lpCol.width = 50; lpCol.minWidth = 50; }

              const newChildren = []
              if (nikCol) newChildren.push(nikCol)
              if (namaCol) newChildren.push(namaCol)
              newChildren.push({ ...seqCol, pinned: undefined })
              if (lpCol) newChildren.push(lpCol)
              newChildren.push(...otherCols)

              return { ...col, children: newChildren }
            }
            return col
          })

          // --- INJECT JABATAN COLUMN ---
          console.log("Starting Column Injection...");
          let injected = false;
          const injectJabatanRecursive = (colsList) => {
            for (let i = 0; i < colsList.length; i++) {
              const c = colsList[i];
              console.log("Checking col:", c.field, c.headerName);
              if (c.children) {
                injectJabatanRecursive(c.children);
              } else if (c.field === 'beras_jumlah' || c.field === 'beras_rate' || c.field === 'tunjangan_beras') {
                console.log("Found injection point at:", c.field);
                // Found injection point
                colsList.splice(i, 0, {
                  headerName: 'JABATAN',
                  field: 'jabatan_frontend', // Virtual field
                  width: 110,
                  editable: true,
                  cellEditor: 'agSelectCellEditor',
                  cellEditorParams: {
                    values: ['Karyawan', 'Operator', 'Helper', 'Kerani', 'Mandor']
                  },
                  cellStyle: (params) => {
                    return {
                      backgroundColor: '#fffbeb', // Light yellow to indicate editable
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer'
                    }
                  },
                  valueGetter: (params) => {
                    // Get from local state via context, or default 'Karyawan'
                    if (!params.data || !params.data.nik) return '';
                    return params.context.jobTitles[params.data.nik] || 'Karyawan';
                  },
                  valueSetter: (params) => {
                    const newVal = params.newValue;
                    if (newVal) {
                      params.context.onJobChange(params.data.nik, newVal, params.data);
                      return true;
                    }
                    return false;
                  }
                });
                injected = true;
                // Move index forward to skip the newly added col
                i++;
              }
            }
          }
          injectJabatanRecursive(finalCols);
          if (!injected) console.warn("WARNING: Jabatan Column NOT injected! target field not found.");


          setColumnDefs(finalCols)
        } catch (colErr) {
          computeRulesRef.current = {}
          setError('Failed to load column definitions')
        }
      } catch (e) {
        console.error('Failed to initialize column definitions loading:', e)
      } finally {
        setLoadingStatus('Column definitions loaded successfully')
      }
    }

    loadColumnDefinitions()
  }, [authToken, activeMonth, activeYear, finalGangCode])

  // 2. Fetch Data
  useEffect(() => {
    async function run() {
      if (!activeMonth || !activeYear || !finalGangCode) return;
      // Wait for columns to be ready before fetching data to ensure proper rendering
      if (columnDefs.length === 0) return;

      setLoading(true);
      setLoadingStatus('Loading payroll data...')
      setError('')
      try {
        let activeToken = authToken
        if (!activeToken && DEV_MODE) {
          try {
            const res = await login('admin', 'admin')
            setAuthToken(res.access_token)
            activeToken = res.access_token
          } catch (autoErr) { }
        }

        if (String(finalGangCode).toUpperCase() === 'ALL') {
          await renderDivisionOptimized(activeToken, finalDivision, activeMonth, activeYear, gangPrefixProp)
        } else {
          const data = await fetchReportRowsSimple(activeToken, { month: activeMonth, year: activeYear, gang_code: finalGangCode, division: finalDivision, skip: 0, limit: INFINITE_BATCH_SIZE, use_history: useHistory })

          const computed = applyComputeToRows(data, computeRulesRef.current)
          const filtered = computed.filter(row => (row.jumlah_hk || 0) > 0)

          setRows(filtered)
          const safe = Array.isArray(filtered) ? filtered : []
          recomputeAutoHideMap(safe)
          setInitialRowsPreview(safe.slice(0, INFINITE_BATCH_SIZE))
          setFirstBatchAttempted(true)
          setFirstBatchReady(safe.length > 0)

          const agg = (field) => Math.round(safe.reduce((a, b) => a + Number(b[field] || 0), 0))

          // Helper for nested aggregation
          const aggNested = (objProp, key) => Math.round(safe.reduce((a, b) => {
            const val = (b[objProp] && b[objProp][key]) ? Number(b[objProp][key]) : 0
            return a + val
          }, 0))

          if (safe.length > 0) {
            const grand = {
              no: '', jenis_kelamin: '', nik: '', nama: 'GRAND TOTAL',
              upah_dasar: '', hari_kerja: agg('hari_kerja'), upah_pokok: agg('upah_pokok'),
              cuti_tahunan_hari: agg('cuti_tahunan_hari'), cuti_sakit_haid_hari: agg('cuti_sakit_haid_hari'), cuti_minggu_hari: agg('cuti_minggu_hari'), cuti_nasional_hari: agg('cuti_nasional_hari'), jumlah_hk: agg('jumlah_hk'),
              gaji_pokok: agg('gaji_pokok'), beras_rate: '', beras_jumlah: agg('beras_jumlah'), jabatan_rate: '', jabatan_jumlah: agg('jabatan_jumlah'), masa_kerja_tahun: '', masa_kerja_jumlah: agg('masa_kerja_jumlah'), lembur_jam: '', lembur_jumlah: agg('lembur_jumlah'), total_tunjangan: agg('total_tunjangan'),
              premi_brondol: agg('premi_brondol'), premi_pruning: agg('premi_pruning'), premi_angkut_material: agg('premi_angkut_material'), premi_angkut_tbs: agg('premi_angkut_tbs'), premi_harvesting: agg('premi_harvesting'), premi_harvesting_incentive: agg('premi_harvesting_incentive'), premi_pupuk: agg('premi_pupuk'),
              pot_koreksi: agg('pot_koreksi'),
              total_premi: agg('total_premi'),
              jumlah_upah_kotor: agg('jumlah_upah_kotor'),
              pot_pph21: agg('pot_pph21'), pot_kontan: agg('pot_kontan'), pot_thr: agg('pot_thr'), pot_pinjam: agg('pot_pinjam'), pot_kl: agg('pot_kl'), pot_bpjs_kes: agg('pot_bpjs_kes'),
              pot_astek: agg('pot_astek'), pot_astek_maj: agg('pot_astek_maj'), pot_astek_jumlah: agg('pot_astek_jumlah'),
              pot_bpjs_pek: agg('pot_bpjs_pek'), pot_bpjs_maj: agg('pot_bpjs_maj'),
              pot_bpjs_kesehatan_pekerja: agg('pot_bpjs_kesehatan_pekerja'),
              pot_bpjs_kesehatan_majikan: agg('pot_bpjs_kesehatan_majikan'),
              pot_bpjs_pensiun_pekerja: agg('pot_bpjs_pensiun_pekerja'),
              pot_bpjs_pensiun_majikan: agg('pot_bpjs_pensiun_majikan'),
              pot_bpjs_jumlah: agg('pot_bpjs_jumlah'),
              pot_bpjs_pekerja_total: agg('pot_bpjs_pekerja_total'),
              pot_spsi: agg('pot_spsi'),
              total_potongan: agg('total_potongan'), upah_bersih: agg('upah_bersih'),
              premi: {} // Initialize nested premi object
            }

            // Aggregate nested premi fields
            const premiKeys = new Set()
            safe.forEach(r => {
              if (r.premi) Object.keys(r.premi).forEach(k => premiKeys.add(k))
            })
            
            let nestedPremiSum = 0
            premiKeys.forEach(k => {
              const val = aggNested('premi', k)
              grand.premi[k] = val
              nestedPremiSum += val
            })

            // Ensure total_premi is the SUM of all individual premiums if not already correct
            // grand.total_premi = agg('total_premi') // This usually comes from backend total_premi
            
            for (let i = 1; i <= 7; i++) {
              const f = `premi_dynamic_${i}`
              const sum = agg(f)
              if (sum > 0) grand[f] = sum
            }
            // Add dynamic potongan from nested structure
            if (safe[0] && safe[0].potongan_upah_kotor && safe[0].potongan_upah_kotor.dynamic) {
              Object.keys(safe[0].potongan_upah_kotor.dynamic).forEach(key => {
                const f = `potongan_upah_kotor.dynamic.${key}`
                const sum = agg(f)
                if (sum > 0) grand[f] = sum
              })
            }
            setPinnedBottom([grand])
          } else {
            setPinnedBottom([])
          }
        }
      } catch (e) {
        setError('Failed to load report data: ' + e.message)
        setRows([])
        setPinnedBottom([])
      } finally {
        setLoading(false)
        setLoadingStatus('')
        if (typeof onLoad === 'function') onLoad()
      }
    }

    // Trigger run when dependencies change
    run()
  }, [authToken, activeMonth, activeYear, finalGangCode, columnDefs, useHistory])

  useEffect(() => {
    let active = true
      ; (async () => {
        try {
          if (authToken && finalGangCode) {
            if (String(finalGangCode).toUpperCase() === 'ALL') {
              if (active) setGangInfo({ division: finalDivision, description: 'All gangs in division (Optimized)', loc_code: '' })
            } else {
              const info = await fetchGangInfo(authToken, finalGangCode)
              if (active) setGangInfo(info)
            }
          }
        } catch (_) { }
      })()
    return () => { active = false }
  }, [authToken, finalGangCode, finalDivision])

  const removeLeavesBy = (cols, pred) => {
    const removed = []
    const walk = list => {
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i]
        if (c && Array.isArray(c.children)) {
          walk(c.children)
          if (c.children.length === 0) list.splice(i, 1)
        } else if (c && pred(c)) {
          removed.push(c)
          list.splice(i, 1)
        }
      }
    }
    const top = Array.isArray(cols) ? cols.slice() : []
    walk(top)
    return { top, removed }
  }
  const relocateDynamicPotonganHeaders = cols => {
    const pred = leaf => {
      const f = String(leaf.field || '')
      const h = String(leaf.headerName || '').toUpperCase().trim()
      if (f.startsWith('pot_dynamic_')) return false // Removed field, skip
      if (f.includes('potongan_upah_kotor.dynamic')) return true
      if (h.startsWith('POT')) return true
      if (h.includes('POTONG')) return true
      return false
    }
    const r = removeLeavesBy(cols, pred)
    if (r.removed.length === 0) return r.top
    const potonganGroupName = 'POTONGAN LAINNYA'
    let attached = false
    for (const g of r.top) {
      if (g && Array.isArray(g.children)) {
        const name = String(g.headerName || '').toUpperCase()
        if (name.includes('POTONGAN')) {
          g.children.push({ headerName: potonganGroupName, children: r.removed })
          attached = true
          break
        }
      }
    }
    if (!attached) {
      r.top.push({ headerName: potonganGroupName, children: r.removed })
    }
    return r.top
  }
  const removePlaceholderPotonganHeaders = cols => {
    const pred = leaf => {
      const f = String(leaf.field || '')
      const h = String(leaf.headerName || '').toUpperCase()
      const isPotTotal = /^pot_total_\d+$/.test(f)
      const isPotonganFamily = h.includes('POTONGAN') || f.startsWith('pot_') || f.includes('potongan_upah_kotor.dynamic')
      const hasTestWord = h.includes('TEST') || h.includes('CONTOH') || h.includes('SAMPLE')
      return isPotTotal || (isPotonganFamily && hasTestWord)
    }
    const r = removeLeavesBy(cols, pred)
    return r.top
  }

  // Enhanced column definitions with proper formatting
  const formatLeaf = useCallback((col) => {
    const cfg = { ...col, ...baseCol }
    const moneyFields = ['upah_dasar', 'upah_pokok', 'gaji_pokok', 'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah', 'lembur_jumlah', 'total_tunjangan', 'premi_brondol', 'premi_pruning', 'premi_angkut_material', 'premi_angkut_tbs', 'premi_harvesting', 'premi_harvesting_incentive', 'premi_pupuk', 'total_premi', 'jumlah_upah_kotor', 'pot_pph21', 'pot_koreksi', 'total_potongan', 'upah_bersih', 'premi_dynamic_1', 'premi_dynamic_2', 'premi_dynamic_3', 'premi_dynamic_4', 'premi_dynamic_5', 'premi_dynamic_6', 'premi_dynamic_7', 'pot_dynamic_1', 'pot_dynamic_2', 'pot_dynamic_3', 'pot_dynamic_4', 'pot_dynamic_5', 'pot_dynamic_6', 'pot_dynamic_7', 'pot_bpjs_kesehatan_pekerja', 'pot_bpjs_kesehatan_majikan', 'pot_bpjs_pensiun_pekerja', 'pot_bpjs_pensiun_majikan', 'pot_bpjs_pekerja_total', 'pot_spsi']
    const intFields = ['no', 'hari_kerja', 'cuti_tahunan_hari', 'cuti_sakit_haid_hari', 'cuti_minggu_hari', 'cuti_nasional_hari', 'tidak_hadir_cth', 'tidak_hadir_alpa', 'jumlah_hk', 'masa_kerja_tahun', 'bunches_total', 'bunches_ripe', 'bunches_unripe', 'bunches_round', 'bunches_transactions']
    // lembur_jam removed from intFields - should preserve decimal values (e.g., 1.5 hours)
    const decimalFields = ['lembur_jam']

    // Universal value getter for all field access - handles both flat and nested structures
    const createUniversalValueGetter = (field) => {
      return (params) => {
        const row = params.data;
        if (!row) return 0;

        // Try direct field access first (most common case)
        let value = row[field];
        if (value !== undefined && value !== null && value !== '') {
          return Number(value) || 0;
        }

        // Handle nested object access for dot notation fields (e.g., 'premi.brondol')
        if (field.includes('.')) {
          const [objectName, propertyName] = field.split('.');
          if (row[objectName] && typeof row[objectName] === 'object' && row[objectName][propertyName] !== undefined) {
            return Number(row[objectName][propertyName]) || 0;
          }
        }

        // Handle special cases for premium fields that might be nested
        if (field.startsWith('premi_') && row.premi && typeof row.premi === 'object') {
          const propertyName = field.replace('premi_', '');

          // Try direct access to nested property
          if (row.premi[propertyName] !== undefined) {
            return Number(row.premi[propertyName]) || 0;
          }

          // Special mappings for common premium fields
          const specialMappings = {
            'brondol': 'brondol',
            'pruning': 'pruning',
            'masa_kerja': 'premi_masa_kerja',
            'potongan_spsi': 'premi_potongan_spsi'
          };

          if (specialMappings[propertyName] && row.premi[specialMappings[propertyName]] !== undefined) {
            return Number(row.premi[specialMappings[propertyName]]) || 0;
          }
        }

        // Handle nested object access for potongan_upah_kotor.dynamic
        if (field.includes('potongan_upah_kotor.dynamic.')) {
          const dynamicKey = field.replace('potongan_upah_kotor.dynamic.', '');
          if (row.potongan_upah_kotor &&
            row.potongan_upah_kotor.dynamic &&
            typeof row.potongan_upah_kotor.dynamic === 'object' &&
            row.potongan_upah_kotor.dynamic[dynamicKey] !== undefined) {
            return Number(row.potongan_upah_kotor.dynamic[dynamicKey]) || 0;
          }
        }


        // Handle nested object access for potongan_upah_bersih.dynamic
        if (field.includes('potongan_upah_bersih.dynamic.')) {
          const dynamicKey = field.replace('potongan_upah_bersih.dynamic.', '');
          if (row.potongan_upah_bersih &&
            row.potongan_upah_bersih.dynamic &&
            typeof row.potongan_upah_bersih.dynamic === 'object' &&
            row.potongan_upah_bersih.dynamic[dynamicKey] !== undefined) {
            return Number(row.potongan_upah_bersih.dynamic[dynamicKey]) || 0;
          }
        }

        return 0;
      };
    };

    // Helper function for integer formatting
    const formatInteger = (value) => {
      const v = value
      if (v === null || v === undefined) return ''
      const n = Number(v)
      const iv = isNaN(n) ? 0 : Math.round(n)
      return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(iv)
    }

    // Helper function for decimal formatting (1 decimal place, e.g., 1.5 hours)
    const formatDecimal = (value) => {
      const v = value
      if (v === null || v === undefined) return ''
      const n = Number(v)
      if (isNaN(n)) return ''
      return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)
    }

    // STYLING RULES APPLICATION
    const f = String(cfg.field || '')
    const hdr = String(cfg.headerName || '').toUpperCase()

    // 1. Identitas
    if (['no', 'nik', 'nama', 'jenis_kelamin'].includes(f) || hdr.includes('IDENTITAS')) {
      cfg.headerClass = (cfg.headerClass || '') + ' header-section-identitas'
    }

    // 2. Absensi
    const isAbsensi = f.includes('hari_kerja') || f.includes('cuti_') || f.includes('tidak_hadir') || f.includes('jumlah_hk') || hdr.includes('ABSENSI')
    if (isAbsensi) {
      cfg.headerClass = (cfg.headerClass || '') + ' header-section-absensi'
      if (!['nama', 'nik'].includes(f)) cfg.cellClass = (cfg.cellClass || '') + ' cell-absensi'
    }

    // 3. Income (Upah & Tunjangan)
    const isIncome = hdr.includes('UPAH') || hdr.includes('TUNJANGAN') || f.startsWith('beras_') || f.startsWith('jabatan_') || f.startsWith('masa_kerja_') || f.startsWith('lembur_') || f === 'upah_dasar' || f === 'upah_pokok' || f === 'gaji_pokok'
    if (isIncome) {
      cfg.headerClass = (cfg.headerClass || '') + ' header-section-income'
      if (moneyFields.includes(f)) cfg.cellClass = (cfg.cellClass || '') + ' cell-income cell-accounting'
    }

    // 4. Premi
    const isPremi = hdr.includes('PREMI') || f.startsWith('premi_')
    if (isPremi) {
      cfg.headerClass = (cfg.headerClass || '') + ' header-section-premi'
      if (moneyFields.includes(f)) cfg.cellClass = (cfg.cellClass || '') + ' cell-premi cell-accounting'

      // Add valueGetter for direct premi fields if not already set to ensure correct data access
      if (f.startsWith('premi_') && !cfg.valueGetter) {
        cfg.valueGetter = (params) => {
          const row = params.data;
          if (!row) return 0;

          // Handle dot notation fields like 'premi.normalized_field'
          if (f.includes('.')) {
            const [objectName, fieldName] = f.split('.');
            if (row[objectName] && typeof row[objectName] === 'object' && row[objectName][fieldName] !== undefined) {
              return Number(row[objectName][fieldName]) || 0;
            }
          }

          // Try direct field access first (for flat fields like premi_brondol, pot_spsi, etc.)
          let value = row[f];
          if (value !== undefined && value !== null) {
            return Number(value) || 0;
          }

          // Fallback: try accessing through premi nested object
          if (row.premi && typeof row.premi === 'object') {
            // Check direct field in nested object
            if (row.premi[f] !== undefined) {
              return Number(row.premi[f]) || 0;
            }

            // Additional fallback: check for field without 'premi_' prefix in nested object
            const fieldNameWithoutPrefix = f.replace('premi_', '');
            if (row.premi[fieldNameWithoutPrefix] !== undefined) {
              return Number(row.premi[fieldNameWithoutPrefix]) || 0;
            }

            // Special handling for premi_brondol which might be stored as 'brondol' in nested object
            if (f === 'premi_brondol' && row.premi.brondol !== undefined) {
              return Number(row.premi.brondol) || 0;
            }
          }

          return 0;
        };
      }
    }

    // 5. Deduction (Potongan)
    const isDeduction = hdr.includes('POTONGAN') || hdr.includes('ASTEK') || hdr.includes('BPJS') || f.startsWith('pot_') || f.includes('potongan_upah_kotor.dynamic')
    if (isDeduction) {
      cfg.headerClass = (cfg.headerClass || '') + ' header-section-deduction'
      if (moneyFields.includes(f)) cfg.cellClass = (cfg.cellClass || '') + ' cell-deduction cell-accounting'
    }

    // 6. Net Salary (Special)
    if (f === 'upah_bersih') {
      cfg.headerClass = (cfg.headerClass || '') + ' header-section-net'
      cfg.cellClass = (cfg.cellClass || '') + ' cell-net-salary cell-accounting'
    }

    // Apply universal value getter for all fields that need it
    if (cfg.field && (moneyFields.includes(cfg.field) || intFields.includes(cfg.field) ||
      cfg.field.startsWith('premi_') || cfg.field.includes('potongan_upah_kotor.dynamic') ||
      cfg.field.includes('.'))) {
      if (!cfg.valueGetter) {
        cfg.valueGetter = createUniversalValueGetter(cfg.field)
      }
    }

    // Value Formatting
    if (cfg.field && moneyFields.includes(cfg.field)) {
      cfg.valueFormatter = p => formatInteger(p.value)
      cfg.type = 'rightAligned'
    } else if (cfg.field && intFields.includes(cfg.field)) {
      cfg.valueFormatter = p => formatInteger(p.value)
      cfg.type = 'rightAligned'
    } else if (cfg.field && decimalFields.includes(cfg.field)) {
      // Use decimal formatter for lembur_jam etc. (preserves 1 decimal place)
      cfg.valueFormatter = p => formatDecimal(p.value)
      cfg.type = 'rightAligned'
    } else if (cfg.field && ['nama'].includes(cfg.field)) {
      cfg.cellStyle = { textAlign: 'left', fontWeight: '600' }; cfg.type = 'leftAligned'; cfg.pinned = 'left'
    } else if (cfg.field && ['nik', 'jenis_kelamin'].includes(cfg.field)) {
      cfg.cellStyle = { textAlign: 'center' }; cfg.type = 'centerAligned'
    } else if (cfg.field === 'phone') {
      cfg.hide = true
    } else if (cfg.field) {
      cfg.valueFormatter = p => {
        if (p.value === null || p.value === undefined) return ''
        if (typeof p.value === 'number') return formatInteger(p.value)
        return p.value
      }
    }

    return cfg
  }, [baseCol])

  const enhanceColumnsRecursive = (cols, depth = 0) => {
    if (!Array.isArray(cols)) return []
    const out = []
    for (const c of cols) {
      if (c.children && Array.isArray(c.children)) {
        const kids = enhanceColumnsRecursive(c.children, depth + 1)
        const visibleKids = kids.filter(k => !k.hide)
        if (visibleKids.length > 0) {
          // Apply header styles to group parents too
          let headerClass = `hdr-level-${depth + 1}`
          const hdr = String(c.headerName || '').toUpperCase()
          if (hdr.includes('ABSENSI')) headerClass += ' header-section-absensi'
          if (hdr.includes('UPAH') || hdr.includes('TUNJANGAN')) headerClass += ' header-section-income'
          if (hdr.includes('PREMI')) headerClass += ' header-section-premi'
          if (hdr.includes('POTONGAN')) headerClass += ' header-section-deduction'

          out.push({ ...c, children: visibleKids, headerGroupComponent: 'HierHeaderGroup', marryChildren: true, headerClass })
        }
      } else {
        const leaf = formatLeaf(c)
        if (!leaf.hide) out.push(leaf)
      }
    }
    return out
  }

  const ensureHierarchicalOrThrow = (cols) => {
    const arr = Array.isArray(cols) ? cols : []
    const hasGroup = arr.some(c => Array.isArray(c.children) && c.children.length > 0)
    if (!hasGroup && arr.length > 0) {
      // Auto-wrap if flat? For now throw to ensure structure
      // throw new Error('Hierarchical headers required')
    }
  }

  const recomputeAutoHideMap = (dataRows) => {
    try {
      const neverHide = new Set([
        'no', 'nik', 'nama', 'jenis_kelamin', 'upah_bersih', 'jumlah_upah_kotor', 'total_tunjangan', 'total_premi', 'gaji_pokok', 'upah_pokok', 'hari_kerja', 'jumlah_hk',
        'total_potongan'
      ])

      // Add dynamic potongan fields to neverHide if they have data
      if (dataRows[0] && dataRows[0].potongan_upah_kotor && dataRows[0].potongan_upah_kotor.dynamic) {
        Object.keys(dataRows[0].potongan_upah_kotor.dynamic).forEach(key => {
          neverHide.add(`potongan_upah_kotor.dynamic.${key}`)
        })
      }
      const fields = new Set()
      for (const r of dataRows || []) Object.keys(r || {}).forEach(f => fields.add(f))
      const m = {}
      for (const f of fields) {
        if (neverHide.has(f)) { m[f] = false; continue }
        let allEmpty = true
        for (const r of dataRows || []) {
          const v = r[f]
          if (v === null || v === undefined) continue
          if (typeof v === 'number') { if (v !== 0) { allEmpty = false; break } }
          else {
            const sv = String(v).trim()
            if (sv !== '' && sv !== '0' && sv !== '0.0') { allEmpty = false; break }
          }
        }
        m[f] = allEmpty
      }
      autoHideMapRef.current = m
    } catch { }
  }

  const handleExportExcel = async () => {
    if (!rows || rows.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }
    try {
      setIsExporting(true);
      setLoadingStatus('Generating Excel Worksheet in progress. This could take a while...');
      await exportReportToExcelPro(rows, columnDefs, {
        division: finalDivision,
        gangCode: finalGangCode,
        month: activeMonth,
        year: activeYear
      });
    } catch (err) {
      console.error('Failed to export to Excel:', err);
      alert('Gagal membuat file Excel: ' + err.message);
    } finally {
      setIsExporting(false);
      setLoadingStatus('');
    }
  }

  /**
   * Download Daftar Upah as a server-generated Excel with:
   * - Dynamic premi columns (one col per premi type)
   * - 'Uraian Premi' section header
   * - Excel formulas for all calculated values
   */
  const handleDownloadDaftarUpahExcel = async () => {
    try {
      setIsDownloadingExcel(true);
      const backendUrl = `${window.location.protocol}//${window.location.hostname}:8002`;
      const params = new URLSearchParams({
        month: activeMonth,
        year: activeYear,
        division: finalDivision || 'ALL',
        gang: finalGangCode || 'ALL'
      });
      const res = await fetch(`${backendUrl}/reports/excel?${params}`, {
        headers: { Authorization: authToken ? `Bearer ${authToken}` : '' }
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Daftar_Upah_${finalDivision || 'ALL'}_${finalGangCode || 'ALL'}_${activeMonth}_${activeYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download Daftar Upah Excel:', err);
      alert('Gagal mengunduh Daftar Upah Excel: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const autoSizeAll = () => {
    const allIds = []
    gridRef.current.columnApi.getColumns().forEach(c => allIds.push(c.getId()))
    gridRef.current.columnApi.autoSizeColumns(allIds)
  }

  if (error) return (
    <DashboardLayout title="Report Error">
      <div className="flex-center" style={{ height: '100%', flexDirection: 'column', color: 'var(--danger-700)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
        <div>{error}</div>
        <button className="btn btn-secondary" onClick={() => window.location.reload()} style={{ marginTop: '1rem' }}>Reload</button>
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout
      title="Daftar Upah Karyawan"
      subtitle={`${(overrideMonth || finalMonth) ? new Date(2000, (overrideMonth || finalMonth) - 1).toLocaleString('id-ID', { month: 'long' }) : '-'} ${(overrideYear || finalYear) || '-'} • Gang ${finalGangCode || '-'}`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0, fontWeight: 500, fontSize: '0.875rem' }} title="Ambil data dari database riwayat terpisah (history seed)">
              <input
                type="checkbox"
                checked={useHistory}
                onChange={(e) => {
                  setUseHistory(e.target.checked);
                  setRows([]);
                  setPinnedBottom([]);
                  dataInitRef.current = false;
                }}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
              />
              Mode History
            </label>
          </div>
          {/* Server-side Excel export with dynamic premi + formulas */}
          <button
            id="btn-download-daftar-upah-excel"
            onClick={handleDownloadDaftarUpahExcel}
            disabled={isDownloadingExcel || loading}
            title="Unduh Daftar Upah Excel (server-side, dengan formula dan kolom premi dinamis)"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: '#0ea5e9', color: 'white',
              border: 'none', padding: '8px 14px', borderRadius: '6px',
              fontWeight: '600', fontSize: '0.875rem',
              cursor: (isDownloadingExcel || loading) ? 'not-allowed' : 'pointer',
              opacity: (isDownloadingExcel || loading) ? 0.7 : 1,
              transition: 'background-color 0.2s'
            }}
          >
            {isDownloadingExcel ? '⏳ Mengunduh...' : '⬇️ Excel (Formula)'}
          </button>
          <ReportToolbar
            month={activeMonth}
            year={activeYear}
            division={finalDivision}
            divisions={allDivisions || []}
            gangCode={finalGangCode}
            gangs={availableGangs}
            onMonthYearChange={(m, y) => {
              setRows([])
              setPinnedBottom([])
              setOverrideMonth(m)
              setOverrideYear(y)
              dataInitRef.current = false
            }}
            onDivisionChange={(newDivision) => {
              if (newDivision && newDivision !== finalDivision) {
                setRows([])
                setPinnedBottom([])
                setOverrideDivision(newDivision)
                setOverrideGangCode(null) // Reset gang when division changes
                dataInitRef.current = false
              }
            }}
            onGangChange={(newGangCode) => {
              if (newGangCode && newGangCode !== finalGangCode) {
                setRows([])
                setPinnedBottom([])
                setOverrideGangCode(newGangCode)
                dataInitRef.current = false
              }
            }}
            onExport={handleExportExcel}
            onAutoSize={autoSizeAll}
            onBack={onBack}
            disableControls={loading || isExporting}
            editMode={editModeNik}
            onEditModeToggle={() => setEditModeNik(p => !p)}
          />
        </div>
      }
    >
      {/* Gang Filter Component */}
      <GangFilter
        gangs={gangFilter.availableData.gangs}
        divisions={gangFilter.availableData.divisions}
        selectedFilters={gangFilter.filters}
        onFiltersChange={(filters) => {
          gangFilter.setFilters(filters)
          // Clear current data when filter changes
          setRows([])
          setPinnedBottom([])
          dataInitRef.current = false
        }}
        isLoading={gangFilter.isLoading}
      />

      {/* Filter Status Summary */}
      {gangFilter.filters.hasActiveFilter && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: 'var(--info-50)',
          border: '1px solid var(--info-200)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1rem' }}>🎯</span>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--info-800)', fontSize: '0.9rem' }}>
              Filter Aktif: {gangFilter.getFilterSummary().text}
            </div>
            <div style={{ color: 'var(--info-700)', fontSize: '0.8rem' }}>
              {gangFilter.stats.totalInSelection} gang dari {gangFilter.stats.totalGangs} total gang
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => gangFilter.clearFilters()}
            style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
          >
            Clear Filter
          </button>
        </div>
      )}

      {loading && (
        <LoadingScreen
          isLoading={true}
          message={loadingStatus || 'Memuat data laporan...'}
          gangCode={finalGangCode}
          month={activeMonth}
          year={activeYear}
          steps={[
            { name: 'Menghubungkan ke database', duration: 1500 },
            { name: 'Mengambil data karyawan', duration: 2000 },
            { name: 'Melakukan kalkulasi payroll', duration: 2500 },
            { name: 'Menyiapkan laporan akhir', duration: 1500 }
          ]}
        />
      )}

      <div style={{ flex: 1, width: '100%' }} className="ag-theme-alpine">
        <AgGridReact
          ref={gridRef}
          context={{ jobTitles, onJobChange: handleJobChange, editModeNik, onNikChange: handleNikChange, openNikHistory }}
          columnDefs={columnDefs}
          rowData={rows}
          columnTypes={columnTypes}
          rowModelType={String(finalGangCode).toUpperCase() === 'ALL' ? 'clientSide' : 'infinite'}
          cacheBlockSize={INFINITE_BATCH_SIZE}
          maxBlocksInCache={5}
          blockLoadDebounceMillis={200}
          getRowId={params => params.data?.id || params.data?.nik || params.data?.NIK || params.data?.no}
          defaultColDef={baseCol}
          rowClassRules={rowClassRules}
          pinnedBottomRowData={pinnedBottom}
          rowSelection={'multiple'}
          rowBuffer={20}
          suppressRowClickSelection={true}
          onRangeSelectionChanged={onRangeSelectionChanged}
          onCellClicked={onCellClicked}
          animateRows={true}
          rowHeight={32}
          autoGroupHeaderHeight={true}
          isFullWidthRow={(params) => params.rowNode.data && params.rowNode.data.isHeader}
          fullWidthCellRenderer={GangHeaderRenderer}
          onGridReady={params => {
            if (String(finalGangCode).toUpperCase() !== 'ALL') {
              const datasource = {
                getRows: async rq => {
                  const start = rq.startRow
                  const end = rq.endRow
                  const monthValue = typeof finalMonth === 'string' && finalMonth.includes('-') ? parseInt(finalMonth.split('-')[1], 10) : finalMonth
                  const yearValue = typeof finalMonth === 'string' && finalMonth.includes('-') ? parseInt(finalMonth.split('-')[0], 10) : finalYear

                  let batch = []
                  if (start === 0 && initialRowsPreview && initialRowsPreview.length > 0) {
                    batch = initialRowsPreview.slice(0, end - start)
                  } else {
                    const leafFields = []
                    const walk = (c) => { if (c.children) c.children.forEach(walk); else if (c.field) leafFields.push(c.field) }
                    columnDefs.forEach(walk)

                    batch = await fetchReportRowsBatched(authToken, {
                      month: (overrideMonth || monthValue),
                      year: (overrideYear || yearValue),
                      gang_code: finalGangCode,
                      division: finalDivision,
                      fields: leafFields,
                      skip: start,
                      limit: end - start
                    })
                  }

                  if (batch && batch.length > 0) {
                    const computed = applyComputeToRows(batch, computeRulesRef.current)
                    const filtered = computed.filter(row => (row.jumlah_hk || 0) > 0)
                    recomputeAutoHideMap(filtered)
                    rq.successCallback(filtered, -1)
                  } else {
                    rq.successCallback([], 0)
                  }
                }
              }
              params.api.setDatasource(datasource)
            }
          }}
        />
      </div>

      {/* Save Button for NIK Edits */}
      {Object.keys(pendingNikEdits).length > 0 && (
        <div className="report-save-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ color: '#854d0e', fontWeight: '600' }}>
              Pending: {Object.keys(pendingNikEdits).length} NIK telah diubah (Versioned Edit Mode)
            </span>
          </div>
          <div className="report-save-bar-actions">
            <button
              className="btn btn-secondary"
              onClick={() => { setPendingNikEdits({}); loadColumnDefinitions(); }}
              disabled={isSavingNik}
              style={{ backgroundColor: 'white' }}
            >
              Batal
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveNikEdits}
              disabled={isSavingNik}
              style={{ backgroundColor: '#eab308', color: '#854d0e', borderColor: '#ca8a04' }}
            >
              {isSavingNik ? 'Menyimpan...' : '💾 SIMPAN PERUBAHAN NIK'}
            </button>
          </div>
        </div>
      )}

      {/* History Modal for NIK */}
      {historyModalNik.isOpen && (
        <div className="history-modal-overlay" onClick={() => setHistoryModalNik({ isOpen: false, data: null, empCode: null, loading: false })}>
          <div className="history-modal-content" onClick={e => e.stopPropagation()}>
            <div className="history-modal-header">
              <h3 style={{ margin: 0 }}>Riwayat Perubahan NIK</h3>
              <button
                onClick={() => setHistoryModalNik({ isOpen: false, data: null, empCode: null, loading: false })}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >✕</button>
            </div>

            <div style={{ marginBottom: '16px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Karyawan: {historyModalNik.empCode}</span>
            </div>

            {historyModalNik.loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading history...</div>
            ) : historyModalNik.data && historyModalNik.data.length > 0 ? (
              <div className="history-list">
                {historyModalNik.data.map((h, index) => (
                  <div key={h.id} className="history-item">
                    <div className="history-meta" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '8px' }}>
                      <span><strong>Versi:</strong> {h.version} {index === 0 && <span style={{ color: '#10b981', fontSize: '10px', marginLeft: '4px' }}>(Terbaru)</span>}</span>
                      <span><strong>Diubah oleh:</strong> {h.changed_by}</span>
                      <span>{new Date(h.changed_at).toLocaleString('id-ID')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="history-changes">
                        <span className="history-old">{h.old_value || '(Kosong/Tidak Ada)'}</span>
                        <span>➔</span>
                        <span className="history-new">{h.new_value}</span>
                      </div>

                      {/* Delete Version Button - only on the latest version */}
                      {index === 0 && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Yakin ingin MENGHAPUS versi ini dan ROLLBACK NIK ke versi sebelumnya?`)) return;

                            try {
                              const backendUrl = `${window.location.protocol}//${window.location.hostname}:8002`;
                              const res = await fetch(`${backendUrl}/employee-hr-data/${historyModalNik.empCode}/rollback`, {
                                method: 'POST',
                                headers: { 'Authorization': authToken ? `Bearer ${authToken}` : '' }
                              });
                              const json = await res.json();
                              if (json.success) {
                                alert("Berhasil di-rollback!");
                                setHistoryModalNik({ isOpen: false, data: null, empCode: null, loading: false });
                                // Force refresh grid data
                                setRows([]);
                                setPinnedBottom([]);
                                dataInitRef.current = false;
                              } else {
                                alert("Gagal rollback: " + json.error);
                              }
                            } catch (e) {
                              alert("Error: " + e.message);
                            }
                          }}
                          className="btn btn-danger"
                          style={{
                            padding: '4px 8px', fontSize: '11px', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5'
                          }}
                        >
                          🗑️ Hapus Setelan Versi Ini
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="history-empty">Belum ada riwayat perubahan NIK (versi default Plantware).</div>
            )}
          </div>
        </div>
      )}

      <SelectionStats selection={selectionStats} />
    </DashboardLayout>
  )
}

// Main Report component that wraps with GangFilterProvider
export default function ReportWrapper({ token, user, month, year, gang_code, division, onLoad, onBack, gangPrefix = null }) {
  return (
    <GangFilterProvider>
      <ReportContent
        token={token}
        user={user}
        month={month}
        year={year}
        gang_code={gang_code}
        division={division}
        onLoad={onLoad}
        onBack={onBack}
        gangPrefix={gangPrefix}
      />
    </GangFilterProvider>
  )
}
