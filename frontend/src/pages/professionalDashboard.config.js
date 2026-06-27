/**
 * ProfessionalDashboard — config & registry
 *
 * Pure data + formatters. No React, no hooks. Easy to tweak labels, roles,
 * module routes, and KPI definitions without touching the component.
 */
import {
  Settings, BarChart2, ArrowRight, DollarSign, Calculator, FileText,
  TrendingUp, PieChart, ClipboardList, Building2, Leaf, Banknote, Receipt,
  Target, Activity, Database, Search, Filter as FilterIcon, Factory,
  ShieldCheck, Briefcase, Sparkles, CheckCircle2, AlertTriangle, LayoutGrid,
  Users, Clock, Printer, GitCompare, IdCard, TrendingDown, CircleDollarSign
} from 'lucide-react';

// ─── Module Registry ────────────────────────────────────────────────────────
export const MODULE_GROUPS = [
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
export const KPI_BLUEPRINT = [
  { key: 'totalUpah', label: 'Total Upah', glow: '#3b82f6', trendClass: '', isCurrency: true, trend: '+8%', comparison: 'vs bulan lalu' },
  { key: 'totalHk', label: 'Total HK', glow: '#22c55e', trendClass: '', isCurrency: false, trend: '+3%', comparison: 'produktivitas stabil' },
  { key: 'jumlahKaryawan', label: 'Jumlah Karyawan', glow: '#8b5cf6', trendClass: 'dashboard-dark__trend--neutral', isCurrency: false, trend: '±0%', comparison: 'headcount aktif' },
  { key: 'costPerHk', label: 'Cost / HK', glow: '#f97316', trendClass: 'dashboard-dark__trend--orange', isCurrency: true, trend: '+2%', comparison: 'efisiensi perlu review' }
];

// ─── Shared formatters ──────────────────────────────────────────────────────
export const MONTH_LABELS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const formatPeriodLabel = (month, year) => (!month || !year ? 'Periode belum dipilih' : `${MONTH_LABELS[month - 1]} ${year}`);
export const formatCompactNumber = (value) => (Number.isFinite(value) ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value) : '—');
export const formatCurrency = (value) => (Number.isFinite(value) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value) : '—');

// Re-export icons the component still needs for JSX (header/insights/etc.)
// NOTE: `Filter` is imported above aliased as `FilterIcon`, so re-export uses
// the local (aliased) binding name.
export {
  Settings, BarChart2, ArrowRight, DollarSign, Calculator, FileText,
  TrendingUp, PieChart, ClipboardList, Building2, Leaf, Banknote, Receipt,
  Target, Activity, Database, Search, FilterIcon, Factory,
  ShieldCheck, Briefcase, Sparkles, CheckCircle2, AlertTriangle, LayoutGrid,
  Users, Clock, Printer, GitCompare, IdCard, TrendingDown, CircleDollarSign
};
