import {
    deriveInitialSpsiMember,
    resolveThrCompatibleEffectiveStartDate
} from "../utils/payrollProfileRules";

export class PayrollProfileSeedService {
    async buildSeedRowFromMarch(row: {
        emp_code: string;
        nik?: string | null;
        pot_spsi?: number | null;
        join_date?: string | null;
        app_join_date?: string | null;
        app_join_grp_date?: string | null;
    }) {
        return {
            emp_code: row.emp_code,
            nik: row.nik || null,
            is_spsi_member: deriveInitialSpsiMember(row.pot_spsi),
            effective_start_date: resolveThrCompatibleEffectiveStartDate(
                row.app_join_date,
                row.app_join_grp_date,
                row.join_date || null
            )
        };
    }
}

export const payrollProfileSeedService = new PayrollProfileSeedService();
