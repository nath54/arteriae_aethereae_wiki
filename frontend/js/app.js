document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Load of manifest
    await window.db.loadManifest();

    // 2. Render Left Menu
    await window.uiMenu.render();

    // 3. Init Router (which will read the hash and trigger map load / card open)
    window.router.init();

    // Set edit mode visibility
    if (window.db.isEditMode) {
        document.querySelector('.edit-tools').style.display = 'flex';
    }

    // Quick test map loading if available
    if (window.loadMap && !window.location.hash) {
        window.loadMap('teria');
    }
});
