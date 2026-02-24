Write-Host "Starting FastAPI Edit Server on port 8000..." -ForegroundColor Cyan
if (Test-Path ".venv\Scripts\Activate.ps1") {
    . .venv\Scripts\Activate.ps1
}
uvicorn backend.main:app --reload --port 8000
