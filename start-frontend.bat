@echo off
echo ============================================
echo   Campus Digital Twin WebGIS - Frontend
echo ============================================
echo.

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [First run] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Please check Node.js installation.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed.
    echo.
)

echo ============================================
echo   Starting dev server...
echo   URL: http://localhost:5173
echo ============================================
echo.

call npm run dev

pause
