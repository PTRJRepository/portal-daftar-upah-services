/** @vitest-environment jsdom */
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import GangAttendanceMatrix from './GangAttendanceMatrix'

vi.mock('../services/employeeDetailService', () => ({
    getGangAttendanceMatrix: vi.fn()
}))

vi.mock('../services/gangService', () => ({
    fetchGangs: vi.fn()
}))

import { getGangAttendanceMatrix } from '../services/employeeDetailService'
import { fetchGangs } from '../services/gangService'

const flushEffects = async () => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

describe('GangAttendanceMatrix', () => {
    let container
    let root

    const baseResponse = {
        success: true,
        data: [{
            gang_code: 'A01',
            gang_description: 'Gang Panen',
            month: 4,
            year: 2026,
            days_in_month: 30,
            holidays: {},
            sundays: [6, 13, 20, 27],
            employees: [{
                emp_code: 'E001',
                emp_name: 'Budi',
                bank_acc_no: '1234567890',
                alamat: 'Divisi A',
                upah_dasar: 120000,
                daily: {
                    1: { status: 'H', hours: 5, amount: 45000, is_short: true },
                    2: { status: 'H', hours: 7, amount: 120000 }
                },
                summary: {
                    hadir: 2,
                    cuti_tahunan: 0,
                    cuti_sakit: 0,
                    alpa: 0,
                    total_hk: 2
                }
            }]
        }],
        meta: {
            total_employees: 1,
            execution_time_ms: 25
        }
    }

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true
        container = document.createElement('div')
        document.body.appendChild(container)
        root = createRoot(container)
        window.print = vi.fn()
        vi.clearAllMocks()
    })

    afterEach(() => {
        act(() => {
            root.unmount()
        })
        container.remove()
    })

    it('renders division-wide attendance matrix without referencing removed payroll variables', async () => {
        fetchGangs.mockResolvedValue([
            { gang_code: 'A01' },
            { gang_code: 'A02' }
        ])

        getGangAttendanceMatrix.mockResolvedValue(baseResponse)

        await act(async () => {
            root.render(
                <GangAttendanceMatrix
                    token="token"
                    gangCodes={[]}
                    month={4}
                    year={2026}
                    division="PG1A"
                    includeFaceVerification={false}
                />
            )
        })

        await flushEffects()

        expect(fetchGangs).toHaveBeenCalledWith('token', 'PG1A', null, true)
        expect(getGangAttendanceMatrix).toHaveBeenCalledWith('token', ['A01', 'A02'], 4, 2026, false)
        expect(container.textContent).toContain('A01')
        expect(container.textContent).toContain('Budi')
    })

    it('shows worked hours for short-day warnings, supports amount mode, and hides alamat column', async () => {
        getGangAttendanceMatrix.mockResolvedValue(baseResponse)

        await act(async () => {
            root.render(
                <GangAttendanceMatrix
                    token="token"
                    gangCodes={['A01']}
                    month={4}
                    year={2026}
                    division="PG1A"
                    includeFaceVerification={false}
                />
            )
        })

        await flushEffects()

        expect(container.textContent).toContain('5j')
        expect(container.textContent).not.toContain('Alamat')

        const amountButton = Array.from(container.querySelectorAll('button'))
            .find((button) => button.textContent?.includes('Amount'))

        expect(amountButton).toBeTruthy()

        await act(async () => {
            amountButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })

        expect(container.textContent).toContain('45k')
    })

    it('renders scroll-safe css guards for the matrix viewport', async () => {
        getGangAttendanceMatrix.mockResolvedValue(baseResponse)

        await act(async () => {
            root.render(
                <GangAttendanceMatrix
                    token="token"
                    gangCodes={['A01']}
                    month={4}
                    year={2026}
                    division="PG1A"
                    includeFaceVerification={false}
                />
            )
        })

        await flushEffects()

        expect(container.innerHTML).toContain('min-height: 0;')
    })

    it('opens employee detail callback from matrix row when name is clicked', async () => {
        const onViewEmployeeDetail = vi.fn()
        getGangAttendanceMatrix.mockResolvedValue(baseResponse)

        await act(async () => {
            root.render(
                <GangAttendanceMatrix
                    token="token"
                    gangCodes={['A01']}
                    month={4}
                    year={2026}
                    division="PG1A"
                    includeFaceVerification={false}
                    onViewEmployeeDetail={onViewEmployeeDetail}
                />
            )
        })

        await flushEffects()

        const openButtons = Array.from(container.querySelectorAll('button.gam-emp-detail-btn'))
        expect(openButtons.length).toBeGreaterThan(0)

        await act(async () => {
            openButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })

        expect(onViewEmployeeDetail).toHaveBeenCalledTimes(1)
        expect(onViewEmployeeDetail).toHaveBeenCalledWith(expect.objectContaining({
            emp_code: 'E001',
            emp_name: 'Budi'
        }))
    })
})
