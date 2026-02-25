/**
 * App Bootstrap — Arteriae Aethereae Wiki
 *
 * This is the main entry point for the frontend application.
 * Executes automatically when the DOM is fully loaded.
 *
 * HOOK POINT (Init Code): If you need to add new global initialization
 * (e.g., setting up WebSockets, checking local storage for user preferences,
 * or loading global assets), add it inside the `DOMContentLoaded` listener below.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Detect server (edit mode)
    await detectServer();

    // 2. Load data manifest
    await window.db.loadManifest();

    // 3. Initialize router (reads hash, shows correct page)
    window.router.init();

    // 4. Medallion shine-to-home animation
    const medallion = document.getElementById('nav-home-btn');
    if (medallion) {
        medallion.addEventListener('click', (e) => {
            e.preventDefault();
            medallion.classList.add('shine-active');
            setTimeout(() => {
                medallion.classList.remove('shine-active');
                window.location.hash = '';
            }, 400);
        });
    }
});
