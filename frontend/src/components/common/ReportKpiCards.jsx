import React from 'react';

/**
 * ReportKpiCards - KPI cards for summary report
 * Placeholder implementation
 */
export default function ReportKpiCards({ data = {} }) {
  return (
    <div className="report-kpi-cards" style={{
      display: 'flex',
      gap: '1rem',
      padding: '1rem',
      background: '#f8fafc',
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <div className="kpi-card" style={{
        flex: 1,
        padding: '1rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Gaji</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
          {data.totalGaji ? `Rp ${data.totalGaji.toLocaleString('id-ID')}` : '-'}
        </div>
      </div>
      <div className="kpi-card" style={{
        flex: 1,
        padding: '1rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Premi</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>
          {data.totalPremi ? `Rp ${data.totalPremi.toLocaleString('id-ID')}` : '-'}
        </div>
      </div>
    </div>
  );
}

export function PrintKpiRow({ data = {} }) {
  return (
    <tr className="print-kpi-row">
      <td colSpan={2}>Total Gaji</td>
      <td>{data.totalGaji || 0}</td>
    </tr>
  );
}
