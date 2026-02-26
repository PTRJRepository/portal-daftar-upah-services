import { Elysia, t } from "elysia";
import { debug, error as logError } from "../utils/logger";
import { OtherIncomesService, OtherIncome } from "../services/otherIncomesService";

export const otherIncomesRoutes = new Elysia({ prefix: "/other-incomes" })

    .get("/", async ({ query }) => {
        try {
            const { year, month, divisionCode, gangCode } = query as any;
            if (!year || !month) {
                return { success: false, error: "Year and month are required parameters" };
            }

            const incomes = await OtherIncomesService.getIncomes(
                parseInt(year),
                parseInt(month),
                divisionCode,
                gangCode
            );
            return { success: true, data: incomes };
        } catch (error: any) {
            logError("OtherIncomesAPI", "Failed to fetch incomes", error);
            return { success: false, error: error.message };
        }
    })

    .post("/", async ({ body }) => {
        try {
            const data = body as OtherIncome;
            if (!data.nik || !data.period_year || !data.period_month || !data.income_type) {
                return { success: false, error: "Missing required fields" };
            }

            const newIncome = await OtherIncomesService.addIncome(data);
            if (newIncome) {
                return { success: true, data: newIncome };
            } else {
                return { success: false, error: "Failed to create income" };
            }
        } catch (error: any) {
            logError("OtherIncomesAPI", "Failed to create income", error);
            return { success: false, error: error.message };
        }
    })

    .put("/:id", async ({ params: { id }, body }) => {
        try {
            const data = body as Partial<OtherIncome>;
            const success = await OtherIncomesService.updateIncome(parseInt(id), data);
            return { success };
        } catch (error: any) {
            logError("OtherIncomesAPI", "Failed to update income", error);
            return { success: false, error: error.message };
        }
    })

    .delete("/:id", async ({ params: { id } }) => {
        try {
            const success = await OtherIncomesService.deleteIncome(parseInt(id));
            return { success };
        } catch (error: any) {
            logError("OtherIncomesAPI", "Failed to delete income", error);
            return { success: false, error: error.message };
        }
    });
