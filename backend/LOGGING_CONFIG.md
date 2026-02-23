# Logging Configuration

## Environment Variables

Add these to your `.env` file:

```bash
# ===================================
# LOGGING CONFIGURATION
# ===================================

# Log Level: DEBUG | INFO | WARN | ERROR | SILENT
# - DEBUG: Shows all logs including query details (verbose)
# - INFO: Shows general operational info (default)
# - WARN: Shows warnings and errors only
# - ERROR: Shows errors only
# - SILENT: Suppresses all logs
LOG_LEVEL=INFO

# Enable file logging (true/false)
# When enabled, errors are written to logs/error.log
LOG_TO_FILE=true

# Path to error log file
# Default: backend/logs/error.log
LOG_FILE_PATH=logs/error.log

# Clear logs on startup (true/false)
# When true, deletes old log file when server starts
# When false, appends to existing log file with separator
CLEAR_LOGS_ON_STARTUP=true
```

## Log Levels Explained

| Level | Description | Example Use Cases |
|-------|-------------|-------------------|
| **DEBUG** | Verbose development logging | Query details, intermediate values, operation tracking |
| **INFO** | General operational info | Request tracking, operation start/complete, startup |
| **WARN** | Potential issues | Fallbacks, unexpected but recoverable situations |
| **ERROR** | Errors only | Exceptions, failures (always logged to file) |
| **SILENT** | No logs | Production when you want minimum output |

## Console Output

### Before (Noisy)
```
[DB] Sending query to server=SERVER_PROFILE_1, database=extend_db_ptrj
[DB] Sending query to server=SERVER_PROFILE_1, database=extend_db_ptrj
[DB] Sending query to server=SERVER_PROFILE_1, database=extend_db_ptrj
GET /payroll/report 245ms
GET /payroll/headers 123ms
[UPAH/ASSETS] Request: index-abc123.js, Resolving: ../frontend/dist/assets/index-abc123.js
[UPAH/ASSETS] Exists: true
```

### After (Clean with LOG_LEVEL=INFO)
```
GET /payroll/report 245ms
GET /payroll/headers 123ms
```

### Error Logging (Always Shown)
```
[ERROR] [DB] Gateway Error (503): Service unavailable
  at Database.query (client.ts:145)
```

## File Logging

Error logs are written to `logs/error.log` with timestamps:

```
[2026-02-22T10:30:45.123Z] [ERROR] [DB] Gateway Error (503): Service unavailable
[2026-02-22T10:30:46.234Z] [ERROR] [DB_TRANSACTION] Transaction failed: Timeout
```

## API Endpoints

### Get Error Log
```
GET /api/logs/error
```

Returns:
```json
{
  "success": true,
  "exists": true,
  "size": 12345,
  "modified": "2026-02-22T10:30:00.000Z",
  "content": "..."
}
```

### Get Last N Lines
```
GET /api/logs/error/tail/100
```

Returns the last 100 lines of the log file.

### Delete Log File
```
DELETE /api/logs/error
```

Clears the error log file.

### Get Log Status
```
GET /api/logs/status
```

Returns current logging configuration:
```json
{
  "logLevel": "INFO",
  "logToFile": true,
  "logFilePath": "logs/error.log",
  "clearLogsOnStartup": true
}
```

## Using the Logger in Code

```typescript
import { debug, info, warn, error, logger } from "../utils/logger";

// Debug - only shown when LOG_LEVEL=DEBUG
debug("CATEGORY", "Detailed message", data);

// Info - shown when LOG_LEVEL=INFO or lower
info("CATEGORY", "Operation completed", { count: 42 });

// Warning - shown when LOG_LEVEL=WARN or lower
warn("CATEGORY", "Using fallback value", { expected: 100, got: 50 });

// Error - ALWAYS shown and logged to file
error("CATEGORY", "Operation failed", errorObj, { context: "data" });

// Advanced usage
const sessionErrors = logger.getSessionErrors();
logger.setLevel(LogLevel.DEBUG);
logger.clearErrorBuffer();
```

## Best Practices

1. **Use appropriate categories**: `DB`, `API`, `PAYROLL`, `LEMBUR`, etc.
2. **Don't log sensitive data**: Passwords, tokens, personal info
3. **Use structured data**: Pass objects as args for better debugging
4. **Error logs go to file**: All `error()` calls are saved to file
5. **Keep console clean**: Set `LOG_LEVEL=WARN` in production

## Troubleshooting

### Logs not appearing?
- Check `LOG_LEVEL` is not set to `SILENT`
- Check `LOG_TO_FILE=true` for file logging
- Check file path permissions

### Old logs persisting?
- Set `CLEAR_LOGS_ON_STARTUP=true`
- Or manually: `DELETE /api/logs/error`

### Too much console output?
- Set `LOG_LEVEL=WARN` or `LOG_LEVEL=ERROR`
- Debug queries only show with `LOG_LEVEL=DEBUG`
