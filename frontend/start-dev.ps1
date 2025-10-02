# Frontend Dev Server Startup Script
# Run this from PowerShell: .\start-dev.ps1

Write-Host "Starting Drawn of War Frontend..." -ForegroundColor Green
Write-Host ""

# Check if backend is running
Write-Host "Checking backend connection..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    Write-Host "✓ Backend is running on port 3001" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend not responding on port 3001" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure backend is running first!" -ForegroundColor Yellow
    Write-Host "  cd ..\backend" -ForegroundColor White
    Write-Host "  .\start-dev.ps1" -ForegroundColor White
    Write-Host ""
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne "y") {
        exit 1
    }
}

Write-Host ""
Write-Host "Starting Vite dev server..." -ForegroundColor Cyan
Write-Host ""

# Start vite
pnpm dev
