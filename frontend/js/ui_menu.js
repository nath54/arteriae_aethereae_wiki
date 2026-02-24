class UIMenu {
    constructor() {
        this.container = document.getElementById('tree-menu');
    }

    async render() {
        if (!window.db.manifest) {
            await window.db.loadManifest();
        }

        const manifest = window.db.manifest;
        let html = '<ul>';

        const categories = {
            'maps': '🗺️ Maps',
            'places': '📍 Places',
            'characters': '👤 Characters',
            'events': '📜 Events'
        };

        for (const [key, label] of Object.entries(categories)) {
            html += `<li class="category-header"><strong>${label}</strong><ul>`;
            const items = manifest[key] || {};
            for (const [id, data] of Object.entries(items)) {
                html += `<li><a href="#${key}:${id}">${data.name}</a></li>`;
            }
            html += `</ul></li>`;
        }

        html += '</ul>';
        this.container.innerHTML = html;
    }
}
window.uiMenu = new UIMenu();
