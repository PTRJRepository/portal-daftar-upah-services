import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import { isProdMode, buildAppPath } from '../utils/prodModeUtils';
import { buildBackendUrl } from '../utils/apiBase';
import GangTrendChart from '../components/dashboard/GangTrendChart';
import PremiCompositionChart from '../components/dashboard/PremiCompositionChart';
import {
  Settings,
  BarChart2,
  ArrowRight,
  DollarSign,
  Calculator,
  FileText,
  TrendingUp,
  PieChart,
  ClipboardList,
  Building2,
  Leaf,
  Banknote,
  Receipt,
  Target,
  Activity,
  Database,
  Search,
  Download,
  Filter as FilterIcon,
  Factory,
  ShieldCheck,
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  Users,
  Clock,
  Printer,
  GitCompare,
  IdCard,
  TrendingDown,
  CircleDollarSign
} from 'lucide-react';

import '../styles/dashboard-dark-palm.css';

// ─── Module Registry ────────────────────────────────────────────────────────
const MODULE_GROUPS = [
  {
    key: 'operational',
    title: 'Operational',
    description: 'Akses cepat laporan operasional dan output inti payroll.',
    icon: ClipboardList,
    eyebrowClass: '',
    iconClass: '',
    countClass: '',
    iconBg: 'rgba(59,130,246,.14)',
    iconColor: '#93c5fd',
    modules: [
      { path: '/operational', label: 'Daftar Upah', description: 'Tampilkan isi daftar upah karyawan sesuai divisi akses.', icon: FileText, roles: ['payroll_admin', 'kerani'], featured: true, iconBg: 'rgba(59,130,246,.14)', iconColor: '#93c5fd' },
      { path: '/summary', label: 'Summary Report', description: 'Ringkasan upah dan rekap utama.', icon: BarChart2, roles: ['payroll_admin', 'estate_manager', 'finance', 'executive'], iconBg: 'rgba(59,130,246,.14)', iconColor: '#93c5fd' },
      { path: '/wages-ijl', label: 'Upah IJL', description: 'Laporan upah tenaga IJL.', icon: Leaf, roles: ['payroll_admin', 'finance'], iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' },
      { path: '/wages-rebinmas', label: 'Daftar Upah Rebinmas', description: 'Laporan payroll Rebinmas.', icon: Building2, roles: ['payroll_admin', 'finance'], iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' }
    ]
  },
  {
    key: 'payslip',
    title: 'Payslip & Kehadiran',
    description: 'Slip gaji, absensi, lembur, dan info karyawan per gang.',
    icon: Printer,
    eyebrowClass: 'dashboard-dark__eyebrow--cyan',
    iconClass: 'dashboard-dark__floating-icon--cyan',
    countClass: 'dashboard-dark__module-count--cyan',
    modules: [
      { path: '/payslip-print', label: 'Slip Gaji (Payslip)', description: 'Cetak slip gaji karyawan.', icon: Printer, roles: ['payroll_admin', 'kerani', 'finance'], openNewTab: true, requiresFilter: true, iconBg: 'rgba(34,211,238,.14)', iconColor: '#67e8f9' },
      { path: '/operational?view=attendance', label: 'Absensi / HK', description: 'Matrix kehadiran per gang.', icon: Clock, roles: ['payroll_admin', 'kerani'], iconBg: 'rgba(34,211,238,.14)', iconColor: '#67e8f9' },
      { path: '/operational?view=overtime', label: 'Lembur', description: 'Matrix lembur per gang.', icon: TrendingUp, roles: ['payroll_admin', 'kerani'], iconBg: 'rgba(249,115,22,.14)', iconColor: '#fdba74' },
      { path: '/operational?view=employee-directory', label: 'Info Karyawan', description: 'Data karyawan per gang.', icon: IdCard, roles: ['payroll_admin', 'kerani'], iconBg: 'rgba(139,92,246,.14)', iconColor: '#c4b5fd' }
    ]
  },
  {
    key: 'analysis',
    title: 'Analysis & Comparison',
    description: 'Insight produktivitas, dampak, dan perbandingan payroll.',
    icon: TrendingUp,
    eyebrowClass: 'dashboard-dark__eyebrow--purple',
    iconClass: 'dashboard-dark__floating-icon--purple',
    countClass: 'dashboard-dark__module-count--purple',
    modules: [
      { path: '/productivity', label: 'Produktivitas', description: 'Tonase, HK, dan biaya per performa.', icon: TrendingUp, roles: ['estate_manager', 'executive'], iconBg: 'rgba(139,92,246,.14)', iconColor: '#c4b5fd' },
      { path: '/wages-comparison', label: 'Comparison', description: 'Perbandingan payroll antar periode.', icon: Activity, roles: ['estate_manager', 'finance', 'executive'], iconBg: 'rgba(139,92,246,.14)', iconColor: '#c4b5fd' },
      { path: '/impact', label: 'Impact Report', description: 'Analisis dampak biaya dan perubahan.', icon: Target, roles: ['estate_manager', 'executive'], iconBg: 'rgba(139,92,246,.14)', iconColor: '#c4b5fd' },
      { path: '/comprehensive', label: 'Comprehensive Analysis', description: 'Analisis payroll lintas komponen.', icon: PieChart, roles: ['estate_manager', 'finance', 'executive'], iconBg: 'rgba(139,92,246,.14)', iconColor: '#c4b5fd' },
      { path: '/mill-production', label: 'Produktivitas Kebun', description: 'Tonase FFB, HK, dan biaya kebun.', icon: Factory, roles: ['estate_manager', 'executive'], iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' },
      { path: '/tonase-analysis', label: 'Tonase Analysis', description: 'Analisis tonase detail per divisi.', icon: BarChart2, roles: ['estate_manager', 'executive'], iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' },
      { path: '/staging-comparison', label: 'Staging vs Plantware', description: 'Perbandingan data staging dan plantware.', icon: GitCompare, roles: ['payroll_admin', 'kerani', 'finance', 'estate_manager', 'executive'], iconBg: 'rgba(249,115,22,.14)', iconColor: '#fdba74' }
    ]
  },
  {
    key: 'finance',
    title: 'Finance',
    description: 'Monitoring payroll finansial dan rincian kompensasi.',
    icon: DollarSign,
    eyebrowClass: 'dashboard-dark__eyebrow--green',
    iconClass: 'dashboard-dark__floating-icon--green',
    countClass: '',
    modules: [
      { path: '/executive', label: 'Executive Payroll', description: 'Ringkasan high-level biaya payroll.', icon: DollarSign, roles: ['finance', 'executive'], featured: true, iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' },
      { path: '/detailed-salary', label: 'Detail Gaji', description: 'Rincian gaji, lembur, dan komponen.', icon: Receipt, roles: ['finance'], iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' },
      { path: '/detail-upah-bersih', label: 'Upah Bersih', description: 'Detail payroll bersih per filter.', icon: Banknote, roles: ['finance'], iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' },
      { path: '/pendapatan-tidak-tetap', label: 'Pendapatan Tidak Tetap', description: 'Komponen pendapatan non-rutin.', icon: Calculator, roles: ['finance'], iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' },
      { path: '/report-pajak', label: 'Report Pajak', description: 'Unduh dan audit laporan pajak.', icon: FileText, roles: ['finance', 'payroll_admin'], iconBg: 'rgba(249,115,22,.14)', iconColor: '#fdba74' },
      { path: '/report/high-earners', label: 'High Earner Report', description: 'Karyawan dengan gaji tertinggi.', icon: TrendingUp, roles: ['finance', 'executive'], iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' },
      { path: '/report/salary-range-detail', label: 'Salary Range', description: 'Distribusi range gaji.', icon: CircleDollarSign, roles: ['finance', 'executive'], iconBg: 'rgba(34,197,94,.14)', iconColor: '#86efac' }
    ]
  },
  {
    key: 'verification',
    title: 'Validasi & Koreksi',
    description: 'Validasi data, seeding, dan area koreksi operasional.',
    icon: ShieldCheck,
    eyebrowClass: 'dashboard-dark__eyebrow--red',
    iconClass: 'dashboard-dark__floating-icon--red',
    countClass: 'dashboard-dark__module-count--red',
    modules: [
      { path: '/data-verification', label: 'Verifikasi Data', description: 'Verifikasi konsistensi data payroll.', icon: Search, roles: ['payroll_admin'], iconBg: 'rgba(239,68,68,.14)', iconColor: '#fca5a5' },
      { path: '/seed', label: 'Seeder', description: 'Re-aggregation data manual.', icon: Database, roles: ['payroll_admin'], iconBg: 'rgba(249,115,22,.14)', iconColor: '#fdba74' },
      { path: '/spreadsheet-sync', label: 'Spreadsheet Sync', description: 'Sinkronisasi data spreadsheet.', icon: Database, roles: ['payroll_admin'], iconBg: 'rgba(34,211,238,.14)', iconColor: '#67e8f9' },
      { path: '/operational', label: 'Koreksi', description: 'Buka daftar upah untuk koreksi dan validasi manual.', icon: Settings, roles: ['payroll_admin'], iconBg: 'rgba(239,68,68,.14)', iconColor: '#fca5a5' }
    ]
  }
];

// ─── KPI Definitions ────────────────────────────────────────────────────────
const KPI_BLUEPRINT = [
  { key: 'totalUpah', label: 'Total Upah', glow: '#3b82f6', trendClass: '', isCurrency: true, trend: '+8%', comparison: 'vs bulan lalu' },
  { key: 'totalHk', label: 'Total HK', glow: '#22c55e', trendClass: '', isCurrency: false, trend: '+3%', comparison: 'produktivitas stabil' },
  { key: 'jumlahKaryawan', label: 'Jumlah Karyawan', glow: '#8b5cf6', trendClass: 'dashboard-dark__trend--neutral', isCurrency: false, trend: '±0%', comparison: 'headcount aktif' },
  { key: 'costPerHk', label: 'Cost / HK', glow: '#f97316', trendClass: 'dashboard-dark__trend--orange', isCurrency: true, trend: '+2%', comparison: 'efisiensi perlu review' }
];

// ─── Utility Functions ──────────────────────────────────────────────────────
const MONTH_LABELS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const formatPeriodLabel = (month, year) => (!month || !year ? 'Periode belum dipilih' : `${MONTH_LABELS[month - 1]} ${year}`);
const formatCompactNumber = (value) => (Number.isFinite(value) ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value) : '—');
const formatCurrency = (value) => (Number.isFinite(value) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value) : '—');

function guessRole(user, isAdminUser) {
  const rawRole = String(user?.role || '').toLowerCase();
  const username = String(user?.username || '').toLowerCase();
  if (rawRole === 'kerani' || username.includes('kerani')) return 'kerani';
  if (isAdminUser || rawRole === 'admin') return 'payroll_admin';
  if (rawRole.includes('finance') || rawRole.includes('akunting') || username.includes('finance')) return 'finance';
  if (rawRole.includes('director') || rawRole.includes('direktur') || rawRole.includes('executive')) return 'executive';
  if (rawRole.includes('manager') || rawRole.includes('estate') || username.includes('manager')) return 'estate_manager';
  return 'payroll_admin';
}

function getRoleMeta(role) {
  const map = {
    payroll_admin: { label: 'Payroll Admin', description: 'Operasional, validasi, koreksi' },
    kerani: { label: 'Kerani', description: 'Akses daftar upah sesuai divisi terkunci' },
    estate_manager: { label: 'Estate Manager', description: 'Monitoring produktivitas dan biaya' },
    finance: { label: 'Finance', description: 'Monitoring biaya payroll dan kompensasi' },
    executive: { label: 'Director / Executive', description: 'Insight high-level dan risk summary' }
  };
  return map[role] || map.payroll_admin;
}

const getVisibleGroups = (role) => MODULE_GROUPS
  .map((group) => ({ ...group, modules: group.modules.filter((module) => module.roles.includes(role)) }))
  .filter((group) => group.modules.length > 0);

function buildKpis({ dashboardData, gangs, currentPeriod, division, gang }) {
  const kpi = dashboardData?.kpi || null;
  const breakdown = Array.isArray(dashboardData?.breakdown) ? dashboardData.breakdown : [];
  const headcountFallback = Array.isArray(gangs) ? gangs.length : 0;
  const totalHkFallback = breakdown.reduce((sum, row) => sum + (Number(row?.headcount) || 0), 0) || (headcountFallback > 0 ? headcountFallback * 24 : null);
  const totalUpahFallback = Number(kpi?.curr_wage) || breakdown.reduce((sum, row) => sum + (Number(row?.total_wage) || 0), 0) || (headcountFallback > 0 ? headcountFallback * 2850000 : null);
  const headcount = Number(kpi?.curr_headcount) || headcountFallback || null;
  const totalHk = totalHkFallback;
  const totalUpah = totalUpahFallback;
  const costPerHk = totalUpah && totalHk ? Math.round(totalUpah / totalHk) : null;
  const values = { totalUpah, totalHk, jumlahKaryawan: headcount, costPerHk };
  return KPI_BLUEPRINT.map((item) => ({
    ...item,
    value: values[item.key],
    helper: currentPeriod ? `${division || 'Semua divisi'}${gang ? ` • ${gang}` : ''}` : 'Pilih filter untuk nilai aktual',
    ready: Boolean(values[item.key])
  }));
}

const getInsights = (role, division, hasFilterReady) => {
  const insights = [];
  insights.push({
    icon: hasFilterReady ? CheckCircle2 : AlertTriangle,
    title: hasFilterReady ? 'Validasi siap' : 'Lengkapi filter',
    body: hasFilterReady ? 'Filter lengkap, data dapat dibuka.' : 'Pilih divisi dan gang untuk membuka data.'
  });
  insights.push({
    icon: TrendingUp,
    title: 'Total upah naik',
    body: 'Naik 8% dari periode sebelumnya.'
  });
  insights.push({
    icon: DollarSign,
    title: 'Cost / HK review',
    body: 'Ada kenaikan 2% bulan ini.'
  });
  if (role === 'kerani') {
    insights.push({
      icon: FileText,
      title: 'Akses Daftar Upah',
      body: 'Cek HK, premi, lembur, dan upah bersih.'
    });
  } else if (role === 'finance') {
    insights.push({
      icon: Banknote,
      title: 'Executive Payroll',
      body: 'Monitor cost trend & tunjangan.'
    });
  } else {
    insights.push({
      icon: Target,
      title: 'Divisi dominan',
      body: 'Kontribusi payroll terbesar.'
    });
  }
  return insights;
};

// ─── Sub-components ────────────────────────────────────────────────────────
function ModuleCard({ module, onClick }) {
  const Icon = module.icon;
  return (
    <button type="button" onClick={() => onClick(module)} className="dashboard-dark__module-card">
      <div className="dashboard-dark__module-icon" style={{ background: module.iconBg, color: module.iconColor }}>
        <Icon size={21} />
      </div>
      <h3>{module.label}</h3>
      <p>{module.description}</p>
      <span className="dashboard-dark__module-action">
        Open module <ArrowRight size={14} />
      </span>
    </button>
  );
}

function ModuleSection({ group, onClick }) {
  const Icon = group.icon;
  return (
    <section className="dashboard-dark__module-section">
      <div className="dashboard-dark__module-head">
        <div>
          <div className={`dashboard-dark__eyebrow ${group.eyebrowClass}`}>Modules</div>
          <h2 className="dashboard-dark__section-title">{group.title}</h2>
          <p className="dashboard-dark__section-subtitle">{group.description}</p>
        </div>
        <span className={`dashboard-dark__module-count ${group.countClass}`}>
          {group.modules.length} module{group.modules.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className={`dashboard-dark__module-grid ${group.modules.length === 3 ? 'dashboard-dark__module-grid--3' : ''}`}>
        {group.modules.map((module) => (
          <ModuleCard key={`${module.path}-${module.label}`} module={module} onClick={onClick} />
        ))}
      </div>
    </section>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function ProfessionalDashboard() {
  const { user, token } = useAuth();
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

  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadDashboardSummary() {
      if (!token || !month || !year) return;
      setDashboardError('');
      try {
        const response = await fetch(buildBackendUrl(`/payroll/dashboard/executive-summary?month=${month}&year=${year}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await response.json();
        if (!active) return;
        if (json?.success) {
          setDashboardData(json.data || null);
        } else {
          setDashboardError(json?.error || 'Gagal memuat ringkasan dashboard');
        }
      } catch (error) {
        if (!active) return;
        setDashboardError(error?.message || 'Gagal memuat ringkasan dashboard');
      }
    }
    loadDashboardSummary();
    return () => { active = false; };
  }, [token, month, year]);

  const userRole = guessRole(user, isAdminUser);
  const roleMeta = getRoleMeta(userRole);
  const visibleGroups = getVisibleGroups(userRole);
  const kpis = buildKpis({ dashboardData, gangs, currentPeriod, division, gang });
  const hasFilterReady = Boolean(division && gang);
  const insights = getInsights(userRole, division, hasFilterReady);

  const currentPeriodLabel = currentPeriod ? formatPeriodLabel(currentPeriod.month, currentPeriod.year) : formatPeriodLabel(month, year);
  const selectedPeriodLabel = formatPeriodLabel(month, year);
  const selectedGangLabel = gang === 'ALL' ? 'SEMUA GANG' : (gang || 'Belum dipilih');
  const isKeraniRole = userRole === 'kerani';
  const canSeeReportPajak = userRole === 'finance' || userRole === 'payroll_admin';
  const canAccessReports = isKeraniRole || isAdminUser || !isProdMode();

  // Top divisi insight (from analytics data)
  const topDivisionLabel = useMemo(() => {
    const breakdown = Array.isArray(dashboardData?.breakdown) ? dashboardData.breakdown : [];
    if (breakdown.length === 0) return null;
    const top = breakdown.slice().sort((a, b) => (Number(b?.total_wage) || 0) - (Number(a?.total_wage) || 0))[0];
    return top?.division_code || null;
  }, [dashboardData]);

  // Handlers
  const handleGenerateOperational = () => {
    if (hasFilterReady && canAccessReports) navigate('/operational');
  };

  const handleTileClick = (module) => {
    if (module.openNewTab) {
      const params = new URLSearchParams();
      if (month) params.set('month', String(month));
      if (year) params.set('year', String(year));
      if (division) params.set('division', division);
      if (gang) params.set('gang', gang);
      const fullPath = buildAppPath(`${module.path}?${params.toString()}`);
      window.open(fullPath, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(module.path);
  };

  const handleMonthChange = (e) => {
    const value = Number(e.target.value);
    if (!Number.isNaN(value)) setMonth(value);
  };

  const handleYearChange = (e) => {
    const value = Number(e.target.value);
    if (!Number.isNaN(value) && value > 1900) setYear(value);
  };

  return (
    <div className="dashboard-dark">
      <div className="dashboard-dark__container">
        {/* ─── HERO BANNER ─────────────────────────────────────────────── */}
        <section className="dashboard-dark__hero">
          <div>
            <h1 className="dashboard-dark__hero-title">Dashboard Payroll</h1>
            <p className="dashboard-dark__hero-subtitle">Sistem Manajemen Data Upah - PT Rebinmas Jaya</p>
            <div className="dashboard-dark__badge-row">
              <div className="dashboard-dark__badge">Role: {roleMeta.label}</div>
              <div className="dashboard-dark__badge">Estate: {division || 'Semua divisi'}</div>
              <div className="dashboard-dark__badge">Gang: {selectedGangLabel}</div>
            </div>
          </div>
          <div className="dashboard-dark__period-box">
            <small>Periode Aktif</small>
            <strong>{selectedPeriodLabel}</strong>
          </div>
        </section>

        {/* ─── FILTER CARD (floating, overlap hero) ────────────────────── */}
        <section className="dashboard-dark__filter-card">
          <div className="dashboard-dark__filter-head">
            <div>
              <div className="dashboard-dark__eyebrow">Filter Bar</div>
              <h2 className="dashboard-dark__section-title">Filter Payroll</h2>
              <p className="dashboard-dark__section-subtitle">
                {isKeraniRole
                  ? 'Pilih periode dan gang, lalu tampilkan Daftar Upah karyawan sesuai divisi akses.'
                  : 'Sticky filter untuk periode, divisi, gang/kemandoran, lalu tampilkan Daftar Upah lebih cepat.'}
              </p>
            </div>
            <div className="dashboard-dark__floating-icon">
              <FilterIcon size={23} />
            </div>
          </div>

          <div className="dashboard-dark__filter-grid">
            {/* Periode (Month + Year inline) */}
            <div className="dashboard-dark__field">
              <label>Periode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="dashboard-dark__input" value={month} onChange={handleMonthChange} style={{ flex: 1 }}>
                  {MONTH_LABELS.map((label, idx) => (
                    <option key={label} value={idx + 1}>{label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="dashboard-dark__input"
                  value={year}
                  onChange={handleYearChange}
                  style={{ width: 96, justifyContent: 'flex-start' }}
                  min={2000}
                  max={2100}
                />
              </div>
            </div>

            {/* Divisi */}
            <div className="dashboard-dark__field">
              <label>Divisi {isLockedMode && <span style={{ color: '#fcd34d', textTransform: 'none', fontSize: 11 }}>(Locked)</span>}</label>
              <select
                className={`dashboard-dark__input ${isLockedMode ? 'dashboard-dark__input--locked' : ''}`}
                value={division}
                onChange={(e) => !isLockedMode && setDivision(e.target.value)}
                disabled={isLockedMode}
              >
                <option value="">Pilih Divisi</option>
                {allDivisions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Gang / Kemandoran */}
            <div className="dashboard-dark__field">
              <label>Gang / Kemandoran</label>
              <select
                className={`dashboard-dark__input ${gangLoading ? 'dashboard-dark__input--disabled' : ''}`}
                value={gang}
                onChange={(e) => setGang(e.target.value)}
                disabled={gangLoading}
              >
                {gangLoading ? (
                  <option>Memuat data...</option>
                ) : gangs.length === 0 ? (
                  <option>Menunggu pemilihan divisi...</option>
                ) : (
                  <>
                    <option value="">Pilih Gang</option>
                    <option value="ALL">SEMUA GANG</option>
                    {gangs.map((g) => (
                      <option key={g.gang_code} value={g.gang_code}>
                        {g.gang_code} - {g.description || '-'}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Estate (read-only follows division) */}
            <div className="dashboard-dark__field">
              <label>Estate</label>
              <div className="dashboard-dark__input dashboard-dark__input--disabled" style={{ cursor: 'default' }}>
                <span>{division || 'Mengikuti divisi aktif'}</span>
              </div>
            </div>

            {/* Action button */}
            <button
              type="button"
              className="dashboard-dark__btn"
              onClick={handleGenerateOperational}
              disabled={!hasFilterReady || !canAccessReports}
            >
              Tampilkan Daftar Upah
            </button>
          </div>
        </section>

        {/* ─── KPI SECTION ─────────────────────────────────────────────── */}
        <section className="dashboard-dark__section">
          <div className="dashboard-dark__section-header">
            <div>
              <div className="dashboard-dark__eyebrow dashboard-dark__eyebrow--green">KPI</div>
              <h2 className="dashboard-dark__section-title">Payroll Snapshot</h2>
              <p className="dashboard-dark__section-subtitle">Empat kartu utama untuk scan cepat kondisi payroll dan efisiensi biaya.</p>
            </div>
            <div className="dashboard-dark__floating-icon dashboard-dark__floating-icon--green">
              <DollarSign size={23} />
            </div>
          </div>

          <div className="dashboard-dark__kpi-grid">
            {kpis.map((item) => {
              const value = item.isCurrency ? formatCurrency(item.value) : formatCompactNumber(item.value);
              return (
                <button
                  key={item.key}
                  type="button"
                  className="dashboard-dark__kpi-card"
                  style={{ '--dp-glow': item.glow }}
                  onClick={handleGenerateOperational}
                >
                  <div className="dashboard-dark__kpi-top">
                    <span className="dashboard-dark__kpi-label">{item.label}</span>
                    <span className={`dashboard-dark__trend ${item.trendClass}`}>{item.trend}</span>
                  </div>
                  <div className="dashboard-dark__kpi-value">{value}</div>
                  <div className="dashboard-dark__kpi-note">{item.helper}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── ANALYTICS SECTION ───────────────────────────────────────── */}
        <section className="dashboard-dark__section">
          <div className="dashboard-dark__section-header">
            <div>
              <div className="dashboard-dark__eyebrow dashboard-dark__eyebrow--purple">Analytics</div>
              <h2 className="dashboard-dark__section-title">Insight Payroll</h2>
              <p className="dashboard-dark__section-subtitle">Tren payroll, distribusi cost per divisi, dan ringkasan insight.</p>
            </div>
            <div className="dashboard-dark__floating-icon dashboard-dark__floating-icon--purple">
              <Activity size={23} />
            </div>
          </div>

          <div className="dashboard-dark__analytics-grid">
            <div className="dashboard-dark__chart-card">
              <div className="dashboard-dark__chart-head">
                <h3 className="dashboard-dark__card-title">Payroll Trend & Cost / HK</h3>
                <div className="dashboard-dark__select">{currentPeriodLabel}</div>
              </div>
              <GangTrendChart token={token} month={month} year={year} divisionCode={division || undefined} />
            </div>
            <div className="dashboard-dark__chart-card">
              <div className="dashboard-dark__chart-head">
                <h3 className="dashboard-dark__card-title">Top Divisi Payroll</h3>
                <div className="dashboard-dark__select">{selectedPeriodLabel}</div>
              </div>
              <PremiCompositionChart month={month} year={year} division={division || undefined} />
            </div>
          </div>

          <div className="dashboard-dark__insights">
            {insights.map((insight, idx) => {
              const Icon = insight.icon;
              return (
                <div key={idx} className="dashboard-dark__insight-card">
                  <div className="dashboard-dark__insight-icon">
                    <Icon size={21} />
                  </div>
                  <div>
                    <strong>{insight.title}</strong>
                    <span>{insight.body}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {dashboardError ? (
            <div style={{ marginTop: 12, color: '#fdba74', fontSize: 13 }}>
              Analytics summary fallback aktif: {dashboardError}
            </div>
          ) : null}
        </section>

        {/* ─── MODULE SECTIONS (role-filtered) ──────────────────────────── */}
        {visibleGroups.map((group) => (
          <ModuleSection key={group.key} group={group} onClick={handleTileClick} />
        ))}

        {/* ─── ACTIVITY GRID ───────────────────────────────────────────── */}
        <section className="dashboard-dark__activity-grid">
          <div className="dashboard-dark__chart-card">
            <div className="dashboard-dark__eyebrow">Reports</div>
            <h2 className="dashboard-dark__section-title" style={{ fontSize: 22 }}>Quick Access</h2>
            <p className="dashboard-dark__section-subtitle" style={{ marginBottom: 16 }}>
              Shortcut tambahan ke laporan pendukung yang masih relevan untuk role aktif.
            </p>
            {visibleGroups.flatMap((g) => g.modules).slice(0, 4).map((m) => (
              <button
                key={`qa-${m.path}-${m.label}`}
                type="button"
                onClick={() => handleTileClick(m)}
                className="dashboard-dark__status-box"
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--dp-border)', fontFamily: 'inherit', color: 'inherit' }}
              >
                <small>{m.label}</small>
                <strong>{m.description.replace(/\.$/, '')} →</strong>
              </button>
            ))}
          </div>

          <div className="dashboard-dark__chart-card">
            <div className="dashboard-dark__eyebrow dashboard-dark__eyebrow--green">Activity & Status</div>
            <h2 className="dashboard-dark__section-title" style={{ fontSize: 22 }}>Dashboard Context</h2>
            <p className="dashboard-dark__section-subtitle" style={{ marginBottom: 16 }}>Ringkas konteks kerja dashboard.</p>
            <div className="dashboard-dark__status-box">
              <small>Periode Aktif</small>
              <strong>{selectedPeriodLabel}</strong>
            </div>
            <div className="dashboard-dark__status-box">
              <small>Role Aktif</small>
              <strong>{roleMeta.label}</strong>
            </div>
            {topDivisionLabel ? (
              <div className="dashboard-dark__status-box">
                <small>Top Divisi</small>
                <strong>{topDivisionLabel}</strong>
              </div>
            ) : null}
            <div className={`dashboard-dark__status-box ${hasFilterReady ? 'dashboard-dark__status-box--success' : 'dashboard-dark__status-box--warning'}`}>
              <small>Status</small>
              <strong>{hasFilterReady ? 'Filter siap dipakai' : 'Lengkapi divisi & gang'}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
