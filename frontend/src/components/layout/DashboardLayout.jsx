import React from 'react'
import { useAuth } from '../../context/AuthContext'
import '../../styles/theme.css'

export default function DashboardLayout({ children, title, subtitle, actions }) {
  const { user, logout } = useAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Header */}
      <header style={{
        height: '64px',
        background: 'white',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 10,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        {/* Brand / Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <style>
            {`
              @keyframes growPalmHeader {
                0% { transform: scaleY(0.85) scaleX(0.95) rotate(-2deg); }
                100% { transform: scaleY(1.05) scaleX(1) rotate(2deg); }
              }
              @keyframes swayLeavesHeader {
                0% { transform: rotate(-4deg); }
                100% { transform: rotate(4deg); }
              }
            `}
          </style>

          <div style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', // Light green background
            border: '1px solid #86efac',
            borderRadius: '10px',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 2px 5px rgba(34, 197, 94, 0.15)'
          }}
            title="Plantware Auto Report"
          >
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '36px', height: '36px', transformOrigin: 'bottom center', animation: 'growPalmHeader 2.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite alternate' }}>
              {/* Trunk */}
              <path d="M45 100 Q 50 50 50 20 Q 55 50 55 100 Z" fill="#8B4513" />
              <path d="M45 90 Q 50 85 55 90" stroke="#654321" strokeWidth="2" fill="none" />
              <path d="M46 70 Q 50 65 54 70" stroke="#654321" strokeWidth="2" fill="none" />
              <path d="M48 50 Q 50 45 52 50" stroke="#654321" strokeWidth="2" fill="none" />
              {/* Leaves Group */}
              <g style={{ animation: 'swayLeavesHeader 3.5s ease-in-out infinite alternate', transformOrigin: 'top center' }}>
                <path d="M50 25 Q 20 0 10 30 Q 30 20 50 25" fill="#22c55e" />
                <path d="M50 25 Q 30 -10 40 10 Q 45 5 50 25" fill="#16a34a" />
                <path d="M50 25 Q 70 -10 60 10 Q 55 5 50 25" fill="#15803d" />
                <path d="M50 25 Q 80 0 90 30 Q 70 20 50 25" fill="#16a34a" />
                <path d="M50 25 Q 20 20 15 50 Q 35 30 50 25" fill="#15803d" />
                <path d="M50 25 Q 80 20 85 50 Q 65 30 50 25" fill="#22c55e" />
              </g>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              {title || 'Payroll Dashboard'}
            </h1>
            {subtitle && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Center Actions (Filters) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'hidden', padding: '0 16px' }}>
          {actions}
        </div>

        {/* User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right', display: 'none', '@media (min-width: 768px)': { display: 'block' } }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{user?.full_name || user?.username}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.divisions?.[0] || 'Staff'}</div>
          </div>
          <div
            onClick={() => { if (confirm('Logout?')) logout() }}
            style={{
              width: '38px', height: '38px',
              borderRadius: '50%',
              background: 'var(--primary-50)',
              color: 'var(--primary-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '600',
              cursor: 'pointer',
              border: '1px solid var(--primary-200)',
              transition: 'all 0.2s'
            }}
            title="Click to Logout"
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--primary-100)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--primary-50)'}
          >
            {(user?.username || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        background: 'var(--bg-body)',
        overflow: 'hidden', // AG Grid handles scrolling
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {children}
      </main>
    </div>
  )
}
