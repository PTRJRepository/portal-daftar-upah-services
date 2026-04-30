import { describe, expect, it } from 'vitest';
import { buildPremiumDetailEdit } from './payrollPremiumDetailEdits';

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
});
