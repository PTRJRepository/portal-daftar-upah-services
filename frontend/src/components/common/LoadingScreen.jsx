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
  const [quote, setQuote] = useState({ text: 'Menyiapkan data...', author: '' })
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const quoteIntervalRef = useRef(null)

  // Static quotes pool - will rotate through these
  const localQuotes = [
    { text: "Kerja keras tidak akan mengkhianati hasil.", author: "Anonim" },
    { text: "Kualitas berarti melakukan hal yang benar ketika tidak ada yang melihat.", author: "Henry Ford" },
    { text: "Satu-satunya cara untuk melakukan pekerjaan hebat adalah dengan mencintai apa yang Anda lakukan.", author: "Steve Jobs" },
    { text: "Kesuksesan tidak datang kepadamu, kamulah yang harus pergi ke sana.", author: "Marva Collins" },
    { text: "Bekerjalah dalam diam, biarkan kesuksesanmu yang bersuara.", author: "Frank Ocean" },
    { text: "Fokus pada produktivitas, bukan kesibukan.", author: "Tim Ferriss" },
    { text: "Tindakan adalah kunci dasar untuk semua kesuksesan.", author: "Pablo Picasso" },
    { text: "Jangan takut untuk menyerah pada yang baik demi mendapatkan yang hebat.", author: "John D. Rockefeller" },
    { text: "Peluang tidak datang, melainkan diciptakan.", author: "Chris Grosser" },
    { text: "Sukses adalah hasil dari persiapan, kerja keras, dan belajar dari kegagalan.", author: "Colin Powell" },
    { text: "Setiap pencapaian dimulai dengan keputusan untuk mencoba.", author: "John F. Kennedy" },
    { text: "Kegagalan adalah bumbu yang memberi kesuksesan rasanya.", author: "Truman Capote" },
    { text: "Hal-hal terbaik dalam hidup tidak selalu gratis, tapi yang gratis bisa menjadi yang terbaik.", author: "Anonim" },
    { text: "Berani gagal adalah setengah jalan menuju sukses.", author: "Thomas Edison" },
    { text: "Perubahan dimulai dari diri sendiri.", author: "Mahatma Gandhi" }
  ]

  // Get random quote, avoiding the current one
  const getRandomQuote = (excludeText = '') => {
    const availableQuotes = localQuotes.filter(q => q.text !== excludeText)
    return availableQuotes[Math.floor(Math.random() * availableQuotes.length)]
  }

  // Set initial random quote and start rotation
  useEffect(() => {
    if (!isLoading) {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current)
      }
      return
    }

    // Set initial quote
    setQuote(getRandomQuote())

    // Rotate quotes every 5 seconds
    quoteIntervalRef.current = setInterval(() => {
      setQuote(prev => getRandomQuote(prev.text))
    }, 5000)

    return () => {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current)
      }
    }
  }, [isLoading])

  // Progress animation
  useEffect(() => {
    if (!isLoading) {
      setProgress(100)
      return
    }

    const totalDuration = steps.length > 0
      ? steps.reduce((sum, step) => sum + (step.duration || 1000), 0)
      : 10000 // Default 10 seconds if no steps

    let elapsed = 0
    const interval = 50

    const timer = setInterval(() => {
      elapsed += interval
      const newProgress = Math.min((elapsed / totalDuration) * 100, 95)
      setProgress(newProgress)

      // Update current step
      if (steps.length > 0) {
        let accumulatedTime = 0
        for (let i = 0; i < steps.length; i++) {
          accumulatedTime += steps[i].duration || 1000
          if (elapsed < accumulatedTime) {
            setCurrentStep(i)
            break
          }
        }
      }

      if (elapsed >= totalDuration) {
        clearInterval(timer)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [isLoading, steps])

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
          <div className="loading-message">{message}</div>

          {steps.length > 0 && currentStep < steps.length && (
            <div className="loading-step">{steps[currentStep].name}</div>
          )}

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

        {/* Motivational Quote with fade animation */}
        <div className="loading-quote-section" key={quote.text}>
          <div className="loading-quote-icon">💡</div>
          <div className="loading-quote-text">"{quote.text}"</div>
          <div className="loading-quote-author">— {quote.author}</div>
        </div>

        {/* Loading Animation */}
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    </div>
  )
}