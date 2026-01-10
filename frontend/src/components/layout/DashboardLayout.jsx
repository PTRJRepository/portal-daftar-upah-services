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
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', // Green gradient
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: '20px',
            boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)'
          }}>
            R
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
