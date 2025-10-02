@echo off
echo Starting Drawn of War Backend...
echo.

REM Check if .env exists
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and add your API keys
    echo.
    echo Run: copy .env.example .env
    echo.
    pause
    exit /b 1
)

echo Starting server with tsx...
echo.

REM Use node_modules\.bin\tsx directly
node_modules\.bin\tsx watch --clear-screen=false src\index.ts
