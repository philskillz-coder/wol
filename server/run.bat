@echo off
cd /d "%~dp0"
echo ========================================
echo Wake-on-LAN Server (Backend + Frontend)
echo ========================================
echo.
echo Current directory: %CD%
echo.

REM Start Backend
echo Starting Backend...
start "WoL Backend" cmd /k "cd /d %~dp0backend && run.bat"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend
echo Starting Frontend...
start "WoL Frontend" cmd /k "cd /d %~dp0frontend && run.bat"

echo.
echo Backend and Frontend are starting in separate windows.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit (this will NOT stop the servers)...
pause >nul
