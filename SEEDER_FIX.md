# Seeder Fix - Masalah Seeder Tidak Bisa Berhenti/Continue

## Problem
Seeder mengalami masalah dimana proses seeding bisa terus-menerus berjalan tanpa bisa dihentikan, disebabkan oleh:
1. **Tidak ada timeout protection** - Seeder bisa berjalan indefinitely tanpa batas waktu
2. **Stuck `is_running` flag** - Jika seeder crash atau error, flag `is_running` tidak di-reset dengan benar
3. **Tidak ada force reset mechanism** - Tidak ada cara untuk membatalkan seeder yang sedang stuck
4. **No duplicate run prevention** - Multiple seeder bisa dijalankan bersamaan

## Solution Implemented

### 1. Timeout Protection (Backend)
**File:** `backend/src/services/historySeederService.ts`

```typescript
// Timeout protection (30 minutes max)
private static readonly MAX_RUN_TIME_MS = 30 * 60 * 1000; // 30 minutes
private static startTime: number | null = null;
```

**Features:**
- ⏱️ **Auto-detect stuck seeder** - Jika berjalan lebih dari 30 menit, otomatis di-reset
- 🔍 **Progress check** - Setiap kali `getProgress()` dipanggil, dicek apakah sudah timeout
- 🔄 **Auto-recovery** - Otomatis reset jika terdetected stuck

### 2. Force Reset Mechanism
**Backend Endpoint:** `POST /payroll/history/seed/reset`

```typescript
public static forceReset(reason: string = 'Manual reset'): void {
    // Clear timeout interval
    // Reset startTime
    // Reset progress dengan message
}
```

**Features:**
- 🛑 **Manual reset** - User bisa manual reset via API/UI
- 📝 **Audit trail** - Reason dicatat untuk tracking
- 🧹 **Proper cleanup** - Semua state di-reset dengan benar

### 3. Duplicate Run Prevention
**File:** `backend/src/services/historySeederService.ts`

```typescript
// Check if another seeder is already running
if (HistorySeederService.progress.is_running) {
    const elapsed = HistorySeederService.startTime 
        ? Math.round((Date.now() - HistorySeederService.startTime) / 1000) 
        : 0;
    console.warn(`⚠️ Seeder already running for ${elapsed}s. Rejecting new request.`);
    result.errors.push(`Seeder already running (started ${elapsed}s ago). Please wait or force reset.`);
    return result;
}
```

**Features:**
- 🚫 **Prevent concurrent runs** - Tidak bisa menjalankan seeder sementara yang lain sedang berjalan
- ⏱️ **Show elapsed time** - Info berapa lama seeder sudah berjalan
- 💡 **Helpful error message** - User tahu harus menunggu atau force reset

### 4. Proper Cleanup in Error Handling
**File:** `backend/src/services/historySeederService.ts`

```typescript
try {
    HistorySeederService.startTime = Date.now();
    // ... seeding logic ...
    HistorySeederService.updateProgress({ is_running: false, ... });
    HistorySeederService.startTime = null; // Reset timeout tracker
} catch (error: any) {
    HistorySeederService.updateProgress({ is_running: false, ... });
    HistorySeederService.startTime = null; // Reset timeout tracker
}
```

**Features:**
- ✅ **Always cleanup** - `startTime` selalu di-reset baik success maupun error
- 🛡️ **Prevents zombie state** - Tidak ada state yang tertinggal

### 5. Frontend UI Enhancement
**File:** `frontend/src/pages/AggregationSeederPage.jsx`

**New Button:**
```jsx
{(isHistoryRunning || (seederProgress && seederProgress.is_running)) && (
    <button onClick={handleResetSeeder} className="agg-btn">
        ⚠️ Reset Stuck Seeder
    </button>
)}
```

**Features:**
- 🎯 **Conditional display** - Button hanya muncul saat seeder sedang running
- ⚠️ **Confirmation dialog** - User harus confirm sebelum reset
- 📊 **Real-time feedback** - Status update langsung ke user

### 6. Frontend Service Function
**File:** `frontend/src/services/historyService.js`

```javascript
export async function resetSeeder(token, reason = 'Manual reset from UI') {
    const url = `${baseUrl}/payroll/history/seed/reset`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
    });
    return response.json();
}
```

## How It Works

### Normal Flow
```
1. User clicks "Save to History"
2. Backend checks if seeder already running → If yes, reject with helpful message
3. Set `startTime = Date.now()` and `is_running = true`
4. Seeder runs...
5. On success/error: `is_running = false` and `startTime = null`
```

### Stuck Seeder Detection
```
1. Frontend polls `GET /payroll/history/seed/progress` every 2s
2. `getProgress()` checks: `if (elapsed > 30 minutes)`
3. If stuck → Auto-reset with message "Stuck timeout - auto reset"
4. Next poll shows `is_running: false`
```

### Manual Reset Flow
```
1. User sees "⚠️ Reset Stuck Seeder" button (only when running)
2. Clicks button → Confirmation dialog
3. Frontend calls `POST /payroll/history/seed/reset`
4. Backend executes `forceReset(reason)`
5. All state cleaned up
6. User can run seeder again
```

## API Endpoints

### New Endpoint: Force Reset Seeder
```http
POST /payroll/history/seed/reset
Authorization: Bearer <token>
Content-Type: application/json

{
    "reason": "Manual reset from UI"  // Optional
}
```

**Response:**
```json
{
    "success": true,
    "message": "Seeder has been reset successfully",
    "reason": "Manual reset from UI"
}
```

### Existing Endpoint: Get Progress (Enhanced)
```http
GET /payroll/history/seed/progress
Authorization: Bearer <token>
```

**Response:**
```json
{
    "is_running": false,
    "current_step": "✅ Selesai!",
    "gangs_total": 10,
    "gangs_done": 10,
    "employees_processed": 250,
    "started_at": "2026-04-04T10:00:00.000Z",
    "last_update": "2026-04-04T10:05:00.000Z"
}
```

## Testing Scenarios

### ✅ Scenario 1: Normal Seeder Run
1. Run seeder for small division
2. Should complete normally
3. `is_running` should be `false` after completion
4. `startTime` should be `null`

### ✅ Scenario 2: Duplicate Run Prevention
1. Start seeder for large division (ALL)
2. Try to start another seeder while first is running
3. Should get error: "Seeder already running (started Xs ago)"
4. Wait for completion or use reset

### ✅ Scenario 3: Manual Reset
1. Start seeder
2. Click "⚠️ Reset Stuck Seeder" button
3. Confirm dialog
4. Should see success message in logs
5. Should be able to run seeder again

### ✅ Scenario 4: Auto Timeout (Simulated)
1. Manually set `startTime = Date.now() - 31 minutes`
2. Call `getProgress()`
3. Should auto-reset with timeout message
4. Next call should show `is_running: false`

## Benefits

1. **🛡️ No More Infinite Runs** - Maximum 30 menit timeout
2. **🔄 Recoverable** - Bisa force reset jika stuck
3. **🚫 No Concurrent Runs** - Prevents resource conflicts
4. **📊 Better UX** - User tahu status dan bisa take action
5. **🧹 Clean State** - Selalu proper cleanup

## Migration Notes

- ✅ **No database changes needed**
- ✅ **No environment variables needed**
- ✅ **Backward compatible** - Existing code tetap works
- ✅ **Zero downtime deployment** - Can deploy while system running

## Files Changed

### Backend
1. `backend/src/services/historySeederService.ts`
   - Added timeout protection constants
   - Added `startTime` tracking
   - Added `forceReset()` static method
   - Enhanced `getProgress()` with timeout detection
   - Added duplicate run prevention
   - Proper cleanup in try/catch/finally

2. `backend/src/api/historyRoutes.ts`
   - Added `POST /payroll/history/seed/reset` endpoint

### Frontend
1. `frontend/src/services/historyService.js`
   - Added `resetSeeder()` function

2. `frontend/src/pages/AggregationSeederPage.jsx`
   - Added `handleResetSeeder()` handler
   - Added conditional reset button
   - Imported `resetSeeder` function

## Future Improvements

1. **Configurable timeout** - Allow different timeout per seeder mode
2. **Progress persistence** - Save progress to database for crash recovery
3. **Pause/Resume** - Ability to pause and resume seeding
4. **Estimated time** - Show ETA based on current speed
5. **Cancel vs Reset** - Differentiate between cancel (keep partial) vs reset (full cleanup)

## Troubleshooting

### Seeder Still Stuck After Reset?
```bash
# Check backend logs for:
[HistorySeeder] Force resetting progress. Reason: ...
[HistorySeeder] ⚠️ Seeder detected as STUCK!

# If still stuck, restart backend server
cd backend
bun run dev
```

### Reset Button Not Showing?
```javascript
// Check browser console for errors
// Verify seederProgress state
console.log(seederProgress);

// Should show is_running: true when seeder is active
```

### API Returns 401 on Reset?
```bash
# Check token is valid
# Verify authorization header
curl -X POST http://localhost:8002/payroll/history/seed/reset \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Test"}'
```

## Summary

Fix ini menyelesaikan masalah seeder yang tidak bisa berhenti/terus-menerus dengan:
- ⏱️ **Auto timeout** setelah 30 menit
- 🛑 **Force reset** mechanism via API & UI
- 🚫 **Prevent duplicate** concurrent runs
- 🧹 **Proper cleanup** di semua code paths
- 📊 **Better UX** dengan real-time progress dan actionable buttons

**Result:** Seeder sekarang **reliable, recoverable, dan user-friendly**! 🎉
