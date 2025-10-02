@echo off
echo ========================================
echo   Drawn of War - Backend Server
echo ========================================
echo.

cd backend

REM Check if .env exists
if not exist ".env" (
    echo [ERROR] .env file not found!
    echo.
    echo Please run: copy .env.example .env
    echo Then edit .env and add your API keys
    echo.
    pause
    exit /b 1
)

echo [OK] .env file found
echo.
echo Starting backend server...
echo Press Ctrl+C to stop
echo.

REM Run from project root so pnpm workspace works
cd ..
pnpm dev:backend
