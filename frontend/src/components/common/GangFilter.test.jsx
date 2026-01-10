import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GangFilter from './GangFilter'

// Mock CSS imports
vi.mock('../../styles/theme.css', () => ({}))

// Sample test data
const mockGangs = [
  { gang_code: 'A1H', description: 'HARVESTING AIR BATU' },
  { gang_code: 'A1M', description: 'MAINTENANCE AIR BATU' },
  { gang_code: 'A2M', description: 'MAINTENANCE AIR KUNDO' },
  { gang_code: 'A2P', description: 'PERCOBAAN AIR KUNDO' },
  { gang_code: 'A3H', description: 'HARVESTING AIR HIJAU' },
  { gang_code: 'AMC', description: 'WORKSHOP PARIT GUNUNG' },
  { gang_code: 'AST', description: 'Staff PG1A' }
]

const mockDivisions = ['PG1A', 'PG1B', 'PG2A', 'PG2B', 'DME']

describe('GangFilter Component', () => {
  const mockOnFiltersChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    expect(screen.getByText('Filter Data Gang')).toBeInTheDocument()
  })

  it('displays available divisions', () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    mockDivisions.forEach(division => {
      expect(screen.getByText(division)).toBeInTheDocument()
    })
  })

  it('displays grouped sub-divisions', () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    // Check for sub-division groups
    expect(screen.getByText(/Air Batu/)).toBeInTheDocument()
    expect(screen.getByText(/Air Kundo/)).toBeInTheDocument()
    expect(screen.getByText(/Air Hijau/)).toBeInTheDocument()
    expect(screen.getByText(/Workshop/)).toBeInTheDocument()
    expect(screen.getByText(/Staff/)).toBeInTheDocument()
  })

  it('shows gang count for each sub-division', () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    expect(screen.getByText('2 gang')).toBeInTheDocument() // A1 (Air Batu)
    expect(screen.getByText('1 gang')).toBeInTheDocument() // AM (Workshop)
  })

  it('allows selecting divisions', async () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const pg1aCheckbox = screen.getByText('PG1A').closest('label').querySelector('input')
    fireEvent.click(pg1aCheckbox)

    expect(pg1aCheckbox.checked).toBe(true)
  })

  it('allows selecting sub-divisions', async () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const a1SubDiv = screen.getByText(/Air Batu.*\(A1\)/).closest('label').querySelector('input')
    fireEvent.click(a1SubDiv)

    expect(a1SubDiv.checked).toBe(true)
  })

  it('shows gang details when sub-division is selected', async () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const a1SubDiv = screen.getByText(/Air Batu.*\(A1\)/).closest('label').querySelector('input')
    fireEvent.click(a1SubDiv)

    await waitFor(() => {
      expect(screen.getByText('A1H: HARVESTING AIR BATU')).toBeInTheDocument()
      expect(screen.getByText('A1M: MAINTENANCE AIR BATU')).toBeInTheDocument()
    })
  })

  it('applies filters when apply button is clicked', async () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    // Select a division
    const pg1aCheckbox = screen.getByText('PG1A').closest('label').querySelector('input')
    fireEvent.click(pg1aCheckbox)

    // Select a sub-division
    const a1SubDiv = screen.getByText(/Air Batu.*\(A1\)/).closest('label').querySelector('input')
    fireEvent.click(a1SubDiv)

    // Click apply button
    const applyButton = screen.getByText('Terapkan Filter')
    fireEvent.click(applyButton)

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      divisions: ['PG1A'],
      subDivisions: ['A1'],
      hasActiveFilter: true
    })
  })

  it('resets filters when reset button is clicked', async () => {
    const initialFilters = {
      divisions: ['PG1A'],
      subDivisions: ['A1'],
      hasActiveFilter: true
    }

    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        selectedFilters={initialFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    // Click reset button
    const resetButton = screen.getByText('Reset Filter')
    fireEvent.click(resetButton)

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      divisions: [],
      subDivisions: [],
      hasActiveFilter: false
    })
  })

  it('displays active filter summary', () => {
    const activeFilters = {
      divisions: ['PG1A'],
      subDivisions: ['A1'],
      hasActiveFilter: true
    }

    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        selectedFilters={activeFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    expect(screen.getByText(/Filter Aktif \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/2 gang akan ditampilkan/)).toBeInTheDocument()
  })

  it('shows "Select All" checkbox for sub-divisions', () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    expect(screen.getByText('Pilih Semua')).toBeInTheDocument()
  })

  it('handles "Select All" functionality', async () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const selectAllCheckbox = screen.getByText('Pilih Semua').closest('label').querySelector('input')
    fireEvent.click(selectAllCheckbox)

    // Check if all sub-divisions are selected
    const subDivCheckboxes = screen.getAllByRole('checkbox').filter(cb =>
      cb.closest('label') && cb.closest('label').textContent.includes('(')
    )

    subDivCheckboxes.forEach(checkbox => {
      expect(checkbox.checked).toBe(true)
    })
  })

  it('displays loading state correctly', () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        isLoading={true}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    expect(screen.getByText('Sedang memproses data...')).toBeInTheDocument()
  })

  it('handles empty gangs data', () => {
    render(
      <GangFilter
        gangs={[]}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    expect(screen.getByText('Tidak ada data sub-divisi')).toBeInTheDocument()
  })

  it('handles empty divisions data', () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={[]}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    // Should still show sub-divisions even without divisions
    expect(screen.getByText(/Air Batu/)).toBeInTheDocument()
  })

  it('displays filter badge when filters are active', () => {
    const activeFilters = {
      divisions: ['PG1A'],
      subDivisions: [],
      hasActiveFilter: true
    }

    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        selectedFilters={activeFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const badge = screen.getByText('1')
    expect(badge).toBeInTheDocument()
  })

  it('collapses and expands filter section', () => {
    render(
      <GangFilter
        gangs={mockGangs}
        divisions={mockDivisions}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    // Initially expanded
    expect(screen.getByText('Divisi Utama')).toBeInTheDocument()

    // Click collapse button
    const collapseButton = screen.getByText('▼')
    fireEvent.click(collapseButton)

    // Should be collapsed (divisions not visible)
    expect(screen.queryByText('Divisi Utama')).not.toBeInTheDocument()
  })
})
