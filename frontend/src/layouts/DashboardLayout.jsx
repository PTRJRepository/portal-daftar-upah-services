import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import { getBasePath } from '../utils/prodModeUtils';

// Icons (Simple SVG implementation to avoid dependencies)
const Icons = {
    Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
    Clipboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>,
    BarChart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
    DollarSign: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
    TrendingUp: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>,
    Activity: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
    Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
    ChevronLeft: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
    ChevronRight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
    LogOut: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
    PalmTree: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2c0-1.66 1.57-3 3.5-3S11 6.34 11 8h2z"></path><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-2c0-1.66-1.57-3-3.5-3c-1.4 0-2.6 1.25-3.2 2.9"></path><path d="M12 22v-9"></path><path d="M8 10.5A5.5 5.5 0 0 1 13.5 5h0"></path><path d="M10 13a4 4 0 0 0-4 4"></path><path d="M14 13a4 4 0 0 1 4 4"></path></svg>
};

const DashboardLayout = () => {
    const { user, logout } = useAuth();
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
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        ) : (
                            // Close / X Icon
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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

                    <NavLink to="/executive" style={getLinkStyle} title={collapsed ? "Analisis Keseluruhan" : ""}>
                        <Icons.TrendingUp />
                        {!collapsed && <span>Analisis Keseluruhan</span>}
                    </NavLink>

                    {/* Section Separator / Label */}
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

                    <NavLink to="/analysis" style={getLinkStyle} title={collapsed ? "Analysis OT & Premi" : ""}>
                        <Icons.TrendingUp />
                        {!collapsed && <span>Analysis OT & Premi</span>}
                    </NavLink>

                    <NavLink to="/comprehensive" style={getLinkStyle} title={collapsed ? "Laporan Analisis Payroll" : ""}>
                        <Icons.Activity />
                        {!collapsed && <span>Laporan Analisis Payroll</span>}
                    </NavLink>

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
                                <Icons.Activity /> {/* Reusing icon */}
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
