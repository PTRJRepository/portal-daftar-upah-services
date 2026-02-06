import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchCurrentPeriod } from '../services/gangService'

/**
 * Custom hook to fetch and use the current payroll period
 *
 * The current period is determined by the backend from PR_TASKREGLN_ARC
 * and is calculated as: latest period + 1 month
 *
 * @returns {Object} { month, year, loading, error }
 */
export function useCurrentPeriod() {
  const { token } = useAuth()
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadCurrentPeriod() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const currentPeriod = await fetchCurrentPeriod(token)
        console.log('[useCurrentPeriod] Loaded current period from API:', currentPeriod)
        if (currentPeriod && currentPeriod.month && currentPeriod.year) {
          setMonth(currentPeriod.month)
          setYear(currentPeriod.year)
          console.log(`[useCurrentPeriod] Set period to month=${currentPeriod.month}, year=${currentPeriod.year}`)
        }
      } catch (e) {
        console.error('[useCurrentPeriod] Failed to load current period from API:', e)
        setError(e)
        // Fallback to current calendar date on error
        setMonth(new Date().getMonth() + 1)
        setYear(new Date().getFullYear())
      } finally {
        setLoading(false)
      }
    }

    loadCurrentPeriod()
  }, [token])

  return { month, year, setMonth, setYear, loading, error }
}
