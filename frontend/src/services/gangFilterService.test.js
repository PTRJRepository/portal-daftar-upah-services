import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import GangFilterService from './gangFilterService'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}

global.localStorage = localStorageMock

describe('GangFilterService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
  })

  describe('groupGangsBySubDivision', () => {
    it('should group gangs by sub-division correctly', () => {
      const gangs = [
        { gang_code: 'A1H', description: 'HARVESTING AIR BATU' },
        { gang_code: 'A1M', description: 'MAINTENANCE AIR BATU' },
        { gang_code: 'A2M', description: 'MAINTENANCE AIR KUNDO' },
        { gang_code: 'A3H', description: 'HARVESTING AIR HIJAU' },
        { gang_code: 'AMC', description: 'WORKSHOP PARIT GUNUNG' }
      ]

      const result = GangFilterService.groupGangsBySubDivision(gangs)

      expect(result).toHaveProperty('A1')
      expect(result).toHaveProperty('A2')
      expect(result).toHaveProperty('A3')
      expect(result).toHaveProperty('AM')

      expect(result.A1).toEqual({
        subDivision: 'A1',
        name: 'Air Batu',
        gangs: [
          { gang_code: 'A1H', description: 'HARVESTING AIR BATU' },
          { gang_code: 'A1M', description: 'MAINTENANCE AIR BATU' }
        ]
      })

      expect(result.A2).toEqual({
        subDivision: 'A2',
        name: 'Air Kundo',
        gangs: [
          { gang_code: 'A2M', description: 'MAINTENANCE AIR KUNDO' }
        ]
      })
    })

    it('should handle empty gangs array', () => {
      const result = GangFilterService.groupGangsBySubDivision([])
      expect(result).toEqual({})
    })

    it('should handle gangs with invalid codes', () => {
      const gangs = [
        { gang_code: '', description: 'Empty code' },
        { gang_code: 'A', description: 'Single character' },
        { gang_code: 'A1H', description: 'Valid code' }
      ]

      const result = GangFilterService.groupGangsBySubDivision(gangs)

      expect(result).toHaveProperty('A1')
      expect(result.A1.gangs).toHaveLength(1)
      expect(result.A1.gangs[0].gang_code).toBe('A1H')
    })

    it('should trim whitespace from gang codes', () => {
      const gangs = [
        { gang_code: '  A1H  ', description: 'Code with spaces' }
      ]

      const result = GangFilterService.groupGangsBySubDivision(gangs)

      expect(result).toHaveProperty('A1')
      expect(result.A1.gangs[0].gang_code).toBe('A1H')
      expect(result.A1.gangs[0].description).toBe('Code with spaces')
    })
  })

  describe('getSubDivisionName', () => {
    it('should return correct names for known sub-divisions', () => {
      expect(GangFilterService.getSubDivisionName('A1')).toBe('Air Batu')
      expect(GangFilterService.getSubDivisionName('A2')).toBe('Air Kundo')
      expect(GangFilterService.getSubDivisionName('A3')).toBe('Air Hijau')
      expect(GangFilterService.getSubDivisionName('AM')).toBe('Workshop')
      expect(GangFilterService.getSubDivisionName('AS')).toBe('Staff')
    })

    it('should return the sub-division code for unknown ones', () => {
      expect(GangFilterService.getSubDivisionName('B1')).toBe('B1')
      expect(GangFilterService.getSubDivisionName('X9')).toBe('X9')
      expect(GangFilterService.getSubDivisionName('')).toBe('')
    })
  })

  describe('extractSubDivision', () => {
    it('should extract first 2 characters from gang code', () => {
      expect(GangFilterService.extractSubDivision('A1H')).toBe('A1')
      expect(GangFilterService.extractSubDivision('A2M')).toBe('A2')
      expect(GangFilterService.extractSubDivision('AMC')).toBe('AM')
    })

    it('should handle edge cases', () => {
      expect(GangFilterService.extractSubDivision('')).toBe('OTHER')
      expect(GangFilterService.extractSubDivision('A')).toBe('OTHER')
      expect(GangFilterService.extractSubDivision('A1H    ')).toBe('A1')
    })
  })

  describe('getUniqueSubDivisions', () => {
    it('should return unique sub-divisions sorted', () => {
      const gangs = [
        { gang_code: 'A1H' },
        { gang_code: 'A1M' },
        { gang_code: 'A2M' },
        { gang_code: 'A3H' },
        { gang_code: 'A1T' }
      ]

      const result = GangFilterService.getUniqueSubDivisions(gangs)

      expect(result).toEqual(['A1', 'A2', 'A3'])
    })

    it('should handle empty array', () => {
      const result = GangFilterService.getUniqueSubDivisions([])
      expect(result).toEqual([])
    })
  })

  describe('filterGangsBySubDivisions', () => {
    const gangs = [
      { gang_code: 'A1H' },
      { gang_code: 'A1M' },
      { gang_code: 'A2M' },
      { gang_code: 'A3H' },
      { gang_code: 'AMC' }
    ]

    it('should filter gangs by selected sub-divisions', () => {
      const selectedSubDivisions = ['A1', 'A3']
      const result = GangFilterService.filterGangsBySubDivisions(gangs, selectedSubDivisions)

      expect(result).toHaveLength(3)
      expect(result.map(g => g.gang_code)).toEqual(['A1H', 'A1M', 'A3H'])
    })

    it('should return all gangs when no sub-divisions selected', () => {
      const result = GangFilterService.filterGangsBySubDivisions(gangs, [])
      expect(result).toEqual(gangs)
    })

    it('should return empty array when no matches', () => {
      const result = GangFilterService.filterGangsBySubDivisions(gangs, ['X1'])
      expect(result).toEqual([])
    })
  })

  describe('applyFilters', () => {
    const gangs = [
      { gang_code: 'A1H', division: 'PG1A' },
      { gang_code: 'A1M', division: 'PG1A' },
      { gang_code: 'A2M', division: 'PG1B' },
      { gang_code: 'A3H', division: 'PG2A' }
    ]

    it('should apply both division and sub-division filters', () => {
      const filters = {
        divisions: ['PG1A'],
        subDivisions: ['A1']
      }

      const result = GangFilterService.applyFilters(gangs, filters)

      expect(result).toHaveLength(2)
      expect(result.map(g => g.gang_code)).toEqual(['A1H', 'A1M'])
    })

    it('should apply only division filter', () => {
      const filters = {
        divisions: ['PG1A'],
        subDivisions: []
      }

      const result = GangFilterService.applyFilters(gangs, filters)

      expect(result).toHaveLength(2)
      expect(result.map(g => g.gang_code)).toEqual(['A1H', 'A1M'])
    })

    it('should apply only sub-division filter', () => {
      const filters = {
        divisions: [],
        subDivisions: ['A1', 'A3']
      }

      const result = GangFilterService.applyFilters(gangs, filters)

      expect(result).toHaveLength(3)
      expect(result.map(g => g.gang_code)).toEqual(['A1H', 'A1M', 'A3H'])
    })

    it('should return all gangs when no filters applied', () => {
      const filters = { divisions: [], subDivisions: [] }
      const result = GangFilterService.applyFilters(gangs, filters)
      expect(result).toEqual(gangs)
    })
  })

  describe('getFilterStats', () => {
    const gangs = [
      { gang_code: 'A1H' },
      { gang_code: 'A1M' },
      { gang_code: 'A2M' },
      { gang_code: 'A3H' },
      { gang_code: 'AMC' }
    ]

    it('should return correct stats with no filters', () => {
      const filters = { divisions: [], subDivisions: [] }
      const result = GangFilterService.getFilterStats(gangs, filters)

      expect(result).toEqual({
        totalGangs: 5,
        filteredGangsCount: 5,
        totalInSelection: 5,
        availableSubDivisions: ['A1', 'A2', 'A3', 'AM'],
        hasActiveFilter: false
      })
    })

    it('should return correct stats with sub-division filters', () => {
      const filters = { subDivisions: ['A1', 'A3'], hasActiveFilter: true }
      const result = GangFilterService.getFilterStats(gangs, filters)

      expect(result.totalGangs).toBe(5)
      expect(result.totalInSelection).toBe(3) // A1H, A1M, A3H
      expect(result.hasActiveFilter).toBe(true)
    })
  })

  describe('validateFilters', () => {
    const availableData = {
      divisions: ['PG1A', 'PG1B', 'PG2A'],
      gangs: [
        { gang_code: 'A1H' },
        { gang_code: 'A2M' }
      ]
    }

    it('should validate correct filters', () => {
      const filters = {
        divisions: ['PG1A'],
        subDivisions: ['A1', 'A2']
      }

      const result = GangFilterService.validateFilters(filters, availableData)

      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should detect invalid divisions', () => {
      const filters = {
        divisions: ['INVALID_DIV'],
        subDivisions: []
      }

      const result = GangFilterService.validateFilters(filters, availableData)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid divisions: INVALID_DIV')
    })

    it('should detect invalid sub-divisions', () => {
      const filters = {
        divisions: [],
        subDivisions: ['X1']
      }

      const result = GangFilterService.validateFilters(filters, availableData)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid sub-divisions: X1')
    })
  })

  describe('createFilterSummary', () => {
    const gangs = [
      { gang_code: 'A1H' },
      { gang_code: 'A2M' },
      { gang_code: 'AMC' }
    ]

    it('should create summary with no filters', () => {
      const filters = { divisions: [], subDivisions: [] }
      const result = GangFilterService.createFilterSummary(filters, gangs)

      expect(result.text).toBe('Menampilkan semua data')
      expect(result.count).toBe(0)
    })

    it('should create summary with division filter', () => {
      const filters = { divisions: ['PG1A'], subDivisions: [] }
      const result = GangFilterService.createFilterSummary(filters, gangs)

      expect(result.text).toBe('Divisi: PG1A')
      expect(result.count).toBe(1)
      expect(result.details).toEqual([{ type: 'division', value: 'PG1A' }])
    })

    it('should create summary with sub-division filter', () => {
      const filters = { divisions: [], subDivisions: ['A1'] }
      const result = GangFilterService.createFilterSummary(filters, gangs)

      expect(result.text).toBe('Sub-divisi: Air Batu')
      expect(result.count).toBe(1)
      expect(result.details).toEqual([{
        type: 'subDivision',
        value: 'A1',
        name: 'Air Batu'
      }])
    })

    it('should create summary with both filters', () => {
      const filters = { divisions: ['PG1A'], subDivisions: ['A1'] }
      const result = GangFilterService.createFilterSummary(filters, gangs)

      expect(result.text).toBe('Divisi: PG1A | Sub-divisi: Air Batu')
      expect(result.count).toBe(2)
    })
  })

  describe('localStorage operations', () => {
    it('should save filters to localStorage', () => {
      const filters = { divisions: ['PG1A'], subDivisions: ['A1'] }

      const result = GangFilterService.saveFiltersToStorage(filters)

      expect(result).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('gangFilters', JSON.stringify(filters))
    })

    it('should handle localStorage save error', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      const result = GangFilterService.saveFiltersToStorage({})

      expect(result).toBe(false)
    })

    it('should load filters from localStorage', () => {
      const savedFilters = { divisions: ['PG1A'], subDivisions: ['A1'] }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedFilters))

      const result = GangFilterService.loadFiltersFromStorage()

      expect(result).toEqual(savedFilters)
      expect(localStorageMock.getItem).toHaveBeenCalledWith('gangFilters')
    })

    it('should handle localStorage load error', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      const result = GangFilterService.loadFiltersFromStorage()

      expect(result).toEqual({})
    })

    it('should clear filters from localStorage', () => {
      const result = GangFilterService.clearFiltersFromStorage()

      expect(result).toBe(true)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('gangFilters')
    })
  })

  describe('getRecommendedFilters', () => {
    it('should return most popular sub-divisions', () => {
      const gangs = [
        { gang_code: 'A1H' },
        { gang_code: 'A1M' },
        { gang_code: 'A1T' },
        { gang_code: 'A2M' },
        { gang_code: 'A2P' },
        { gang_code: 'A3H' }
      ]

      const result = GangFilterService.getRecommendedFilters(gangs)

      expect(result.mostPopular).toHaveLength(3)
      expect(result.mostPopular[0].subDiv).toBe('A1') // Most gangs (3)
      expect(result.mostPopular[0].count).toBe(3)
      expect(result.all).toHaveLength(3)
    })

    it('should handle empty gangs array', () => {
      const result = GangFilterService.getRecommendedFilters([])

      expect(result.mostPopular).toEqual([])
      expect(result.all).toEqual([])
    })
  })
})