@echo off
cd /d "%~dp0"
echo Fixing TypeScript errors...
echo.

echo Installing missing dependencies...
call npm install @nestjs/mapped-types @nestjs/axios
echo.

echo Cleaning TypeScript cache...
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"
if exist ".nest" rmdir /s /q ".nest"
echo.

echo Regenerating Prisma Client...
call npx prisma generate
echo.

echo Done! Try running the server again.
pause
