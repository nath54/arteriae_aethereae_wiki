/**
 * App Bootstrap — Arteriae Aethereae Wiki
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
