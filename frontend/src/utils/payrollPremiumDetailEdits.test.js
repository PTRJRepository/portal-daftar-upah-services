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

// ─────────────────────────────────────────────────────────────────────────────
// BUG-DB-001: frontend auto-sync tests for non-whitelist premium
// Tests for buildPremiumDetailEdit with all detail input types
// ─────────────────────────────────────────────────────────────────────────────

describe('buildPremiumDetailEdit — auto-sync for all detail types (BUG-DB-001)', () => {
  // Before fix: only PREMI PRUNING and PREMI RAKING had auto-sync
  // After fix: ALL input_type !== 'amount' have auto-sync

  it('syncs blok metadata for PREMI JAGA (was NOT in whitelist)', () => {
    const metadata = {
      input_type: 'blok',
      items: [
        { subblok: 'P0921', gang_code: 'B1H', jumlah: 5000 },
        { subblok: 'P0922', gang_code: 'B1H', jumlah: 3000 }
      ],
      total_amount: 8000
    };
    const result = buildPremiumDetailEdit({
      existingEdit: null,
      editBase: {
        emp_code: 'J0001', nik: '1234', emp_name: 'Worker J',
        field: 'premi_jaga', value: 0, originalValue: 0,
        gang_code: 'B1H', type: 'PREMI', name: 'PREMI JAGA'
      },
      metadataJson: metadata,
      amountToSave: 8000 // totalAmount = sum items = 8000
    });
    expect(result.value).toBe(8000);
    expect(result.metadata_json).toBe(JSON.stringify(metadata));
  });

  it('syncs kendaraan metadata for PREMI ANGKUT TBS', () => {
    const metadata = {
      input_type: 'kendaraan',
      items: [
        { nomor_kendaraan: 'B1234AB', expense_code: 'TRANSPORT', jumlah: 3500 },
        { nomor_kendaraan: 'B5678CD', expense_code: 'TRANSPORT', jumlah: 2500 }
      ],
      total_amount: 6000
    };
    const result = buildPremiumDetailEdit({
      existingEdit: null,
      editBase: {
        emp_code: 'J0002', nik: '1235', emp_name: 'Worker K',
        field: 'premi_angkut_tbs', value: 0, originalValue: 0,
        gang_code: 'J3T', type: 'PREMI', name: 'PREMI ANGKUT TBS'
      },
      metadataJson: metadata,
      amountToSave: 6000
    });
    expect(result.value).toBe(6000);
    expect(result.metadata_json).toBe(JSON.stringify(metadata));
  });

  it('syncs blok,exp metadata for PREMI KINERJA', () => {
    const metadata = {
      input_type: 'blok,exp',
      blok_items: [
        { subblok: 'P0921', gang_code: 'B1H', jumlah: 2000 },
        { subblok: 'P0922', gang_code: 'B1H', jumlah: 1500 }
      ],
      expense: { expense_code: 'LABOUR', jumlah: 1000 },
      total_amount: 4500
    };
    const result = buildPremiumDetailEdit({
      existingEdit: null,
      editBase: {
        emp_code: 'E0001', nik: '1236', emp_name: 'Worker E',
        field: 'premi_kinerja', value: 0, originalValue: 0,
        gang_code: 'E2H', type: 'PREMI', name: 'PREMI KINERJA'
      },
      metadataJson: metadata,
      amountToSave: 4500
    });
    expect(result.value).toBe(4500);
    expect(result.metadata_json).toBe(JSON.stringify(metadata));
  });

  it('syncs exp metadata for PREMI JAGA TANGGUNG JAWAB', () => {
    const metadata = {
      input_type: 'exp',
      expense_code: 'WORKSHOP_CONTROL_ACCOUNT',
      jumlah: 5000,
      total_amount: 5000
    };
    const result = buildPremiumDetailEdit({
      existingEdit: null,
      editBase: {
        emp_code: 'H0001', nik: '1237', emp_name: 'Worker H',
        field: 'premi_jaga_tanggung_jawab', value: 0, originalValue: 0,
        gang_code: 'H1H', type: 'PREMI', name: 'PREMI JAGA TANGGUNG JAWAB'
      },
      metadataJson: metadata,
      amountToSave: 5000
    });
    expect(result.value).toBe(5000);
    expect(result.metadata_json).toBe(JSON.stringify(metadata));
  });

  it('preserves existing edit for blok PREMI JAGA when amountToSave matches existing value', () => {
    const existingEdit = {
      emp_code: 'J0001', nik: '1234', emp_name: 'Worker J',
      field: 'premi_jaga', value: 8000, originalValue: 0,
      gang_code: 'B1H', type: 'PREMI', name: 'PREMI JAGA',
      metadata_json: '{"input_type":"blok","items":[{"subblok":"P0921","gang_code":"B1H","jumlah":5000},{"subblok":"P0922","gang_code":"B1H","jumlah":3000}],"total_amount":8000}'
    };
    const metadata = {
      input_type: 'blok',
      items: [
        { subblok: 'P0921', gang_code: 'B1H', jumlah: 5000 },
        { subblok: 'P0922', gang_code: 'B1H', jumlah: 3000 }
      ],
      total_amount: 8000
    };
    const result = buildPremiumDetailEdit({
      existingEdit,
      editBase: existingEdit,
      metadataJson: metadata,
      amountToSave: 8000
    });
    expect(result.emp_code).toBe('J0001');
    expect(result.field).toBe('premi_jaga');
    expect(result.value).toBe(8000);
  });

  it('updates amount for blok when items change (PREMI JAGA partial edit)', () => {
    const existingEdit = {
      emp_code: 'J0001', nik: '1234', emp_name: 'Worker J',
      field: 'premi_jaga', value: 8000, originalValue: 0,
      gang_code: 'B1H', type: 'PREMI', name: 'PREMI JAGA',
      metadata_json: '{"input_type":"blok","items":[{"subblok":"P0921","gang_code":"B1H","jumlah":5000},{"subblok":"P0922","gang_code":"B1H","jumlah":3000}],"total_amount":8000}'
    };
    // User removes one item — now only P0921 with jumlah=5000
    const metadata = {
      input_type: 'blok',
      items: [{ subblok: 'P0921', gang_code: 'B1H', jumlah: 5000 }],
      total_amount: 5000
    };
    const result = buildPremiumDetailEdit({
      existingEdit,
      editBase: existingEdit,
      metadataJson: metadata,
      amountToSave: 5000 // totalAmount decreased from 8000 to 5000
    });
    expect(result.value).toBe(5000); // amount should be updated to new totalAmount
    expect(result.metadata_json).toBe(JSON.stringify(metadata));
  });

  it('still works for PREMI PRUNING (was in whitelist — no regression)', () => {
    const metadata = {
      input_type: 'blok',
      items: [{ subblok: 'P0921', gang_code: 'D1H', jumlah: 201549 }],
      total_amount: 201549
    };
    const result = buildPremiumDetailEdit({
      existingEdit: null,
      editBase: {
        emp_code: 'D0001', nik: '1238', emp_name: 'Worker D',
        field: 'premi_pruning', value: 0, originalValue: 0,
        gang_code: 'D1H', type: 'PREMI', name: 'PREMI PRUNING'
      },
      metadataJson: metadata,
      amountToSave: 201549
    });
    expect(result.value).toBe(201549);
  });

  it('handles amount input_type (no metadata, just nominal)', () => {
    // For amount type, metadataJson is null, amountToSave is the plain amount
    const result = buildPremiumDetailEdit({
      existingEdit: null,
      editBase: {
        emp_code: 'A0001', nik: '1239', emp_name: 'Worker A',
        field: 'premi_cuci_mobil', value: 0, originalValue: 0,
        gang_code: 'A1H', type: 'PREMI', name: 'PREMI CUCI MOBIL'
      },
      metadataJson: null,
      amountToSave: 100000
    });
    expect(result.value).toBe(100000);
    expect(result.metadata_json).toBeUndefined();
  });
});
