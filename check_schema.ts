/**
 * Check database schema for payroll_history_detail table
 * Run: bun run check_schema.ts
 */

import { Database } from './backend/src/db/client';

async function checkSchema() {
    console.log('=== CHECKING DATABASE SCHEMA ===\n');
    
    const db = Database.getExtendedInstance();
    
    try {
        console.log('1. Checking payroll_history_detail columns...\n');
        const columns = await db.query<{COLUMN_NAME: string; DATA_TYPE: string}>(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'dbo' 
              AND TABLE_NAME = 'payroll_history_detail'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log(`Found ${columns.length} columns:\n`);
        columns.forEach((col, i) => {
            console.log(`  ${i+1}. ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
        
        console.log('\n\n2. Checking PR_TASKREG columns...\n');
        const taskregCols = await db.query<{COLUMN_NAME: string; DATA_TYPE: string}>(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'dbo' 
              AND TABLE_NAME = 'PR_TASKREG'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log(`Found ${taskregCols.length} columns:\n`);
        taskregCols.forEach((col, i) => {
            console.log(`  ${i+1}. ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
        
        console.log('\n\n3. Checking PR_ADTRANS columns...\n');
        const adtransCols = await db.query<{COLUMN_NAME: string; DATA_TYPE: string}>(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'dbo' 
              AND TABLE_NAME = 'PR_ADTRANS'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log(`Found ${adtransCols.length} columns:\n`);
        adtransCols.forEach((col, i) => {
            console.log(`  ${i+1}. ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
        
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

checkSchema();
