import { Elysia, t } from 'elysia';
import { employeeGangHistoryService } from '../services/employeeGangHistoryService';
import { error as logError } from '../utils/logger';

export const employeeGangHistoryRoutes = new Elysia({ prefix: '/employee-history' })
    .get('/gang-history/:identifier', async ({ params, set }) => {
        try {
            const history = await employeeGangHistoryService.getGangHistory(params.identifier);
            return { success: true, data: history };
        } catch (error: any) {
            logError("EmployeeHistoryAPI", "Failed to get gang history", error);
            set.status = 500;
            return { success: false, error: error.message };
        }
    })
    .get('/current-official/:nik', async ({ params, set }) => {
        try {
            const info = await employeeGangHistoryService.getCurrentOfficialInfo(params.nik);
            if (!info) {
                set.status = 404;
                return { success: false, error: "Employee not found" };
            }
            return { success: true, data: info };
        } catch (error: any) {
            logError("EmployeeHistoryAPI", "Failed to get current info", error);
            set.status = 500;
            return { success: false, error: error.message };
        }
    })
    .post('/resolve-latest-codes', async ({ body, set }) => {
        try {
            const map = await employeeGangHistoryService.resolveLatestEmpCodes(body.niks);
            // Convert Map to plain object for JSON response
            const result: Record<string, string> = {};
            map.forEach((val, key) => { result[key] = val; });
            return { success: true, data: result };
        } catch (error: any) {
            logError("EmployeeHistoryAPI", "Failed to resolve codes", error);
            set.status = 500;
            return { success: false, error: error.message };
        }
    }, {
        body: t.Object({
            niks: t.Array(t.String())
        })
    });
