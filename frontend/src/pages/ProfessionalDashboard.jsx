import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import { isProdMode, buildAppPath } from '../utils/prodModeUtils';
import { buildBackendUrl } from '../utils/apiBase';
import GangTrendChart from '../components/dashboard/GangTrendChart';
import PremiCompositionChart from '../components/dashboard/PremiCompositionChart';
import { ArrowRight } from 'lucide-react';

import '../styles/dashboard-dark-palm.css';
// Config (module registry, KPI blueprint, formatters, icon re-exports)
import {
  MONTH_LABELS, formatPeriodLabel, formatCompactNumber, formatCurrency,
  FilterIcon, DollarSign, Activity
} from './professionalDashboard.config';
// Pure helpers (role, module visibility, KPI build, insights, group/asistensi)
import {
  guessRole, getRoleMeta, getVisibleGroups, buildKpis, getInsights,
  getAsistensi, getAvailablePrefixes
} from './professionalDashboard.helpers';

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
    gangPrefix, setGangPrefix,
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
        const params = new URLSearchParams({ month: String(month), year: String(year) });
        if (division) params.set('division_code', division);
        if (gang && gang !== 'ALL') params.set('gang_code', gang);
        if (gangPrefix && gangPrefix !== 'ALL') params.set('gang_prefix', gangPrefix);
        const response = await fetch(buildBackendUrl(`/payroll/dashboard/executive-summary?${params.toString()}`), {
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
  }, [token, month, year, division, gang, gangPrefix]);

  const userRole = guessRole(user, isAdminUser);
  const roleMeta = getRoleMeta(userRole);
  const visibleGroups = getVisibleGroups(userRole);
  const kpis = buildKpis({ dashboardData, gangs, currentPeriod, division, gang });
  const hasFilterReady = Boolean(division && gang);
  const insights = getInsights(userRole, division, hasFilterReady);

  const currentPeriodLabel = currentPeriod ? formatPeriodLabel(currentPeriod.month, currentPeriod.year) : formatPeriodLabel(month, year);
  const selectedPeriodLabel = formatPeriodLabel(month, year);
  const selectedGangLabel = gang === 'ALL' ? 'SEMUA GANG' : (gang || 'Belum dipilih');

  // Group/Asistensi options derived from the gang list (helper shared with Daftar Upah)
  const availablePrefixes = useMemo(() => getAvailablePrefixes(gangs), [gangs]);
  // Reset gangPrefix when it's no longer valid for the current gang list
  useEffect(() => {
    if (gangPrefix && availablePrefixes.length > 0 && !availablePrefixes.includes(gangPrefix)) {
      setGangPrefix('');
    }
  }, [gangPrefix, availablePrefixes, setGangPrefix]);
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
        <section
          className="dashboard-dark__hero dashboard-dark__hero--banner"
          style={{
            backgroundImage: `linear-gradient(120deg, rgba(8,20,12,0.92) 0%, rgba(10,30,18,0.78) 55%, rgba(10,30,18,0.35) 100%), url('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQvJiYUwSzJH5sTusic2GfVszxQYpAl-eOy3A-_wF6MJAtgw9kbCnVeVy3Q&s=10')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center right'
          }}
        >
          <div>
            <h1 className="dashboard-dark__hero-title">Dashboard Payroll</h1>
            <p className="dashboard-dark__hero-subtitle">Sistem Manajemen Data Upah - PT Rebinmas Jaya</p>
            <div className="dashboard-dark__badge-row">
              <div className="dashboard-dark__badge">Role: {roleMeta.label}</div>
              <div className="dashboard-dark__badge">Estate: {division || 'Semua divisi'}</div>
              <div className="dashboard-dark__badge">Gang: {selectedGangLabel}</div>
              {gangPrefix && gangPrefix !== 'ALL' && <div className="dashboard-dark__badge">Group: {gangPrefix}</div>}
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

            {/* Group / Asistensi (like Daftar Upah) */}
            <div className="dashboard-dark__field">
              <label>Group / Asistensi</label>
              <select
                className={`dashboard-dark__input ${gangLoading ? 'dashboard-dark__input--disabled' : ''}`}
                value={gangPrefix || ''}
                onChange={(e) => setGangPrefix(e.target.value)}
                disabled={gangLoading || availablePrefixes.length === 0}
              >
                <option value="">Semua Group</option>
                {availablePrefixes.map((p) => (
                  <option key={p} value={p}>Group {p}</option>
                ))}
              </select>
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

        {/* ─── MODULE SECTIONS (role-filtered, primary access) ─────────── */}
        {visibleGroups.map((group) => (
          <ModuleSection key={group.key} group={group} onClick={handleTileClick} />
        ))}

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
