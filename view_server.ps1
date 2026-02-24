Write-Host "Starting simple Python HTTP server for View Mode on port 8000..." -ForegroundColor Cyan
Write-Host "Access the app at: http://localhost:8000/frontend/index.html" -ForegroundColor Yellow
python -m http.server 8000
