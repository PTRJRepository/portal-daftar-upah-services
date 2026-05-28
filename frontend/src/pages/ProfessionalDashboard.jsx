import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import MonthSelector from '../components/common/MonthSelector';
import { isProdMode } from '../utils/prodModeUtils';

// Icons - Lucide React
import {
  Settings, Info, BarChart2, ArrowRight, DollarSign, Calculator,
  Users, FileText, TrendingUp, PieChart, ClipboardList,
  Calendar, Building2, Truck, Leaf, Banknote, Receipt,
  Target, Activity, Database, Search, Download,
  ChevronRight, LayoutGrid, Home, Filter
} from 'lucide-react';

// ============================================
// PROFESSIONAL DASHBOARD (Windows-Style Tile Grid)
// ============================================

// Report categories with tiles configuration
const REPORT_TILES = {
  operational: {
    title: 'Laporan Operasional',
    icon: ClipboardList,
    color: '#0ea5e9',
    tiles: [
      { path: '/operational', label: 'Data Upah Operasional', icon: FileText, color: '#0ea5e9' },
      { path: '/summary', label: 'Summary Report', icon: BarChart2, color: '#06b6d4' },
      { path: '/wages-rebinmas', label: 'Daftar Upah Rebinmas', icon: Building2, color: '#14b8a6' },
      { path: '/wages-ijl', label: 'Daftar Upah IJL', icon: Leaf, color: '#22c55e' },
    ]
  },
  analysis: {
    title: 'Laporan Analisis',
    icon: TrendingUp,
    color: '#8b5cf6',
    tiles: [
      { path: '/analysis', label: 'Analisis Data', icon: Activity, color: '#8b5cf6' },
      { path: '/comprehensive', label: 'Comprehensive Analysis', icon: PieChart, color: '#a855f7' },
      { path: '/productivity', label: 'Produktivitas', icon: TrendingUp, color: '#d946ef' },
      { path: '/impact', label: 'Impact Report', icon: Target, color: '#ec4899' },
    ]
  },
  finance: {
    title: 'Laporan Keuangan',
    icon: DollarSign,
    color: '#10b981',
    tiles: [
      { path: '/executive', label: 'Executive Payroll', icon: DollarSign, color: '#10b981' },
      { path: '/wages-comparison', label: 'Perbandingan Upah', icon: Banknote, color: '#14b8a6' },
      { path: '/detailed-salary', label: 'Detail Gaji & Lembur', icon: Receipt, color: '#0d9488' },
      { path: '/detail-upah-bersih', label: 'Upah Bersih', icon: DollarSign, color: '#f59e0b' },
    ]
  },
  employee: {
    title: 'Data Karyawan',
    icon: Users,
    color: '#f97316',
    tiles: [
      { path: '/employee-directory', label: 'Direktori Karyawan', icon: Users, color: '#f97316' },
      { path: '/gang-comparison', label: 'Perbandingan Gang', icon: Building2, color: '#ea580c' },
    ]
  },
  production: {
    title: 'Produksi & Tonase',
    icon: Truck,
    color: '#06b6d4',
    tiles: [
      { path: '/mill-production', label: 'Produksi Mill', icon: Factory, color: '#06b6d4' },
      { path: '/tonase-analysis', label: 'Analisis Tonase', icon: Truck, color: '#0891b2' },
    ]
  },
  tax: {
    title: 'Pajak',
    icon: Calculator,
    color: '#ef4444',
    tiles: [
      { path: '/report-pajak', label: 'Laporan Pajak', icon: Calculator, color: '#ef4444' },
      { path: '/pendapatan-tidak-tetap', label: 'Pendapatan Tidak Tetap', icon: Banknote, color: '#dc2626' },
    ]
  },
  verifications: {
    title: 'Verifikasi & Koreksi',
    icon: Search,
    color: '#6366f1',
    tiles: [
      { path: '/data-verification', label: 'Verifikasi Data', icon: Search, color: '#6366f1' },
      { path: '/seed', label: 'Aggregation Seeder', icon: Database, color: '#4f46e5' },
    ]
  }
};

// Role-based tile filtering
const getAccessibleTiles = (userRole, isAdmin) => {
  if (isAdmin) return REPORT_TILES;
  
  // Non-admin users get limited access
  const limitedTiles = {};
  
  // Kerani gets operational + some analysis
  if (userRole === 'kerani') {
    limitedTiles.operational = REPORT_TILES.operational;
    limitedTiles.verifications = REPORT_TILES.verifications;
  }
  
  // Manager gets analysis + finance
  if (userRole === 'manager') {
    limitedTiles.analysis = REPORT_TILES.analysis;
    limitedTiles.finance = REPORT_TILES.finance;
    limitedTiles.production = REPORT_TILES.production;
  }
  
  return limitedTiles;
};

// ============================================
// TILE COMPONENT
// ============================================
function ReportTile({ path, label, icon: Icon, color, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  
  return (
    <button
      onClick={() => onClick(path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        padding: '1rem 1.25rem',
        backgroundColor: hovered ? `${color}10` : 'white',
        border: `1px solid ${hovered ? color : '#e2e8f0'}`,
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: hovered ? `0 4px 12px ${color}20` : '0 1px 3px rgba(0,0,0,0.05)',
        textAlign: 'left',
        width: '100%',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        backgroundColor: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <span style={{
        flex: 1,
        fontSize: '0.9rem',
        fontWeight: '600',
        color: hovered ? color : '#1e293b',
      }}>
        {label}
      </span>
      <ChevronRight size={18} color={hovered ? color : '#94a3b8'} />
    </button>
  );
}

// ============================================
// CATEGORY SECTION COMPONENT
// ============================================
function ReportCategory({ title, icon: Icon, color, tiles, onTileClick }) {
  const [expanded, setExpanded] = React.useState(true);
  
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '14px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* Category Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1.25rem 1.5rem',
          backgroundColor: 'white',
          border: 'none',
          borderBottom: expanded ? `1px solid #f1f5f9` : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
        <span style={{
          flex: 1,
          fontSize: '1rem',
          fontWeight: '700',
          color: '#0f172a',
        }}>
          {title}
        </span>
        <ChevronRight 
          size={20} 
          color="#94a3b8"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
      
      {/* Tiles Grid */}
      {expanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '0.75rem',
          padding: '1rem 1.25rem 1.25rem',
        }}>
          {tiles.map((tile, idx) => (
            <ReportTile
              key={idx}
              {...tile}
              onClick={onTileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
export default function ProfessionalDashboard() {
  const { user } = useAuth();
  const {
    month, setMonth,
    year, setYear,
    division, setDivision,
    gang, setGang,
    gangs, allDivisions,
    gangLoading, isLockedMode, isAdminUser,
    currentPeriod
  } = useReport();

  const navigate = useNavigate();
  const inProdMode = isProdMode();

  // Role determination
  const userRole = (user?.role || '').toLowerCase();
  const canAccessReports = isAdminUser || !inProdMode;
  const canSeeReportPajak = userRole === 'kerani' || (userRole !== 'admin');

  // Get accessible tiles based on role
  const accessibleTiles = getAccessibleTiles(userRole, isAdminUser);

  const handleTileClick = (path) => {
    navigate(path);
  };

  const handleGenerateOperational = () => {
    if (division && gang) navigate('/operational');
  };

  const handleGenerateReportPajak = () => {
    if (division && gang) navigate('/report-pajak');
  };

  // Quick stats for display
  const currentPeriodLabel = currentPeriod 
    ? new Date(currentPeriod.year, currentPeriod.month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })
    : `${new Date(year, month - 1).toLocaleString('id-ID', { month: 'long' })} ${year}`;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      
      {/* HEADER - Modern Windows 11 Style */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1.5rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        {/* Left: Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Home size={24} color="white" />
          </div>
          <div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.02em',
            }}>
              Dashboard
            </h1>
            <p style={{
              fontSize: '0.85rem',
              color: '#64748b',
              margin: '0.25rem 0 0',
            }}>
              Sistem Manajemen Data Upah - PT Rebinmas
            </p>
          </div>
        </div>

        {/* Right: User Info Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#f1f5f9',
            borderRadius: '8px',
          }}>
            <Users size={16} color="#64748b" />
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {user?.name || 'User'} 
              <span style={{ 
                marginLeft: '0.5rem', 
                padding: '0.125rem 0.5rem',
                backgroundColor: isAdminUser ? '#dbeafe' : '#fef3c7',
                color: isAdminUser ? '#1e40af' : '#92400e',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}>
                {userRole}
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* FILTER PANEL - Modern Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem 2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid #f1f5f9',
          }}>
            <Filter size={20} color="#2563eb" />
            <h2 style={{
              fontSize: '1rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Filter Parameter
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.5rem',
            alignItems: 'end',
          }}>
            {/* Period */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              }}>
                Periode
              </label>
              <MonthSelector
                month={month}
                year={year}
                onChange={(m, y) => { setMonth(m); setYear(y); }}
              />
            </div>

            {/* Division */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              }}>
                Divisi {isLockedMode && <span style={{ color: '#d97706' }}>(LOCKED)</span>}
              </label>
              <select
                value={division}
                onChange={e => !isLockedMode && setDivision(e.target.value)}
                disabled={isLockedMode}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 1rem',
                  fontSize: '0.9rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: isLockedMode ? '#fef9c3' : 'white',
                  cursor: isLockedMode ? 'not-allowed' : 'pointer',
                  outline: 'none',
                }}
              >
                <option value="">Pilih Divisi</option>
                {allDivisions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Gang */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              }}>
                Gang / Kemandoran
              </label>
              <select
                value={gang}
                onChange={e => setGang(e.target.value)}
                disabled={gangLoading}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 1rem',
                  fontSize: '0.9rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: gangLoading ? '#f8fafc' : 'white',
                  outline: 'none',
                }}
              >
                {gangLoading ? (
                  <option>Memuat...</option>
                ) : (
                  <>
                    <option value="">Pilih Gang</option>
                    <option value="ALL">SEMUA GANG</option>
                    {gangs.map(g => (
                      <option key={g.gang_code} value={g.gang_code}>
                        {g.gang_code} - {g.description || '-'}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {canSeeReportPajak && (
                <button
                  onClick={handleGenerateReportPajak}
                  disabled={!division || !gang}
                  style={{
                    flex: 1,
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    backgroundColor: (!division || !gang) ? '#e2e8f0' : '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: (!division || !gang) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Calculator size={16} />
                  Pajak
                </button>
              )}
              <button
                onClick={handleGenerateOperational}
                disabled={!division || !gang}
                style={{
                  flex: 1,
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  backgroundColor: (!division || !gang) ? '#e2e8f0' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: (!division || !gang) ? 'not-allowed' : 'pointer',
                }}
              >
                <FileText size={16} />
                Operasional
              </button>
            </div>
          </div>
        </div>

        {/* PERIOD INFO */}
        {currentPeriod && (
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <Database size={20} color="#0284c7" />
            <div>
              <span style={{ fontWeight: '600', color: '#0c4a6e', fontSize: '0.9rem' }}>
                Database Aktif: {currentPeriodLabel}
              </span>
              <span style={{ color: '#0ea5e9', fontSize: '0.85rem', marginLeft: '0.75rem' }}>
                Data bulan berjalan untuk laporan operasional
              </span>
            </div>
          </div>
        )}

        {/* REPORT CATEGORIES GRID */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}>
          {Object.entries(accessibleTiles).map(([key, category]) => (
            <ReportCategory
              key={key}
              title={category.title}
              icon={category.icon}
              color={category.color}
              tiles={category.tiles}
              onTileClick={handleTileClick}
            />
          ))}
        </div>

      </main>

    </div>
  );
}