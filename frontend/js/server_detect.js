/**
 * Server Detection Module
 * Pings the local Python API server to determine if we're in edit mode.
 * If the server responds, edit-mode UI elements are shown.
 *
 * Detection strategy:
 * 1. If we're already served by FastAPI (same origin includes /api), detect immediately
 * 2. Otherwise, ping http://127.0.0.1:8000/api/manifest to check if the server is running
 *
 * HOOK POINT (Auth): If you decide to add authentication layers, this is the best
 * place to ping an auth endpoint instead of just `manifest`.
 *
 * @returns {Promise<void>} Resolves when detection is complete. Sets window.isEditMode.
 */
async function detectServer() {
    window.isEditMode = false;

    try {
        // First: try to detect if we're already on the FastAPI server
        // (when user accessed via http://localhost:8000/frontend/...)
        const origin = window.location.origin;
        let apiUrl;

        if (origin.includes(':8000')) {
            // We're being served by FastAPI directly — use same origin API
            apiUrl = `${origin}/api/manifest`;
        } else {
            // We're on a different server (e.g. port 8080 view server, or file://)
            // Try to reach the edit server
            apiUrl = 'http://127.0.0.1:8000/api/manifest';
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(apiUrl, {
            method: 'GET',
            signal: controller.signal,
            mode: 'cors'
        });

        clearTimeout(timeout);

        if (response.ok) {
            window.isEditMode = true;
            document.body.classList.add('edit-mode');
            console.log('[Arteriae] ✏️ Edit server detected — editor mode enabled.');
        }
    } catch (e) {
        console.log('[Arteriae] 📖 No edit server found — read-only wiki mode.');
    }
}
