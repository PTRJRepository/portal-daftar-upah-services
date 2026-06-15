import React from 'react';

/**
 * ReportMiniStats - Mini statistics for summary report
 * Placeholder implementation
 */
export default function ReportMiniStats({ stats = {} }) {
  return (
    <div className="report-mini-stats" style={{
      display: 'flex',
      gap: '0.5rem',
      fontSize: '0.8rem',
      color: '#64748b'
    }}>
      <span>Karyawan: {stats.employeeCount || 0}</span>
      <span>|</span>
      <span>Divisi: {stats.divisionCount || 0}</span>
    </div>
  );
}
