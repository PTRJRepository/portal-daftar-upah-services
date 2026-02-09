import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import LoadingScreen from '../components/common/LoadingScreen';

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

    // Filters (Default to current month, can be changed to view historical snapshots)
    const [month, setMonth] = useState(initialMonth || new Date().getMonth() + 1);
    const [year, setYear] = useState(initialYear || new Date().getFullYear());

    // Comparison State
    const [filterOptions, setFilterOptions] = useState({ divisions: [], gangs: [] });
    const [compMode, setCompMode] = useState('division');
    const [selectedItems, setSelectedItems] = useState([]);
    const [compData, setCompData] = useState(null);
    const [compLoading, setCompLoading] = useState(false);

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
                }
            } catch (e) {
                console.error("Failed to load filters:", e);
            }
        }
        if (token) loadFilters();
    }, [token, month, year]);

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

    // Derived Data for Charts
    const divisionChartData = useMemo(() => {
        if (!data?.breakdown) return [];
        // Top 10 Divisions by Wage
        return [...data.breakdown]
            .sort((a, b) => b.total_wage - a.total_wage)
            .slice(0, 10)
            .map(d => ({
                name: d.division_code,
                Wage: d.total_wage,
                Overtime: d.total_ot,
                Premi: d.total_premi
            }));
    }, [data]);

    const gangChartData = useMemo(() => {
        if (!data?.gangBreakdown) return [];
        return data.gangBreakdown.map(g => ({
            name: g.gang_code,
            Wage: g.total_wage,
            Overtime: g.total_ot
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
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {/* Period Selector could go here, simplified for now */}
                    <div style={{ padding: '0.5rem 1rem', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: '600', color: '#334155' }}>
                        {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
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
                {/* Division Breakdown */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', marginBottom: '1.5rem' }}>Top Divisions by Cost</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={divisionChartData} layout="vertical" margin={{ left: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={50} />
                                <Tooltip formatter={(val) => formatCurrency(val)} />
                                <Bar dataKey="Wage" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
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
