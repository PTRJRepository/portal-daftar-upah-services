import { useEffect, useState, useRef } from 'react'
import { getBasePath } from '../../utils/prodModeUtils'
import './LoadingScreen.css'

export default function LoadingScreen({
  isLoading,
  message = 'Loading...',
  steps = [],
  gangCode,
  month,
  year
}) {
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState(0)
  const prevStepsRef = useRef("[]")

  // Handle Log History
  useEffect(() => {
    if (isLoading && message) {
      setLogs(prev => {
        if (prev[prev.length - 1] === message) return prev
        const newLogs = [...prev, message]
        return newLogs.slice(-4) // Keep last 4 messages visible
      })
    }
  }, [message, isLoading])

  // Reset state on initial load
  useEffect(() => {
    if (isLoading && logs.length === 0 && message) {
      setLogs([message])
    }
    if (!isLoading) {
      setLogs([])
    }
  }, [isLoading])

  // Progress animation
  useEffect(() => {
    if (!isLoading) {
      setProgress(100)
      return
    }

    // Capture initial steps state safely
    const stepsString = JSON.stringify(steps || [])
    if (prevStepsRef.current === "[]" && stepsString !== "[]") {
      prevStepsRef.current = stepsString
    }

    let parsedSteps = []
    try {
      parsedSteps = JSON.parse(prevStepsRef.current !== "[]" ? prevStepsRef.current : stepsString)
    } catch (e) { }

    const totalDuration = parsedSteps.length > 0
      ? parsedSteps.reduce((sum, step) => sum + (step.duration || 1000), 0)
      : 10000 // Default 10 seconds if no steps

    let elapsed = (progress / 100) * totalDuration // Start from current progress roughly
    const interval = 50

    const timer = setInterval(() => {
      elapsed += interval
      const newProgress = Math.min((elapsed / totalDuration) * 100, 98)
      setProgress(prev => Math.max(prev, newProgress)) // Never move backwards!
    }, interval)

    return () => clearInterval(timer)
  }, [isLoading])

  if (!isLoading) return null

  const basePath = getBasePath()

  return (
    <div className="loading-screen-overlay">
      <div className="loading-screen-wallpaper" style={{
        backgroundImage: `url('${basePath}/images/wallpaper_loading_screen.webp')`
      }}></div>

      <div className="loading-screen-content">
        {/* Logo Section */}
        <div className="loading-logo-container">
          <img
            src={`${basePath}/images/rebinmas.webp`}
            alt="PT Rebinmas Jaya"
            className="loading-logo"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
          <div className="loading-company-name">PT REBINMAS JAYA</div>
          <div className="loading-app-name">Sistem Daftar Upah</div>
        </div>

        {/* Progress Section */}
        <div className="loading-progress-section">
          {/* Progress Bar */}
          <div className="loading-progress-bar-container">
            <div
              className="loading-progress-bar-fill"
              style={{ width: `${progress}%` }}
            >
              <div className="loading-progress-shine"></div>
            </div>
          </div>

          <div className="loading-progress-text">{Math.round(progress)}%</div>

          {/* Report Info */}
          {(gangCode || month || year) && (
            <div className="loading-report-info">
              {gangCode && <span>Gang: {gangCode}</span>}
              {month && year && (
                <span>Periode: {`${String(month).padStart(2, '0')}/${year}`}</span>
              )}
            </div>
          )}
        </div>

        {/* Action Logs (Replaces Quotes) */}
        <div className="loading-logs-container">
          {logs.map((logMsg, index) => (
            <div key={`${logMsg}-${index}`} className="loading-log-item">
              <span className="logger-icon">{index === logs.length - 1 ? '🔄' : '✅'}</span>
              <span>{logMsg}</span>
            </div>
          ))}
        </div>

        {/* Responsive Palm Tree Animation (Replaces Spinner) */}
        <div className="loading-palm-container">
          <svg className="palm-tree-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Trunk */}
            <path d="M45 100 Q 50 50 50 20 Q 55 50 55 100 Z" fill="#8B4513" />
            <path d="M45 90 Q 50 85 55 90" stroke="#654321" strokeWidth="2" fill="none" />
            <path d="M46 70 Q 50 65 54 70" stroke="#654321" strokeWidth="2" fill="none" />
            <path d="M48 50 Q 50 45 52 50" stroke="#654321" strokeWidth="2" fill="none" />
            {/* Leaves Group */}
            <g className="palm-leaves">
              <path d="M50 25 Q 20 0 10 30 Q 30 20 50 25" fill="#22c55e" />
              <path d="M50 25 Q 30 -10 40 10 Q 45 5 50 25" fill="#16a34a" />
              <path d="M50 25 Q 70 -10 60 10 Q 55 5 50 25" fill="#15803d" />
              <path d="M50 25 Q 80 0 90 30 Q 70 20 50 25" fill="#16a34a" />
              <path d="M50 25 Q 20 20 15 50 Q 35 30 50 25" fill="#15803d" />
              <path d="M50 25 Q 80 20 85 50 Q 65 30 50 25" fill="#22c55e" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}