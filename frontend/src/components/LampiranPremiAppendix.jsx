/**
 * LampiranPremiAppendix - Comprehensive Premium Appendix for Summary Report
 * Features: Tabulation, Charts, Visual Hierarchy
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ReportWatermark from '../components/common/ReportWatermark';
import '../styles/LampiranPremiAppendix.css';

// Color palette - Professional dark theme for PT REBINMAS
const COLORS = {
    primary: '#1e293b',      // Dark slate
    secondary: '#334155',    // Slate
    accent: '#3b82f6',       // Blue
    success: '#10b981',      // Green
    warning: '#f59e0b',      // Amber
    danger: '#ef4444',       // Red
    muted: '#64748b',        // Muted gray
    light: '#f1f5f9',       // Light gray
    white: '#ffffff',
    border: '#e2e8f0'
};

// Premium type colors for charts
const PREMIUM_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

// Format number to Indonesian locale
const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.round(num));
};

// Extract assistance/group from gang code
const getAsistensi = (gc) => {
    if (!gc) return null;
    const g = gc.trim().toUpperCase();
    if (g.startsWith('K2')) return '1';
    const match = g.match(/\d/);
    return match ? match[0] : null;
};

export default function LampiranPremiAppendix({
    filteredSummaryData,
    filteredGrandTotal,
    companyInfo,
    periodLabel,
    reportDivisionSummary,
    printDate,
    user,
    dynamicPremiHeaders
}) {
    const getDynamicPremiValue = (row, headerName) => {
        if (!row._dynamic_premi_list || !Array.isArray(row._dynamic_premi_list)) return 0;
        const item = row._dynamic_premi_list.find(
            p => p.header && p.header.toLowerCase() === headerName.toLowerCase()
        );
        return item ? parseFloat(item.total || 0) : 0;
    };

    const buildPremiBreakdownText = (row) => {
        if (!dynamicPremiHeaders || !dynamicPremiHeaders.length) return '-';
        const parts = dynamicPremiHeaders
            .map(header => ({ header, value: getDynamicPremiValue(row, header) }))
            .filter(item => Number(item.value || 0) !== 0)
            .map(item => `${item.header}: ${formatNumber(item.value)}`);
        return parts.length ? parts.join('; ') : '-';
    };

    // Build lampiran data structure: Division > Group > Gang
    const lampiranData = useMemo(() => {
        const divisionsMap = new Map();

        filteredSummaryData.forEach(row => {
            const divKey = row.division_code || 'LAINNYA';
            if (!divisionsMap.has(divKey)) {
                divisionsMap.set(divKey, {
                    division_code: divKey,
                    gangs: [],
                    subtotal_premi: 0,
                    subtotal_dynamic: {}
                });
            }
            const divData = divisionsMap.get(divKey);
            divData.gangs.push(row);
            divData.subtotal_premi += Number(row.total_premi || 0);

            if (row._dynamic_premi_list) {
                row._dynamic_premi_list.forEach(dp => {
                    const h = dp.header;
                    divData.subtotal_dynamic[h] = (divData.subtotal_dynamic[h] || 0) + Number(dp.total || 0);
                });
            }
        });

        const result = Array.from(divisionsMap.values()).map(div => {
            const groupsMap = new Map();
            div.gangs.forEach(gang => {
                const groupKey = getAsistensi(gang.gang_code) || 'LAINNYA';
                if (!groupsMap.has(groupKey)) {
                    groupsMap.set(groupKey, { group: groupKey, gangs: [] });
                }
                groupsMap.get(groupKey).gangs.push(gang);
            });

            const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
                const aNum = Number(a.group);
                const bNum = Number(b.group);
                if (!isNaN(aNum) && !isNaN(bNum) && aNum !== bNum) return aNum - bNum;
                if (isNaN(aNum)) return 1;
                if (isNaN(bNum)) return -1;
                return String(a.group).localeCompare(String(b.group));
            });

            return { ...div, groups: sortedGroups };
        });

        return result.sort((a, b) => String(a.division_code).localeCompare(String(b.division_code)));
    }, [filteredSummaryData]);

    // Chart data: Division distribution
    const divisionChartData = useMemo(() => {
        return lampiranData.map(div => ({
            name: div.division_code,
            value: div.subtotal_premi,
            percentage: filteredGrandTotal?.total_premi > 0
                ? ((div.subtotal_premi / filteredGrandTotal.total_premi) * 100).toFixed(1)
                : 0
        }));
    }, [lampiranData, filteredGrandTotal]);

    // Chart data: Premium type distribution
    const premiumTypeChartData = useMemo(() => {
        if (!filteredGrandTotal?.dynamic_premi_totals) return [];
        return Object.entries(filteredGrandTotal.dynamic_premi_totals)
            .filter(([_, v]) => Number(v) > 0)
            .map(([k, v]) => ({
                name: k.length > 20 ? k.substring(0, 20) + '...' : k,
                fullName: k,
                value: Number(v)
            }))
            .sort((a, b) => b.value - a.value);
    }, [filteredGrandTotal]);

    // Chart data: Top gangs by premium
    const topGangsData = useMemo(() => {
        return [...filteredSummaryData]
            .sort((a, b) => Number(b.total_premi || 0) - Number(a.total_premi || 0))
            .slice(0, 10)
            .map(g => ({
                name: g.gang_code,
                fullName: g.gang_description || g.gang_code,
                value: Number(g.total_premi || 0)
            }));
    }, [filteredSummaryData]);

    const filteredGrandTotalLabel = 'GRAND TOTAL';

    return (
        <div className="lampiran-premi-appendix" id="summary-premi-appendix-content">
            <ReportWatermark />

            {/* Header */}
            <div className="lampiran-header">
                <div className="lampiran-header-left">
                    <img
                        src={companyInfo.logo}
                        alt={companyInfo.name}
                        className="lampiran-logo"
                        onError={(e) => { e.target.src = companyInfo.logoFallback; }}
                    />
                    <div className="lampiran-header-info">
                        <h1 className="lampiran-company">{companyInfo.name}</h1>
                        <div className="lampiran-title">LAMPIRAN REPORT II - URAIAN TOTAL PREMI</div>
                        <div className="lampiran-period">
                            {reportDivisionSummary} | {periodLabel}
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="lampiran-summary-cards">
                <div className="lampiran-summary-card lampiran-card-total">
                    <div className="lampiran-card-label">TOTAL PREMI</div>
                    <div className="lampiran-card-value">Rp {formatNumber(filteredGrandTotal?.total_premi || 0)}</div>
                </div>
                <div className="lampiran-summary-card">
                    <div className="lampiran-card-label">TOTAL DIVISI</div>
                    <div className="lampiran-card-value">{lampiranData.length}</div>
                </div>
                <div className="lampiran-summary-card">
                    <div className="lampiran-card-label">TOTAL GANG</div>
                    <div className="lampiran-card-value">{filteredSummaryData.length}</div>
                </div>
                <div className="lampiran-summary-card">
                    <div className="lampiran-card-label">JENIS PREMI</div>
                    <div className="lampiran-card-value">{premiumTypeChartData.length}</div>
                </div>
            </div>

            {/* Charts Section - Print Hidden */}
            <div className="lampiran-charts-section">
                {/* Division Pie Chart */}
                <div className="lampiran-chart-card">
                    <div className="lampiran-chart-title">DISTRIBUSI PREMI PER DIVISI</div>
                    <div className="lampiran-chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={divisionChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                                >
                                    {divisionChartData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={PREMIUM_COLORS[index % PREMIUM_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => [`Rp ${formatNumber(value)}`, 'Total Premi']}
                                    contentStyle={{ backgroundColor: COLORS.primary, border: 'none', borderRadius: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Premium Type Bar Chart */}
                <div className="lampiran-chart-card">
                    <div className="lampiran-chart-title">DISTRIBUSI PER JENIS PREMI</div>
                    <div className="lampiran-chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={premiumTypeChartData} layout="vertical">
                                <XAxis type="number" tickFormatter={(v) => `Rp ${(v/1000000).toFixed(0)}jt`} />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    formatter={(value, name, props) => [`Rp ${formatNumber(value)}`, props.payload.fullName]}
                                    contentStyle={{ backgroundColor: COLORS.primary, border: 'none', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {premiumTypeChartData.map((_, index) => (
                                        <Cell key={`bar-${index}`} fill={PREMIUM_COLORS[index % PREMIUM_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Top Gangs Chart */}
            <div className="lampiran-chart-card lampiran-chart-full">
                <div className="lampiran-chart-title">TOP 10 GANG DENGAN PREMI TERTINGGI</div>
                <div className="lampiran-chart-container lampiran-bar-horizontal">
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={topGangsData}>
                            <XAxis type="number" tickFormatter={(v) => `Rp ${(v/1000000).toFixed(1)}jt`} />
                            <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 10 }} />
                            <Tooltip
                                formatter={(value) => [`Rp ${formatNumber(value)}`, 'Total Premi']}
                                contentStyle={{ backgroundColor: COLORS.primary, border: 'none', borderRadius: '8px' }}
                            />
                            <Bar dataKey="value" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Main Tabulation Table */}
            <div className="lampiran-table-section">
                <div className="lampiran-table-title">REKAPITULASI DETAIL URAIAN PREMI</div>
                <div className="lampiran-table-wrapper">
                    <table className="lampiran-table">
                        <thead>
                            <tr className="lampiran-thead-row">
                                <th className="lampiran-th-no">NO</th>
                                <th className="lampiran-th-gang">ESTATE / GANG</th>
                                <th className="lampiran-th-premi">TOTAL PREMI</th>
                                <th className="lampiran-th-detail">URAIAN PREMI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSummaryData.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="lampiran-no-data">No Data Available</td>
                                </tr>
                            ) : (
                                lampiranData.map((div, divIdx) => {
                                    let rowNo = 0;

                                    return (
                                        <React.Fragment key={`div-${div.division_code}`}>
                                            {/* Division Header */}
                                            <tr className="lampiran-division-header">
                                                <td colSpan="4" className="lampiran-division-cell">
                                                    <span className="lampiran-division-name">ESTATE / DIVISI: {div.division_code}</span>
                                                    <span className="lampiran-division-meta">
                                                        {div.gangs.length} gang
                                                        <span className="lampiran-division-total">Rp {formatNumber(div.subtotal_premi)}</span>
                                                    </span>
                                                </td>
                                            </tr>

                                            {/* Groups and Gang Rows */}
                                            {div.groups.map((grp, grpIdx) => {
                                                let groupPremi = 0;
                                                grp.gangs.forEach(g => groupPremi += Number(g.total_premi || 0));

                                                return (
                                                    <React.Fragment key={`div-${div.division_code}-grp-${grp.group}`}>
                                                        {/* Group Header */}
                                                        <tr className="lampiran-group-header">
                                                            <td colSpan="4" className="lampiran-group-cell">
                                                                GROUP {grp.group}
                                                            </td>
                                                        </tr>

                                                        {/* Gang Rows */}
                                                        {grp.gangs.map((gang, gangIdx) => {
                                                            rowNo++;
                                                            const hasDesc = gang.gang_description && gang.gang_description !== gang.gang_code;
                                                            const gangName = hasDesc ? gang.gang_description : gang.gang_code;

                                                            return (
                                                                <tr key={`gang-${gang.gang_code || gangIdx}`} className="lampiran-gang-row">
                                                                    <td className="lampiran-cell-no">{rowNo}</td>
                                                                    <td className="lampiran-cell-gang">
                                                                        <span className="lampiran-gang-name">{gangName}</span>
                                                                        {hasDesc && (
                                                                            <span className="lampiran-gang-code">{gang.gang_code}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="lampiran-cell-premi">{formatNumber(gang.total_premi)}</td>
                                                                    <td className="lampiran-cell-detail">{buildPremiBreakdownText(gang)}</td>
                                                                </tr>
                                                            );
                                                        })}

                                                        {/* Group Subtotal */}
                                                        <tr className="lampiran-group-subtotal">
                                                            <td colSpan="2" className="lampiran-subtotal-label">
                                                                SUBTOTAL GROUP {grp.group}
                                                            </td>
                                                            <td className="lampiran-subtotal-value">{formatNumber(groupPremi)}</td>
                                                            <td className="lampiran-subtotal-detail">-</td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            })}

                                            {/* Division Subtotal */}
                                            <tr className="lampiran-division-subtotal">
                                                <td colSpan="2" className="lampiran-subtotal-label">
                                                    SUBTOTAL {div.division_code}
                                                </td>
                                                <td className="lampiran-subtotal-value">{formatNumber(div.subtotal_premi)}</td>
                                                <td className="lampiran-subtotal-detail">
                                                    {Object.entries(div.subtotal_dynamic)
                                                        .filter(([_, v]) => Number(v) > 0)
                                                        .map(([k, v]) => `${k}: ${formatNumber(v)}`)
                                                        .join('; ') || '-'}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                        {filteredGrandTotal && (
                            <tfoot>
                                <tr className="lampiran-grand-total">
                                    <td colSpan="2">{filteredGrandTotalLabel}</td>
                                    <td>{formatNumber(filteredGrandTotal.total_premi)}</td>
                                    <td>
                                        {Object.entries(filteredGrandTotal.dynamic_premi_totals || {})
                                            .filter(([_, v]) => Number(v) > 0)
                                            .map(([k, v]) => `${k}: ${formatNumber(v)}`)
                                            .join('; ') || '-'}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Footer */}
            <footer className="lampiran-footer">
                <div className="lampiran-footer-left">
                    <span>Dicetak: {printDate}</span>
                    <span className="lampiran-footer-user">User: {user?.username}</span>
                </div>
                <div className="lampiran-footer-right">
                    {companyInfo.name}
                </div>
            </footer>
        </div>
    );
}
