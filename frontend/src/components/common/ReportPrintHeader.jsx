import React from 'react';

const REBINMAS_LOGO_SRC = `${import.meta.env.BASE_URL || '/'}images/rebinmas.webp`;

/**
 * ReportPrintHeader - Print header for summary report
 * Placeholder implementation
 */
export default function ReportPrintHeader({ title, period, division }) {
  return (
    <div className="report-print-header" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '1rem',
      borderBottom: '2px solid #1e293b',
      marginBottom: '1rem'
    }}>
      <img
        src={REBINMAS_LOGO_SRC}
        alt="Logo"
        style={{ width: '50px', height: '50px' }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      <div>
        <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 'bold' }}>{title || 'Summary Report'}</h1>
        <p style={{ fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
          {period || 'Periode'} - {division || 'Division'}
        </p>
      </div>
    </div>
  );
}
