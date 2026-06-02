import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { buildBackendUrl } from '../utils/apiBase';
import LoadingScreen from '../components/common/LoadingScreen';

const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const fetchDetail = (token, empCode, month, year) =>
  axios.get(buildBackendUrl('/api/staging/compare/employee-detail'), {
    params: { emp_code: empCode, month, year },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(r => {
    if (r.data?.success === false) throw new Error(r.data.error);
    return r.data?.data;
  });

const th = (x = {}) => ({ padding: '0.4rem 0.6rem', fontWeight: 700, fontSize: '0.7rem', background: '#f1f5f9', color: '#1e293b', borderBottom: '2px solid #cbd5e1', whiteSpace: 'nowrap', textAlign: 'left', ...x });
const td = (x = {}) => ({ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderBottom: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'top', ...x });

const COLS = {
  staging: {
    attendance: ['JobCode', 'Field', 'OC', 'TransNo'],
    overtime:   ['JobCode', 'Jam', 'Rate', 'Add Rate', 'TransNo'],
    loosefruit: ['OC', 'Bunches', 'TaskNo', 'TransNo'],
  },
  prod: {
    attendance: ['TaskCode', 'Jam', 'ChargeTo', 'Rate', 'ID'],
    overtime:   ['TaskCode', 'Jam', 'Rate', 'ChargeTo', 'ID'],
    loosefruit: ['MT', 'ChargeTo', 'MasterID', 'ID'],
  },
};

const getCells = (r, side, module) => ({
  staging: {
    attendance: [r.job_code, r.field, r.oc, r.trans_no],
    overtime:   [r.job_code, r.hours, r.rate, r.add_rate, r.trans_no],
    loosefruit: [r.oc, r.bunches, r.task_no, r.trans_no],
  },
  prod: {
    attendance: [r.task_code, r.hours, r.charge_to, r.rate, r.id],
    overtime:   [r.task_code, r.hours, r.rate, r.charge_to, r.id],
    loosefruit: [r.mt, r.charge_to, r.master_id, r.id],
  },
}[side][module]);

function DayTable({ rows, module }) {
  if (!rows.length) return <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.8rem' }}>Tidak ada data.</div>;

  const sCols = COLS.staging[module];
  const pCols = COLS.prod[module];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
        <thead>
          <tr>
            <th style={th({ background: '#0f172a', color: '#e2e8f0', minWidth: 90 })}>Tanggal</th>
            <th style={th({ background: '#1e40af', color: '#fff', textAlign: 'center', borderLeft: '2px solid #93c5fd' })} colSpan={sCols.length}>STAGING</th>
            <th style={th({ background: '#166534', color: '#fff', textAlign: 'center', borderLeft: '2px solid #86efac' })} colSpan={pCols.length}>DB PLANTWARE</th>
            <th style={th({ background: '#0f172a', color: '#e2e8f0', textAlign: 'center' })}>Status</th>
          </tr>
          <tr>
            <th style={th({ background: '#0f172a', color: '#94a3b8' })} />
            {sCols.map((c, i) => <th key={c} style={th({ background: '#eff6ff', color: '#1e40af', borderLeft: i === 0 ? '2px solid #93c5fd' : undefined })}>{c}</th>)}
            {pCols.map((c, i) => <th key={c} style={th({ background: '#f0fdf4', color: '#166534', borderLeft: i === 0 ? '2px solid #86efac' : undefined })}>{c}</th>)}
            <th style={th({ background: '#0f172a', color: '#94a3b8' })} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const maxLen = Math.max(row.staging.length, row.prod.length, 1);
            const rowBg = row.has_diff ? '#fff7ed' : ri % 2 === 0 ? '#fff' : '#f8fafc';
            return Array.from({ length: maxLen }).map((_, si) => {
              const s = row.staging[si];
              const p = row.prod[si];
              const isFirst = si === 0;
              return (
                <tr key={`${row.date}-${si}`} style={{ background: rowBg, boxShadow: isFirst && row.has_diff ? 'inset 3px 0 0 #f97316' : 'none' }}>
                  {isFirst && (
                    <td style={td({ fontWeight: 700, color: '#1e293b', verticalAlign: 'middle', background: row.has_diff ? '#fef3c7' : rowBg })} rowSpan={maxLen}>
                      {row.date.slice(5)}
                      {row.has_diff && <div style={{ fontSize: '0.62rem', color: '#b45309', fontWeight: 700, marginTop: 2 }}>△ selisih</div>}
                      {row.staging?.some((r) => r.cancelled) && <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: 1 }}>⊘ ada cancel</div>}
                    </td>
                  )}
                  {s ? getCells(s, 'staging', module).map((v, ci) => (
                    <td key={ci} style={td({
                      borderLeft: ci === 0 ? '2px solid #bfdbfe' : undefined,
                      color: s.cancelled ? '#94a3b8' : '#1e40af',
                      fontFamily: ci === 0 ? 'monospace' : undefined,
                      fontSize: '0.72rem',
                      textDecoration: s.cancelled ? 'line-through' : undefined,
                      background: s.cancelled ? '#f8fafc' : (module === 'loosefruit' && s.matched === false) ? '#fef2f2' : undefined,
                    })}>{v ?? '—'}</td>
                  )) : sCols.map((_, ci) => (
                    <td key={ci} style={td({ borderLeft: ci === 0 ? '2px solid #bfdbfe' : undefined, color: '#94a3b8' })}>—</td>
                  ))}
                  {p ? getCells(p, 'prod', module).map((v, ci) => (
                    <td key={ci} style={td({ borderLeft: ci === 0 ? '2px solid #bbf7d0' : undefined, color: '#166534', fontFamily: ci === 0 ? 'monospace' : undefined, fontSize: '0.72rem' })}>{v ?? '—'}</td>
                  )) : pCols.map((_, ci) => (
                    <td key={ci} style={td({ borderLeft: ci === 0 ? '2px solid #bbf7d0' : undefined, color: '#94a3b8', background: '#fef2f2' })}>—</td>
                  ))}
                  {isFirst && (
                    <td style={td({ textAlign: 'center', verticalAlign: 'middle' })} rowSpan={maxLen}>
                      {row.has_diff
                        ? <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.65rem', fontWeight: 700 }}>△ Beda</span>
                        : <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7', fontSize: '0.65rem', fontWeight: 700 }}>✓ Match</span>
                      }
                    </td>
                  )}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StagingEmployeeDetailModal({ empCode, month, year, token, onClose }) {
  const [tab, setTab] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!empCode) return;
    setLoading(true); setError(null);
    fetchDetail(token, empCode, month, year)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [empCode, month, year, token]);

  const TABS = [
    { key: 'attendance', label: 'Kehadiran' },
    { key: 'overtime',   label: 'Lembur' },
    { key: 'loosefruit', label: 'Brondol' },
  ].map(t => ({
    ...t,
    count: data?.[t.key]?.length ?? 0,
    diffCount: data?.[t.key]?.filter(r => r.has_diff).length ?? 0,
  }));

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: 'min(1100px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', background: '#fff', borderRadius: 10, border: '1px solid #cbd5e1', boxShadow: '0 24px 80px rgba(15,23,42,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', fontFamily: 'monospace' }}>{empCode}</span>
              {data && <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8' }}>{data.emp_name}</span>}
            </div>
            <div style={{ marginTop: 4, fontSize: '0.78rem', color: '#64748b' }}>
              {data?.gang_code && <span style={{ marginRight: 12 }}>Gang: <strong style={{ color: '#93c5fd' }}>{data.gang_code}</strong></span>}
              {data?.division && <span>Divisi: <strong style={{ color: '#93c5fd' }}>{data.division}</strong></span>}
              <span style={{ marginLeft: 12 }}>{MONTHS[month]} {year}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>✕ Tutup</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '0.65rem 1.25rem', fontSize: '0.82rem', fontWeight: tab === t.key ? 700 : 500,
              border: 'none', borderBottom: tab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
              background: 'transparent', color: tab === t.key ? '#1e40af' : '#475569', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: 10, background: t.diffCount > 0 ? '#fef2f2' : '#ecfdf5', color: t.diffCount > 0 ? '#b91c1c' : '#047857', fontWeight: 700 }}>
                {t.diffCount > 0 ? `${t.diffCount} selisih` : `${t.count} hari`}
              </span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem 1rem' }}>
          {loading && <LoadingScreen isLoading message="Memuat detail karyawan…" />}
          {error && <div style={{ padding: '0.85rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', fontSize: '0.82rem' }}>Error: {error}</div>}
          {!loading && !error && data && <DayTable rows={data[tab] ?? []} module={tab} />}
        </div>
      </div>
    </div>
  );
}
