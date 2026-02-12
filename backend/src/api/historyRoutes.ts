/**
 * History Routes
 * 
 * API endpoints untuk operasi history payroll:
 * - POST /payroll/history/seed - Menyimpan data history dari periode tertentu
 * - GET /payroll/history - Mengambil data history
 * - GET /payroll/history/:id - Mengambil detail history
 * - DELETE /payroll/history/:id - Menghapus data history
 * - POST /payroll/history/:id/lock - Mengunci data history
 * - GET /payroll/history/audit - Audit trail
 */

import { Elysia, t } from "elysia";
import { historyDatabaseService } from "../services/historyDatabaseService";
import { historySeederService, SeederOptions } from "../services/historySeederService";
import { Config } from "../config";

// Helper to get client IP
function getClientIP(headers: Record<string, string | undefined>): string {
    return headers["x-forwarded-for"] ||
        headers["x-real-ip"] ||
        headers["remote-addr"] ||
        "unknown";
}

export const historyRoutes = new Elysia({ prefix: "/payroll/history" })
    // Health check
    .get("/health", async () => {
        const isHistoryMode = historyDatabaseService.isHistoryMode();
        return {
            success: true,
            history_mode: isHistoryMode,
            run_mode: Config.RUN_MODE,
            databases: {
                payroll: isHistoryMode ? Config.DB_EXTEND_DATABASE : Config.DEFAULT_DATABASE,
                transaction: isHistoryMode ? process.env.DB_EXTEND_TRANS_DATABASE : Config.DEFAULT_DATABASE
            },
            timestamp: new Date().toISOString()
        };
    })

    // Seed history data
    .post("/seed", async ({ body, headers, set }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        // Check if history mode is enabled
        if (!historyDatabaseService.isHistoryMode()) {
            set.status = 400;
            return {
                success: false,
                error: "History mode is not enabled. Set RUN_MODE=prod in .env"
            };
        }

        const { period_month, period_year, division_code, gang_code, force } = body;
        const createdBy = headers["x-user-id"] || "system";
        const ipAddress = getClientIP(headers);
        const userAgent = headers["user-agent"] || "unknown";

        try {
            const options: SeederOptions = {
                periodMonth: period_month,
                periodYear: period_year,
                divisionCode: division_code,
                gangCode: gang_code,
                createdBy,
                ipAddress,
                userAgent,
                force: force || false
            };

            const result = await historySeederService.seedPayrollHistory(options);

            if (!result.success) {
                set.status = 500;
            }

            return {
                success: result.success,
                data: {
                    history_id: result.history_id,
                    period_month: result.period_month,
                    period_year: result.period_year,
                    division_code: result.division_code,
                    gang_code: result.gang_code,
                    total_employees: result.total_employees,
                    records_inserted: result.records_inserted
                },
                errors: result.errors.length > 0 ? result.errors : undefined
            };
        } catch (error: any) {
            console.error("[HistoryRoutes] Seed error:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Failed to seed history"
            };
        }
    }, {
        body: t.Object({
            period_month: t.Numeric(),
            period_year: t.Numeric(),
            division_code: t.String(),
            gang_code: t.Optional(t.String()),
            force: t.Optional(t.Boolean())
        })
    })

    // Get history list
    .get("/", async ({ query, headers, set }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        const periodMonth = query.period_month ? parseInt(query.period_month) : undefined;
        const periodYear = query.period_year ? parseInt(query.period_year) : undefined;
        const divisionCode = query.division_code;
        const gangCode = query.gang_code;

        try {
            const histories = await historyDatabaseService.getPayrollHistoryMaster(
                periodMonth || 0,
                periodYear || 0,
                divisionCode,
                gangCode
            );

            return {
                success: true,
                data: histories,
                count: histories.length,
                mode: historyDatabaseService.isHistoryMode() ? "history" : "realtime"
            };
        } catch (error: any) {
            console.error("[HistoryRoutes] Get history error:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Failed to fetch history"
            };
        }
    }, {
        query: t.Object({
            period_month: t.Optional(t.String()),
            period_year: t.Optional(t.String()),
            division_code: t.Optional(t.String()),
            gang_code: t.Optional(t.String())
        })
    })

    // Get history by ID with details
    .get("/:history_id", async ({ params, headers, set }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        const { history_id } = params;

        try {
            // Get master record
            const masters = await historyDatabaseService.getPayrollHistoryMaster(0, 0);
            const master = masters.find(m => m.history_id === history_id);

            if (!master) {
                set.status = 404;
                return {
                    success: false,
                    error: "History not found"
                };
            }

            // Get details
            const details = await historyDatabaseService.getPayrollHistoryDetails(master.id!);

            // Get metadata
            const metadata = await historyDatabaseService.getHistoryMetadata(history_id);

            return {
                success: true,
                data: {
                    master,
                    details,
                    metadata
                }
            };
        } catch (error: any) {
            console.error("[HistoryRoutes] Get history detail error:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Failed to fetch history detail"
            };
        }
    })

    // Delete history
    .delete("/:history_id", async ({ params, headers, set }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        const { history_id } = params;
        const performedBy = headers["x-user-id"] || "system";

        try {
            // Check if history exists
            const masters = await historyDatabaseService.getPayrollHistoryMaster(0, 0);
            const master = masters.find(m => m.history_id === history_id);

            if (!master) {
                set.status = 404;
                return {
                    success: false,
                    error: "History not found"
                };
            }

            // Check if locked
            if (master.is_locked) {
                set.status = 403;
                return {
                    success: false,
                    error: `History is locked: ${master.lock_reason}`
                };
            }

            // Delete transaction history
            await historyDatabaseService.deleteTransactionHistory(history_id);

            // Delete payroll history (cascade will delete details)
            const db = historyDatabaseService.getPayrollDatabase();
            await db.query(
                "DELETE FROM dbo.payroll_history_master WHERE history_id = ?",
                [history_id]
            );

            // Save metadata
            await historyDatabaseService.saveHistoryMetadata({
                history_id,
                operation: "DELETE",
                entity_type: "BATCH",
                period_month: master.period_month,
                period_year: master.period_year,
                division_code: master.division_code,
                gang_code: master.gang_code,
                description: `Deleted history for ${master.division_code} - ${master.gang_code}`,
                performed_by: performedBy
            });

            return {
                success: true,
                message: "History deleted successfully"
            };
        } catch (error: any) {
            console.error("[HistoryRoutes] Delete history error:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Failed to delete history"
            };
        }
    })

    // Lock history
    .post("/:history_id/lock", async ({ params, body, headers, set }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        const { history_id } = params;
        const { reason } = body;
        const performedBy = headers["x-user-id"] || "system";

        try {
            // Get master record
            const masters = await historyDatabaseService.getPayrollHistoryMaster(0, 0);
            const master = masters.find(m => m.history_id === history_id);

            if (!master) {
                set.status = 404;
                return {
                    success: false,
                    error: "History not found"
                };
            }

            // Lock
            await historyDatabaseService.lockPayrollHistory(
                master.period_month,
                master.period_year,
                master.division_code,
                master.gang_code,
                reason,
                performedBy
            );

            // Save metadata
            await historyDatabaseService.saveHistoryMetadata({
                history_id,
                operation: "LOCK",
                entity_type: "PAYROLL_MASTER",
                entity_id: master.id,
                period_month: master.period_month,
                period_year: master.period_year,
                division_code: master.division_code,
                gang_code: master.gang_code,
                description: reason,
                performed_by: performedBy
            });

            return {
                success: true,
                message: "History locked successfully"
            };
        } catch (error: any) {
            console.error("[HistoryRoutes] Lock history error:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Failed to lock history"
            };
        }
    }, {
        body: t.Object({
            reason: t.String()
        })
    })

    // Get audit trail
    .get("/audit/trail", async ({ query, headers, set }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        const historyId = query.history_id;
        const operation = query.operation;
        const performedBy = query.performed_by;
        const startDate = query.start_date ? new Date(query.start_date) : undefined;
        const endDate = query.end_date ? new Date(query.end_date) : undefined;

        try {
            const db = historyDatabaseService.getTransactionDatabase();

            let sql = `
                SELECT * FROM dbo.history_metadata
                WHERE 1=1
            `;
            const params: any[] = [];

            if (historyId) {
                sql += ` AND history_id = ?`;
                params.push(historyId);
            }

            if (operation) {
                sql += ` AND operation = ?`;
                params.push(operation);
            }

            if (performedBy) {
                sql += ` AND performed_by = ?`;
                params.push(performedBy);
            }

            if (startDate) {
                sql += ` AND performed_at >= ?`;
                params.push(startDate);
            }

            if (endDate) {
                sql += ` AND performed_at <= ?`;
                params.push(endDate);
            }

            sql += ` ORDER BY performed_at DESC`;

            const metadata = await db.query(sql, params);

            return {
                success: true,
                data: metadata,
                count: metadata.length
            };
        } catch (error: any) {
            console.error("[HistoryRoutes] Get audit trail error:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Failed to fetch audit trail"
            };
        }
    }, {
        query: t.Object({
            history_id: t.Optional(t.String()),
            operation: t.Optional(t.String()),
            performed_by: t.Optional(t.String()),
            start_date: t.Optional(t.String()),
            end_date: t.Optional(t.String())
        })
    })

    // Get available periods
    .get("/periods/available", async ({ headers, set }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        try {
            const db = historyDatabaseService.getPayrollDatabase();

            const periods = await db.query<{ period_year: number; period_month: number }>(`
                SELECT DISTINCT period_year, period_month
                FROM dbo.payroll_history_master
                ORDER BY period_year DESC, period_month DESC
            `);

            return {
                success: true,
                data: periods
            };
        } catch (error: any) {
            console.error("[HistoryRoutes] Get periods error:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Failed to fetch periods"
            };
        }
    });
