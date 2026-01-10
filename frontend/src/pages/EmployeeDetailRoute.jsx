import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import EmployeeDetailPage from '../components/employee/EmployeeDetailPage'
import LoadingScreen from '../components/common/LoadingScreen'

export default function EmployeeDetailRoute() {
    const { token, loading: authLoading } = useAuth()
    const [params, setParams] = useState(null)

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const rawNik = urlParams.get('nik')
        const nik = rawNik ? rawNik.trim() : null
        const month = parseInt(urlParams.get('month') || '0', 10)
        const year = parseInt(urlParams.get('year') || '0', 10)
        const rawDivision = urlParams.get('division')
        const division = (rawDivision && rawDivision !== 'undefined' && rawDivision !== 'null') ? rawDivision : null

        // Validate params
        const isValidNik = nik && nik !== 'undefined' && nik !== 'null'

        if (isValidNik && month && year) {
            console.log(`[EmployeeDetailRoute] Params: nik=${nik}, month=${month}, year=${year}, div=${division}`)
            setParams({
                nik,
                month,
                year,
                division
            })
        } else {
            console.error('[EmployeeDetailRoute] Invalid params:', { rawNik, nik, month, year, division })
        }
    }, [])

    if (authLoading) {
        return <LoadingScreen isLoading={true} message="Authenticating..." />
    }

    if (!params) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: '#666'
            }}>
                <h3>Parameter tidak lengkap</h3>
                <p>Harap akses halaman ini melalui Laporan Upah.</p>
            </div>
        )
    }

    return (
        <div style={{ height: '100vh', width: '100vw', overflow: 'auto', backgroundColor: '#e5e7eb' }}>
            <EmployeeDetailPage
                employeeData={{ nik: params.nik }}
                month={params.month}
                year={params.year}
                division={params.division}
                onBack={() => window.close()}
            />
        </div>
    )
}
