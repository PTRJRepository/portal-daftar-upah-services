import { describe, expect, it } from 'vitest';
import { buildPremiumDetailEdit, validatePremiumDetailMetadata } from './payrollPremiumDetailEdits';

describe('buildPremiumDetailEdit', () => {
    it('creates a pending edit from popup metadata when the amount cell was not edited first', () => {
        const metadata = {
            input_type: 'blok',
            items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 677650 }],
            total_amount: 677650
        };

        const result = buildPremiumDetailEdit({
            existingEdit: null,
            editBase: {
                emp_code: 'B0001',
                nik: '3171',
                emp_name: 'Test Employee',
                field: 'premi_pruning',
                value: 650000,
                originalValue: 650000,
                gang_code: 'D1H',
                type: 'PREMI',
                name: 'PREMI PRUNING'
            },
            metadataJson: metadata,
            amountToSave: 677650
        });

        expect(result).toEqual(expect.objectContaining({
            emp_code: 'B0001',
            field: 'premi_pruning',
            value: 677650,
            originalValue: 650000,
            type: 'PREMI',
            name: 'PREMI PRUNING',
            metadata_json: JSON.stringify(metadata)
        }));
    });

    it('preserves existing edit identity while replacing amount and metadata', () => {
        const metadata = {
            input_type: 'blok',
            items: [{ subblok: 'P10/01', gang_code: 'D1H', jumlah: 800000 }],
            total_amount: 800000
        };

        const result = buildPremiumDetailEdit({
            existingEdit: {
                emp_code: 'B0001',
                field: 'premi_pruning',
                value: 650000,
                originalValue: 600000,
                type: 'PREMI',
                name: 'PREMI PRUNING',
                remarks: 'existing remarks'
            },
            editBase: null,
            metadataJson: metadata,
            amountToSave: 800000
        });

        expect(result).toEqual(expect.objectContaining({
            emp_code: 'B0001',
            value: 800000,
            originalValue: 600000,
            remarks: 'existing remarks',
            metadata_json: JSON.stringify(metadata)
        }));
    });

    it('omits metadata for amount-only popup edits', () => {
        const result = buildPremiumDetailEdit({
            existingEdit: null,
            editBase: {
                emp_code: 'B0001',
                field: 'premi_jarak',
                value: 0,
                originalValue: 0,
                type: 'PREMI',
                name: 'PREMI JARAK'
            },
            metadataJson: null,
            amountToSave: 125000
        });

        expect(result).toEqual(expect.objectContaining({
            emp_code: 'B0001',
            field: 'premi_jarak',
            value: 125000,
            originalValue: 0,
            type: 'PREMI',
            name: 'PREMI JARAK'
        }));
        expect(result).not.toHaveProperty('metadata_json');
    });

    it('normalizes negative koreksi and potongan detail values before saving', () => {
        const metadata = {
            input_type: 'blok,exp',
            blok_items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: -6000 }],
            expense: { expense_code: 'KASBON', jumlah: -4000 },
            total_amount: -10000
        };

        const result = buildPremiumDetailEdit({
            existingEdit: null,
            editBase: {
                emp_code: 'B0001',
                field: 'koreksi_denda_panen',
                value: 0,
                originalValue: 0,
                type: 'POTONGAN_KOTOR',
                name: 'KOREKSI DENDA PANEN'
            },
            metadataJson: metadata,
            amountToSave: -10000
        });

        expect(result.value).toBe(10000);
        expect(JSON.parse(result.metadata_json)).toEqual({
            input_type: 'blok,exp',
            blok_items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 6000 }],
            expense: { expense_code: 'KASBON', jumlah: 4000 },
            total_amount: 10000
        });
    });
});

describe('validatePremiumDetailMetadata', () => {
  it('requires subblok, gang, and nonzero amount for blok input', () => {
    expect(validatePremiumDetailMetadata({
      input_type: 'blok',
      items: [{ subblok: '', gang_code: 'D1H', jumlah: 100000 }],
    }, 'blok')).toEqual({
      isComplete: false,
      inputType: 'blok',
      reasons: ['Baris blok 1: subblok wajib diisi.'],
    });

    const missingGangAndAmount = validatePremiumDetailMetadata({
      input_type: 'blok',
      items: [{ subblok: 'P09/15', gang_code: '', jumlah: 0 }],
    }, 'blok');
    expect(missingGangAndAmount.isComplete).toBe(false);
    expect(missingGangAndAmount.reasons).toContain('Baris blok 1: gang code wajib diisi.');
    expect(missingGangAndAmount.reasons).toContain('Baris blok 1: jumlah wajib lebih dari 0.');

    expect(validatePremiumDetailMetadata({
      input_type: 'blok',
      items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 100000 }],
    }, 'blok').isComplete).toBe(true);
  });

  it('requires vehicle number, expense code, and nonzero amount for kendaraan input', () => {
    const result = validatePremiumDetailMetadata({
      input_type: 'kendaraan',
      items: [{ nomor_kendaraan: '', expense_code: 'ANGKUT', jumlah: 150000 }],
    }, 'kendaraan');

    expect(result.isComplete).toBe(false);
    expect(result.reasons).toContain('Baris kendaraan 1: nomor kendaraan wajib diisi.');

    expect(validatePremiumDetailMetadata({
      input_type: 'kendaraan',
      items: [
        { nomor_kendaraan: 'B1234AB', expense_code: 'HELPER', jumlah: 150000 },
      ],
    }, 'kendaraan').isComplete).toBe(true);
  });

  it('marks empty structured metadata as incomplete', () => {
    expect(validatePremiumDetailMetadata(null, 'blok')).toMatchObject({
      isComplete: false,
      inputType: 'blok',
      reasons: ['Minimal satu detail blok wajib diisi.'],
    });
  });

  it('accepts negative structured amounts for koreksi and potongan but not premi', () => {
    expect(validatePremiumDetailMetadata({
      input_type: 'exp',
      expense_code: 'KASBON',
      jumlah: -7000,
    }, 'exp', 'POTONGAN_BERSIH')).toEqual({
      isComplete: true,
      inputType: 'exp',
      reasons: [],
    });

    const premiumResult = validatePremiumDetailMetadata({
      input_type: 'exp',
      expense_code: 'KASBON',
      jumlah: -7000,
    }, 'exp', 'PREMI');
    expect(premiumResult.isComplete).toBe(false);
    expect(premiumResult.reasons).toContain('Jumlah expense tidak boleh negatif.');
  });
});
