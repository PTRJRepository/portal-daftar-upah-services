@echo off
echo === TEST SEEDER VIA CURL (PASTI JALAN) ===
echo.
echo Menggunakan system auth token (tidak perlu external auth)
echo.

set BACKEND_URL=http://localhost:8002
set AUTH_TOKEN=Bearer system
set MONTH=3
set YEAR=2026
set DIVISION=P1A

echo [1/3] Testing backend connection...
curl -s %BACKEND_URL%/payroll/history/health
echo.
echo.

echo [2/3] Running seeder untuk %DIVISION% %MONTH%/%YEAR%...
echo.

curl -X POST %BACKEND_URL%/payroll/history/seed ^
  -H "Authorization: %AUTH_TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"period_month\":%MONTH%,\"period_year\":%YEAR%,\"division_code\":\"%DIVISION%\",\"force\":false,\"seederMode\":\"PAYROLL\"}"

echo.
echo.
echo [3/3] Done! Check output above.
echo.
echo Jika success, akan ada output seperti:
echo   {"success":true,"data":{"history_id":"...","total_employees":...}}
echo.
pause
