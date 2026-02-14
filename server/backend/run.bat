@echo off
cd /d "%~dp0"
echo ========================================
echo Wake-on-LAN Backend Server
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

REM Check if .env exists
if not exist ".env" (
    echo Warning: .env file not found!
    echo Please create .env file from .env.example
    echo.
)

REM Generate Prisma Client
echo Generating Prisma Client...
call npx prisma generate --schema=./prisma/schema.prisma
if errorlevel 1 (
    echo Failed to generate Prisma Client!
    echo Trying to fix permissions...
    timeout /t 2 /nobreak >nul
    call npx prisma generate --schema=./prisma/schema.prisma
    if errorlevel 1 (
        echo Still failed. Please close any programs using the database and try again.
        pause
        exit /b 1
    )
)
echo.

REM Run database migrations (if needed)
echo Running database migrations...
call npx prisma migrate dev --name init
if errorlevel 1 (
    echo Migration failed or already applied. Continuing...
)
echo.

REM Start the development server
echo Starting development server...
echo.
call npm run start:dev

pause
