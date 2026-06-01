import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import MonthSelector from '../components/common/MonthSelector';
import { isProdMode } from '../utils/prodModeUtils';
import { buildBackendUrl } from '../utils/apiBase';
import GangTrendChart from '../components/dashboard/GangTrendChart';
import PremiCompositionChart from '../components/dashboard/PremiCompositionChart';
import {
  Settings,
  Info,
  BarChart2,
  ArrowRight,
  DollarSign,
  Calculator,
  FileText,
  TrendingUp,
  PieChart,
  ClipboardList,
  Calendar,
  Building2,
  Leaf,
  Banknote,
  Receipt,
  Target,
  Activity,
  Database,
  Search,
  Download,
  Home,
  Filter,
  Factory,
  ShieldCheck,
  Briefcase,
  Bell,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid
} from 'lucide-react';

const TOKENS = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#475569',
  textSoft: '#64748b',
  navy: '#0f172a',
  blue: '#2563eb',
  blueSoft: '#dbeafe',
  green: '#16a34a',
  greenSoft: '#dcfce7',
  purple: '#7c3aed',
  purpleSoft: '#ede9fe',
  orange: '#ea580c',
  orangeSoft: '#ffedd5',
  shadow: '0 20px 40px rgba(15, 23, 42, 0.06)',
  radiusLg: '20px',
  radiusMd: '16px',
  radiusSm: '12px'
};

const MODULE_GROUPS = [
  {
    key: 'operational',
    title: 'Operational',
    description: 'Akses cepat laporan operasional dan output inti payroll.',
    icon: ClipboardList,
    color: TOKENS.blue,
    accent: TOKENS.blueSoft,
    modules: [
      { path: '/operational', label: 'Daftar Upah', description: 'Filter upah operasional utama', icon: FileText, roles: ['payroll_admin', 'estate_manager', 'finance', 'executive'], featured: true },
      { path: '/summary', label: 'Summary Report', description: 'Ringkasan upah dan rekap utama', icon: BarChart2, roles: ['payroll_admin', 'estate_manager', 'finance', 'executive'] },
      { path: '/wages-ijl', label: 'Upah IJL', description: 'Laporan upah tenaga IJL', icon: Leaf, roles: ['payroll_admin', 'finance'] },
      { path: '/wages-rebinmas', label: 'Daftar Upah Rebinmas', description: 'Laporan payroll Rebinmas', icon: Building2, roles: ['payroll_admin', 'finance'] }
    ]
  },
  {
    key: 'analysis',
    title: 'Analysis',
    description: 'Insight produktivitas, dampak, dan perbandingan payroll.',
    icon: TrendingUp,
    color: TOKENS.purple,
    accent: TOKENS.purpleSoft,
    modules: [
      { path: '/productivity', label: 'Produktivitas', description: 'Tonase, HK, dan biaya per performa', icon: TrendingUp, roles: ['estate_manager', 'executive'] },
      { path: '/wages-comparison', label: 'Comparison', description: 'Perbandingan payroll antar periode', icon: Activity, roles: ['estate_manager', 'finance', 'executive'] },
      { path: '/impact', label: 'Impact Report', description: 'Analisis dampak biaya dan perubahan', icon: Target, roles: ['estate_manager', 'executive'] },
      { path: '/comprehensive', label: 'Comprehensive Analysis', description: 'Analisis payroll lintas komponen', icon: PieChart, roles: ['estate_manager', 'finance', 'executive'] },
      { path: '/mill-production', label: 'Produktivitas Kebun', description: 'Tonase FFB, HK, dan biaya kebun', icon: Factory, roles: ['estate_manager', 'executive'] }
    ]
  },
  {
    key: 'finance',
    title: 'Finance',
    description: 'Monitoring payroll finansial dan rincian kompensasi.',
    icon: DollarSign,
    color: TOKENS.green,
    accent: TOKENS.greenSoft,
    modules: [
      { path: '/executive', label: 'Executive Payroll', description: 'Ringkasan high-level biaya payroll', icon: DollarSign, roles: ['finance', 'executive'], featured: true },
      { path: '/detailed-salary', label: 'Detail Gaji', description: 'Rincian gaji, lembur, dan komponen', icon: Receipt, roles: ['finance'] },
      { path: '/detail-upah-bersih', label: 'Upah Bersih', description: 'Detail payroll bersih per filter', icon: Banknote, roles: ['finance'] },
      { path: '/pendapatan-tidak-tetap', label: 'Pendapatan Tidak Tetap', description: 'Komponen pendapatan non-rutin', icon: Calculator, roles: ['finance'] },
      { path: '/report-pajak', label: 'Report Pajak', description: 'Unduh dan audit laporan pajak', icon: Calculator, roles: ['finance', 'payroll_admin'] }
    ]
  },
  {
    key: 'verification',
    title: 'Verification',
    description: 'Validasi data, seeding, dan area koreksi operasional.',
    icon: ShieldCheck,
    color: TOKENS.orange,
    accent: TOKENS.orangeSoft,
    modules: [
      { path: '/data-verification', label: 'Verifikasi Data', description: 'Verifikasi konsistensi data payroll', icon: Search, roles: ['payroll_admin'] },
      { path: '/seed', label: 'Seeder', description: 'Re-aggregation data manual', icon: Database, roles: ['payroll_admin'] }
    ]
  }
];

const KPI_BLUEPRINT = [
  { key: 'totalUpah', label: 'Total Upah', accent: TOKENS.blue, accentSoft: TOKENS.blueSoft, trend: '+8%', comparison: 'vs bulan lalu' },
  { key: 'totalHk', label: 'Total HK', accent: TOKENS.green, accentSoft: TOKENS.greenSoft, trend: '+3%', comparison: 'produktivitas stabil' },
  { key: 'jumlahKaryawan', label: 'Jumlah Karyawan', accent: TOKENS.purple, accentSoft: TOKENS.purpleSoft, trend: '±0%', comparison: 'headcount aktif' },
  { key: 'costPerHk', label: 'Cost / HK', accent: TOKENS.orange, accentSoft: TOKENS.orangeSoft, trend: '+2%', comparison: 'efisiensi perlu review' }
];

const formatPeriodLabel = (month, year) => (!month || !year ? 'Periode belum dipilih' : new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' }));
const formatCompactNumber = (value) => (Number.isFinite(value) ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value) : '—');
const formatCurrency = (value) => (Number.isFinite(value) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value) : '—');

function guessRole(user, isAdminUser) {
  const rawRole = String(user?.role || '').toLowerCase();
  const username = String(user?.username || '').toLowerCase();
  if (isAdminUser || rawRole === 'admin' || rawRole === 'kerani' || username.includes('kerani')) return 'payroll_admin';
  if (rawRole.includes('finance') || rawRole.includes('akunting') || username.includes('finance')) return 'finance';
  if (rawRole.includes('director') || rawRole.includes('direktur') || rawRole.includes('executive')) return 'executive';
  if (rawRole.includes('manager') || rawRole.includes('estate') || username.includes('manager')) return 'estate_manager';
  return 'payroll_admin';
}

function getRoleMeta(role) {
  const map = {
    payroll_admin: { label: 'Payroll Admin', description: 'Operasional, validasi, koreksi', color: TOKENS.blue, icon: ShieldCheck },
    estate_manager: { label: 'Estate Manager', description: 'Monitoring produktivitas dan biaya', color: TOKENS.purple, icon: Briefcase },
    finance: { label: 'Finance', description: 'Monitoring biaya payroll dan kompensasi', color: TOKENS.green, icon: DollarSign },
    executive: { label: 'Director / Executive', description: 'Insight high-level dan risk summary', color: TOKENS.orange, icon: Sparkles }
  };
  return map[role] || map.payroll_admin;
}

const getVisibleGroups = (role) => MODULE_GROUPS.map((group) => ({ ...group, modules: group.modules.filter((module) => module.roles.includes(role)) })).filter((group) => group.modules.length > 0);

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
  return KPI_BLUEPRINT.map((item) => ({ ...item, value: values[item.key], helper: currentPeriod ? `${division || 'Semua divisi'}${gang ? ` • ${gang}` : ''}` : 'Pilih filter untuk nilai aktual', ready: Boolean(values[item.key]) }));
}


const getInsights = (role, division) => {
  const common = [`${division || 'Divisi aktif'} payroll naik 8% dibanding bulan lalu.`, 'Biaya tertinggi terkonsentrasi pada divisi operasional besar.', 'Filter sticky siap dipakai untuk drilldown cepat.'];
  if (role === 'payroll_admin') return ['Validasi dan seeder perlu akses cepat.', 'Menu koreksi harus tetap paling terlihat.', ...common];
  if (role === 'finance') return ['Executive payroll dan pendapatan tidak tetap jadi fokus utama.', ...common];
  if (role === 'executive') return ['Fokus pada KPI, tren, dan top risk tanpa menu operasional detail.', ...common];
  return ['Produktivitas dan impact report perlu menonjol.', ...common];
};

const cardStyle = (extra = {}) => ({ backgroundColor: TOKENS.surface, border: `1px solid ${TOKENS.border}`, borderRadius: TOKENS.radiusLg, boxShadow: TOKENS.shadow, ...extra });
const baseControlStyle = (disabled) => ({ width: '100%', height: '46px', padding: '0 0.9rem', borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.border}`, backgroundColor: disabled ? TOKENS.surfaceAlt : TOKENS.surface, fontSize: '0.92rem', color: TOKENS.text, outline: 'none', boxSizing: 'border-box' });

function SectionTitle({ eyebrow, title, description, icon: Icon, accent = TOKENS.blue }) {
  return <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}><div>{eyebrow ? <div style={{ fontSize: '0.78rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{eyebrow}</div> : null}<h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: TOKENS.text }}>{title}</h2>{description ? <p style={{ margin: '0.5rem 0 0', color: TOKENS.textSoft, fontSize: '0.95rem', maxWidth: '60ch', lineHeight: 1.6 }}>{description}</p> : null}</div>{Icon ? <div style={{ width: '46px', height: '46px', borderRadius: '14px', backgroundColor: `${accent}14`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={22} /></div> : null}</div>;
}

function HeaderStat({ label, value }) { return <div style={{ padding: '0.85rem 1rem', borderRadius: TOKENS.radiusSm, backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', minWidth: '140px' }}><div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div><div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 700 }}>{value}</div></div>; }
function FilterField({ label, children }) { return <div style={{ minWidth: 0 }}><label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: TOKENS.textSoft, marginBottom: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>{children}</div>; }
function KpiCard({ item, onClick }) { const value = item.key === 'totalUpah' || item.key === 'costPerHk' ? formatCurrency(item.value) : formatCompactNumber(item.value); return <button onClick={onClick} style={{ ...cardStyle({ padding: '1.15rem 1.2rem', textAlign: 'left', cursor: 'pointer', width: '100%' }), borderColor: item.accentSoft, background: `linear-gradient(180deg, ${TOKENS.surface} 0%, ${item.accentSoft} 160%)` }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}><div><div style={{ fontSize: '0.8rem', color: TOKENS.textSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div><div style={{ fontSize: '1.6rem', color: TOKENS.text, fontWeight: 800, marginTop: '0.45rem' }}>{value}</div></div><div style={{ padding: '0.35rem 0.55rem', borderRadius: '999px', backgroundColor: item.accentSoft, color: item.accent, fontWeight: 700, fontSize: '0.8rem' }}>{item.trend}</div></div><div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}><div><div style={{ fontSize: '0.85rem', color: TOKENS.textMuted }}>{item.comparison}</div><div style={{ fontSize: '0.78rem', color: TOKENS.textSoft, marginTop: '0.2rem' }}>{item.helper}</div></div><ArrowRight size={16} color={item.accent} /></div>{!item.ready ? <div style={{ marginTop: '0.85rem', fontSize: '0.78rem', color: TOKENS.orange, fontWeight: 600 }}>Placeholder aktif sampai filter lengkap.</div> : null}</button>; }
function AnalyticsCard({ card, periodLabel }) { return <div style={cardStyle({ padding: '1.1rem 1.1rem 1rem' })}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.9rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: card.tone, color: card.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><card.icon size={19} /></div><div><div style={{ fontWeight: 700, color: TOKENS.text }}>{card.title}</div><div style={{ fontSize: '0.82rem', color: TOKENS.textSoft }}>{periodLabel}</div></div></div><span style={{ fontSize: '0.78rem', fontWeight: 700, color: card.accent }}>Preview</span></div><div style={{ height: '140px', borderRadius: TOKENS.radiusSm, border: `1px dashed ${card.accent}`, background: `linear-gradient(180deg, ${card.tone} 0%, rgba(255,255,255,0.9) 100%)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1rem' }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', alignItems: 'end', gap: '0.35rem', height: '70px' }}>{[34, 46, 42, 64, 59, 70, 55, 78].map((height, index) => <div key={index} style={{ height: `${height}px`, borderRadius: '999px 999px 6px 6px', backgroundColor: index % 2 === 0 ? `${card.accent}cc` : `${card.accent}66` }} />)}</div><div style={{ marginTop: '0.85rem', fontSize: '0.84rem', color: TOKENS.textMuted, lineHeight: 1.5 }}>{card.description}</div></div></div>; }
function InsightWidget({ insights }) { return <div style={cardStyle({ padding: '1.15rem' })}><div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.9rem' }}><div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: TOKENS.purpleSoft, color: TOKENS.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={19} /></div><div><div style={{ fontWeight: 700, color: TOKENS.text }}>Quick Insight</div><div style={{ fontSize: '0.82rem', color: TOKENS.textSoft }}>Ringkas fokus payroll paling penting</div></div></div><div style={{ display: 'grid', gap: '0.75rem' }}>{insights.map((insight, index) => <div key={index} style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', padding: '0.85rem', borderRadius: TOKENS.radiusSm, backgroundColor: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}` }}><CheckCircle2 size={18} color={TOKENS.purple} style={{ marginTop: '2px', flexShrink: 0 }} /><span style={{ color: TOKENS.textMuted, lineHeight: 1.5, fontSize: '0.9rem' }}>{insight}</span></div>)}</div></div>; }
function ModuleCard({ module, accent, onClick }) { return <button onClick={() => onClick(module.path)} style={{ ...cardStyle({ padding: '1rem', width: '100%', textAlign: 'left', cursor: 'pointer', minHeight: '168px' }), display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><div><div style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: `${accent}14`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.95rem' }}><module.icon size={20} /></div><div style={{ fontSize: '1rem', fontWeight: 700, color: TOKENS.text }}>{module.label}</div><div style={{ marginTop: '0.5rem', fontSize: '0.88rem', color: TOKENS.textMuted, lineHeight: 1.55 }}>{module.description}</div></div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}><span style={{ fontSize: '0.82rem', fontWeight: 700, color: accent }}>{module.featured ? 'Primary action' : 'Open module'}</span><ArrowRight size={16} color={accent} /></div></button>; }
function GroupSection({ group, onClick }) { return <section style={cardStyle({ padding: '1.25rem' })}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}><div><div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}><div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: group.accent, color: group.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><group.icon size={19} /></div><h3 style={{ margin: 0, fontSize: '1.08rem', color: TOKENS.text }}>{group.title}</h3></div><p style={{ margin: '0.55rem 0 0', fontSize: '0.88rem', color: TOKENS.textSoft, lineHeight: 1.5 }}>{group.description}</p></div><span style={{ fontSize: '0.8rem', color: group.color, fontWeight: 700 }}>{group.modules.length} module</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>{group.modules.map((module) => <ModuleCard key={module.path} module={module} accent={group.color} onClick={onClick} />)}</div></section>; }
function StatusCard({ currentPeriodLabel, roleMeta, hasFilterReady }) { return <div style={cardStyle({ padding: '1.15rem' })}><div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}><div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: TOKENS.greenSoft, color: TOKENS.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={18} /></div><div><div style={{ fontWeight: 700, color: TOKENS.text }}>Activity & Status</div><div style={{ fontSize: '0.82rem', color: TOKENS.textSoft }}>Ringkas konteks kerja dashboard</div></div></div><div style={{ display: 'grid', gap: '0.75rem' }}><div style={{ padding: '0.9rem', borderRadius: TOKENS.radiusSm, backgroundColor: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}` }}><div style={{ fontSize: '0.78rem', color: TOKENS.textSoft, textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>Periode aktif</div><div style={{ fontWeight: 700, color: TOKENS.text }}>{currentPeriodLabel}</div></div><div style={{ padding: '0.9rem', borderRadius: TOKENS.radiusSm, backgroundColor: TOKENS.surfaceAlt, border: `1px solid ${TOKENS.border}` }}><div style={{ fontSize: '0.78rem', color: TOKENS.textSoft, textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.35rem' }}>Role aktif</div><div style={{ fontWeight: 700, color: TOKENS.text }}>{roleMeta.label}</div><div style={{ marginTop: '0.3rem', fontSize: '0.84rem', color: TOKENS.textMuted }}>{roleMeta.description}</div></div><div style={{ padding: '0.9rem', borderRadius: TOKENS.radiusSm, backgroundColor: hasFilterReady ? TOKENS.greenSoft : TOKENS.orangeSoft, border: `1px solid ${hasFilterReady ? '#bbf7d0' : '#fed7aa'}` }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: hasFilterReady ? TOKENS.green : TOKENS.orange }}>{hasFilterReady ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{hasFilterReady ? 'Filter siap dipakai' : 'Lengkapi divisi dan gang'}</div><div style={{ marginTop: '0.35rem', fontSize: '0.84rem', color: TOKENS.textMuted }}>Generate dan drilldown akan lebih akurat saat filter lengkap.</div></div></div></div>; }

export default function ProfessionalDashboard() {
  const { user, token } = useAuth();
  const { month, setMonth, year, setYear, division, setDivision, gang, setGang, gangs, allDivisions, gangLoading, isLockedMode, isAdminUser, currentPeriod } = useReport();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadDashboardSummary() {
      if (!token || !month || !year) return;
      setDashboardError('');
      try {
        const response = await fetch(buildBackendUrl('/payroll/dashboard/executive-summary?month=' + month + '&year=' + year), {
          headers: { Authorization: 'Bearer ' + token }
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
  const analyticsSummaryCards = useMemo(() => {
    const breakdown = Array.isArray(dashboardData?.breakdown) ? dashboardData.breakdown : [];
    const efficiency = Array.isArray(dashboardData?.efficiency) ? dashboardData.efficiency : [];
    const productivityTrend = Array.isArray(dashboardData?.productivityTrend) ? dashboardData.productivityTrend : [];
    const topDivision = breakdown.slice().sort((a, b) => (Number(b?.total_wage) || 0) - (Number(a?.total_wage) || 0))[0];
    const topEfficiency = efficiency.slice().sort((a, b) => {
      const aCost = (Number(a?.headcount) || 0) > 0 ? (Number(a?.total_cost) || 0) / Number(a.headcount) : 0;
      const bCost = (Number(b?.headcount) || 0) > 0 ? (Number(b?.total_cost) || 0) / Number(b.headcount) : 0;
      return bCost - aCost;
    })[0];
    const latestProductivity = productivityTrend[productivityTrend.length - 1];
    return [
      {
        title: 'Top Divisi Payroll',
        value: topDivision?.division_code || '—',
        description: topDivision ? formatCurrency(Number(topDivision.total_wage) || 0) : 'Belum ada data breakdown payroll',
        accent: TOKENS.purple,
        tone: TOKENS.purpleSoft,
        icon: PieChart
      },
      {
        title: 'Productivity vs Cost',
        value: latestProductivity?.period_label || latestProductivity?.label || '—',
        description: topEfficiency ? ('Cost/head tertinggi ' + topEfficiency.division_code + ': ' + formatCurrency((Number(topEfficiency.total_cost) || 0) / Math.max(1, Number(topEfficiency.headcount) || 1))) : 'Belum ada data efisiensi',
        accent: TOKENS.orange,
        tone: TOKENS.orangeSoft,
        icon: Activity
      }
    ];
  }, [dashboardData]);
  const insights = getInsights(userRole, division);
  const currentPeriodLabel = currentPeriod ? formatPeriodLabel(currentPeriod.month, currentPeriod.year) : formatPeriodLabel(month, year);
  const selectedGangLabel = gang === 'ALL' ? 'SEMUA GANG' : (gang || 'Belum dipilih');
  const canSeeReportPajak = userRole === 'finance' || userRole === 'payroll_admin';
  const canAccessReports = isAdminUser || !isProdMode();
  const hasFilterReady = Boolean(division && gang);
  const handleGenerateOperational = () => { if (hasFilterReady) navigate('/operational'); };
  const handleGenerateReportPajak = () => { if (hasFilterReady) navigate('/report-pajak'); };
  const handleTileClick = (path) => navigate(path);

  return (
    <div style={{ minHeight: '100%', background: `linear-gradient(180deg, ${TOKENS.bg} 0%, #eef2ff 100%)`, color: TOKENS.text }}>
      <div style={{ background: `linear-gradient(135deg, ${TOKENS.navy} 0%, #1e3a8a 62%, ${TOKENS.blue} 100%)`, color: '#fff', padding: '2rem clamp(1rem, 2vw, 2rem)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}><Home size={15} /><span>Dashboard</span><ChevronRight size={15} /><span>Daftar Upah</span><ChevronRight size={15} /><span style={{ color: '#fff' }}>{roleMeta.label}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: '720px' }}><div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.14)', marginBottom: '1rem', fontWeight: 700, fontSize: '0.82rem' }}><roleMeta.icon size={15} />{roleMeta.label}</div><h1 style={{ margin: 0, fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.05, fontWeight: 800 }}>Dashboard Daftar Upah</h1><p style={{ margin: '1rem 0 0', fontSize: '1rem', color: '#dbeafe', lineHeight: 1.7, maxWidth: '64ch' }}>Modern enterprise dashboard untuk payroll monitoring, akses laporan cepat, dan insight visual berbasis role.</p></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', minWidth: 'min(100%, 430px)' }}><HeaderStat label="Periode" value={currentPeriodLabel} /><HeaderStat label="Divisi" value={division || 'Semua divisi'} /><HeaderStat label="Gang" value={selectedGangLabel} /></div>
          </div>
        </div>
      </div>
      <div style={{ padding: '1.5rem clamp(1rem, 2vw, 2rem) 2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
          <section style={{ ...cardStyle({ padding: '1.25rem', position: 'sticky', top: 0, zIndex: 10 }), backdropFilter: 'blur(10px)' }}>
            <SectionTitle eyebrow="Filter Bar" title="Filter Payroll" description="Sticky filter untuk periode, divisi, gang/kemandoran, dan generate report lebih cepat." icon={Filter} accent={TOKENS.blue} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', alignItems: 'end' }}>
              <FilterField label="Periode"><div style={{ ...baseControlStyle(false), display: 'flex', alignItems: 'center', gap: '0.65rem' }}><Calendar size={16} color={TOKENS.textSoft} /><MonthSelector month={month} setMonth={setMonth} year={year} setYear={setYear} compact /></div></FilterField>
              <FilterField label="Divisi"><select value={division} onChange={(e) => setDivision(e.target.value)} disabled={isLockedMode} style={baseControlStyle(isLockedMode)}><option value="">Pilih Divisi</option>{allDivisions.map((d) => <option key={d} value={d}>{d}</option>)}</select></FilterField>
              <FilterField label="Gang / Kemandoran"><select value={gang} onChange={(e) => setGang(e.target.value)} disabled={gangLoading} style={baseControlStyle(gangLoading)}>{gangLoading ? <option>Memuat...</option> : <><option value="">Pilih Gang</option><option value="ALL">SEMUA GANG</option>{gangs.map((item) => <option key={item.gang_code} value={item.gang_code}>{item.gang_code} - {item.description || '-'}</option>)}</>}</select></FilterField>
              <FilterField label="Estate"><div style={{ ...baseControlStyle(true), display: 'flex', alignItems: 'center', gap: '0.65rem' }}><Building2 size={16} color={TOKENS.textSoft} /><span>{division || 'Mengikuti divisi aktif'}</span></div></FilterField>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}><button onClick={handleGenerateOperational} disabled={!hasFilterReady || !canAccessReports} style={{ height: '46px', padding: '0 1rem', borderRadius: TOKENS.radiusSm, border: 'none', backgroundColor: !hasFilterReady || !canAccessReports ? TOKENS.border : TOKENS.blue, color: '#fff', fontWeight: 700, cursor: !hasFilterReady || !canAccessReports ? 'not-allowed' : 'pointer', minWidth: '140px' }}>Generate</button>{canSeeReportPajak ? <button onClick={handleGenerateReportPajak} disabled={!hasFilterReady} style={{ height: '46px', padding: '0 1rem', borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.borderStrong}`, backgroundColor: TOKENS.surface, color: TOKENS.text, fontWeight: 700, cursor: !hasFilterReady ? 'not-allowed' : 'pointer', minWidth: '120px' }}>Pajak</button> : null}</div>
            </div>
          </section>
          <section><SectionTitle eyebrow="KPI" title="Payroll Snapshot" description="Empat kartu utama untuk scan cepat kondisi payroll dan efisiensi biaya." icon={DollarSign} accent={TOKENS.green} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>{kpis.map((item) => <KpiCard key={item.key} item={item} onClick={handleGenerateOperational} />)}</div></section>
          <section><SectionTitle eyebrow="Analytics" title="Insight Payroll" description="Visual area untuk tren payroll, cost per HK, distribusi biaya, dan hubungan produktivitas dengan cost." icon={Activity} accent={TOKENS.purple} /><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '1rem' }}><div style={{ display: 'grid', gap: '1rem' }}><div style={cardStyle({ padding: '1rem' })}><div style={{ marginBottom: '0.85rem', fontWeight: 700, color: TOKENS.text }}>Payroll Trend & Cost / HK</div><GangTrendChart token={token} month={month} year={year} divisionCode={division || undefined} /></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}><div style={cardStyle({ padding: '1rem' })}><div style={{ marginBottom: '0.85rem', fontWeight: 700, color: TOKENS.text }}>Top Divisi Payroll</div><PremiCompositionChart month={month} year={year} division={division || undefined} /></div>{analyticsSummaryCards.map((card) => <AnalyticsCard key={card.title} card={card} periodLabel={currentPeriodLabel} />)}</div></div><InsightWidget insights={insights} /></div>{dashboardError ? <div style={{ marginTop: '0.85rem', fontSize: '0.84rem', color: TOKENS.orange }}>Analytics summary fallback aktif: {dashboardError}</div> : null}</section>
          <section><SectionTitle eyebrow="Modules" title="Role Specific Modules" description="Bento modules dirancang untuk akses cepat sesuai kebutuhan role aktif." icon={LayoutGrid} accent={TOKENS.orange} /><div style={{ display: 'grid', gap: '1rem' }}>{visibleGroups.map((group) => <GroupSection key={group.key} group={group} onClick={handleTileClick} />)}</div></section>
          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)', gap: '1rem' }}><div style={cardStyle({ padding: '1.15rem' })}><SectionTitle eyebrow="Reports" title="Quick Access" description="Shortcut tambahan ke laporan pendukung yang masih relevan untuk role aktif." icon={Download} accent={TOKENS.blue} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>{visibleGroups.flatMap((group) => group.modules).slice(0, 6).map((module) => <button key={module.path} onClick={() => handleTileClick(module.path)} style={{ textAlign: 'left', padding: '0.95rem 1rem', borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.border}`, backgroundColor: TOKENS.surfaceAlt, color: TOKENS.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}><span><span style={{ display: 'block', fontWeight: 700 }}>{module.label}</span><span style={{ display: 'block', fontSize: '0.82rem', color: TOKENS.textSoft, marginTop: '0.25rem' }}>{module.description}</span></span><ArrowRight size={16} color={TOKENS.blue} /></button>)}</div></div><StatusCard currentPeriodLabel={currentPeriodLabel} roleMeta={roleMeta} hasFilterReady={hasFilterReady} /></section>
          <section style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem 1.1rem', borderRadius: TOKENS.radiusMd, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}><Info size={18} color={TOKENS.blue} style={{ flexShrink: 0, marginTop: '2px' }} /><div><div style={{ fontWeight: 700, color: TOKENS.text }}>Catatan implementasi</div><div style={{ marginTop: '0.35rem', fontSize: '0.9rem', color: TOKENS.textMuted, lineHeight: 1.6 }}>Dashboard baru sudah role-aware dan siap dipoles dengan data KPI/analytics aktual saat endpoint final siap. Route inti tetap dipertahankan agar transisi aman.</div></div></section>
        </div>
      </div>
    </div>
  );
}








