import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import LoadingScreen from '../components/common/LoadingScreen';
import { RefreshCw, Download } from 'lucide-react';
import { fetchGangs, fetchDivisions } from '../services/gangService';
import axios from 'axios';
import { buildBackendUrl } from '../utils/apiBase';
import StagingEmployeeDetailModal from './StagingEmployeeDetailModal';

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchSummaryAll = (token, params) =>
  axios.get(buildBackendUrl('/api/staging/compare/summary-all'), {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(r => {
    if (r.data?.success === false) throw new Error(r.data.error || 'Request failed');
    return r.data?.data;
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const fmt = (v, dec = 0) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: dec }).format(n);
};

const diffStyle = (d, threshold = 0.01) => {
  if (Math.abs(d) <= threshold) return { color: '#047857', fontWeight: 400 };
  return { color: '#b91c1c', fontWeight: 700 };
};

const exportCSV = (rows, month, year) => {
  if (!rows?.length) return;
  const hdrs = ['No','EmpCode','Nama','Gang','Div',
    'S-HK','P-HK','Δ-HK',
    'S-OT Jam','P-OT Jam','Δ-OT',
    'S-Bunches','P-MT','Δ-LF',
    'S-Leave','P-Leave','Δ-Leave',
    'Status'];
  const data = rows.map((r, i) => [i+1, r.emp_code, r.emp_name, r.gang_code, r.division,
    r.s_hk, r.p_hk, r.diff_hk,
    r.s_ot_jam, r.p_ot_jam, r.diff_ot,
    r.s_bunches, r.p_mt, r.diff_lf,
    r.s_leave_days, r.p_leave_days, r.diff_leave,
    r.has_diff ? 'SELISIH' : 'MATCH']);
  const csv = [hdrs, ...data].map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: `staging_daftar_upah_${month}_${year}.csv`,
  });
  a.click();
};

// ─── Column group header style ────────────────────────────────────────────────

const GH = ({ label, cols, color, bg, borderColor }) => (
  <th colSpan={cols} style={{
    padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 800, fontSize: '0.7rem',
    color, background: bg, borderBottom: `2px solid ${borderColor}`,
    borderLeft: `2px solid ${borderColor}`, letterSpacing: '0.05em', textTransform: 'uppercase',
  }}>{label}</th>
);

const TH = ({ children, right, borderLeft, bg = '#f1f5f9', color = '#1e293b' }) => (
  <th style={{
    padding: '0.4rem 0.55rem', fontWeight: 700, fontSize: '0.68rem',
    color, background: bg, borderBottom: '2px solid #cbd5e1',
    borderLeft: borderLeft ? `2px solid ${borderLeft}` : undefined,
    textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap',
  }}>{children}</th>
);

// ─── Main Table ───────────────────────────────────────────────────────────────

function DaftarUpahTable({ rows, onRowClick }) {
  if (!rows.length) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: 8 }}>
      Tidak ada data untuk periode ini.
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
          {/* Group headers */}
          <tr>
            <th rowSpan={2} style={{ padding: '0.4rem 0.5rem', background: '#0f172a', color: '#e2e8f0', fontWeight: 700, fontSize: '0.68rem', borderBottom: '2px solid #334155', textAlign: 'center', minWidth: 36, position: 'sticky', left: 0, zIndex: 4 }}>No</th>
            <th rowSpan={2} style={{ padding: '0.4rem 0.5rem', background: '#0f172a', color: '#e2e8f0', fontWeight: 700, fontSize: '0.68rem', borderBottom: '2px solid #334155', minWidth: 72, position: 'sticky', left: 36, zIndex: 4 }}>EmpCode</th>
            <th rowSpan={2} style={{ padding: '0.4rem 0.5rem', background: '#0f172a', color: '#e2e8f0', fontWeight: 700, fontSize: '0.68rem', borderBottom: '2px solid #334155', minWidth: 140, position: 'sticky', left: 108, zIndex: 4 }}>Nama</th>
            <th rowSpan={2} style={{ padding: '0.4rem 0.5rem', background: '#0f172a', color: '#e2e8f0', fontWeight: 700, fontSize: '0.68rem', borderBottom: '2px solid #334155', minWidth: 60, position: 'sticky', left: 248, zIndex: 4 }}>Gang</th>
            <th rowSpan={2} style={{ padding: '0.4rem 0.5rem', background: '#0f172a', color: '#e2e8f0', fontWeight: 700, fontSize: '0.68rem', borderBottom: '2px solid #334155', minWidth: 48, position: 'sticky', left: 308, zIndex: 4, borderRight: '2px solid #334155' }}>Div</th>
            <GH label="KEHADIRAN (HK)" cols={3} color="#1e40af" bg="#dbeafe" borderColor="#93c5fd" />
            <GH label="LEMBUR (JAM)" cols={3} color="#7c3aed" bg="#ede9fe" borderColor="#c4b5fd" />
            <GH label="BRONDOL (BUNCHES)" cols={3} color="#166534" bg="#dcfce7" borderColor="#86efac" />
            <GH label="CUTI/IZIN (HARI)" cols={3} color="#b45309" bg="#fffbeb" borderColor="#fcd34d" />
            <th rowSpan={2} style={{ padding: '0.4rem 0.5rem', background: '#0f172a', color: '#e2e8f0', fontWeight: 700, fontSize: '0.68rem', borderBottom: '2px solid #334155', textAlign: 'center', minWidth: 72 }}>Status</th>
          </tr>
          {/* Sub-headers */}
          <tr>
            {/* Kehadiran */}
            <TH right bg="#eff6ff" color="#1e40af" borderLeft="#93c5fd">Staging</TH>
            <TH right bg="#eff6ff" color="#1e40af">Prod</TH>
            <TH right bg="#eff6ff" color="#1e40af">Δ</TH>
            {/* Lembur */}
            <TH right bg="#f5f3ff" color="#7c3aed" borderLeft="#c4b5fd">Staging</TH>
            <TH right bg="#f5f3ff" color="#7c3aed">Prod</TH>
            <TH right bg="#f5f3ff" color="#7c3aed">Δ</TH>
            {/* Brondol */}
            <TH right bg="#f0fdf4" color="#166534" borderLeft="#86efac">Staging</TH>
            <TH right bg="#f0fdf4" color="#166534">Prod</TH>
            <TH right bg="#f0fdf4" color="#166534">Δ</TH>
            {/* Cuti/Izin */}
            <TH right bg="#fffbeb" color="#b45309" borderLeft="#fcd34d">Staging</TH>
            <TH right bg="#fffbeb" color="#b45309">Prod</TH>
            <TH right bg="#fffbeb" color="#b45309">Δ</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const rowBg = r.has_diff
              ? (i % 2 === 0 ? '#fff7ed' : '#fff3e0')
              : (i % 2 === 0 ? '#fff' : '#f8fafc');
            const accent = r.has_diff ? 'inset 3px 0 0 #f97316' : 'none';
            return (
              <tr key={r.emp_code} style={{ background: rowBg, boxShadow: accent, cursor: 'pointer' }} onClick={() => onRowClick(r)}>
                <td style={{ padding: '0.38rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.7rem', borderBottom: '1px solid #e2e8f0', position: 'sticky', left: 0, zIndex: 1, background: rowBg }}>{i + 1}</td>
                <td style={{ padding: '0.38rem 0.5rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.75rem', position: 'sticky', left: 36, zIndex: 1, background: rowBg }}>{r.emp_code}</td>
                <td style={{ padding: '0.38rem 0.5rem', color: '#334155', borderBottom: '1px solid #e2e8f0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'sticky', left: 108, zIndex: 1, background: rowBg }} title={r.emp_name}>{r.emp_name || '—'}</td>
                <td style={{ padding: '0.38rem 0.5rem', color: '#475569', fontSize: '0.72rem', borderBottom: '1px solid #e2e8f0', position: 'sticky', left: 248, zIndex: 1, background: rowBg }}>{r.gang_code || '—'}</td>
                <td style={{ padding: '0.38rem 0.5rem', color: '#475569', fontSize: '0.72rem', borderBottom: '1px solid #e2e8f0', position: 'sticky', left: 308, zIndex: 1, background: rowBg, borderRight: '2px solid #e2e8f0' }}>{r.division || '—'}</td>

                {/* Kehadiran */}
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #bfdbfe', color: '#1e40af', fontWeight: 600 }}>{fmt(r.s_hk)}</td>
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', color: '#166534', fontWeight: 600 }}>{fmt(r.p_hk)}</td>
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', ...diffStyle(r.diff_hk) }}>{r.diff_hk > 0 ? `+${r.diff_hk}` : r.diff_hk}</td>

                {/* Lembur */}
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #c4b5fd', color: '#7c3aed', fontWeight: 600 }}>{r.s_ot_jam ? fmt(r.s_ot_jam, 1) : '—'}</td>
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', color: '#166534', fontWeight: 600 }}>{r.p_ot_jam ? fmt(r.p_ot_jam, 1) : '—'}</td>
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', ...diffStyle(r.diff_ot) }}>{r.diff_ot !== 0 ? (r.diff_ot > 0 ? `+${fmt(r.diff_ot, 1)}` : fmt(r.diff_ot, 1)) : '—'}</td>

                {/* Brondol */}
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #86efac', color: '#166534', fontWeight: 600 }}>{r.s_bunches ? fmt(r.s_bunches) : '—'}</td>
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', color: '#166534', fontWeight: 600 }}>{r.p_mt ? fmt(r.p_mt, 1) : '—'}</td>
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', ...diffStyle(r.diff_lf) }}>{r.diff_lf !== 0 ? (r.diff_lf > 0 ? `+${fmt(r.diff_lf, 1)}` : fmt(r.diff_lf, 1)) : '—'}</td>

                {/* Cuti/Izin */}
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #fcd34d', color: '#b45309', fontWeight: 600 }}>{r.s_leave_days ? fmt(r.s_leave_days) : '—'}</td>
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', color: '#166534', fontWeight: 600 }}>{r.p_leave_days ? fmt(r.p_leave_days) : '—'}</td>
                <td style={{ padding: '0.38rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0', ...diffStyle(r.diff_leave) }}>{r.diff_leave !== 0 ? (r.diff_leave > 0 ? `+${r.diff_leave}` : r.diff_leave) : '—'}</td>

                {/* Status */}
                <td style={{ padding: '0.38rem 0.5rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                  {r.has_diff
                    ? <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 4, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.68rem', fontWeight: 700 }}>△ Selisih</span>
                    : <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 4, background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7', fontSize: '0.68rem', fontWeight: 700 }}>✓ Match</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* Grand total footer */}
        {rows.length > 0 && (() => {
          const tot = rows.reduce((a, r) => ({
            s_hk: a.s_hk + r.s_hk, p_hk: a.p_hk + r.p_hk,
            s_ot: a.s_ot + r.s_ot_jam, p_ot: a.p_ot + r.p_ot_jam,
            s_lf: a.s_lf + r.s_bunches, p_lf: a.p_lf + r.p_mt,
            s_lv: a.s_lv + (r.s_leave_days || 0), p_lv: a.p_lv + (r.p_leave_days || 0),
          }), { s_hk: 0, p_hk: 0, s_ot: 0, p_ot: 0, s_lf: 0, p_lf: 0, s_lv: 0, p_lv: 0 });
          const ftd = { padding: '0.45rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: '0.78rem', background: '#1e293b', color: '#f1f5f9', borderTop: '2px solid #334155' };
          const ftdL = { ...ftd, borderLeft: '2px solid #475569' };
          return (
            <tfoot>
              <tr>
                <td colSpan={5} style={{ ...ftd, textAlign: 'left', color: '#94a3b8', letterSpacing: '0.05em' }}>TOTAL ({rows.length} karyawan)</td>
                <td style={ftdL}>{fmt(tot.s_hk)}</td>
                <td style={ftd}>{fmt(tot.p_hk)}</td>
                <td style={{ ...ftd, color: tot.s_hk !== tot.p_hk ? '#fca5a5' : '#86efac' }}>{tot.s_hk - tot.p_hk > 0 ? `+${tot.s_hk - tot.p_hk}` : tot.s_hk - tot.p_hk}</td>
                <td style={ftdL}>{fmt(tot.s_ot, 1)}</td>
                <td style={ftd}>{fmt(tot.p_ot, 1)}</td>
                <td style={{ ...ftd, color: Math.abs(tot.s_ot - tot.p_ot) > 0.01 ? '#fca5a5' : '#86efac' }}>{+(tot.s_ot - tot.p_ot).toFixed(1) > 0 ? `+${+(tot.s_ot - tot.p_ot).toFixed(1)}` : +(tot.s_ot - tot.p_ot).toFixed(1)}</td>
                <td style={ftdL}>{fmt(tot.s_lf)}</td>
                <td style={ftd}>{fmt(tot.p_lf, 1)}</td>
                <td style={{ ...ftd, color: Math.abs(tot.s_lf - tot.p_lf) > 0.01 ? '#fca5a5' : '#86efac' }}>{+(tot.s_lf - tot.p_lf).toFixed(1) > 0 ? `+${+(tot.s_lf - tot.p_lf).toFixed(1)}` : +(tot.s_lf - tot.p_lf).toFixed(1)}</td>
                <td style={ftdL}>{fmt(tot.s_lv)}</td>
                <td style={ftd}>{fmt(tot.p_lv)}</td>
                <td style={{ ...ftd, color: tot.s_lv !== tot.p_lv ? '#fca5a5' : '#86efac' }}>{tot.s_lv - tot.p_lv > 0 ? `+${tot.s_lv - tot.p_lv}` : tot.s_lv - tot.p_lv}</td>
                <td style={ftd} />
              </tr>
            </tfoot>
          );
        })()}
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StagingDaftarUpahPage() {
  const { token } = useAuth();
  const { month, year } = useReport();

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [data, setData]       = useState(null);
  const [search, setSearch]   = useState('');
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [selectedEmp, setSelectedEmp]   = useState(null);

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
    setLoading(true); setError(null); setData(null);
    try {
      const result = await fetchSummaryAll(token, {
        month: month || 5, year: year || 2026,
        gang: selGang || undefined, division: selDiv || undefined,
      });
      setData(result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [month, year, token, selGang, selDiv]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    let rows = data.rows;
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
  }, [data, showDiffOnly, search]);

  const diffCount = data?.rows?.filter(r => r.has_diff).length ?? 0;
  const btn = (active) => ({
    padding: '0.38rem 0.85rem', fontSize: '0.78rem', fontWeight: active ? 700 : 500,
    border: `1px solid ${active ? '#3b82f6' : '#cbd5e1'}`,
    borderRadius: 6, background: active ? '#3b82f6' : '#fff',
    color: active ? '#fff' : '#475569', cursor: 'pointer',
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Header — mirip Daftar Upah */}
      <div style={{ marginBottom: '0.85rem', borderBottom: '3px solid #1e293b', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
            DAFTAR UPAH — DATA STAGING
          </h1>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
            {MONTHS[month || 5]} {year || 2026}
            {selDiv && ` · ${selDiv}`}
            {selGang && ` · ${selGang}`}
          </span>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
          Sumber: staging_PTRJ_iFES_Plantware vs db_ptrj · {data?.rows?.length ?? 0} karyawan
          {diffCount > 0 && <span style={{ color: '#b91c1c', marginLeft: 8, fontWeight: 700 }}>⚠ {diffCount} karyawan ada selisih</span>}
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem', alignItems: 'center', padding: '0.6rem 0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
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

        <input type="text" placeholder="Cari nama / emp / gang…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: 6, width: 180 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}>
          <input type="checkbox" checked={showDiffOnly} onChange={e => setShowDiffOnly(e.target.checked)} />
          Hanya yang selisih
        </label>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={fetchData} disabled={loading} style={{ ...btn(false), display: 'flex', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => exportCSV(filteredRows, month, year)} disabled={!filteredRows.length}
            style={{ ...btn(false), display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem' }}>
        {[['Staging', '#1e40af', '#dbeafe'], ['Prod (DB Plantware)', '#166534', '#dcfce7']].map(([l, fg, bg]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: fg, fontWeight: 600 }}>
            <span style={{ width: 11, height: 11, background: bg, border: `1px solid ${fg}44`, borderRadius: 2, display: 'inline-block' }} />{l}
          </span>
        ))}
        <span style={{ color: '#94a3b8' }}>· Δ merah = ada selisih · Baris oranye = karyawan dengan selisih</span>
      </div>

      {/* KPI bar */}
      {data?.summary && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          {[
            ['Total', data.summary.total, '#334155', '#f8fafc', '#e2e8f0'],
            ['Match', data.summary.match, '#047857', '#ecfdf5', '#6ee7b7'],
            ['Selisih', data.summary.diff, '#b91c1c', '#fef2f2', '#fca5a5'],
            ['% Match', `${data.summary.pct_match}%`, Number(data.summary.pct_match) >= 98 ? '#047857' : '#b45309', Number(data.summary.pct_match) >= 98 ? '#ecfdf5' : '#fffbeb', Number(data.summary.pct_match) >= 98 ? '#6ee7b7' : '#fcd34d'],
          ].map(([l, v, fg, bg, border]) => (
            <div key={l} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 7, padding: '0.5rem 0.85rem', textAlign: 'center', minWidth: 90 }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: fg, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: '0.68rem', color: fg, fontWeight: 600, marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <LoadingScreen isLoading message="Memuat data staging…" />}
      {error && <div style={{ padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', fontSize: '0.82rem', marginBottom: '1rem' }}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <DaftarUpahTable rows={filteredRows} onRowClick={setSelectedEmp} />
        </div>
      )}

      {selectedEmp && (
        <StagingEmployeeDetailModal
          empCode={selectedEmp.emp_code}
          month={month || 5}
          year={year || 2026}
          token={token}
          onClose={() => setSelectedEmp(null)}
        />
      )}
    </div>
  );
}
