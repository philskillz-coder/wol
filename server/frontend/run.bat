@echo off
cd /d "%~dp0"
echo ========================================
echo Wake-on-LAN Frontend
echo ========================================
echo.
echo Current directory: %CD%
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
)

REM Start the development server
echo Starting development server...
echo Frontend will be available at http://localhost:5173
echo.
call npm run dev

pause
