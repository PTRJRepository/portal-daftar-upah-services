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
            {/* BACKDROP (Overlay mode) - Always present, animated via opacity/pointer-events */}
            <div
                className="no-print sidebar-backdrop"
                onClick={() => setCollapsed(true)}
                title="Tutup Menu Sidebar"
                style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: collapsed ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.5)',
                    zIndex: 15,
                    backdropFilter: collapsed ? 'blur(0px)' : 'blur(4px)',
                    WebkitBackdropFilter: collapsed ? 'blur(0px)' : 'blur(4px)',
                    cursor: collapsed ? 'default' : 'pointer',
                    pointerEvents: collapsed ? 'none' : 'auto',
                    transition: 'background-color 0.4s ease, backdrop-filter 0.4s ease, -webkit-backdrop-filter 0.4s ease'
                }}
            />

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

                    {/* Dashboard */}
                    {!collapsed ? (
                        <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                            Paling Atas
                        </div>
                    ) : (
                        <div style={{ height: '1px', background: '#334155', margin: '0.5rem 0.25rem 1rem 0.25rem' }}></div>
                    )}

                    <NavLink to="/" style={getLinkStyle} end title={collapsed ? "Dashboard" : ""}>
                        <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.Home /></div>
                        {!collapsed && (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Dashboard</span>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Ringkasan dan metrik utama aplikasi.</span>
                            </div>
                        )}
                    </NavLink>

                    {/* Laporan Operasional */}
                    {!collapsed ? (
                        <div style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                            Laporan Operasional
                        </div>
                    ) : (
                        <div style={{ height: '1px', background: '#334155', margin: '1rem 0.25rem' }}></div>
                    )}

                    <NavLink to="/operational" style={getLinkStyle} title={collapsed ? "Daftar Upah" : ""}>
                        <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.Clipboard /></div>
                        {!collapsed && (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Daftar Upah</span>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Filter daftar upah operasional dan mandor berdasarkan parameter.</span>
                            </div>
                        )}
                    </NavLink>

                    <NavLink to="/pendapatan-tidak-tetap" style={getLinkStyle} title={collapsed ? "Pendapatan Lainnya" : ""}>
                        <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.DollarSign /></div>
                        {!collapsed && (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Pendapatan Lainnya</span>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Daftar pendapatan tidak tetap lain-lain.</span>
                            </div>
                        )}
                    </NavLink>

                    {/* Report - Report */}
                    {!collapsed ? (
                        <div style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                            Report - Report
                        </div>
                    ) : (
                        <div style={{ height: '1px', background: '#334155', margin: '1rem 0.25rem' }}></div>
                    )}

                    {!isKeraniUser && (
                        <NavLink to="/executive" style={getLinkStyle} title={collapsed ? "Executive Analysis" : ""}>
                            <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.TrendingUp /></div>
                            {!collapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Executive Analysis</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Analisis metrik upah dan operasional untuk level eksekutif.</span>
                                </div>
                            )}
                        </NavLink>
                    )}

                    {!isKeraniUser && (
                        <NavLink to="/comprehensive" style={getLinkStyle} title={collapsed ? "Analisis Keseluruhan" : ""}>
                            <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.Comprehensive /></div>
                            {!collapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Analisis Keseluruhan</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Laporan analisis payroll secara holistik.</span>
                                </div>
                            )}
                        </NavLink>
                    )}

                    {!isKeraniUser && (
                        <NavLink to="/summary" style={getLinkStyle} title={collapsed ? "Accounting Report" : ""}>
                            <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.BarChart /></div>
                            {!collapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Accounting Report</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Laporan rekap dan summary untuk keperluan accounting.</span>
                                </div>
                            )}
                        </NavLink>
                    )}

                    <NavLink to="/report-pajak" style={getLinkStyle} title={collapsed ? "Report Pajak" : ""}>
                        <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.Clipboard /></div>
                        {!collapsed && (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Report Pajak</span>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Laporan 12 bulan PPh21 untuk keperluan pajak.</span>
                            </div>
                        )}
                    </NavLink>

                    {!isKeraniUser && (
                        <NavLink to="/wages-rebinmas" style={getLinkStyle} title={collapsed ? "Wages Rebinmas" : ""}>
                            <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.DollarSign /></div>
                            {!collapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Wages Rebinmas</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Rincian daftar upah untuk entitas Rebinmas.</span>
                                </div>
                            )}
                        </NavLink>
                    )}

                    {!isKeraniUser && (
                        <NavLink to="/wages-ijl" style={getLinkStyle} title={collapsed ? "Wages IJL" : ""}>
                            <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.PalmTree /></div>
                            {!collapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Wages IJL</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Rincian daftar upah untuk entitas Investasi.</span>
                                </div>
                            )}
                        </NavLink>
                    )}

                    {!isKeraniUser && (
                        <NavLink to="/wages-comparison" style={getLinkStyle} title={collapsed ? "Verifikasi Upah" : ""}>
                            <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.Verifikasi /></div>
                            {!collapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Verifikasi Upah</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Perbandingan dan verifikasi pembayaran.</span>
                                </div>
                            )}
                        </NavLink>
                    )}

                    {!isKeraniUser && (
                        <NavLink to="/analysis" style={getLinkStyle} title={collapsed ? "Analysis OT & Premi" : ""}>
                            <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.TrendingUp /></div>
                            {!collapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Analysis OT & Premi</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Detail tren lembur dan premi.</span>
                                </div>
                            )}
                        </NavLink>
                    )}

                    {/* Admin dan Config */}
                    {isAdminUser && (
                        <>
                            {!collapsed ? (
                                <div style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                                    Admin dan Config
                                </div>
                            ) : (
                                <div style={{ height: '1px', background: '#334155', margin: '1rem 0.25rem' }}></div>
                            )}

                            <NavLink to="/seed" style={getLinkStyle} title={collapsed ? "Aggregation Seeder" : ""}>
                                <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.Settings /></div>
                                {!collapsed && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Aggregation Seeder</span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Jalankan re-aggregation data manual.</span>
                                    </div>
                                )}
                            </NavLink>

                            <NavLink to="/spreadsheet-sync" style={getLinkStyle} title={collapsed ? "Spreadsheet Sync" : ""}>
                                <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.DatabaseIcon /></div>
                                {!collapsed && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Spreadsheet Sync</span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Sinkronisasi data pajak dan profil ke spreadsheet.</span>
                                    </div>
                                )}
                            </NavLink>

                            <NavLink to="/employee-directory" style={getLinkStyle} title={collapsed ? "HR Employee Directory" : ""}>
                                <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.Activity /></div>
                                {!collapsed && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>HR Employee Directory</span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Alat admin daftar database HR.</span>
                                    </div>
                                )}
                            </NavLink>

                            <NavLink to="/test/components" style={getLinkStyle} title={collapsed ? "Sisa Lainnya / Test" : ""}>
                                <div style={{ marginTop: collapsed ? '0' : '0.15rem' }}><Icons.AdminTest /></div>
                                {!collapsed && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600', color: '#e2e8f0', lineHeight: '1.2' }}>Sisa Lainnya</span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem', lineHeight: '1.3' }}>Metadata test dan routing sementara.</span>
                                    </div>
                                )}
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
