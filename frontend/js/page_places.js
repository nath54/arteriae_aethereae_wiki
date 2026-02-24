/**
 * Places Page — Recursive card sheet browser for planets, continents, regions, cities
 * Navigation: click card → drill into children. "View Map" opens the map editor overlay.
 */
(function () {
    let currentPath = []; // breadcrumb: ['teria', 'risnia', 'bruine']

    function renderPlacesGrid(container) {
        const manifest = window.db.manifest;
        const places = manifest.places || {};

        // Get items at current depth
        const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
        const items = Object.entries(places).filter(([id, data]) => {
            return (data.parent || null) === parentId;
        });

        let html = '';

        // Breadcrumb
        html += renderBreadcrumb(places);

        // Add place button (edit mode)
        html += '<div class="places-grid">';
        html += `<div class="place-add-card edit-only" id="btn-add-place">
            <div class="char-add-icon">+</div>
            <span>Add Place</span>
        </div>`;

        if (items.length === 0 && currentPath.length > 0) {
            html += `<div class="placeholder-text" style="grid-column:1/-1;">No sub-locations yet.</div>`;
        }

        for (const [id, data] of items) {
            const hasChildren = Object.values(places).some(p => p.parent === id);
            const hasMap = manifest.maps && manifest.maps[id];
            const iconUrl = data.icon ? `../data/places/${id}_icon.png` : null;

            html += `
            <div class="place-card" data-id="${id}">
                <div class="place-card-thumb">
                    ${iconUrl ? `<img src="${iconUrl}" alt="${data.name}">` : `<span class="place-card-emoji">${getPlaceEmoji(data.type)}</span>`}
                </div>
                <div class="place-card-body">
                    <h3 class="place-card-name">${data.name}</h3>
                    <p class="place-card-type">${data.type || 'Location'}</p>
                    ${data.description ? `<p class="place-card-desc">${data.description}</p>` : ''}
                </div>
                <div class="place-card-actions">
                    ${hasChildren ? `<button class="tool-btn place-enter-btn" data-id="${id}" title="Enter">→ Enter</button>` : ''}
                    ${hasMap ? `<button class="tool-btn place-map-btn" data-map="${id}" title="View Map">🗺️ Map</button>` : ''}
                </div>
            </div>`;
        }

        html += '</div>';
        container.innerHTML = html;

        // Bind events
        container.querySelectorAll('.place-enter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentPath.push(btn.dataset.id);
                renderPlacesGrid(container);
            });
        });

        container.querySelectorAll('.place-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                openPlaceDetail(id);
            });
        });

        container.querySelectorAll('.place-map-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openMapEditor(btn.dataset.map);
            });
        });

        // Breadcrumb navigation
        container.querySelectorAll('.breadcrumb-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const depth = parseInt(link.dataset.depth);
                currentPath = currentPath.slice(0, depth);
                renderPlacesGrid(container);
            });
        });

        const addBtn = container.querySelector('#btn-add-place');
        if (addBtn) {
            addBtn.addEventListener('click', () => promptNewPlace());
        }
    }

    function renderBreadcrumb(places) {
        let html = '<div class="breadcrumb">';
        html += `<a href="#" class="breadcrumb-link" data-depth="0">🌍 All</a>`;

        for (let i = 0; i < currentPath.length; i++) {
            const id = currentPath[i];
            const name = places[id] ? places[id].name : id;
            html += ` <span class="breadcrumb-sep">›</span> `;
            html += `<a href="#" class="breadcrumb-link" data-depth="${i + 1}">${name}</a>`;
        }

        html += '</div>';
        return html;
    }

    function getPlaceEmoji(type) {
        const map = {
            'planet': '🪐', 'continent': '🌍', 'country': '🏰',
            'region': '🏞️', 'city': '🏙️', 'village': '🏘️',
            'dungeon': '⚔️', 'temple': '🛕', 'forest': '🌲',
            'mountain': '⛰️', 'ocean': '🌊', 'island': '🏝️'
        };
        return map[(type || '').toLowerCase()] || '📍';
    }

    async function openPlaceDetail(id) {
        const data = await window.db.getEntity('places', id);
        const container = document.getElementById('places-content');
        const manifest = window.db.manifest;

        if (!data) {
            // No detailed data file — just show a basic card from manifest
            const mData = manifest.places[id] || { name: id };
            let html = `<div class="char-sheet">
                <button class="char-sheet-back tool-btn" id="btn-back-places">← Back</button>
                <div class="char-sheet-header">
                    <div class="char-sheet-icon"><span class="char-placeholder-large">${getPlaceEmoji(mData.type)}</span></div>
                    <div class="char-sheet-title-block">
                        <h2 class="char-sheet-name">${mData.name}</h2>
                        <p class="char-sheet-subtitle">${mData.type || 'Location'}</p>
                    </div>
                </div>
                <div class="char-section">
                    <h3 class="char-section-title">📝 Details</h3>
                    <div class="char-section-body">
                        <p class="placeholder-text">No detailed data yet. Add a file at data/places/${id}.json</p>
                    </div>
                </div>
            </div>`;
            container.innerHTML = html;
        } else {
            let html = `<div class="char-sheet">
                <button class="char-sheet-back tool-btn" id="btn-back-places">← Back</button>
                <div class="char-sheet-header">
                    <div class="char-sheet-icon"><span class="char-placeholder-large">${getPlaceEmoji(data.type)}</span></div>
                    <div class="char-sheet-title-block">
                        <h2 class="char-sheet-name">${data.name}</h2>
                        <p class="char-sheet-subtitle">${data.type || 'Location'}${data.inspiration ? ' — Inspired by: ' + data.inspiration : ''}</p>
                    </div>
                </div>`;

            // Detail sections
            const sections = [
                { key: 'description', title: '📝 Description' },
                { key: 'geography', title: '🌍 Geography' },
                { key: 'culture', title: '🎭 Culture' },
                { key: 'history', title: '📚 History' },
                { key: 'politics', title: '⚖️ Politics' },
                { key: 'language', title: '🗣️ Language' },
                { key: 'notes', title: '📋 Notes' }
            ];

            for (const section of sections) {
                const val = data[section.key];
                if (!val) continue;
                html += `<div class="char-section">
                    <h3 class="char-section-title">${section.title}</h3>
                    <div class="char-section-body">
                        <p>${typeof val === 'object' ? JSON.stringify(val) : val}</p>
                    </div>
                </div>`;
            }

            // Gallery
            if (data.gallery && data.gallery.length > 0) {
                html += `<div class="char-section">
                    <h3 class="char-section-title">🖼️ Gallery</h3>
                    <div class="char-gallery">`;
                for (const img of data.gallery) {
                    html += `<img src="${img}" alt="Gallery" class="char-gallery-img">`;
                }
                html += '</div></div>';
            }

            html += '</div>';
            container.innerHTML = html;
        }

        document.getElementById('btn-back-places').addEventListener('click', () => {
            renderPlacesGrid(container);
        });
    }

    function openMapEditor(mapId) {
        const overlay = document.getElementById('map-editor-overlay');
        overlay.classList.remove('hidden');

        // Set title
        const manifest = window.db.manifest;
        const name = (manifest.places && manifest.places[mapId]) ? manifest.places[mapId].name : mapId;
        document.getElementById('map-editor-title').textContent = `Map: ${name}`;

        // Bind map tools if not already
        if (window.mapTools) {
            window.mapTools.bindEvents();
        }

        // Load map data
        if (window.mapRenderer) {
            window.mapRenderer.loadMap(mapId);
        } else if (window.loadMap) {
            window.loadMap(mapId);
        }
    }

    async function promptNewPlace() {
        const name = prompt('Place name:');
        if (!name) return;

        const type = prompt('Place type (planet, continent, country, region, city, village):') || 'region';
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;

        const placeData = {
            name: name,
            type: type,
            parent: parentId,
            description: '',
            gallery: []
        };

        await window.db.saveEntity('places', id, placeData);
        window.db.manifest = null;
        await window.db.loadManifest();
        const container = document.getElementById('places-content');
        renderPlacesGrid(container);
    }

    // ── Page Lifecycle ──

    window.addEventListener('pagechange', (e) => {
        if (e.detail.page === 'places') {
            const container = document.getElementById('places-content');
            if (e.detail.id) {
                openPlaceDetail(e.detail.id);
            } else {
                currentPath = [];
                renderPlacesGrid(container);
            }
        }
    });
})();
