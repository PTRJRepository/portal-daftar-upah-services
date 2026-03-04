import React from 'react';

const PrintSignature = () => {
    return (
        <div className="print-signature-section" style={{
            marginTop: '40px',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            pageBreakInside: 'avoid'
        }}>
            <div className="signature-block" style={{ width: '30%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: '0' }}>Dibuat Oleh:</p>
                <div className="signature-space" style={{ height: '80px' }}></div>
                <div style={{ borderTop: '1px solid black', display: 'inline-block', minWidth: '180px' }}>
                    <p style={{ fontWeight: 'bold', margin: '5px 0 0 0' }}>Admin Payroll</p>
                    <p style={{ fontSize: '0.8rem', fontStyle: 'italic', margin: '0' }}>Staff Payroll</p>
                </div>
            </div>

            <div className="signature-block" style={{ width: '30%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: '0' }}>Diperiksa Oleh:</p>
                <div className="signature-space" style={{ height: '80px' }}></div>
                <div style={{ borderTop: '1px solid black', display: 'inline-block', minWidth: '180px' }}>
                    <p style={{ fontWeight: 'bold', margin: '5px 0 0 0' }}>HR Manager</p>
                    <p style={{ fontSize: '0.8rem', fontStyle: 'italic', margin: '0' }}>Manager</p>
                </div>
            </div>

            <div className="signature-block" style={{ width: '30%', textAlign: 'center' }}>
                <p style={{ fontWeight: 'bold', margin: '0' }}>Disetujui Oleh:</p>
                <div className="signature-space" style={{ height: '80px' }}></div>
                <div style={{ borderTop: '1px solid black', display: 'inline-block', minWidth: '180px' }}>
                    <p style={{ fontWeight: 'bold', margin: '5px 0 0 0' }}>General Manager</p>
                    <p style={{ fontSize: '0.8rem', fontStyle: 'italic', margin: '0' }}>GM / Direksi</p>
                </div>
            </div>
        </div>
    );
};

export default PrintSignature;
