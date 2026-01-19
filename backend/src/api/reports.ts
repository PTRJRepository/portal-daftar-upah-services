import { Elysia, t } from "elysia";
import { AuthService } from "../services/authService";
import { User } from "../types/user";
import { reportService } from "../services/reportService";

const authService = AuthService.getInstance();

// Helper to get user from header
async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    return authService.verifyToken(token);
}

// Simple in-memory job store
// In production, use Redis or database
const jobs: Map<string, { status: string; result?: any; error?: string; created_at: number }> = new Map();

// Cleanup old jobs periodically (every 1 hour)
setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs.entries()) {
        if (now - job.created_at > 3600000) { // 1 hour
            jobs.delete(id);
        }
    }
}, 3600000);

export const reportsRoutes = new Elysia({ prefix: "/reports" })
    .derive(async ({ headers }) => {
        const user = await getUserFromHeader(headers);
        return { currentUser: user };
    })
    .onBeforeHandle(({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })
    .post("/generate", async ({ body }) => {
        const { month, year, gang_code, loc_code } = body as any;

        // Generate job ID
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Store initial job state
        jobs.set(jobId, {
            status: "pending",
            created_at: Date.now()
        });

        // Start processing in background
        reportService.generateReport(month, year, gang_code, loc_code)
            .then(result => {
                const job = jobs.get(jobId);
                if (job) {
                    job.status = "completed";
                    job.result = result;
                }
            })
            .catch(error => {
                console.error(`Job ${jobId} failed:`, error);
                const job = jobs.get(jobId);
                if (job) {
                    job.status = "failed";
                    job.error = error.message || String(error);
                }
            });

        return { job_id: jobId, status: "pending" };
    }, {
        body: t.Object({
            month: t.Number(),
            year: t.Number(),
            gang_code: t.String(),
            loc_code: t.Optional(t.String())
        })
    })
    .get("/:job_id", async ({ params, set }) => {
        const job = jobs.get(params.job_id);
        if (!job) {
            set.status = 404;
            return { error: "Job not found" };
        }
        return job;
    });