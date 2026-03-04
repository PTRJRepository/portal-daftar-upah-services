import React from 'react';

const PrintSignature = () => {
    return (
        <div className="print-signature-section" style={{
            marginTop: '15px',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            pageBreakInside: 'avoid'
        }}>
            <div className="signature-block" style={{ width: '30%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: '0', fontSize: '0.7rem' }}>Dibuat Oleh:</p>
                <div className="signature-space" style={{ height: '40px' }}></div>
                <div style={{ borderTop: '1px solid black', display: 'inline-block', minWidth: '150px' }}>
                    <p style={{ fontWeight: 'bold', margin: '3px 0 0 0', fontSize: '0.7rem' }}>Admin Payroll</p>
                    <p style={{ fontSize: '0.65rem', fontStyle: 'italic', margin: '0' }}>Staff Payroll</p>
                </div>
            </div>

            <div className="signature-block" style={{ width: '30%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: '0', fontSize: '0.7rem' }}>Diperiksa Oleh:</p>
                <div className="signature-space" style={{ height: '40px' }}></div>
                <div style={{ borderTop: '1px solid black', display: 'inline-block', minWidth: '150px' }}>
                    <p style={{ fontWeight: 'bold', margin: '3px 0 0 0', fontSize: '0.7rem' }}>HR Manager</p>
                    <p style={{ fontSize: '0.65rem', fontStyle: 'italic', margin: '0' }}>Manager</p>
                </div>
            </div>

            <div className="signature-block" style={{ width: '30%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: '0', fontSize: '0.7rem' }}>Disetujui Oleh:</p>
                <div className="signature-space" style={{ height: '40px' }}></div>
                <div style={{ borderTop: '1px solid black', display: 'inline-block', minWidth: '150px' }}>
                    <p style={{ fontWeight: 'bold', margin: '3px 0 0 0', fontSize: '0.7rem' }}>General Manager</p>
                    <p style={{ fontSize: '0.65rem', fontStyle: 'italic', margin: '0' }}>GM / Direksi</p>
                </div>
            </div>
        </div>
    );
};

export default PrintSignature;
