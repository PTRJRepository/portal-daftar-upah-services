import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../styles/gang-report-print.css';

// Helper Functions
const formatCurrency = (val) => {
    if (val === null || val === undefined) return '-';
    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}jt`;
    if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)}rb`;
    return `Rp ${val.toFixed(0)}`;
};

const formatNumber = (val) => {
    if (val === null || val === undefined) return '0';
    return new Intl.NumberFormat('id-ID').format(val);
};

const getGangType = (gangCode) => {
    if (!gangCode) return 'uncategorized';
    const lastChar = gangCode.slice(-1).toUpperCase();
    if (lastChar === 'H') return 'harvesting';
    if (lastChar === 'T') return 'transport';
    if (lastChar === 'M') return 'maintenance';
    return 'uncategorized';
};

const isIJLGang = (gangCode) => {
    if (!gangCode) return false;
    return gangCode.toUpperCase().startsWith('L');
};

const getGangTypeLabel = (type) => {
    const labels = {
        harvesting: 'Panen (Harvesting)',
        transport: 'Transport',
        maintenance: 'Maintenance',
        uncategorized: 'Lainnya'
    };
    return labels[type] || type;
};

const getGangTypeColor = (type) => {
    const colors = {
        harvesting: '#16a34a',
        transport: '#2563eb',
        maintenance: '#d97706',
        uncategorized: '#64748b'
    };
    return colors[type] || '#64748b';
};

// Helper to get month name
const getMonthName = (monthNum) => {
    const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return months[monthNum] || '';
};

export default function GangComparisonReportPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // State
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Params
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const divisionFilter = searchParams.get('division') || 'ALL';
    const gangTypeFilter = searchParams.get('type') || 'ALL';

    useEffect(() => {
        const fetchData = async () => {
            if (!month || !year) return;
            setLoading(true);
            try {
                // Fetch data from existing endpoint which returns comparison data
                // Use relative URL for proxy mode compatibility (no VITE_API_BASE_URL needed)
                const basePath = '/backend/upah/payroll/dashboard/gang-comparison';
                const searchParams = new URLSearchParams();
                searchParams.append('month', month);
                searchParams.append('year', year);
                if (divisionFilter !== 'ALL') {
                    searchParams.append('division_code', divisionFilter);
                }
                const url = `${basePath}?${searchParams.toString()}`;

                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                const json = await res.json();
                if (json.success) {
                    setData(json.data);
                } else {
                    setError('Failed to load report data');
                }
            } catch (err) {
                console.error("Report fetch error:", err);
                setError('Network error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Auto print after a short delay when loaded? 
        // Best to let user click print.
    }, [month, year, divisionFilter]);

    // Filter Logic
    const filteredReportData = useMemo(() => {
        // First enrich
        const enriched = data.map(gang => ({
            ...gang,
            gang_type: getGangType(gang.gang_code),
            is_ijl: isIJLGang(gang.gang_code)
        }));

        let result = enriched;

        // Division Filter (Client Side refinement if API didn't handle IJL prefix logic)
        // Note: API 'division_code' param handles actual division code column. 
        // Frontend 'IJL'/'NON_IJL' filter logic relies on 'is_ijl' check.
        if (divisionFilter === 'IJL') result = result.filter(g => g.is_ijl);
        if (divisionFilter === 'NON_IJL') result = result.filter(g => !g.is_ijl);

        // Gang Type Filter
        if (gangTypeFilter !== 'ALL') {
            result = result.filter(g => g.gang_type === gangTypeFilter);
        }
        return result;
    }, [data, divisionFilter, gangTypeFilter]);

    // Group Data
    const groupedReportData = useMemo(() => {
        const groups = {
            harvesting: [],
            transport: [],
            maintenance: [],
            uncategorized: []
        };
        filteredReportData.forEach(gang => {
            if (groups[gang.gang_type]) {
                groups[gang.gang_type].push(gang);
            } else {
                groups.uncategorized.push(gang);
            }
        });
        return groups;
    }, [filteredReportData]);

    if (loading) return <div className="p-8 text-center">Loading Report...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="gang-report-page-container" style={{ padding: '2rem', background: 'white', minHeight: '100vh' }}>
            {/* Header Controls (No Print) */}
            <div className="no-print" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                >
                    ← Back to Dashboard
                </button>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                        Displaying {filteredReportData.length} gangs
                    </div>
                    <button
                        onClick={() => window.print()}
                        style={{ padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        🖨️ Print Report
                    </button>
                </div>
            </div>

            {/* Report Content */}
            <div className="gang-report-content">
                {/* Letterhead */}
                <div className="gang-report-letterhead">
                    <img src="/assets/images/rebinmas.webp" alt="Logo" className="gang-report-logo" />
                    <h1 className="gang-report-company-name">PT. REBINMAS JAYA</h1>
                    <h2 className="gang-report-title">LAPORAN PERBANDINGAN COST/HK PER GANG</h2>
                    <p className="gang-report-period">
                        Periode: {month && year ? `${getMonthName(parseInt(month))} ${year}` : '-'}
                    </p>
                    <p className="gang-report-filter-info">
                        Filter Divisi: {divisionFilter === 'ALL' ? 'Semua Divisi' : divisionFilter === 'IJL' ? 'IJL Only' : divisionFilter === 'NON_IJL' ? 'Non-IJL' : divisionFilter}
                        {gangTypeFilter !== 'ALL' && ` | Tipe: ${gangTypeFilter === 'harvesting' ? 'Panen (H)' : gangTypeFilter === 'transport' ? 'Transport (T)' : 'Maintenance (M)'}`}
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="gang-report-summary">
                    <div className="gang-report-summary-card">
                        <div className="gang-report-summary-label">Total Cost</div>
                        <div className="gang-report-summary-value">
                            {formatCurrency(filteredReportData.reduce((sum, g) => sum + (g.total_wage || 0), 0))}
                        </div>
                    </div>
                    <div className="gang-report-summary-card">
                        <div className="gang-report-summary-label">Total HK</div>
                        <div className="gang-report-summary-value">
                            {formatNumber(filteredReportData.reduce((sum, g) => sum + (g.total_hk || 0), 0))}
                        </div>
                    </div>
                    <div className="gang-report-summary-card highlight">
                        <div className="gang-report-summary-label">Rata-rata Cost/HK</div>
                        <div className="gang-report-summary-value">
                            {filteredReportData.length > 0
                                ? formatCurrency(filteredReportData.reduce((sum, g) => sum + (g.total_wage || 0), 0) / filteredReportData.reduce((sum, g) => sum + (g.total_hk || 0), 0))
                                : '-'}
                        </div>
                    </div>
                </div>

                {/* Summary by Gang Type */}
                <div className="gang-report-type-summary">
                    <h3 className="gang-report-section-title">Ringkasan per Tipe Gang</h3>
                    <div className="gang-report-type-cards">
                        {Object.entries(groupedReportData).map(([type, gangs]) => gangs.length > 0 && (
                            <div key={type} className="gang-report-type-card" style={{ borderColor: getGangTypeColor(type) }}>
                                <div className="gang-report-type-header" style={{ backgroundColor: getGangTypeColor(type) }}>
                                    <span className="gang-report-type-name">{getGangTypeLabel(type)}</span>
                                    <span className="gang-report-type-count">{gangs.length} gangs</span>
                                </div>
                                <div className="gang-report-type-body">
                                    <div className="gang-report-type-row">
                                        <span>Total Cost:</span>
                                        <span>{formatCurrency(gangs.reduce((sum, g) => sum + (g.total_wage || 0), 0))}</span>
                                    </div>
                                    <div className="gang-report-type-row">
                                        <span>Total HK:</span>
                                        <span>{formatNumber(gangs.reduce((sum, g) => sum + (g.total_hk || 0), 0))}</span>
                                    </div>
                                    <div className="gang-report-type-row highlight">
                                        <span>Cost/HK:</span>
                                        <span>{formatCurrency(gangs.reduce((sum, g) => sum + (g.total_wage || 0), 0) / gangs.reduce((sum, g) => sum + (g.total_hk || 0), 0))}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detail Table */}
                <div className="gang-report-table-wrapper">
                    <h3 className="gang-report-section-title">Detail per Gang</h3>
                    <table className="gang-report-table">
                        <thead>
                            <tr>
                                <th>Kode Gang</th>
                                <th>Divisi</th>
                                <th>Tipe Gang</th>
                                <th className="text-right">Total HK</th>
                                <th className="text-right">Total Cost</th>
                                <th className="text-right">Cost/HK</th>
                                <th className="text-right">Headcount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(groupedReportData).map(([type, gangs]) =>
                                gangs.length > 0 && (
                                    <React.Fragment key={type}>
                                        <tr className="gang-report-group-header" style={{ backgroundColor: getGangTypeColor(type) + '20' }}>
                                            <td colSpan="6" className="gang-report-group-title">
                                                <span className="gang-report-type-badge" style={{ backgroundColor: getGangTypeColor(type) }}>
                                                    {getGangTypeLabel(type)}
                                                </span>
                                                <span className="gang-report-group-count">({gangs.length} gangs)</span>
                                            </td>
                                        </tr>
                                        {gangs.map((gang, idx) => (
                                            <tr key={gang.gang_code} className={idx % 2 === 0 ? 'gang-report-row-even' : 'gang-report-row-odd'}>
                                                <td className="gang-report-sticky-col">{gang.gang_code}</td>
                                                <td>
                                                    {gang.is_ijl ? (
                                                        <span className="gang-report-badge-ijl">IJL</span>
                                                    ) : (
                                                        <span className="gang-report-badge-non-ijl">Non-IJL</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="gang-report-type-badge" style={{ backgroundColor: getGangTypeColor(gang.gang_type) }}>
                                                        {getGangTypeLabel(gang.gang_type)}
                                                    </span>
                                                </td>
                                                <td className="text-right">{formatNumber(gang.total_hk)}</td>
                                                <td className="text-right">{formatCurrency(gang.total_wage)}</td>
                                                <td className="text-right" style={{ color: getGangTypeColor(gang.gang_type) }}>{formatCurrency(gang.cost_per_hk)}</td>
                                                <td className="text-right">{formatNumber(gang.headcount)}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                )
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="gang-report-grand-total">
                                <td className="gang-report-sticky-col" colSpan="3">GRAND TOTAL</td>
                                <td className="text-right">{formatNumber(filteredReportData.reduce((sum, g) => sum + (g.total_hk || 0), 0))}</td>
                                <td className="text-right">{formatCurrency(filteredReportData.reduce((sum, g) => sum + (g.total_wage || 0), 0))}</td>
                                <td className="text-right">{filteredReportData.length > 0 ? formatCurrency(filteredReportData.reduce((sum, g) => sum + (g.total_wage || 0), 0) / filteredReportData.reduce((sum, g) => sum + (g.total_hk || 0), 0)) : '-'}</td>
                                <td className="text-right">{formatNumber(filteredReportData.reduce((sum, g) => sum + (g.headcount || 0), 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Footer */}
                <div className="gang-report-footer">
                    <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
            </div>
        </div>
    );
}
