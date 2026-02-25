/**
 * Places Page Module — Arteriae Aethereae Wiki
 * Handles the recursive card browser for planets, continents, regions, and cities.
 * Manages the "Places" view, sidebar info, grid rendering, and triggers the Map Editor overlay.
 *
 * HOOK POINT (Custom UI): If you add new data fields to place JSON files (e.g., "climate", "population"),
 * you should render them by extending the `sections` array inside `renderSidebar()` below.
 */
(function () {
    let currentPath = []; // breadcrumb: ['teria', 'risnia', 'bruine']

    // ── Unified Desktop/Mobile Split Render ──

    async function renderPlacesView() {
        const manifest = window.db.manifest;
        const places = manifest.places || {};
        const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;

        const sidebar = document.getElementById('places-sidebar');
        const grid = document.getElementById('places-grid-container');

        // Render Sidebar Info
        await renderSidebar(parentId, places, sidebar);

        // Render Sub-places Grid
        renderGrid(parentId, places, grid);
    }

    async function renderSidebar(placeId, places, container) {
        let html = '';

        // Breadcrumb
        html += renderBreadcrumb(places);

        if (!placeId) {
            // Root View
            html += `<div class="char-sheet">
                <div class="char-sheet-header" style="flex-direction:column; text-align:center;">
                    <div class="char-sheet-icon" style="margin: 0 auto; width:120px; height:120px;"><span class="char-placeholder-large">🌌</span></div>
                    <div class="char-sheet-title-block">
                        <h2 class="char-sheet-name">The Cosmos</h2>
                        <p class="char-sheet-subtitle">All Worlds & Dimensions</p>
                    </div>
                </div>
                <div class="char-section">
                    <div class="char-section-body">
                        <p>Select a world to explore its regions, continents, and cities.</p>
                    </div>
                </div>
            </div>`;
            container.innerHTML = html;
        } else {
            // Specific Place Detail
            const data = await window.db.getEntity('places', placeId);
            const mData = places[placeId] || { name: placeId };
            const placeNode = data || mData;

            const hasMap = window.db.manifest.maps && window.db.manifest.maps[placeId];

            html += `<div class="char-sheet" style="max-width:100%;">`;
            html += `<div class="char-sheet-header" style="align-items:flex-start;">
                        <div class="char-sheet-icon"><span class="char-placeholder-large">${getPlaceEmoji(placeNode.type)}</span></div>
                        <div class="char-sheet-title-block">
                            <h2 class="char-sheet-name">${placeNode.name}</h2>
                            <p class="char-sheet-subtitle">${placeNode.type || 'Location'}${placeNode.inspiration ? ' — ' + placeNode.inspiration : ''}</p>
                            <div style="margin-top:10px; display:flex; gap:8px;">
                                ${hasMap ? `<button class="tool-btn place-map-btn" data-map="${placeId}" title="View Map">🗺️ Map</button>`
                    : `<button class="tool-btn place-map-create-btn edit-only" data-id="${placeId}" data-parent="${placeNode.parent || ''}" title="Create Map">${placeNode.type === 'planet' ? '🌍 + Map' : '🗺️ + Map from Parent'}</button>`}
                            </div>
                        </div>
                        <div class="char-sheet-actions edit-only" style="flex-direction:column; gap:8px;">
                            <button class="tool-btn" id="btn-edit-place" data-id="${placeId}">Edit</button>
                            <button class="tool-btn danger" id="btn-delete-place" data-id="${placeId}">Delete</button>
                        </div>
                    </div>`;

            if (!data) {
                html += `<div class="char-section"><div class="char-section-body"><p class="placeholder-text">No detailed description yet.</p></div></div>`;
            } else {
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

                if (data.gallery && data.gallery.length > 0) {
                    html += `<div class="char-section">
                        <h3 class="char-section-title">🖼️ Gallery</h3>
                        <div class="char-gallery">`;
                    for (const img of data.gallery) {
                        html += `<img src="${img}" alt="Gallery" class="char-gallery-img">`;
                    }
                    html += '</div></div>';
                }
            }

            html += '</div>';
            container.innerHTML = html;

            // Bind Sidebar Events
            const mapBtn = container.querySelector('.place-map-btn');
            if (mapBtn) {
                mapBtn.addEventListener('click', (e) => {
                    openMapEditor(e.target.dataset.map);
                });
            }

            const mapCreateBtn = container.querySelector('.place-map-create-btn');
            if (mapCreateBtn) {
                mapCreateBtn.addEventListener('click', () => {
                    handleMapCreateClick(placeId, placeNode.parent);
                });
            }

            const editBtn = container.querySelector('#btn-edit-place');
            if (editBtn) {
                editBtn.addEventListener('click', () => promptEditPlace(placeId, placeNode));
            }

            const delBtn = container.querySelector('#btn-delete-place');
            if (delBtn) {
                delBtn.addEventListener('click', () => deletePlace(placeId));
            }
        }

        // Bind Breadcrumb
        container.querySelectorAll('.breadcrumb-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const depth = parseInt(link.dataset.depth);
                currentPath = currentPath.slice(0, depth);
                renderPlacesView();
            });
        });
    }

    function renderGrid(parentId, places, container) {
        const items = Object.entries(places).filter(([id, data]) => {
            return (data.parent || null) === parentId;
        });

        let html = '<div class="places-grid">';

        // Add place button (edit mode)
        html += `<div class="place-add-card edit-only" id="btn-add-place">
            <div class="char-add-icon">+</div>
            <span>New Sub-Region</span>
        </div>`;

        if (items.length === 0) {
            html += `<div class="placeholder-text" style="grid-column:1/-1;">No sub-locations found.</div>`;
        }

        for (const [id, data] of items) {
            const iconUrl = data.icon ? `../data/places/${id}_icon.png` : null;

            html += `
            <div class="place-card" data-id="${id}">
                <div class="place-card-thumb">
                    ${iconUrl ? `<img src="${iconUrl}" alt="${data.name}">` : `<span class="place-card-emoji">${getPlaceEmoji(data.type)}</span>`}
                </div>
                <div class="place-card-body">
                    <h3 class="place-card-name">${data.name}</h3>
                    <p class="place-card-type">${data.type || 'Location'}</p>
                    ${data.description ? `<p class="place-card-desc">${data.description.substring(0, 60)}...</p>` : ''}
                </div>
            </div>`;
        }

        html += '</div>';
        container.innerHTML = html;

        // Bind Events
        container.querySelectorAll('.place-card').forEach(card => {
            card.addEventListener('click', () => {
                currentPath.push(card.dataset.id);
                renderPlacesView();
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

    // ── Map Editor Logic ──
    async function openMapEditor(mapId) {
        const overlay = document.getElementById('map-editor-overlay');
        overlay.classList.remove('hidden');
        document.body.classList.add('map-editor-active'); // Hides nav var

        // Set title
        const manifest = window.db.manifest;
        const name = (manifest.places && manifest.places[mapId]) ? manifest.places[mapId].name : mapId;
        document.getElementById('map-editor-title').textContent = `Map Editor: ${name}`;

        // Populate left sub-places bar
        const subList = document.getElementById('map-editor-subplaces-list');
        const children = Object.entries(manifest.places || {}).filter(([id, data]) => data.parent === mapId);

        let subHtml = `<h4 style="color:var(--text-dim); margin-bottom:10px;">Sub-Regions:</h4>`;
        if (children.length === 0) {
            subHtml += `<p class="placeholder-text" style="font-size:0.9rem; padding:10px;">No sub-regions. Create them in the places menu first.</p>`;
        } else {
            for (const [cId, cData] of children) {
                subHtml += `
                <div class="map-subplace-item" data-id="${cId}">
                    <span class="map-subplace-name">${cData.name}</span>
                    <button class="tool-btn edit-only map-assign-btn" data-assign="${cId}">Assign</button>
                    <button class="tool-btn edit-only map-assign-btn" style="border-color:red; color:red; display:none;" data-unassign="${cId}">Unassign</button>
                </div>`;
            }
        }
        subList.innerHTML = subHtml;

        subList.querySelectorAll('.map-subplace-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return; // Handled below
                subList.querySelectorAll('.map-subplace-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                if (window.mapTools) window.mapTools.selectPlace(item.dataset.id);
            });
        });

        subList.querySelectorAll('button[data-assign]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (window.mapTools) window.mapTools.activateAssignMode(btn.dataset.assign);
            });
        });

        // Bind map tools if not already
        if (window.mapTools) {
            window.mapTools.bindEvents();
        }

        // Close logic
        document.getElementById('btn-close-map').onclick = () => {
            document.getElementById('map-editor-overlay').classList.add('hidden');
            document.body.classList.remove('map-editor-active');
            if (window.mapTools) window.mapTools.selectPlace(null);
            renderPlacesView(); // Refresh in case maps were adjusted
        };

        // Load map data
        if (window.mapRenderer) {
            await window.mapRenderer.loadMap(mapId);
        } else if (window.loadMap) {
            await window.loadMap(mapId);
        }
    }

    // ── CRUD Logic ──
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
        renderPlacesView();
    }

    async function promptEditPlace(id, existingData) {
        const desc = prompt('Enter description:', existingData.description || '');
        if (desc === null) return;

        const type = prompt('Place type:', existingData.type || 'region');
        if (type === null) return;

        const iconUrl = prompt('Enter icon filename (e.g., place_icon.png) or leave blank:', existingData.icon ? existingData.icon.split('/').pop() : '');

        const updatedData = { ...existingData, description: desc, type: type };
        if (iconUrl) {
            updatedData.icon = `../data/places/${iconUrl}`;
        } else {
            delete updatedData.icon;
        }

        await window.db.saveEntity('places', id, updatedData);
        window.db.manifest = null;
        await window.db.loadManifest();
        renderPlacesView();
    }

    async function deletePlace(id) {
        if (!confirm(`Are you sure you want to delete place ${id}?`)) return;

        await window.db.deleteEntity('places', id);
        window.db.manifest = null;
        await window.db.loadManifest();
        currentPath.pop();
        renderPlacesView();
    }

    function handleMapCreateClick(placeId, parentId) {
        if (!parentId) {
            // Planet: show modal for custom size
            const popup = document.getElementById('map-create-popup');
            popup.classList.remove('hidden');

            document.getElementById('btn-cancel-map-create').onclick = () => {
                popup.classList.add('hidden');
            };

            document.getElementById('btn-confirm-map-create').onclick = async () => {
                const w = parseInt(document.getElementById('map-create-w').value) || 1000;
                const h = parseInt(document.getElementById('map-create-h').value) || 1000;
                popup.classList.add('hidden');
                await createMapForPlace(placeId, parentId, w, h);
            };
        } else {
            // Child: extract directly from parent
            createMapForPlace(placeId, parentId);
        }
    }

    async function createMapForPlace(id, parentId, customW = 1000, customH = 1000) {
        let mapData = {
            nodes: {},
            edges: {},
            polygons: {},
            layers: {}
        };

        if (!parentId) {
            // Planet level: default bounds
            mapData.nodes = {
                n1: { x: 0, y: 0, locked: [0, 0] },
                n2: { x: customW, y: 0, locked: [customW, 0] },
                n3: { x: customW, y: customH, locked: [customW, customH] },
                n4: { x: 0, y: customH, locked: [0, customH] }
            };
            mapData.edges = {
                e1: { n1: 'n1', n2: 'n2' },
                e2: { n1: 'n2', n2: 'n3' },
                e3: { n1: 'n3', n2: 'n4' },
                e4: { n1: 'n4', n2: 'n1' }
            };
            mapData.polygons = {
                poly1: { name: 'World', edges: ['e1', 'e2', 'e3', 'e4'], color: 'rgba(0,0,0,0.1)', link: id }
            };
        } else {
            // Sublevel: extract from parent map's assigned polygon
            const parentMap = await window.db.getEntity('maps', parentId);
            if (!parentMap) {
                alert("Parent map not found!");
                return;
            }

            // Find the polygon in the parent map linked to this child place
            const polyEntry = Object.entries(parentMap.polygons || {}).find(([k, p]) => p.link === id);

            if (!polyEntry) {
                alert(`No polygon in parent map is assigned to ${id}. Please open the parent map and assign a region to this place first.`);
                return;
            }

            const [polyId, polyData] = polyEntry;

            const tempGraph = new MapGraph();
            tempGraph.load(parentMap);
            const { nodes } = tempGraph.getOrderedNodesForPolygon(polyId);

            if (!nodes || nodes.length < 3) {
                alert("Assigned polygon has too few nodes.");
                return;
            }

            // Calculate bounding box in parent coordinates
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const nId of nodes) {
                const n = parentMap.nodes[nId];
                if (n.x < minX) minX = n.x;
                if (n.y < minY) minY = n.y;
                if (n.x > maxX) maxX = n.x;
                if (n.y > maxY) maxY = n.y;
            }

            // Target viewport is 0-1000
            const pWidth = maxX - minX;
            const pHeight = maxY - minY;
            const size = Math.max(pWidth, pHeight);
            const targetW = 1000;
            const targetH = 1000;

            const scale = size > 0 ? targetW / size : 1;
            const offsetX = (targetW - pWidth * scale) / 2;
            const offsetY = (targetH - pHeight * scale) / 2;

            const nodeMapping = {};
            let nodeCounter = 1;

            for (const nId of nodes) {
                const n = parentMap.nodes[nId];
                const nx = (n.x - minX) * scale + offsetX;
                const ny = (n.y - minY) * scale + offsetY;

                const newId = `n${nodeCounter++}`;
                mapData.nodes[newId] = { x: nx, y: ny, locked: [nx, ny] };
                nodeMapping[nId] = newId;
            }

            let edgeCounter = 1;
            const newEdges = [];
            for (let i = 0; i < nodes.length; i++) {
                const n1Id = nodeMapping[nodes[i]];
                const n2Id = nodeMapping[nodes[(i + 1) % nodes.length]];
                const eId = `e${edgeCounter++}`;
                mapData.edges[eId] = { n1: n1Id, n2: n2Id };
                newEdges.push(eId);
            }

            mapData.polygons['poly1'] = {
                name: polyData.name || 'Region',
                edges: newEdges,
                color: polyData.color || 'rgba(0,0,0,0.1)',
                link: id
            };
        }

        await window.db.saveEntity('maps', id, mapData);
        window.db.manifest = null;
        await window.db.loadManifest();
        renderPlacesView();
    }

    // ── Page Lifecycle ──

    window.addEventListener('pagechange', (e) => {
        if (e.detail.page === 'places') {
            if (e.detail.id) {
                currentPath = [e.detail.id]; // Quick hack for direct navigation
            } else {
                currentPath = [];
            }
            renderPlacesView();
        }
    });
})();