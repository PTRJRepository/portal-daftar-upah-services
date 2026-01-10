import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import HierHeaderGroup from '../components/common/HierHeaderGroup'

const makeGroup = () => {
  const leaves = [ { getColId: () => 'a' }, { getColId: () => 'b' } ]
  const group = {
    getOriginalParent: () => null,
    getLeafColumns: () => leaves,
    getDisplayName: () => 'PREMI'
  }
  return group
}

describe('HierHeaderGroup expand/collapse', () => {
  it('toggles child visibility', async () => {
    const api = { setColumnsVisible: vi.fn() }
    const columnGroup = makeGroup()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(<HierHeaderGroup columnGroup={columnGroup} api={api} />)
    })
    const btn = container.querySelector('button.hdr-toggle')
    btn.click()
    await new Promise(r => setTimeout(r, 0))
    expect(api.setColumnsVisible).toHaveBeenCalledWith(['a','b'], false)
    btn.click()
    await new Promise(r => setTimeout(r, 0))
    expect(api.setColumnsVisible).toHaveBeenCalledWith(['a','b'], true)
  })
})
