/**
 * Admin Utility: Duplicate NIK Manual Review
 * 
 * This script generates a comprehensive report for HR to manually review
 * duplicate NIK cases and recommend actions.
 * 
 * Run: cd backend && bun run ../_dev_utils/scripts/admin_review_duplicate_nik.ts
 */

import { duplicateNikMitigationService } from '../../backend/src/services/DuplicateNikMitigationService';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface ReviewReport {
    generated_at: string;
    summary: {
        total_duplicate_niks: number;
        total_affected_employees: number;
        likely_errors: number;
        likely_legitimate: number;
        uncertain: number;
        resolved_automatically: number;
    };
    high_priority_cases: HighPriorityCase[];
    all_duplicates: DuplicateSummary[];
}

interface HighPriorityCase {
    nik: string;
    assessment: 'likely_error' | 'likely_legitimate' | 'uncertain';
    employee_count: number;
    active_count: number;
    recommendation: string;
    reasons: string[];
    employees: Array<{
        emp_code: string;
        emp_name: string;
        gang_code: string;
        division_code: string;
        status: string;
        join_date?: string;
    }>;
    suggested_action: string;
}

interface DuplicateSummary {
    nik: string;
    employee_count: number;
    is_resolved: boolean;
    assessment?: string;
}

async function generateAdminReviewReport() {
    console.log('='.repeat(80));
    console.log('📋 PT REBINMAS - DUPLICATE NIK MANUAL REVIEW REPORT');
    console.log('='.repeat(80));
    console.log(`\nGenerated at: ${new Date().toISOString()}\n`);

    // =========================================================================
    // Step 1: Get all duplicate NIKs
    // =========================================================================
    console.log('📊 Step 1: Detecting all duplicate NIKs...');
    const report = await duplicateNikMitigationService.generateDuplicateReport();
    
    console.log(`   ✅ Found ${report.total_duplicate_niks} duplicate NIKs`);
    console.log(`   ✅ Affecting ${report.total_affected_employees} employees\n`);

    // =========================================================================
    // Step 2: Assess legitimacy for each duplicate
    // =========================================================================
    console.log('🔍 Step 2: Assessing duplicate legitimacy (this may take a while)...');
    
    const highPriorityCases: HighPriorityCase[] = [];
    const allDuplicates: DuplicateSummary[] = [];
    let likelyErrors = 0;
    let likelyLegitimate = 0;
    let uncertain = 0;
    let resolvedAutomatically = 0;

    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    const duplicates = report.duplicates;
    
    for (let i = 0; i < duplicates.length; i += batchSize) {
        const batch = duplicates.slice(i, i + batchSize);
        console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(duplicates.length / batchSize)}...`);
        
        for (const dup of batch) {
            // Assess legitimacy
            const assessment = await duplicateNikMitigationService.assessDuplicateLegitimacy(dup.nik);
            
            // Check if resolved automatically
            const hasActive = dup.employees.some(e => e.status === '1');
            const isActiveResolved = hasActive && dup.employees.filter(e => e.status === '1').length === 1;
            
            if (isActiveResolved) {
                resolvedAutomatically++;
            }

            // Count by assessment
            if (assessment.assessment === 'likely_error') likelyErrors++;
            else if (assessment.assessment === 'likely_legitimate') likelyLegitimate++;
            else uncertain++;

            // Add to summary
            allDuplicates.push({
                nik: dup.nik,
                employee_count: dup.employee_count,
                is_resolved: isActiveResolved,
                assessment: assessment.assessment
            });

            // Add to high priority if it's a likely error or has multiple active employees
            const activeCount = dup.employees.filter(e => e.status === '1').length;
            
            if (
                assessment.assessment === 'likely_error' ||
                activeCount > 1 ||
                dup.employee_count >= 5
            ) {
                highPriorityCases.push({
                    nik: dup.nik,
                    assessment: assessment.assessment,
                    employee_count: dup.employee_count,
                    active_count: activeCount,
                    recommendation: assessment.recommendation,
                    reasons: assessment.reasons,
                    employees: dup.employees.map(e => ({
                        emp_code: e.emp_code,
                        emp_name: e.emp_name,
                        gang_code: e.gang_code || 'N/A',
                        division_code: e.division_code || 'N/A',
                        status: e.status === '1' ? 'Active' : 'Inactive',
                        join_date: e.join_date
                    })),
                    suggested_action: generateSuggestedAction(dup, activeCount, assessment.assessment)
                });
            }
        }
    }

    // Sort high priority cases
    highPriorityCases.sort((a, b) => {
        // Priority: likely_error > uncertain > likely_legitimate
        const priorityOrder = { 'likely_error': 0, 'uncertain': 1, 'likely_legitimate': 2 };
        const priorityDiff = priorityOrder[a.assessment] - priorityOrder[b.assessment];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then by employee count
        return b.employee_count - a.employee_count;
    });

    // =========================================================================
    // Step 3: Generate report
    // =========================================================================
    console.log('\n📝 Step 3: Generating report...\n');

    const reviewReport: ReviewReport = {
        generated_at: new Date().toISOString(),
        summary: {
            total_duplicate_niks: report.total_duplicate_niks,
            total_affected_employees: report.total_affected_employees,
            likely_errors: likelyErrors,
            likely_legitimate: likelyLegitimate,
            uncertain: uncertain,
            resolved_automatically: resolvedAutomatically
        },
        high_priority_cases: highPriorityCases.slice(0, 50), // Top 50
        all_duplicates: allDuplicates
    };

    // =========================================================================
    // Step 4: Print summary
    // =========================================================================
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nTotal Duplicate NIKs: ${report.total_duplicate_niks}`);
    console.log(`Total Affected Employees: ${report.total_affected_employees}`);
    console.log(`\nAssessment Breakdown:`);
    console.log(`  🔴 Likely Errors: ${likelyErrors} (${((likelyErrors / report.total_duplicate_niks) * 100).toFixed(1)}%)`);
    console.log(`  🟡 Uncertain: ${uncertain} (${((uncertain / report.total_duplicate_niks) * 100).toFixed(1)}%)`);
    console.log(`  🟢 Likely Legitimate: ${likelyLegitimate} (${((likelyLegitimate / report.total_duplicate_niks) * 100).toFixed(1)}%)`);
    console.log(`  ✅ Resolved Automatically: ${resolvedAutomatically} (${((resolvedAutomatically / report.total_duplicate_niks) * 100).toFixed(1)}%)`);
    console.log(`\nHigh Priority Cases: ${highPriorityCases.length}`);

    // =========================================================================
    // Step 5: Print top cases
    // =========================================================================
    if (highPriorityCases.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('🔴 TOP 10 HIGH PRIORITY CASES');
        console.log('='.repeat(80));

        highPriorityCases.slice(0, 10).forEach((case_, idx) => {
            console.log(`\n${idx + 1}. NIK: ${case_.nik}`);
            console.log(`   Assessment: ${case_.assessment.toUpperCase()}`);
            console.log(`   Employees: ${case_.employee_count} (${case_.active_count} active)`);
            console.log(`   Reasons:`);
            case_.reasons.forEach(reason => console.log(`     - ${reason}`));
            console.log(`   Suggested Action: ${case_.suggested_action}`);
            console.log(`   Employees:`);
            case_.employees.forEach(emp => {
                console.log(`     - ${emp.emp_code} | ${emp.emp_name} | ${emp.gang_code} | ${emp.status}`);
            });
        });
    }

    // =========================================================================
    // Step 6: Save to file
    // =========================================================================
    const outputPath = join(__dirname, '../../_dev_utils/output/duplicate_nik_review_report.json');
    writeFileSync(outputPath, JSON.stringify(reviewReport, null, 2), 'utf-8');
    
    console.log('\n' + '='.repeat(80));
    console.log('💾 REPORT SAVED');
    console.log('='.repeat(80));
    console.log(`\nFull report saved to: ${outputPath}`);
    
    // Also save CSV for easy Excel viewing
    const csvPath = join(__dirname, '../../_dev_utils/output/duplicate_nik_review.csv');
    const csvContent = convertToCSV(allDuplicates);
    writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`CSV export saved to: ${csvPath}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ REVIEW COMPLETE');
    console.log('='.repeat(80));
    console.log('\n📋 NEXT STEPS FOR HR:');
    console.log('   1. Review high priority cases listed above');
    console.log('   2. Open the JSON report for detailed analysis');
    console.log('   3. Use the CSV file for bulk processing in Excel');
    console.log('   4. For each likely error:');
    console.log('      - Verify with employee records');
    console.log('      - Identify the correct EmpCode to keep');
    console.log('      - Submit request to IT to merge/delete duplicate records');
    console.log('   5. For uncertain cases:');
    console.log('      - Check physical employee files');
    console.log('      - Verify with payroll department');
    console.log('      - May require employee interview\n');
}

function generateSuggestedAction(
    dup: any,
    activeCount: number,
    assessment: string
): string {
    if (activeCount === 1) {
        return 'Keep the active employee, archive inactive duplicates';
    }
    
    if (activeCount > 1) {
        return `URGENT: ${activeCount} active employees - verify which one is legitimate`;
    }
    
    if (assessment === 'likely_error') {
        return 'Investigate data entry error - check original hiring documents';
    }
    
    if (dup.employee_count >= 5) {
        return 'Large duplicate set - likely systematic error, review HR data entry process';
    }
    
    return 'Manual review required - contact HR department';
}

function convertToCSV(duplicates: DuplicateSummary[]): string {
    const headers = ['NIK', 'Employee Count', 'Is Resolved', 'Assessment'];
    const rows = duplicates.map(d => [
        d.nik,
        d.employee_count.toString(),
        d.is_resolved ? 'Yes' : 'No',
        d.assessment || ''
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// Run the report
generateAdminReviewReport()
    .then(() => {
        console.log('\nReport generation completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error generating report:', error);
        process.exit(1);
    });
