# ───────────────────────────────────────────────────────────
# Arteriae Aethereae — View Server (Static HTTP)
# Simple Python HTTP server for read-only preview.
# Mirrors how GitHub Pages would serve the site.
# Access at: http://localhost:8080/frontend/index.html
# ───────────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "║      Arteriae Aethereae — View Server (Static)        ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Mode:     VIEW MODE (read-only, no API)" -ForegroundColor Blue
Write-Host "  URL:      http://localhost:8080/frontend/index.html" -ForegroundColor Yellow
Write-Host ""
Write-Host "  This mirrors how the wiki looks on GitHub Pages." -ForegroundColor DarkGray
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

python -m http.server 8080
