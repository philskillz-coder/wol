@echo off
cd /d "%~dp0"
echo ========================================
echo Wake-on-LAN Backend Server (Production)
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
    echo Error: .env file not found!
    echo Please create .env file from .env.example
    pause
    exit /b 1
)

REM Generate Prisma Client
echo Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo Failed to generate Prisma Client!
    pause
    exit /b 1
)
echo.

REM Build the application
echo Building application...
call npm run build
if errorlevel 1 (
    echo Failed to build application!
    pause
    exit /b 1
)
echo.

REM Run database migrations
echo Running database migrations...
call npx prisma migrate deploy
if errorlevel 1 (
    echo Migration failed!
    pause
    exit /b 1
)
echo.

REM Start the production server
echo Starting production server...
echo.
call npm run start:prod

pause
