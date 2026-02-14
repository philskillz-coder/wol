@echo off
cd /d "%~dp0"
echo ========================================
echo Fixing Prisma Client Generation
echo ========================================
echo.

echo Stopping any processes that might be using Prisma files...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Cleaning Prisma cache...
if exist "node_modules\.prisma" rmdir /s /q "node_modules\.prisma"
if exist "node_modules\@prisma" rmdir /s /q "node_modules\@prisma"

echo Regenerating Prisma Client...
call npx prisma generate

if errorlevel 1 (
    echo.
    echo Error: Failed to generate Prisma Client
    echo Please make sure:
    echo 1. No other processes are using the Prisma files
    echo 2. You have write permissions in the node_modules directory
    echo 3. Try running this script as Administrator
    pause
    exit /b 1
)

echo.
echo Prisma Client generated successfully!
pause
