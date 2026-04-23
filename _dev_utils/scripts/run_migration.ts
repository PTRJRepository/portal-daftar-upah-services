import { historyDatabaseService } from "../../backend/src/services/historyDatabaseService.js";

console.log("Running migration for jabatan and is_spsi_member columns...");
await historyDatabaseService.migrateNewNikColumn();
console.log("Migration completed!");
