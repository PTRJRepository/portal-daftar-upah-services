import { describe, it, expect } from 'vitest'
import { PayrollAggregator } from './PayrollAggregator'

describe('PayrollAggregator', () => {
  describe('calculateEmployeeFields', () => {
    it('should use backend provided values for aggregations', () => {
      const input = {
        // Backend provided aggregates
        total_tunjangan: 500,
        total_premi: 1000,
        potongan_upah_kotor_total: 100,
        jumlah_upah_kotor: 1400,
        total_potongan: 200,
        upah_bersih: 1200,

        // Individual fields (values shouldn't matter if we use backend aggregates)
        beras_jumlah: 50, 
        jabatan_jumlah: 50,
        pot_pph21: 10,
        pot_bpjs_kesehatan_pekerja: 0,
        pot_bpjs_pensiun_pekerja: 0,
      }

      const result = PayrollAggregator.calculateEmployeeFields(input)

      expect(result.total_tunjangan).toBe(500)
      expect(result.total_premi).toBe(1000)
      expect(result.potongan_upah_kotor_total).toBe(100)
      expect(result.jumlah_upah_kotor).toBe(1400)
      expect(result.total_potongan).toBe(200)
      expect(result.upah_bersih).toBe(1200)
    })
    
    it('should calculate simple BPJS helpers correctly', () => {
         const input = {
             pot_bpjs_kesehatan_pekerja: 100,
             pot_bpjs_kesehatan_majikan: 200,
             pot_bpjs_pensiun_pekerja: 50,
             pot_bpjs_pensiun_majikan: 100,
             pot_bpjs_maj: 0 // Optional from backend
         }
         
         const result = PayrollAggregator.calculateEmployeeFields(input)
         
         expect(result.pot_bpjs_pekerja_total).toBe(150)
         expect(result.pot_bpjs_kesehatan_total).toBe(300)
         expect(result.pot_bpjs_pensiun_total).toBe(150)
         expect(result.pot_bpjs_jumlah).toBe(150 + 300) // 150 (pek) + 300 (maj - calculated as sum if pot_bpjs_maj is 0/missing)
    })
  })
})