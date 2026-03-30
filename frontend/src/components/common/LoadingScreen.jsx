import { useEffect, useState, useRef } from 'react'
import { getBasePath } from '../../utils/prodModeUtils'
import './LoadingScreen.css'

const TIPS = [
  "Kelapa sawit adalah tanaman penghasil minyak nabati paling efisien di dunia.",
  "Satu hektar kelapa sawit dapat menghasilkan hingga 4 ton minyak per tahun.",
  "Minyak sawit mengandung Vitamin E (Tokotrienol) yang tinggi, baik untuk kesehatan jantung.",
  "Indonesia adalah produsen minyak kelapa sawit terbesar di dunia.",
  "Penggunaan sistem digital membantu akurasi perhitungan upah dan transparansi data.",
  "Produktivitas yang tinggi dimulai dari kesejahteraan karyawan yang terjaga.",
  "Kelapa sawit menyerap lebih banyak CO2 per hektar dibandingkan hutan tanaman industri lainnya.",
  "Sistem ini dirancang untuk memproses ribuan data karyawan dalam hitungan detik.",
  "Akurasi NIK sangat penting untuk integrasi data BPJS dan pajak yang valid.",
  "Memastikan data absensi lengkap akan mempercepat proses verifikasi payroll."
]

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
  const [currentTip, setCurrentTip] = useState(0)
  const prevStepsRef = useRef("[]")

  // Cycle through tips
  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % TIPS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [isLoading])

  // Handle Log History
  useEffect(() => {
    if (isLoading && message) {
      setLogs(prev => {
        if (prev[prev.length - 1] === message) return prev
        const newLogs = [...prev, message]
        return newLogs.slice(-3) // Keep last 3 messages visible
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
      : 8000 // Faster default for better feel

    let elapsed = (progress / 100) * totalDuration
    const interval = 50

    const timer = setInterval(() => {
      elapsed += interval
      const newProgress = Math.min((elapsed / totalDuration) * 100, 99)
      setProgress(prev => Math.max(prev, newProgress))
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
          <div className="loading-app-name">Payroll Intelligence System</div>
        </div>

        {/* Progress Section */}
        <div className="loading-progress-section">
          <div className="loading-progress-text">{Math.round(progress)}%</div>
          
          <div className="loading-progress-bar-container">
            <div
              className="loading-progress-bar-fill"
              style={{ width: `${progress}%` }}
            >
            </div>
          </div>

          {/* Report Info */}
          {(gangCode || month || year) && (
            <div className="loading-report-info">
              {gangCode && <span>📍 Gang: {gangCode}</span>}
              {month && year && (
                <span>📅 {`${String(month).padStart(2, '0')}/${year}`}</span>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Tips Carousel */}
        <div className="loading-tips-container">
          <div className="loading-tip-label">Tahukah Anda?</div>
          <div key={currentTip} className="loading-tip-text">
            "{TIPS[currentTip]}"
          </div>
        </div>

        {/* Action Logs */}
        <div className="loading-logs-container">
          {logs.map((logMsg, index) => (
            <div key={`${logMsg}-${index}`} className="loading-log-item">
              <span className="logger-icon">{index === logs.length - 1 ? '⌛' : '✅'}</span>
              <span>{logMsg}</span>
            </div>
          ))}
        </div>

        {/* Background Animation Element */}
        <div className="loading-palm-container">
          <svg className="palm-tree-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M45 100 Q 50 50 50 20 Q 55 50 55 100 Z" fill="white" />
            <g opacity="0.8">
              <path d="M50 25 Q 20 0 10 30 Q 30 20 50 25" fill="white" />
              <path d="M50 25 Q 30 -10 40 10 Q 45 5 50 25" fill="white" />
              <path d="M50 25 Q 70 -10 60 10 Q 55 5 50 25" fill="white" />
              <path d="M50 25 Q 80 0 90 30 Q 70 20 50 25" fill="white" />
              <path d="M50 25 Q 20 20 15 50 Q 35 30 50 25" fill="white" />
              <path d="M50 25 Q 80 20 85 50 Q 65 30 50 25" fill="white" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}