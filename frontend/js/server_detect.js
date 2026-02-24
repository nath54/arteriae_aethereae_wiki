/**
 * Server Detection Module
 * Pings the local Python API server to determine if we're in edit mode.
 * If the server responds, edit-mode UI elements are shown.
 */
async function detectServer() {
    window.isEditMode = false;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        const response = await fetch('http://127.0.0.1:8000/api/manifest', {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'cors'
        });

        clearTimeout(timeout);

        if (response.ok) {
            window.isEditMode = true;
            document.body.classList.add('edit-mode');
            console.log('[Arteriae] Edit server detected — editor mode enabled.');
        }
    } catch (e) {
        console.log('[Arteriae] No edit server found — read-only wiki mode.');
    }
}
