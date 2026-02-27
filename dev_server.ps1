# ───────────────────────────────────────────────────────────
# Arteriae Aethereae — Edit Server (FastAPI)
# Serves frontend + API with CORS support for editing.
# Access at: http://localhost:8000/frontend/index.html
# ───────────────────────────────────────────────────────────

# Write-Host ""
# Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor DarkCyan
# Write-Host "║       Arteriae Aethereae — Edit Server (FastAPI)      ║" -ForegroundColor Cyan
# Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor DarkCyan
# Write-Host ""
# Write-Host "  Mode:     EDIT MODE (CRUD API enabled)" -ForegroundColor Green
# Write-Host "  URL:      http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:8000/frontend/index.html" -ForegroundColor Yellow
# Write-Host ""
# Write-Host "  Press Ctrl+C to stop."
# Write-Host ""

. .venv\Scripts\Activate.ps1

# Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

uvicorn backend.main:app --port 8000
