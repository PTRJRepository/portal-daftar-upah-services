import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import { getBasePath } from '../utils/prodModeUtils';

import {
    Home, FileText, BarChart2, DollarSign, TrendingUp, Users, Activity,
    Settings, ChevronLeft, ChevronRight, LogOut, Briefcase, ShieldCheck,
    PieChart, Menu, X, Database
} from 'lucide-react';

// Icons using Lucide React for professional corporate aesthetic
const Icons = {
    Home: () => <Home size={20} />,
    Clipboard: () => <FileText size={20} />,
    BarChart: () => <BarChart2 size={20} />,
    DollarSign: () => <DollarSign size={20} />,
    TrendingUp: () => <TrendingUp size={20} />,
    Activity: () => <Users size={20} />, // Mapped to HR Directory
    Settings: () => <Settings size={20} />,
    ChevronLeft: () => <ChevronLeft size={20} />,
    ChevronRight: () => <ChevronRight size={20} />,
    LogOut: () => <LogOut size={18} />,
    PalmTree: () => <Briefcase size={20} />,
    Verifikasi: () => <ShieldCheck size={20} />,
    Comprehensive: () => <PieChart size={20} />,
    AdminTest: () => <Activity size={20} />,
    DatabaseIcon: () => <Database size={20} />
};

const DashboardLayout = () => {
    const { user, logout, isKeraniUser } = useAuth();
    const { isAdminUser } = useReport();
    const navigate = useNavigate();
    const location = useLocation();

    // Sidebar State
    const [collapsed, setCollapsed] = useState(false);

    // Get base path for proxy mode compatibility
    const basePath = getBasePath();

    // Dynamic styles
    const getLinkStyle = ({ isActive }) => ({
        padding: collapsed ? '0.75rem 0' : '0.75rem 1rem',
        backgroundColor: isActive ? '#334155' : 'transparent',
        color: isActive ? '#ffffff' : '#94a3b8',
        borderRadius: '8px',
        fontWeight: '500',
        fontSize: '0.9rem',
        cursor: 'pointer',
        borderLeft: (!collapsed && isActive) ? '4px solid #3b82f6' : '4px solid transparent',
        transition: 'all 0.2s',
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? '0' : '0.75rem',
        marginBottom: '0.25rem',
        position: 'relative'
    });

    const sidebarWidth = collapsed ? '72px' : '260px';

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            backgroundColor: '#f8fafc',
            fontFamily: "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            overflow: 'hidden',
            color: '#334155',
            position: 'relative' // For absolute positioning context
        }}>
            {/* BACKDROP (Overlay mode) - Applies on ALL screens now since sidebar is overlay 
                This allows user to click anywhere outside to close it, solving "cannot close" issue.
            */}
            {!collapsed && (
                <div
                    className="no-print"
                    onClick={() => setCollapsed(true)}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.4)', // Slightly darker for better focus
                        zIndex: 15,
                        backdropFilter: 'blur(2px)',
                        cursor: 'pointer'
                    }}
                />
            )}

            {/* SIDEBAR - Fixed/Absolute Position */}
            <div className="no-print" style={{
                width: collapsed ? '72px' : '260px',
                height: '100%',
                backgroundColor: '#0f172a', // Darker Slate for more contrast
                color: '#f1f5f9',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 20, // Higher than content
                boxShadow: collapsed ? '4px 0 10px rgba(0,0,0,0.05)' : '4px 0 20px rgba(0,0,0,0.25)',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'absolute', // FLOAT over content
                left: 0,
                top: 0
            }}>

                {/* Sidebar Header with Toggle Integrated */}
                <div style={{
                    padding: '1rem',
                    borderBottom: '1px solid #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    minHeight: '70px',
                    transition: 'all 0.3s'
                }}>
                    {/* Logo Area */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        overflow: 'hidden',
                        opacity: collapsed ? 0 : 1,
                        width: collapsed ? 0 : 'auto',
                        transition: 'opacity 0.2s',
                    }}>
                        <img
                            src={`${basePath}/images/rebinmas.webp`}
                            alt="Logo"
                            style={{ height: '32px', display: 'block' }}
                        />
                        <div style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: '700', fontSize: '1rem', color: '#ffffff' }}>PT Rebinmas Jaya</div>
                        </div>
                    </div>

                    {/* Collapse Toggle Button - Always visible, changes position/icon */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: collapsed ? 'transparent' : '#334155',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            // Reset margins
                            margin: 0
                        }}
                        title={collapsed ? "Expand Menu" : "Close Menu"}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#475569'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = collapsed ? 'transparent' : '#334155'}
                    >
                        {collapsed ? (
                            // Hamburger / Menu Icon
                            <Menu size={20} />
                        ) : (
                            // Close / X Icon
                            <X size={20} />
                        )}
                    </button>
                </div>

                {/* Collapsed Logo (Only shown when collapsed, centered below toggle) */}
                {collapsed && (
                    <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                        <img
                            src={`${basePath}/images/rebinmas.webp`}
                            alt="Logo"
                            style={{ height: '28px', display: 'block' }}
                        />
                    </div>
                )}

                {/* Navigation Links */}
                <div style={{ padding: '1.5rem 0.75rem', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

                    {/* Main Menu Label */}
                    {!collapsed ? (
                        <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                            Main Menu
                        </div>
                    ) : (
                        <div style={{ height: '1px', background: '#334155', margin: '0.5rem 0.25rem 1rem 0.25rem' }}></div>
                    )}

                    <NavLink to="/" style={getLinkStyle} end title={collapsed ? "Dashboard" : ""}>
                        <Icons.Home />
                        {!collapsed && <span>Dashboard</span>}
                    </NavLink>

                    <NavLink to="/operational" style={getLinkStyle} title={collapsed ? "Laporan Operasional" : ""}>
                        <Icons.Clipboard />
                        {!collapsed && <span>Laporan Operasional</span>}
                    </NavLink>

                    <NavLink to="/employee-directory" style={getLinkStyle} title={collapsed ? "HR Employee Directory" : ""}>
                        <Icons.Activity />
                        {!collapsed && <span>HR Employee Directory</span>}
                    </NavLink>

                    {!isKeraniUser && (
                        <NavLink to="/executive" style={getLinkStyle} title={collapsed ? "Analisis Keseluruhan" : ""}>
                            <Icons.TrendingUp />
                            {!collapsed && <span>Analisis Keseluruhan</span>}
                        </NavLink>
                    )}

                    {/* Section Separator / Label - Hidden for Kerani */}
                    {!isKeraniUser && (
                        <>
                            {!collapsed ? (
                                <div style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                                    Analysis & Summary
                                </div>
                            ) : (
                                <div style={{ height: '1px', background: '#334155', margin: '1rem 0.25rem' }}></div>
                            )}

                            <NavLink to="/summary" style={getLinkStyle} title={collapsed ? "Summary Report" : ""}>
                                <Icons.BarChart />
                                {!collapsed && <span>Summary Report</span>}
                            </NavLink>

                            <NavLink to="/wages-rebinmas" style={getLinkStyle} title={collapsed ? "Wages Rebinmas" : ""}>
                                <Icons.DollarSign />
                                {!collapsed && <span>Wages Rebinmas</span>}
                            </NavLink>

                            <NavLink to="/wages-ijl" style={getLinkStyle} title={collapsed ? "Wages IJL" : ""}>
                                <Icons.PalmTree />
                                {!collapsed && <span>Wages IJL</span>}
                            </NavLink>

                            <NavLink to="/wages-comparison" style={getLinkStyle} title={collapsed ? "Verifikasi Upah" : ""}>
                                <Icons.Verifikasi />
                                {!collapsed && <span>Verifikasi Upah</span>}
                            </NavLink>

                            <NavLink to="/analysis" style={getLinkStyle} title={collapsed ? "Analysis OT & Premi" : ""}>
                                <Icons.TrendingUp />
                                {!collapsed && <span>Analysis OT & Premi</span>}
                            </NavLink>

                            <NavLink to="/report-pajak" style={getLinkStyle} title={collapsed ? "Report Pajak" : ""}>
                                <Icons.Clipboard />
                                {!collapsed && <span>Report Pajak</span>}
                            </NavLink>

                            <NavLink to="/comprehensive" style={getLinkStyle} title={collapsed ? "Laporan Analisis Payroll" : ""}>
                                <Icons.Comprehensive />
                                {!collapsed && <span>Laporan Analisis Payroll</span>}
                            </NavLink>
                        </>
                    )}

                    {isAdminUser && (
                        <>
                            {!collapsed ? (
                                <div style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                                    Admin Tools
                                </div>
                            ) : (
                                <div style={{ height: '1px', background: '#334155', margin: '1rem 0.25rem' }}></div>
                            )}

                            <NavLink to="/seed" style={getLinkStyle} title={collapsed ? "Aggregation Seeder" : ""}>
                                <Icons.Settings />
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {!collapsed && <span>Aggregation Seeder</span>}
                                </div>
                            </NavLink>

                            <NavLink to="/spreadsheet-sync" style={getLinkStyle} title={collapsed ? "Spreadsheet Sync" : ""}>
                                <Icons.Clipboard /> {/* Or any other icon */}
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {!collapsed && <span>Spreadsheet Sync</span>}
                                </div>
                            </NavLink>

                            {/* Check if Metadata Test route exists and show if needed
                                Ideally we check routes, but here we just rely on link validity */}
                            <NavLink to="/test/components" style={getLinkStyle} title={collapsed ? "Metadata Test" : ""}>
                                <Icons.AdminTest /> {/* Reusing icon */}
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {!collapsed && <span>Metadata Test</span>}
                                </div>
                            </NavLink>
                        </>
                    )}

                </div>

                {/* User Profile & Logout */}
                <div style={{
                    padding: collapsed ? '1rem 0.5rem' : '1.5rem',
                    borderTop: '1px solid #334155',
                    backgroundColor: '#1e293b',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '0'
                }}>
                    {!collapsed && (
                        <div style={{ width: '100%', overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.username}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{user?.role || 'Staff'}</div>
                        </div>
                    )}

                    <button
                        onClick={logout}
                        title="Logout"
                        style={{
                            width: '100%',
                            padding: '0.6rem',
                            border: '1px solid #475569',
                            backgroundColor: 'transparent',
                            color: '#cbd5e1',
                            borderRadius: '6px',
                            fontWeight: '500',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: collapsed ? '0' : '0.5rem'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.borderColor = '#ef4444';
                            e.currentTarget.style.color = '#ef4444';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.borderColor = '#475569';
                            e.currentTarget.style.color = '#cbd5e1';
                        }}
                    >
                        <Icons.LogOut />
                        {!collapsed && <span>Logout</span>}
                    </button>
                </div>
            </div>

            {/* SPACER FOR COLLAPSED RAIL */}
            <div className="no-print" style={{
                width: '72px',
                flexShrink: 0,
                height: '100%',
                backgroundColor: '#f8fafc' // Match bg to be invisible
            }}></div>

            {/* MAIN CONTENT AREA */}
            <div className="print-content-area" style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden', // Let children handle X scroll, keep container clean
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                minWidth: 0, // CRITICAL for flex containers to shrinking properly
                height: '100vh',
                zIndex: 10 // Ensures proper layering: sidebar (20) > backdrop (15) > content (10)
            }}>
                <Outlet />
            </div>
        </div >
    );
};

export default DashboardLayout;
