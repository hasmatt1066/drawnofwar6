# Backend Dev Server Startup Script
# Run this from PowerShell: .\start-dev.ps1

Write-Host "Starting Drawn of War Backend Server..." -ForegroundColor Green
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and add your API keys" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run this command:" -ForegroundColor Cyan
    Write-Host "  Copy-Item .env.example .env" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Check if Redis is running
Write-Host "Checking Redis connection..." -ForegroundColor Cyan
$redisTest = docker ps --filter "name=redis-dev" --format "{{.Names}}" 2>$null
if ($redisTest -eq "redis-dev") {
    Write-Host "✓ Redis container is running" -ForegroundColor Green
} else {
    Write-Host "✗ Redis container not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Start Redis with:" -ForegroundColor Yellow
    Write-Host "  docker run -d -p 6379:6379 --name redis-dev redis:alpine" -ForegroundColor White
    Write-Host ""
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne "y") {
        exit 1
    }
}

Write-Host ""
Write-Host "Starting server with tsx..." -ForegroundColor Cyan
Write-Host ""

# Try pnpm first, fallback to npx
try {
    pnpm dev
} catch {
    Write-Host "pnpm failed, trying npx..." -ForegroundColor Yellow
    npx tsx watch --clear-screen=false src/index.ts
}
