import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import LoadingScreen from '../components/common/LoadingScreen';
import PremiCompositionChart from '../components/dashboard/PremiCompositionChart';

// Helper to format currency
const formatCurrency = (val) => {
    if (val === null || val === undefined) return '-';
    // Miliar
    if (Math.abs(val) >= 1000000000) {
        return `Rp ${(val / 1000000000).toFixed(2)} M`;
    }
    // Juta
    if (Math.abs(val) >= 1000000) {
        return `Rp ${(val / 1000000).toFixed(1)} jt`;
    }
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
};

const formatNumber = (val) => new Intl.NumberFormat('id-ID').format(val);

export default function ExecutivePayrollPage({ onBack, initialMonth, initialYear }) {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [availablePeriods, setAvailablePeriods] = useState([]);

    // Filters (Default to current month, can be changed to view historical snapshots)
    const [month, setMonth] = useState(initialMonth || new Date().getMonth() + 1);
    const [year, setYear] = useState(initialYear || new Date().getFullYear());

    // Comparison State
    const [filterOptions, setFilterOptions] = useState({ divisions: [], gangs: [] });
    const [compMode, setCompMode] = useState('division');
    const [selectedItems, setSelectedItems] = useState([]);
    const [compData, setCompData] = useState(null);
    const [compLoading, setCompLoading] = useState(false);

    // Division Detail Modal State
    const [selectedDivision, setSelectedDivision] = useState(null);
    const [divisionDetails, setDivisionDetails] = useState(null);
    const [divisionDetailsLoading, setDivisionDetailsLoading] = useState(false);

    // Main Filter State (Header)
    const [selectedFilterDivision, setSelectedFilterDivision] = useState('ALL');
    const [selectedFilterGang, setSelectedFilterGang] = useState('ALL');
    const [availableGangs, setAvailableGangs] = useState([]);

    // Load available periods
    useEffect(() => {
        async function loadPeriods() {
            try {
                const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002';
                const res = await fetch(`${apiUrl}/payroll/dashboard/available-periods`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.success) {
                    setAvailablePeriods(json.data);
                }
            } catch (e) {
                console.error("Failed to load available periods:", e);
            }
        }
        if (token) loadPeriods();
    }, [token]);

    // Auto-select latest period on mount
    useEffect(() => {
        async function checkLatestPeriod() {
            try {
                const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002';
                const res = await fetch(`${apiUrl}/payroll/dashboard/latest-period`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.success) {
                    const { month: latestMonth, year: latestYear } = json.data;
                    // If current selection is different (or future/empty), switch to latest
                    // Only switch if we are strictly using defaults (not user provided props)
                    if (!initialMonth && !initialYear) {
                        if (latestYear !== year || latestMonth !== month) {
                            console.log(`Switching to latest data period: ${latestMonth}/${latestYear}`);
                            setMonth(latestMonth);
                            setYear(latestYear);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to check latest period:", e);
            }
        }
        if (token) checkLatestPeriod();
    }, [token]);

    useEffect(() => {
        async function loadDashboard() {
            setLoading(true);
            try {
                const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002';
                const res = await fetch(`${apiUrl}/payroll/dashboard/executive-summary?month=${month}&year=${year}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.success) {
                    setData(json.data);
                } else {
                    setError(json.error);
                }
            } catch (e) {
                console.error("Failed to load dashboard:", e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }
        if (token) loadDashboard();
    }, [token, month, year]);

    // Load Filter Options
    useEffect(() => {
        async function loadFilters() {
            try {
                const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002';
                const res = await fetch(`${apiUrl}/payroll/dashboard/filter-options?month=${month}&year=${year}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.success) {
                    setFilterOptions(json.data);
                    // Initialize available gangs with all gangs
                    setAvailableGangs(json.data.gangs || []);
                }
            } catch (e) {
                console.error("Failed to load filters:", e);
            }
        }
        if (token) loadFilters();
    }, [token, month, year]);

    // Filter gangs when division changes
    useEffect(() => {
        if (selectedFilterDivision === 'ALL') {
            setAvailableGangs(filterOptions.gangs || []);
        } else {
            // Filter gangs that belong to the selected division
            // Gang codes usually start with division code, e.g., "AB1A" for division "AB1"
            const filteredGangs = (filterOptions.gangs || []).filter(gang =>
                gang.startsWith(selectedFilterDivision)
            );
            setAvailableGangs(filteredGangs.length > 0 ? filteredGangs : filterOptions.gangs || []);
        }
        // Reset gang selection when division changes
        setSelectedFilterGang('ALL');
    }, [selectedFilterDivision, filterOptions.gangs]);

    const handleCompare = async () => {
        if (selectedItems.length === 0) return;
        setCompLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002';
            const res = await fetch(`${apiUrl}/payroll/dashboard/comparison`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: compMode,
                    codes: selectedItems,
                    month,
                    year
                })
            });
            const json = await res.json();
            if (json.success) {
                setCompData(json.data);
            }
        } catch (e) {
            console.error("Comparison failed:", e);
        } finally {
            setCompLoading(false);
        }
    };

    // Fetch Division Details (gangs, premi, and overtime breakdown)
    const fetchDivisionDetails = async (divisionCode) => {
        setSelectedDivision(divisionCode);
        setDivisionDetailsLoading(true);
        setDivisionDetails(null);

        try {
            const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002';

            // Fetch gang breakdown for this division
            const gangRes = await fetch(
                `${apiUrl}/payroll/dashboard/aggregated-gang-data?month=${month}&year=${year}&division_code=${divisionCode}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const gangData = await gangRes.json();

            // Fetch premi breakdown for this division
            const premiRes = await fetch(
                `${apiUrl}/payroll/dashboard/premi-analysis?month=${month}&year=${year}&division_code=${divisionCode}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const premiData = await premiRes.json();

            // Fetch overtime analysis for this division
            const otRes = await fetch(
                `${apiUrl}/payroll/dashboard/overtime-analysis?month=${month}&year=${year}&division_code=${divisionCode}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const otData = await otRes.json();

            setDivisionDetails({
                gangs: gangData.success ? gangData.data : [],
                premi: premiData.success ? premiData.data : [],
                overtime: otData.success ? otData.data : []
            });
        } catch (e) {
            console.error("Failed to fetch division details:", e);
            setDivisionDetails({ gangs: [], premi: [], overtime: [] });
        } finally {
            setDivisionDetailsLoading(false);
        }
    };

    // Handle bar click
    const handleDivisionBarClick = (data) => {
        if (data && data.name) {
            fetchDivisionDetails(data.name);
        }
    };

    // Derived Data for Charts
    const divisionChartData = useMemo(() => {
        if (!data?.breakdown) return [];
        // All Divisions sorted by Wage - show stacked breakdown
        return [...data.breakdown]
            .sort((a, b) => b.total_wage - a.total_wage)
            .map(d => {
                const total = d.total_wage || 1; // Avoid division by zero
                const overtime = d.total_ot || 0;
                const premi = d.total_premi || 0;
                const base = Math.max(0, total - overtime - premi); // Base = Total - OT - Premi

                return {
                    name: d.division_code,
                    Total: total,
                    Base: base,
                    Overtime: overtime,
                    Premi: premi,
                    // Percentages for tooltip
                    basePercent: ((base / total) * 100).toFixed(1),
                    otPercent: ((overtime / total) * 100).toFixed(1),
                    premiPercent: ((premi / total) * 100).toFixed(1)
                };
            });
    }, [data]);

    const gangChartData = useMemo(() => {
        if (!data?.gangBreakdown) return [];
        return data.gangBreakdown.map(g => ({
            name: g.gang_code,
            Wage: g.total_wage,
            Overtime: g.total_ot
        }));
    }, [data]);

    // Overtime Distribution Chart Data
    const overtimeChartData = useMemo(() => {
        if (!data?.breakdown) return [];
        const totalOT = data.breakdown.reduce((sum, d) => sum + (d.total_ot || 0), 0);
        return [...data.breakdown]
            .filter(d => d.total_ot > 0)
            .sort((a, b) => b.total_ot - a.total_ot)
            .map(d => ({
                name: d.division_code,
                Overtime: d.total_ot || 0,
                percent: totalOT > 0 ? ((d.total_ot / totalOT) * 100).toFixed(1) : 0
            }));
    }, [data]);

    const efficiencyData = useMemo(() => {
        if (!data?.efficiency) return [];
        return data.efficiency.map(d => ({
            name: d.division_code,
            costPerHead: d.headcount > 0 ? d.total_cost / d.headcount : 0,
            headcount: d.headcount,
            totalCost: d.total_cost
        })).sort((a, b) => b.costPerHead - a.costPerHead).slice(0, 15); // Top 15 by cost per head
    }, [data]);

    const productivityData = useMemo(() => {
        if (!data?.productivityTrend) return [];
        return data.productivityTrend;
    }, [data]);

    const wageSpikes = useMemo(() => {
        if (!data?.wageSpikes) return [];
        return data.wageSpikes;
    }, [data]);

    const costComposition = useMemo(() => {
        if (!data?.kpi) return [];
        const { curr_wage, curr_ot } = data.kpi;
        // Total Wage usually includes everything, so we might need to derive Basic if Total Wage is the sum.
        // Assuming total_wage is the grand total (Upah Bersih).
        // Let's approximate breakdown:
        // Basic = Total Wage - OT - Premi (Adjust as per actual data definition)
        // For visual purpose, if we don't have exact 'Basic', we can just show available components.
        // But better: use the 'breakdown' sum.

        // Let's use the KPI values directly for simplicity
        const wage = data.kpi.curr_wage;
        const ot = data.kpi.curr_ot;
        // Caution: Upah Bersih already contains OT and Premi in many systems. 
        // If total_wage = Basic + OT + Premi, then Basic = total_wage - OT - Premi?
        // Let's assume total_wage is "Take Home Pay".

        return [
            { name: 'Overtime', value: ot, color: '#f59e0b' },
            { name: 'Regular Pay & Premi', value: wage - ot, color: '#3b82f6' }
        ];
    }, [data]);

    if (loading) return <LoadingScreen isLoading={true} message="Loading Executive Dashboard..." />;
    if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;
    if (!data) return null;

    const { kpi, trends } = data;
    const percent = (value, total) => total > 0 ? ((value / total) * 100).toFixed(1) : 0;
    // KPI Percentages
    const calcChange = (curr, prev) => {
        if (!prev) return 0;
        return ((curr - prev) / prev) * 100;
    };

    const wageChange = calcChange(kpi.curr_wage, kpi.prev_wage);
    const otChange = calcChange(kpi.curr_ot, kpi.prev_ot);
    const headChange = calcChange(kpi.curr_headcount, kpi.prev_headcount);

    return (
        <div style={{ padding: '2rem', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Daftar Upah Analysis Keseluruhan</h1>
                    <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Overview of financial and operational metrics</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Division Filter */}
                    <select
                        value={selectedFilterDivision}
                        onChange={(e) => setSelectedFilterDivision(e.target.value)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontWeight: '600',
                            color: '#334155',
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            minWidth: '120px'
                        }}
                    >
                        <option value="ALL">Semua Divisi</option>
                        {filterOptions.divisions?.map((div, idx) => (
                            <option key={idx} value={div}>{div}</option>
                        ))}
                    </select>

                    {/* Gang Filter */}
                    <select
                        value={selectedFilterGang}
                        onChange={(e) => setSelectedFilterGang(e.target.value)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontWeight: '600',
                            color: '#334155',
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            minWidth: '120px'
                        }}
                    >
                        <option value="ALL">Semua Gang</option>
                        {availableGangs.map((gang, idx) => (
                            <option key={idx} value={gang}>{gang}</option>
                        ))}
                    </select>

                    {/* Period Select */}
                    <select
                        value={`${year}-${month}`}
                        onChange={(e) => {
                            const [y, m] = e.target.value.split('-').map(Number);
                            setYear(y);
                            setMonth(m);
                        }}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontWeight: '600',
                            color: '#334155',
                            cursor: 'pointer',
                            outline: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        {availablePeriods.length > 0 ? (
                            availablePeriods.map((p, idx) => (
                                <option key={idx} value={`${p.year}-${p.month}`}>
                                    {new Date(p.year, p.month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                </option>
                            ))
                        ) : (
                            <option value={`${year}-${month}`}>
                                {new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                            </option>
                        )}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <KPICard
                    title="Total Payroll Cost"
                    value={formatCurrency(kpi.curr_wage)}
                    subValue={`${wageChange >= 0 ? '+' : ''}${wageChange.toFixed(1)}% vs last month`}
                    trend={wageChange >= 0 ? 'up' : 'down'}
                    color={wageChange > 5 ? 'red' : 'blue'} // Warning if wage spikes > 5%
                />
                <KPICard
                    title="Total Overtime"
                    value={formatCurrency(kpi.curr_ot)}
                    subValue={`${otChange >= 0 ? '+' : ''}${otChange.toFixed(1)}% vs last month`}
                    trend={otChange >= 0 ? 'up' : 'down'}
                    color={otChange > 0 ? 'orange' : 'green'}
                />
                <KPICard
                    title="Headcount"
                    value={formatNumber(kpi.curr_headcount)}
                    subValue={`${headChange >= 0 ? '+' : ''}${headChange.toFixed(1)}% vs last month`}
                    trend={headChange >= 0 ? 'up' : 'down'}
                    color="gray"
                />
            </div>

            {/* Main Trend Chart */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', marginBottom: '1.5rem' }}>12-Month Expenditure Trend</h3>
                <div style={{ height: '350px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorWage" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorOt" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="period" />
                            <YAxis tickFormatter={(val) => `${val / 1000000}M`} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <Tooltip formatter={(val) => formatCurrency(val)} />
                            <Legend />
                            <Area type="monotone" dataKey="total_wage" name="Total Wages" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWage)" />
                            <Area type="monotone" dataKey="total_ot" name="Overtime" stroke="#f59e0b" fillOpacity={1} fill="url(#colorOt)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Interactive Comparison Widget */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', margin: 0 }}>Interactive Comparison</h3>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {/* Mode Toggle */}
                        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
                            <button
                                onClick={() => { setCompMode('division'); setSelectedItems([]); setCompData(null); }}
                                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: compMode === 'division' ? 'white' : 'transparent', boxShadow: compMode === 'division' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', fontWeight: '600', color: compMode === 'division' ? '#0f172a' : '#64748b', cursor: 'pointer' }}
                            >
                                Division
                            </button>
                            <button
                                onClick={() => { setCompMode('gang'); setSelectedItems([]); setCompData(null); }}
                                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: compMode === 'gang' ? 'white' : 'transparent', boxShadow: compMode === 'gang' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', fontWeight: '600', color: compMode === 'gang' ? '#0f172a' : '#64748b', cursor: 'pointer' }}
                            >
                                Gang
                            </button>
                        </div>

                        {/* Multi-Select */}
                        <select
                            multiple
                            value={selectedItems}
                            onChange={(e) => {
                                const options = [...e.target.selectedOptions];
                                const values = options.map(o => o.value);
                                setSelectedItems(values);
                            }}
                            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '8px', minWidth: '200px', height: '40px' }}
                        >
                            {(compMode === 'division' ? filterOptions.divisions : filterOptions.gangs).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>

                        <button
                            onClick={handleCompare}
                            disabled={compLoading || selectedItems.length === 0}
                            style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', opacity: (compLoading || selectedItems.length === 0) ? 0.7 : 1 }}
                        >
                            {compLoading ? 'Loading...' : 'Compare'}
                        </button>
                    </div>
                </div>

                {/* Comparison Charts */}
                {compData && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        <div style={{ height: '300px' }}>
                            <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem', textAlign: 'center' }}>Total Wage</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={compData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={10} interval={0} angle={-45} textAnchor="end" height={60} />
                                    <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                                    <Tooltip formatter={(val) => formatCurrency(val)} />
                                    <Bar dataKey="total_wage" fill="#3b82f6" name="Wage" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ height: '300px' }}>
                            <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem', textAlign: 'center' }}>Overtime</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={compData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={10} interval={0} angle={-45} textAnchor="end" height={60} />
                                    <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                                    <Tooltip formatter={(val) => formatCurrency(val)} />
                                    <Bar dataKey="total_ot" fill="#f59e0b" name="Overtime" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ height: '300px' }}>
                            <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem', textAlign: 'center' }}>Productivity (Cost/HK)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={compData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={10} interval={0} angle={-45} textAnchor="end" height={60} />
                                    <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(val) => formatCurrency(val)} />
                                    <Bar dataKey="cost_per_hk" fill="#10b981" name="Cost/HK" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
                {!compData && !compLoading && (
                    <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '3rem' }}>
                        Select items and click Compare to see specific metrics
                    </div>
                )}
            </div>

            {/* Secondary Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                {/* Division Breakdown - Full Stacked Bar */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', marginBottom: '0.5rem' }}>
                        Division Cost Breakdown ({divisionChartData.length} divisions)
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.75rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></span>
                            Gaji Pokok + Tunjangan
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', backgroundColor: '#f97316', borderRadius: '2px' }}></span>
                            Lembur
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }}></span>
                            Premi
                        </span>
                    </div>
                    <div style={{ height: Math.max(300, divisionChartData.length * 30) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={divisionChartData} layout="vertical" margin={{ left: 40, right: 10 }}>
                                <XAxis type="number" tickFormatter={(val) => `${(val / 1000000).toFixed(0)}jt`} fontSize={10} />
                                <YAxis dataKey="name" type="category" width={35} fontSize={11} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0]?.payload;
                                        return (
                                            <div style={{
                                                background: 'white',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                fontSize: '0.8rem'
                                            }}>
                                                <div style={{ fontWeight: '700', marginBottom: '6px' }}>{label}</div>
                                                <div style={{ color: '#64748b', marginBottom: '4px' }}>
                                                    Total: {formatCurrency(d.Total)}
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ color: '#3b82f6' }}>■</span>
                                                    Base: {formatCurrency(d.Base)} ({d.basePercent}%)
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ color: '#f97316' }}>■</span>
                                                    Lembur: {formatCurrency(d.Overtime)} ({d.otPercent}%)
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ color: '#10b981' }}>■</span>
                                                    Premi: {formatCurrency(d.Premi)} ({d.premiPercent}%)
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Bar
                                    dataKey="Base"
                                    stackId="a"
                                    fill="#3b82f6"
                                    barSize={22}
                                    cursor="pointer"
                                    onClick={handleDivisionBarClick}
                                />
                                <Bar
                                    dataKey="Overtime"
                                    stackId="a"
                                    fill="#f97316"
                                    barSize={22}
                                    cursor="pointer"
                                    onClick={handleDivisionBarClick}
                                />
                                <Bar
                                    dataKey="Premi"
                                    stackId="a"
                                    fill="#10b981"
                                    radius={[0, 4, 4, 0]}
                                    barSize={22}
                                    cursor="pointer"
                                    onClick={handleDivisionBarClick}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Overtime Distribution */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', marginBottom: '1.5rem' }}>Cost Composition</h3>
                    <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={costComposition}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {costComposition.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val) => formatCurrency(val)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Premi Analysis - Full Width Row */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginTop: '2rem' }}>
                <PremiCompositionChart month={month} year={year} division="ALL" />
            </div>

            {/* Overtime Distribution - Full Width Row */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', margin: 0 }}>
                        ⏰ Distribusi Lembur per Divisi ({overtimeChartData.length} divisions)
                    </h3>
                    <div style={{
                        backgroundColor: '#fff7ed',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: '#ea580c'
                    }}>
                        Total: {formatCurrency(overtimeChartData.reduce((sum, d) => sum + d.Overtime, 0))}
                    </div>
                </div>
                {overtimeChartData.length > 0 ? (
                    <div style={{ height: Math.max(300, overtimeChartData.length * 32) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={overtimeChartData} layout="vertical" margin={{ left: 40, right: 80 }}>
                                <XAxis type="number" tickFormatter={(val) => `${(val / 1000000).toFixed(0)} jt`} fontSize={10} />
                                <YAxis dataKey="name" type="category" width={35} fontSize={11} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0]?.payload;
                                        return (
                                            <div style={{
                                                background: 'white',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                fontSize: '0.85rem'
                                            }}>
                                                <div style={{ fontWeight: '700', marginBottom: '4px' }}>Divisi: {label}</div>
                                                <div style={{ color: '#ea580c' }}>
                                                    Lembur: {formatCurrency(d?.Overtime || 0)} ({d?.percent || 0}%)
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Bar
                                    dataKey="Overtime"
                                    fill="#f97316"
                                    radius={[0, 4, 4, 0]}
                                    barSize={24}
                                    label={({ x, y, width, height, value, payload }) => {
                                        if (!payload) return null;
                                        return (
                                            <text
                                                x={x + width + 5}
                                                y={y + height / 2}
                                                fill="#64748b"
                                                fontSize={10}
                                                dominantBaseline="middle"
                                            >
                                                {formatCurrency(value)} ({payload.percent || 0}%)
                                            </text>
                                        );
                                    }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                        No overtime data available for this period
                    </div>
                )}
            </div>

            {/* Advanced Analysis Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
                {/* Gang Comparison */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', marginBottom: '1.5rem' }}>Top 15 Gangs by Cost</h3>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={gangChartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} interval={0} fontSize={10} />
                                <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} />
                                <Tooltip formatter={(val) => formatCurrency(val)} />
                                <Legend />
                                <Bar dataKey="Wage" stackId="a" fill="#3b82f6" name="Total Wages" />
                                <Bar dataKey="Overtime" stackId="a" fill="#f59e0b" name="Overtime" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Division Efficiency */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', marginBottom: '1.5rem' }}>Cost Efficiency (Avg Cost per Employee)</h3>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={efficiencyData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} interval={0} fontSize={10} />
                                <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(1)}jt`} />
                                <Tooltip formatter={(val, name) => [formatCurrency(val), name === 'costPerHead' ? 'Avg Cost/Head' : name]} />
                                <Bar dataKey="costPerHead" fill="#10b981" name="Avg Cost per Employee" onClick={(data) => console.log(data)} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Phase 2: Productivity & Alerts */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem', marginBottom: '3rem' }}>
                {/* Productivity Trend */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', marginBottom: '1.5rem' }}>Workforce Productivity Trend (Avg Cost / Man-Day)</h3>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={productivityData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="period" angle={-45} textAnchor="end" height={60} interval={0} fontSize={10} />
                                <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
                                <Tooltip formatter={(val, name) => [formatCurrency(val), name === 'costPerHk' ? 'Cost/HK' : name]} />
                                <Legend />
                                <Line type="monotone" dataKey="costPerHk" stroke="#8b5cf6" strokeWidth={3} name="Cost/HK" activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="totalHk" stroke="#cbd5e1" strokeWidth={2} name="Total HK" yAxisId="right" hide={true} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Wage Spikes / Alerts */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ef4444', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ backgroundColor: '#fee2e2', padding: '4px 8px', borderRadius: '6px' }}>⚠️ Gang Cost Spikes (Cost/HK)</span>
                    </h3>
                    <div style={{ overflowY: 'auto', maxHeight: '350px' }}>
                        {wageSpikes.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No anomalies detected this month.</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem', color: '#64748b' }}>Gang</th>
                                        <th style={{ padding: '0.75rem', color: '#64748b', textAlign: 'right' }}>Increase</th>
                                        <th style={{ padding: '0.75rem', color: '#64748b', textAlign: 'right' }}>Cost/HK</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wageSpikes.map((spike, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ fontWeight: '600', color: '#334155' }}>{spike.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{spike.id} • {spike.gang}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#ef4444', fontWeight: '700' }}>
                                                +{spike.percentage.toFixed(1)}%
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>
                                                {formatCurrency(spike.currentWage)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Division Details Modal */}
            {selectedDivision && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '2rem'
                    }}
                    onClick={() => setSelectedDivision(null)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            maxWidth: '900px',
                            width: '100%',
                            maxHeight: '85vh',
                            overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.5rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                                📊 Detail Divisi: {selectedDivision}
                            </h2>
                            <button
                                onClick={() => setSelectedDivision(null)}
                                style={{
                                    background: '#f1f5f9',
                                    border: 'none',
                                    borderRadius: '8px',
                                    width: '32px',
                                    height: '32px',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div style={{ padding: '1.5rem', maxHeight: 'calc(85vh - 80px)', overflowY: 'auto' }}>
                            {divisionDetailsLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                    Loading division details...
                                </div>
                            ) : divisionDetails ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                                    {/* Gang Breakdown */}
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#334155', marginBottom: '1rem' }}>
                                            👥 Breakdown Gang ({divisionDetails.gangs?.length || 0} gangs)
                                        </h3>
                                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0 }}>
                                                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Gang</th>
                                                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>Total Wage</th>
                                                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>Employees</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {divisionDetails.gangs
                                                        ?.sort((a, b) => (b.total_upah_bersih || b.total_wage || 0) - (a.total_upah_bersih || a.total_wage || 0))
                                                        .map((gang, idx) => (
                                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                <td style={{ padding: '8px', fontWeight: '500' }}>{gang.gang_code}</td>
                                                                <td style={{ padding: '8px', textAlign: 'right', color: '#3b82f6' }}>
                                                                    {formatCurrency(gang.total_upah_bersih || gang.total_wage || 0)}
                                                                </td>
                                                                <td style={{ padding: '8px', textAlign: 'right' }}>{gang.total_employees || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    {(!divisionDetails.gangs || divisionDetails.gangs.length === 0) && (
                                                        <tr>
                                                            <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
                                                                No gang data available
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Premi Breakdown */}
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#334155', marginBottom: '1rem' }}>
                                            💰 Komposisi Premi ({divisionDetails.premi?.length || 0} jenis)
                                        </h3>
                                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                            {divisionDetails.premi && divisionDetails.premi.length > 0 ? (
                                                <>
                                                    {/* Total Premi Summary */}
                                                    <div style={{
                                                        backgroundColor: '#f0fdf4',
                                                        padding: '1rem',
                                                        borderRadius: '8px',
                                                        marginBottom: '1rem',
                                                        textAlign: 'center'
                                                    }}>
                                                        <div style={{ color: '#15803d', fontSize: '0.8rem' }}>Total Premi Divisi</div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#166534' }}>
                                                            {formatCurrency(divisionDetails.premi.reduce((sum, p) => sum + p.value, 0))}
                                                        </div>
                                                    </div>
                                                    {/* Premi List */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {divisionDetails.premi.map((premi, idx) => {
                                                            const total = divisionDetails.premi.reduce((sum, p) => sum + p.value, 0);
                                                            const percent = total > 0 ? ((premi.value / total) * 100).toFixed(1) : 0;
                                                            return (
                                                                <div key={idx} style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    padding: '8px 12px',
                                                                    backgroundColor: '#f8fafc',
                                                                    borderRadius: '6px'
                                                                }}>
                                                                    <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{premi.name}</span>
                                                                    <span style={{
                                                                        color: '#10b981',
                                                                        fontWeight: '600',
                                                                        fontSize: '0.85rem'
                                                                    }}>
                                                                        {formatCurrency(premi.value)} ({percent}%)
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                                                    No premi data available for this division
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Overtime Breakdown */}
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#334155', marginBottom: '1rem' }}>
                                            ⏰ Analisis Lembur
                                        </h3>
                                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                            {divisionDetails.overtime && divisionDetails.overtime.length > 0 ? (
                                                <>
                                                    {/* Total Overtime Summary */}
                                                    <div style={{
                                                        backgroundColor: '#fff7ed',
                                                        padding: '1rem',
                                                        borderRadius: '8px',
                                                        marginBottom: '1rem',
                                                        textAlign: 'center'
                                                    }}>
                                                        <div style={{ color: '#c2410c', fontSize: '0.8rem' }}>Total Lembur Divisi</div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ea580c' }}>
                                                            {formatCurrency(divisionDetails.overtime.reduce((sum, o) => sum + o.value, 0))}
                                                        </div>
                                                    </div>
                                                    {/* Overtime List */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {divisionDetails.overtime.map((ot, idx) => {
                                                            const total = divisionDetails.overtime.reduce((sum, o) => sum + o.value, 0);
                                                            const percent = total > 0 ? ((ot.value / total) * 100).toFixed(1) : 0;
                                                            return (
                                                                <div key={idx} style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    padding: '8px 12px',
                                                                    backgroundColor: '#f8fafc',
                                                                    borderRadius: '6px'
                                                                }}>
                                                                    <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{ot.name}</span>
                                                                    <span style={{
                                                                        color: '#ea580c',
                                                                        fontWeight: '600',
                                                                        fontSize: '0.85rem'
                                                                    }}>
                                                                        {formatCurrency(ot.value)} ({percent}%)
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                                                    No overtime data available for this division
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    Failed to load division details
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const KPICard = ({ title, value, subValue, trend, color }) => (
    <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: `4px solid ${getColorCode(color)}` }}>
        <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{title}</p>
        <p style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.25rem' }}>{value}</p>
        <p style={{ fontSize: '0.875rem', color: trend === 'up' && color !== 'green' ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {trend === 'up' ? '▲' : '▼'} {subValue}
        </p>
    </div>
);

const getColorCode = (name) => {
    const map = { red: '#ef4444', blue: '#3b82f6', green: '#10b981', orange: '#f59e0b', gray: '#94a3b8' };
    return map[name] || '#94a3b8';
};
