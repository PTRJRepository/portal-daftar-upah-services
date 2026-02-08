export interface PayrollComponentMetadata {
    source: 'DATABASE_PLANTWARE' | 'DATABASE_VENUS' | 'CALCULATION' | 'MANUAL' | 'DEFAULT';
    taxable?: boolean;
    description?: string;
    calculation_basis?: string;
    last_updated?: Date;
    [key: string]: any;
}

export interface PayrollComponent<T> {
    value: T;
    meta: PayrollComponentMetadata;
}

export interface PayrollComponentV2 {
    amount: number;
    meta: PayrollComponentMetadata;
}
