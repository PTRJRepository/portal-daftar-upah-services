/** @vitest-environment jsdom */
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import GangOvertimeMatrix from './GangOvertimeMatrix'

vi.mock('../services/employeeDetailService', () => ({
    getGangOvertimeMatrix: vi.fn()
}))

import { getGangOvertimeMatrix } from '../services/employeeDetailService'

const flushEffects = async () => {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

describe('GangOvertimeMatrix', () => {
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
                daily: {
                    2: [{ hours: 2, taskDesc: 'Panen', dayType: 'Hari Kerja' }]
                },
                total_hours: 2,
                total_amount: 50000
            }]
        }],
        meta: {
            total_employees: 1,
            execution_time_ms: 20
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

    it('opens employee detail callback from overtime matrix row when name is clicked', async () => {
        const onViewEmployeeDetail = vi.fn()
        getGangOvertimeMatrix.mockResolvedValue(baseResponse)

        await act(async () => {
            root.render(
                <GangOvertimeMatrix
                    token="token"
                    gangCodes={['A01']}
                    month={4}
                    year={2026}
                    onViewEmployeeDetail={onViewEmployeeDetail}
                />
            )
        })

        await flushEffects()

        expect(getGangOvertimeMatrix).toHaveBeenCalledWith('token', ['A01'], 4, 2026)

        const openButtons = Array.from(container.querySelectorAll('button.gom-emp-detail-btn'))
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
