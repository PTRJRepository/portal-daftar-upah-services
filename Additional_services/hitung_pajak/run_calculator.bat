@echo off
REM Kalkulator Pajak PPh21 TER - Launcher
REM =======================================

echo.
echo ===============================================
echo   KALKULATOR PAJAK PPh21 TER (PP 58/2023)
echo ===============================================
echo.
echo Starting application...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.7+ to run this application
    pause
    exit /b 1
)

REM Run the calculator application
cd /d "%~dp0"
python pajak_calculator_gui.py

if errorlevel 1 (
    echo.
    echo Application closed with error.
    pause
)
