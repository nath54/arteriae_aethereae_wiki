/**
 * UIMenu Module — Arteriae Aethereae Wiki
 * Utility class for building hierarchical tree menus from manifest data.
 * Used dynamically by other pages; does not auto-render globally.
 *
 * HOOK POINT (Nav Tree Labels): If you add a new category to the manifest
 * (e.g., "items"), add its display label to the `labels` dictionary inside `renderInto`.
 */
class UIMenu {
    constructor() {
        // No longer auto-renders; pages call renderInto() as needed
    }

    /**
     * Render a category tree into a target container element.
     * @param {HTMLElement} container - The DOM element to render into
     * @param {string[]} categories - Which manifest categories to show
     */
    async renderInto(container, categories = ['maps', 'places', 'characters', 'events']) {
        if (!window.db.manifest) {
            await window.db.loadManifest();
        }

        const manifest = window.db.manifest;
        const labels = {
            'maps': '🗺️ Maps',
            'places': '📍 Places',
            'characters': '👤 Characters',
            'events': '📜 Events'
        };

        let html = '<ul class="tree-menu">';
        for (const key of categories) {
            const label = labels[key] || key;
            html += `<li class="category-header"><strong>${label}</strong><ul>`;
            const items = manifest[key] || {};
            for (const [id, data] of Object.entries(items)) {
                html += `<li><a href="#${key}:${id}">${data.name}</a></li>`;
            }
            html += `</ul></li>`;
        }
        html += '</ul>';
        container.innerHTML = html;
    }
}
window.uiMenu = new UIMenu();
