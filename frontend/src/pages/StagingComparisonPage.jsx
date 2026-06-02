import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import LoadingScreen from '../components/common/LoadingScreen';
import { RefreshCw, Download } from 'lucide-react';
import { fetchGangs, fetchDivisions } from '../services/gangService';
import axios from 'axios';
import { buildBackendUrl } from '../utils/apiBase';
import { fetchLoosefruitAnomalies } from '../services/stagingComparisonService';

// ─── API ──────────────────────────────────────────────────────────────────────

const getPivot = (path, params, token) =>
  axios.get(buildBackendUrl(path), {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(r => {
    if (r.data?.success === false) throw new Error(r.data.error || 'Request failed');
    return r.data?.data;
  });

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULES = [
  { key: 'attendance', label: 'Kehadiran',  path: '/api/staging/compare/pivot-attendance',  unit: 'trx' },
  { key: 'overtime',   label: 'Lembur',     path: '/api/staging/compare/pivot-overtime',    unit: 'jam' },
  { key: 'loosefruit', label: 'Brondol',    path: '/api/staging/compare/pivot-loosefruit',  unit: 'bch' },
];

const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCell = (v, unit) => {
  if (!v && v !== 0) return '';
  const n = Number(v);
  if (!n) return '';
  if (unit === 'jam') return n % 1 === 0 ? `${n}j` : `${n.toFixed(1)}j`;
  return String(n);
};

const exportCSV = (rows, days, module, month, year) => {
  if (!rows?.length) return;
  const dayHdrs = Array.from({ length: days }, (_, i) => i + 1);
  const hdrs = ['EmpCode', 'Nama', 'Gang', 'Div', ...dayHdrs.flatMap(d => [`${d}S`, `${d}P`]), 'TotalS', 'TotalP'];
  const data = rows.map(r => [
    r.emp_code, r.emp_name, r.gang_code, r.division,
    ...dayHdrs.flatMap(d => [r.days[d]?.s ?? 0, r.days[d]?.p ?? 0]),
    r.total_staging, r.total_prod,
  ]);
  const csv = [hdrs, ...data].map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: `pivot_${module}_${month}_${year}.csv`,
  });
  a.click();
};

// ─── Pivot Matrix Table ───────────────────────────────────────────────────────

function PivotMatrix({ rows, daysInMonth, unit, showDiff }) {
  if (!rows.length) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: 8 }}>
      Tidak ada data untuk periode ini.
    </div>
  );

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Cell background based on staging vs prod
  const cellBg = (cell) => {
    if (!cell || (!cell.s && !cell.p)) return 'transparent';
    if (!cell.p && cell.s) return '#fee2e2';   // staging only → merah
    if (!cell.s && cell.p) return '#dbeafe';   // prod only → biru
    if (cell.diff) return '#fef3c7';            // beda → kuning
    return '#dcfce7';                           // match → hijau
  };

  const cellColor = (cell) => {
    if (!cell || (!cell.s && !cell.p)) return '#94a3b8';
    if (!cell.p && cell.s) return '#b91c1c';
    if (!cell.s && cell.p) return '#1e40af';
    if (cell.diff) return '#92400e';
    return '#166534';
  };

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.72rem', tableLayout: 'fixed', minWidth: daysInMonth * 52 + 320 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
          {/* Day numbers row */}
          <tr>
            <th style={{ ...stickyLeft, width: 80, minWidth: 80, background: '#1e293b', color: '#e2e8f0', borderBottom: '2px solid #334155', borderRight: '2px solid #334155', padding: '0.4rem 0.5rem', textAlign: 'left', fontSize: '0.7rem' }}>EmpCode</th>
            <th style={{ ...stickyLeft2, width: 130, minWidth: 130, background: '#1e293b', color: '#e2e8f0', borderBottom: '2px solid #334155', borderRight: '2px solid #334155', padding: '0.4rem 0.5rem', textAlign: 'left', fontSize: '0.7rem' }}>Nama</th>
            <th style={{ width: 55, minWidth: 55, background: '#1e293b', color: '#e2e8f0', borderBottom: '2px solid #334155', padding: '0.4rem 0.3rem', textAlign: 'center', fontSize: '0.7rem' }}>Gang</th>
            <th style={{ width: 45, minWidth: 45, background: '#1e293b', color: '#e2e8f0', borderBottom: '2px solid #334155', borderRight: '2px solid #475569', padding: '0.4rem 0.3rem', textAlign: 'center', fontSize: '0.7rem' }}>Div</th>
            {days.map(d => (
              <th key={d} style={{ width: 48, minWidth: 48, background: '#1e293b', color: '#94a3b8', borderBottom: '2px solid #334155', padding: '0.3rem 0', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700 }}>
                {d}
              </th>
            ))}
            <th style={{ width: 52, minWidth: 52, background: '#1e293b', color: '#fbbf24', borderBottom: '2px solid #334155', borderLeft: '2px solid #475569', padding: '0.3rem 0', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700 }}>ΣS</th>
            <th style={{ width: 52, minWidth: 52, background: '#1e293b', color: '#86efac', borderBottom: '2px solid #334155', padding: '0.3rem 0', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700 }}>ΣP</th>
          </tr>
          {/* S/P sub-header */}
          <tr>
            <th colSpan={4} style={{ background: '#0f172a', borderBottom: '1px solid #334155', borderRight: '2px solid #475569' }} />
            {days.map(d => (
              <th key={d} style={{ background: '#0f172a', borderBottom: '1px solid #334155', padding: '0.15rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                  <span style={{ fontSize: '0.58rem', color: '#fbbf24', fontWeight: 700 }}>S</span>
                  <span style={{ fontSize: '0.58rem', color: '#86efac', fontWeight: 700 }}>P</span>
                </div>
              </th>
            ))}
            <th colSpan={2} style={{ background: '#0f172a', borderBottom: '1px solid #334155', borderLeft: '2px solid #475569' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.emp_code} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
              {/* Identity */}
              <td style={{ ...stickyLeft, width: 80, fontWeight: 700, fontSize: '0.72rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', borderRight: '2px solid #334155', padding: '0.3rem 0.5rem', background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>{r.emp_code}</td>
              <td style={{ ...stickyLeft2, width: 130, fontSize: '0.72rem', color: '#334155', borderBottom: '1px solid #e2e8f0', borderRight: '2px solid #334155', padding: '0.3rem 0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: ri % 2 === 0 ? '#fff' : '#f8fafc' }} title={r.emp_name}>{r.emp_name || '—'}</td>
              <td style={{ fontSize: '0.68rem', color: '#475569', borderBottom: '1px solid #e2e8f0', padding: '0.3rem 0.3rem', textAlign: 'center' }}>{r.gang_code || '—'}</td>
              <td style={{ fontSize: '0.68rem', color: '#475569', borderBottom: '1px solid #e2e8f0', borderRight: '2px solid #e2e8f0', padding: '0.3rem 0.3rem', textAlign: 'center' }}>{r.division || '—'}</td>

              {/* Day cells */}
              {days.map(d => {
                const cell = r.days[d];
                const bg = cellBg(cell);
                const col = cellColor(cell);
                const hasData = cell && (cell.s || cell.p);
                return (
                  <td key={d} style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #f1f5f9', padding: '0.2rem 0', textAlign: 'center', background: bg, verticalAlign: 'middle' }}>
                    {hasData ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, lineHeight: 1.1 }}>
                        <span style={{ fontSize: '0.65rem', color: cell.s ? '#92400e' : '#94a3b8', fontWeight: cell.s ? 700 : 400 }}>{fmtCell(cell.s, unit) || '·'}</span>
                        <span style={{ fontSize: '0.65rem', color: cell.p ? '#166534' : '#94a3b8', fontWeight: cell.p ? 700 : 400 }}>{fmtCell(cell.p, unit) || '·'}</span>
                      </div>
                    ) : (
                      <span style={{ color: '#e2e8f0', fontSize: '0.6rem' }}>—</span>
                    )}
                  </td>
                );
              })}

              {/* Totals */}
              <td style={{ borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #e2e8f0', padding: '0.3rem 0.3rem', textAlign: 'center', fontWeight: 700, fontSize: '0.72rem', color: '#92400e', background: '#fffbeb' }}>{fmtCell(r.total_staging, unit) || '—'}</td>
              <td style={{ borderBottom: '1px solid #e2e8f0', padding: '0.3rem 0.3rem', textAlign: 'center', fontWeight: 700, fontSize: '0.72rem', color: r.has_diff ? '#b91c1c' : '#166534', background: r.has_diff ? '#fef2f2' : '#f0fdf4' }}>{fmtCell(r.total_prod, unit) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// sticky column styles
const stickyLeft  = { position: 'sticky', left: 0, zIndex: 1 };
const stickyLeft2 = { position: 'sticky', left: 80, zIndex: 1 };

// ─── Anomaly Panel ────────────────────────────────────────────────────────────

function AnomalyPanel({ token }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchLoosefruitAnomalies(token, { limit: 100 }).then(setData).catch(() => {});
  }, [token]);
  if (!data?.rows?.length) return null;
  const { rows, summary } = data;
  return (
    <div style={{ marginTop: '1.5rem', border: '1px solid #ddd6fe', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#f5f3ff', padding: '0.65rem 1rem', borderBottom: '1px solid #ddd6fe', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, color: '#5b21b6', fontSize: '0.82rem' }}>⚠ Anomali ID Double — DocDate berisi kode LF########_##</span>
        <span style={{ fontSize: '0.75rem', color: '#7c3aed' }}>{summary.total_anomaly_headers} header · {summary.total_anomaly_lines} baris · Amount excluded: {new Intl.NumberFormat('id-ID').format(summary.total_amount_excluded)}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead><tr>{['ID','DocDate (raw)','Lines','Total MT','Total Amount','Emp Codes'].map(h => <th key={h} style={{ padding: '0.45rem 0.65rem', fontWeight: 700, fontSize: '0.72rem', color: '#5b21b6', background: '#ede9fe', borderBottom: '2px solid #c4b5fd', textAlign: 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#faf5ff' : '#f5f3ff' }}>
                <td style={{ padding: '0.4rem 0.65rem', fontSize: '0.72rem', color: '#64748b', borderBottom: '1px solid #e9d5ff' }}>{r.doc_id}</td>
                <td style={{ padding: '0.4rem 0.65rem', fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace', borderBottom: '1px solid #e9d5ff' }}>{r.doc_date_raw}</td>
                <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', borderBottom: '1px solid #e9d5ff' }}>{r.line_count}</td>
                <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', borderBottom: '1px solid #e9d5ff' }}>{r.total_mt}</td>
                <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #e9d5ff' }}>{new Intl.NumberFormat('id-ID').format(r.total_amount)}</td>
                <td style={{ padding: '0.4rem 0.65rem', fontSize: '0.72rem', color: '#475569', borderBottom: '1px solid #e9d5ff' }}>{r.emp_codes.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StagingComparisonPage() {
  const { token } = useAuth();
  const { month, year } = useReport();

  const [module, setModule]   = useState('attendance');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [pivotData, setPivotData] = useState(null);
  const [search, setSearch]   = useState('');
  const [showDiffOnly, setShowDiffOnly] = useState(false);

  const [divisions, setDivisions] = useState([]);
  const [gangs, setGangs]         = useState([]);
  const [selDiv, setSelDiv]       = useState('');
  const [selGang, setSelGang]     = useState('');

  useEffect(() => {
    fetchDivisions(token).then(d => setDivisions(d || [])).catch(() => {});
  }, [token]);

  useEffect(() => {
    setSelGang('');
    if (!selDiv) { setGangs([]); return; }
    fetchGangs(token, selDiv).then(g => setGangs(g || [])).catch(() => setGangs([]));
  }, [selDiv, token]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null); setPivotData(null);
    try {
      const mod = MODULES.find(m => m.key === module);
      const result = await getPivot(mod.path, {
        month: month || 5, year: year || 2026,
        gang: selGang || undefined,
        division: selDiv || undefined,
      }, token);
      setPivotData(result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [module, month, year, token, selGang, selDiv]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRows = useMemo(() => {
    if (!pivotData?.rows) return [];
    let rows = pivotData.rows;
    if (showDiffOnly) rows = rows.filter(r => r.has_diff);
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      rows = rows.filter(r =>
        (r.emp_code || '').toUpperCase().includes(q) ||
        (r.emp_name || '').toUpperCase().includes(q) ||
        (r.gang_code || '').toUpperCase().includes(q)
      );
    }
    return rows;
  }, [pivotData, showDiffOnly, search]);

  const mod = MODULES.find(m => m.key === module);
  const diffCount = pivotData?.rows?.filter(r => r.has_diff).length ?? 0;
  const totalCount = pivotData?.rows?.length ?? 0;

  const btn = (active) => ({
    padding: '0.38rem 0.85rem', fontSize: '0.78rem', fontWeight: active ? 700 : 500,
    border: `1px solid ${active ? '#3b82f6' : '#cbd5e1'}`,
    borderRadius: 6, background: active ? '#3b82f6' : '#fff',
    color: active ? '#fff' : '#475569', cursor: 'pointer',
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: '0.85rem' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          Matriks Komparasi Staging vs DB Plantware
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
          {MONTHS[month || 5]} {year || 2026}
          {selDiv && <> · Divisi <strong>{selDiv}</strong></>}
          {selGang && <> · Gang <strong>{selGang}</strong></>}
          {totalCount > 0 && <> · <strong>{filteredRows.length}</strong> / {totalCount} karyawan{diffCount > 0 && <span style={{ color: '#b91c1c', marginLeft: 6 }}>({diffCount} ada selisih)</span>}</>}
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem', alignItems: 'center', padding: '0.6rem 0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        {/* Module */}
        <div style={{ display: 'flex', gap: 3 }}>
          {MODULES.map(m => (
            <button key={m.key} onClick={() => { setModule(m.key); setSearch(''); setShowDiffOnly(false); }} style={btn(module === m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 4px' }} />

        {/* Division + Gang */}
        <select value={selDiv} onChange={e => setSelDiv(e.target.value)}
          style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: 6, minWidth: 90 }}>
          <option value="">Semua Divisi</option>
          {divisions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={selGang} onChange={e => setSelGang(e.target.value)} disabled={!selDiv}
          style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: 6, minWidth: 110 }}>
          <option value="">Semua Gang</option>
          {gangs.map(g => <option key={g.gang_code} value={g.gang_code}>{g.gang_code}</option>)}
        </select>

        <div style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 4px' }} />

        {/* Search + diff filter */}
        <input type="text" placeholder="Cari nama / emp / gang…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: 6, width: 170 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}>
          <input type="checkbox" checked={showDiffOnly} onChange={e => setShowDiffOnly(e.target.checked)} />
          Hanya yang selisih
        </label>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={fetchData} disabled={loading} style={{ ...btn(false), display: 'flex', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => exportCSV(filteredRows, pivotData?.days_in_month, module, month, year)} disabled={!filteredRows.length}
            style={{ ...btn(false), display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem' }}>
        <span style={{ fontWeight: 700, color: '#334155' }}>Tiap sel: <span style={{ color: '#92400e' }}>S</span>=Staging / <span style={{ color: '#166534' }}>P</span>=Prod</span>
        {[
          ['Match', '#166534', '#dcfce7'],
          ['Beda', '#92400e', '#fef3c7'],
          ['Staging Only', '#b91c1c', '#fee2e2'],
          ['Prod Only', '#1e40af', '#dbeafe'],
        ].map(([l, fg, bg]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: fg }}>
            <span style={{ width: 11, height: 11, background: bg, border: `1px solid ${fg}44`, borderRadius: 2, display: 'inline-block' }} />{l}
          </span>
        ))}
        <span style={{ color: '#94a3b8' }}>· ΣS = total staging bulan · ΣP = total prod bulan</span>
      </div>

      {/* Loading / Error */}
      {loading && <LoadingScreen isLoading message="Memuat matriks pivot…" />}
      {error && <div style={{ padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', fontSize: '0.82rem', marginBottom: '1rem' }}>Error: {error}</div>}

      {/* Pivot Matrix */}
      {!loading && !error && pivotData && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <PivotMatrix
            rows={filteredRows}
            daysInMonth={pivotData.days_in_month}
            unit={mod?.unit}
            showDiff={showDiffOnly}
          />
        </div>
      )}

      {/* Anomaly panel (Brondol only) */}
      {!loading && module === 'loosefruit' && <AnomalyPanel token={token} />}

    </div>
  );
}
