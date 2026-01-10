import { describe, it, expect } from 'vitest'

const ensureHierarchicalOrThrow = (cols) => {
  const arr = Array.isArray(cols) ? cols : []
  const hasGroup = arr.some(c => Array.isArray(c.children) && c.children.length > 0)
  const allLeaves = arr.every(c => !Array.isArray(c.children) || c.children.length === 0)
  if (!hasGroup || allLeaves) throw new Error('Hierarchical headers required: detected flat columns')
}

const enhanceColumnsRecursive = (cols, depth = 0) => {
  if (!Array.isArray(cols)) return []
  const out = []
  for (const c of cols) {
    if (c.children && Array.isArray(c.children)) {
      const kids = enhanceColumnsRecursive(c.children, depth + 1)
      const visibleKids = kids.filter(k => !k.hide)
      if (visibleKids.length > 0) out.push({ ...c, children: visibleKids, headerGroupComponent: 'HierHeaderGroup', headerClass: `hdr-level-${depth + 1}`, marryChildren: true })
    } else {
      const leaf = { ...c }
      leaf.headerClass = `hdr-level-${depth + 1}`
      if (!leaf.hide) out.push(leaf)
    }
  }
  return out
}

describe('Hierarchical Columns', () => {
  it('throws on flat columns', () => {
    const flat = [ { field: 'no', headerName: 'NO' }, { field: 'nama', headerName: 'NAMA' } ]
    expect(() => ensureHierarchicalOrThrow(flat)).toThrow()
  })

  it('accepts hierarchical columns', () => {
    const hier = [ { headerName: 'IDENTITAS', children: [ { field: 'no', headerName: 'NO' }, { field: 'nama', headerName: 'NAMA' } ] } ]
    expect(() => ensureHierarchicalOrThrow(hier)).not.toThrow()
  })

  it('applies level classes', () => {
    const hier = [ { headerName: 'A', children: [ { headerName: 'B', children: [ { field: 'c', headerName: 'C' } ] } ] } ]
    const out = enhanceColumnsRecursive(hier, 0)
    expect(out[0].headerClass).toBe('hdr-level-1')
    expect(out[0].children[0].headerClass).toBe('hdr-level-2')
    expect(out[0].children[0].children[0].headerClass).toBe('hdr-level-3')
  })
})
