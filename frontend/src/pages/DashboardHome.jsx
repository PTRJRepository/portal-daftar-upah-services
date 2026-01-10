import React, { useState, useEffect, useMemo } from 'react'
import { fetchGangs, fetchDivisions } from '../services/gangService'
import MonthPicker from '../components/common/MonthPicker'
import DivisionTabs from '../components/common/DivisionTabs'
import GangCardGrid from '../components/common/GangCardGrid'
import '../styles/dashboard-modern.css'
import '../styles/theme.css'

export default function DashboardHome({ user, token, onGenerateReport }) {
  const [monthInput, setMonthInput] = useState('')
  const [division, setDivision] = useState('')
  const [divisions, setDivisions] = useState([])
  const [gang, setGang] = useState('')
  const [gangs, setGangs] = useState([])
  const [gangLoading, setGangLoading] = useState(false)
  const [divisionsLoading, setDivisionsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Initialize defaults
  useEffect(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setMonthInput(currentMonth)

    // Prioritize 'divisi' from user object or localStorage as requested
    let initialDivision = ''

    // Check prop user
    if (user?.divisi) {
      initialDivision = user.divisi
    } else if (user?.divisions?.length > 0) {
      initialDivision = user.divisions[0]
    }

    // Fallback to localStorage
    if (!initialDivision) {
      try {
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser)
          if (parsedUser.divisi) {
            initialDivision = parsedUser.divisi
          } else if (parsedUser.divisions?.length > 0) {
            initialDivision = parsedUser.divisions[0]
          }
        }
      } catch (e) {
        console.error('Error reading user from localStorage:', e)
      }
    }

    if (initialDivision) {
      setDivision(initialDivision)
    }
  }, [user])

  // Load available divisions
  useEffect(() => {
    async function loadDivisions() {
      setDivisionsLoading(true)
      try {
        const divList = await fetchDivisions(token)
        if (divList && divList.length > 0) {
          setDivisions(divList)
          // Set first division if none selected
          if (!division && divList.length > 0) {
            setDivision(divList[0])
          }
        } else {
          // Fallback divisions
          const fallback = ['P1A', 'P1B', 'P2A', 'P2B']
          setDivisions(fallback)
        }
      } catch (e) {
        console.error('Failed to load divisions:', e)
        // Fallback
        const fallback = ['P1A', 'P1B', 'P2A', 'P2B']
        setDivisions(fallback)
      } finally {
        setDivisionsLoading(false)
      }
    }
    loadDivisions()
  }, [token])

  // Load Gangs
  useEffect(() => {
    async function loadGangs() {
      if (!division) {
        setGangs([])
        setGang('')
        return
      }

      setGangLoading(true)

      try {
        // Always fetch all gangs for the division to enable client-side filtering
        const list = await fetchGangs(token, division, null, true)

        if (list && list.length > 0) {
          setGangs(list)

          // Select first gang by default if current selection is invalid
          const firstGangCode = typeof list[0] === 'string' ? list[0] : list[0].gang_code

          // Check if current gang exists in new list
          const exists = list.some(g => {
            const code = typeof g === 'string' ? g : g.gang_code
            return code === gang
          })

          if (!gang || !exists) {
            setGang('ALL') // Default to ALL for new division
          }
        } else {
          setGangs([])
          setGang('')
        }
      } catch (e) {
        console.error('Failed to load gangs:', e)
        // Fallback for offline/error
        const fallbackGangs = ['H1H', 'H1M', 'H1T', 'A1H']
        setGangs(fallbackGangs)
        setGang('ALL')
      } finally {
        setGangLoading(false)
      }
    }

    loadGangs()
  }, [division, token])

  const handleDivisionChange = (newDivision) => {
    setDivision(newDivision)
    setGang('')
  }

  const handleGenerateReport = async () => {
    if (!monthInput || !division || !gang) return

    setIsGenerating(true)

    const [yearStr, monthStr] = monthInput.split('-')

    try {
      await onGenerateReport({
        month: parseInt(monthStr, 10),
        year: parseInt(yearStr, 10),
        gang_code: gang,
        division: division
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const isFormValid = monthInput && division && gang && !gangLoading

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '2rem',
      paddingTop: '4rem',
      position: 'relative'
    }}>
      {/* Animated Background */}
      <div className="modern-dashboard-bg" />

      {/* Loading Bar */}
      {isGenerating && (
        <div className="loading-bar">
          <div className="loading-bar-progress" />
        </div>
      )}

      {/* Main Glass Card */}
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '520px',
        zIndex: 1
      }}>
        {/* Header */}
        <div className="glass-card-header">
          <h2 className="glass-card-title">
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            Buat Laporan Gaji
          </h2>
          <p className="glass-card-subtitle">
            Pilih periode dan kemandoran untuk generate laporan
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Periode Section */}
          <div>
            <div className="section-label">
              <span className="section-label-icon">📅</span>
              Periode
            </div>
            <MonthPicker
              value={monthInput}
              onChange={setMonthInput}
              disabled={isGenerating}
            />
          </div>

          {/* Division Section */}
          <div>
            <div className="section-label">
              <span className="section-label-icon">🏢</span>
              Divisi
            </div>
            <DivisionTabs
              divisions={divisions}
              selected={division}
              onChange={handleDivisionChange}
              disabled={isGenerating}
              isLoading={divisionsLoading}
            />
          </div>

          {/* Gang Selection Section */}
          <div>
            <div className="section-label">
              <span className="section-label-icon">👥</span>
              Kemandoran / Gang
            </div>
            <GangCardGrid
              gangs={gangs}
              selected={gang}
              onChange={setGang}
              disabled={isGenerating}
              isLoading={gangLoading}
              showAllOption={true}
            />
          </div>

          {/* Generate Button */}
          <button
            className={`btn-generate ${isGenerating ? 'loading' : ''}`}
            onClick={handleGenerateReport}
            disabled={!isFormValid || isGenerating}
          >
            <span className="btn-generate-icon">🚀</span>
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>

        </div>
      </div>
    </div>
  )
}
