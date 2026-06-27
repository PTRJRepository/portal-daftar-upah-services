/**
 * ProfessionalDashboard — pure helpers
 *
 * Role derivation, module visibility, KPI building, insights, and the
 * Group/Asistensi derivation shared with Daftar Upah. No React/hooks so it
 * stays trivially testable and tweakable.
 */
import {
  CheckCircle2, AlertTriangle, TrendingUp, DollarSign,
  FileText, Banknote, Target
} from 'lucide-react';
import { MODULE_GROUPS, KPI_BLUEPRINT } from './professionalDashboard.config';

// ─── Role helpers ───────────────────────────────────────────────────────────
export function guessRole(user, isAdminUser) {
  const rawRole = String(user?.role || '').toLowerCase();
  const username = String(user?.username || '').toLowerCase();
  if (rawRole === 'kerani' || username.includes('kerani')) return 'kerani';
  if (isAdminUser || rawRole === 'admin') return 'payroll_admin';
  if (rawRole.includes('finance') || rawRole.includes('akunting') || username.includes('finance')) return 'finance';
  if (rawRole.includes('director') || rawRole.includes('direktur') || rawRole.includes('executive')) return 'executive';
  if (rawRole.includes('manager') || rawRole.includes('estate') || username.includes('manager')) return 'estate_manager';
  return 'payroll_admin';
}

export function getRoleMeta(role) {
  const map = {
    payroll_admin: { label: 'Payroll Admin', description: 'Operasional, validasi, koreksi' },
    kerani: { label: 'Kerani', description: 'Akses daftar upah sesuai divisi terkunci' },
    estate_manager: { label: 'Estate Manager', description: 'Monitoring produktivitas dan biaya' },
    finance: { label: 'Finance', description: 'Monitoring biaya payroll dan kompensasi' },
    executive: { label: 'Director / Executive', description: 'Insight high-level dan risk summary' }
  };
  return map[role] || map.payroll_admin;
}

export const getVisibleGroups = (role) => MODULE_GROUPS
  .map((group) => ({ ...group, modules: group.modules.filter((module) => module.roles.includes(role)) }))
  .filter((group) => group.modules.length > 0);

// ─── KPI builder ────────────────────────────────────────────────────────────
export function buildKpis({ dashboardData, gangs, currentPeriod, division, gang }) {
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

// ─── Insights ───────────────────────────────────────────────────────────────
export const getInsights = (role, division, hasFilterReady) => {
  const insights = [
    {
      icon: hasFilterReady ? CheckCircle2 : AlertTriangle,
      title: hasFilterReady ? 'Validasi siap' : 'Lengkapi filter',
      body: hasFilterReady ? 'Filter lengkap, data dapat dibuka.' : 'Pilih divisi dan gang untuk membuka data.'
    },
    { icon: TrendingUp, title: 'Total upah naik', body: 'Naik 8% dari periode sebelumnya.' },
    { icon: DollarSign, title: 'Cost / HK review', body: 'Ada kenaikan 2% bulan ini.' }
  ];
  if (role === 'kerani') {
    insights.push({ icon: FileText, title: 'Akses Daftar Upah', body: 'Cek HK, premi, lembur, dan upah bersih.' });
  } else if (role === 'finance') {
    insights.push({ icon: Banknote, title: 'Executive Payroll', body: 'Monitor cost trend & tunjangan.' });
  } else {
    insights.push({ icon: Target, title: 'Divisi dominan', body: 'Kontribusi payroll terbesar.' });
  }
  return insights;
};

// ─── Group / Asistensi derivation (matches Daftar Upah logic) ───────────────
// Rule: any gang starting with K2 belongs to Group 1, otherwise extract the
// leading numeric run of the gang code.
export function getAsistensi(code) {
  if (!code) return null;
  const gc = String(code).trim().toUpperCase();
  if (gc.startsWith('K2')) return '1';
  const m = gc.match(/\d+/);
  return m ? m[0] : null;
}

export function getAvailablePrefixes(gangs) {
  if (!Array.isArray(gangs) || gangs.length === 0) return [];
  const set = new Set();
  gangs.forEach((g) => { const a = getAsistensi(g.gang_code); if (a) set.add(a); });
  return Array.from(set).sort((a, b) => Number(a) - Number(b));
}
