/**
 * Places Page Module — Arteriae Aethereae Wiki
 * Unified single-page layout with inline per-field editing.
 * Renders breadcrumb → header → details → sub-places strip → gallery, all in one column.
 *
 * HOOK POINT: Extend `PLACE_SECTIONS` to add new detail fields.
 */
(function () {
    let currentPath = []; // breadcrumb: ['teria', 'risnia', 'bruine']

    const PLACE_TYPES = ['planet', 'continent', 'country', 'region', 'city', 'village', 'dungeon', 'temple', 'forest', 'mountain', 'ocean', 'island'];

    const PLACE_SECTIONS = [
        { key: 'description', title: '📝 Description', multiline: true },
        { key: 'geography', title: '🌍 Geography', multiline: true },
        { key: 'culture', title: '🎭 Culture', multiline: true },
        { key: 'history', title: '📚 History', multiline: true },
        { key: 'politics', title: '⚖️ Politics', multiline: true },
        { key: 'language', title: '🗣️ Language', multiline: true },
        { key: 'notes', title: '📋 Notes', multiline: true }
    ];

    // ── Helpers ──
    const escHtml = str => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escAttr = str => String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function getPlaceEmoji(type) {
        const map = {
            'planet': '🪐', 'continent': '🌍', 'country': '🏰',
            'region': '🏞️', 'city': '🏙️', 'village': '🏘️',
            'dungeon': '⚔️', 'temple': '🛕', 'forest': '🌲',
            'mountain': '⛰️', 'ocean': '🌊', 'island': '🏝️'
        };
        return map[(type || '').toLowerCase()] || '📍';
    }

    // ── Main Render ──
    async function renderPlacesView() {
        const container = document.getElementById('places-page-content');
        const manifest = window.db.manifest;
        const places = manifest.places || {};
        const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;

        let html = '';

        // Breadcrumb
        html += renderBreadcrumb(places);

        if (!parentId) {
            // Root View
            html += `<div class="place-page-unified">
                <div class="char-sheet-header" style="flex-direction:column;text-align:center;">
                    <div class="char-sheet-icon" style="margin:0 auto;width:120px;height:120px;"><span class="char-placeholder-large">🌌</span></div>
                    <div class="char-sheet-title-block">
                        <h2 class="char-sheet-name">The Cosmos</h2>
                        <p class="char-sheet-subtitle">All Worlds & Dimensions</p>
                    </div>
                </div>
                <div class="char-section"><div class="char-section-body"><p>Select a world to explore its regions, continents, and cities.</p></div></div>`;

            // Sub-places strip
            html += renderSubplacesStrip(null, places);
            html += '</div>';
        } else {
            // Specific place view
            const data = await window.db.getEntity('places', parentId);
            const mData = places[parentId] || { name: parentId };
            const placeNode = data || mData;
            const hasMap = manifest.maps && manifest.maps[parentId];

            html += `<div class="place-page-unified">`;

            // Header
            html += `<div class="char-sheet-header" style="align-items:flex-start;">
                <div class="char-sheet-icon"><span class="char-placeholder-large">${getPlaceEmoji(placeNode.type)}</span></div>
                <div class="char-sheet-title-block">
                    <h2 class="char-sheet-name" id="place-name-display">${escHtml(placeNode.name)}
                        <button class="place-inline-edit-btn edit-only" data-field="name" title="Rename">✏️</button>
                    </h2>
                    <p class="char-sheet-subtitle" id="place-type-display">${escHtml(placeNode.type || 'Location')}${placeNode.inspiration ? ' — ' + escHtml(placeNode.inspiration) : ''}
                        <button class="place-inline-edit-btn edit-only" data-field="type" title="Change type">✏️</button>
                    </p>
                    <div style="margin-top:10px;display:flex;gap:8px;">
                        ${hasMap ? `<button class="tool-btn place-map-btn" data-map="${parentId}" title="View Map">🗺️ Map</button>`
                    : `<button class="tool-btn place-map-create-btn edit-only" data-id="${parentId}" data-parent="${placeNode.parent || ''}" title="Create Map">${placeNode.type === 'planet' ? '🌍 + Map' : '🗺️ + Map from Parent'}</button>`}
                        <button class="tool-btn danger edit-only" id="btn-delete-place" data-id="${parentId}">🗑️ Delete</button>
                        <button class="tool-btn edit-only" id="btn-move-place" data-id="${parentId}" style="border-color:#f7b731;color:#f7b731;">📦 Move to…</button>
                    </div>
                </div>
            </div>`;

            // Inline edit zones for name and type (hidden by default)
            html += `<div id="inline-edit-name" class="place-inline-editor" style="display:none;">
                <input type="text" id="inline-name-input" value="${escAttr(placeNode.name)}" style="flex:1;padding:8px;background:var(--glass-bg);color:white;border:1px solid var(--border-color);border-radius:4px;font-size:1.2rem;" />
                <button class="tool-btn" id="inline-name-save" style="border-color:#4ecdc4;color:#4ecdc4;">✔️</button>
                <button class="tool-btn btn-muted" id="inline-name-cancel">✖</button>
            </div>`;

            html += `<div id="inline-edit-type" class="place-inline-editor" style="display:none;">
                <select id="inline-type-select" style="flex:1;padding:8px;background:var(--glass-bg);color:white;border:1px solid var(--border-color);border-radius:4px;">
                    ${PLACE_TYPES.map(t => `<option value="${t}"${t === (placeNode.type || 'region') ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
                </select>
                <button class="tool-btn" id="inline-type-save" style="border-color:#4ecdc4;color:#4ecdc4;">✔️</button>
                <button class="tool-btn btn-muted" id="inline-type-cancel">✖</button>
            </div>`;

            // Move-place modal (edit mode only, hidden by default)
            html += `<div id="move-place-modal" class="modal-overlay edit-only" style="display:none;">
                <div class="modal-box" style="max-width:400px;">
                    <h3 style="margin-bottom:12px;">📦 Move Place</h3>
                    <p style="margin-bottom:12px;color:var(--text-dim);font-size:0.9rem;">Select a new parent for <strong>${escHtml(placeNode.name)}</strong>. Polygon assignments will be cleared for this place and all its descendants.</p>
                    <select id="move-place-target" style="width:100%;padding:10px;background:var(--glass-bg);color:white;border:1px solid var(--border-color);border-radius:6px;margin-bottom:16px;"></select>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button class="tool-btn btn-muted" id="btn-cancel-move-place">✖ Cancel</button>
                        <button class="tool-btn" id="btn-confirm-move-place" style="border-color:#4ecdc4;color:#4ecdc4;">✔️ Move</button>
                    </div>
                </div>
            </div>`;

            // Icon section (edit mode only, shown small)
            html += `<div class="char-section edit-only">
                <h3 class="char-section-title">🖼️ Profile Image</h3>
                <div class="char-section-body" style="flex-direction:row;align-items:center;gap:20px;">
                    <div id="place-icon-wrap" style="width:80px;height:80px;border-radius:10px;overflow:hidden;background:var(--glass-bg);display:flex;align-items:center;justify-content:center;">
                        ${placeNode.icon ? `<img id="place-icon-preview" src="${placeNode.icon}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:3rem;opacity:0.6;">🗺️</span>`}
                    </div>
                    <div>
                        <button type="button" class="tool-btn" id="btn-pick-place-icon">🖼 Choose</button>
                        ${placeNode.icon ? `<button type="button" class="tool-btn btn-muted" id="btn-clear-place-icon" style="margin-top:8px;">✖ Clear</button>` : ''}
                    </div>
                </div>
            </div>`;

            // Detail sections with inline editing
            for (const section of PLACE_SECTIONS) {
                const val = placeNode[section.key];
                html += `<div class="char-section" id="section-${section.key}">
                    <h3 class="char-section-title">${section.title}
                        <button class="place-inline-edit-btn edit-only" data-field="${section.key}" title="Edit">✏️</button>
                    </h3>
                    <div class="char-section-body">
                        <div id="display-${section.key}" class="place-field-display">${val ? `<p>${typeof val === 'object' ? JSON.stringify(val) : escHtml(val)}</p>` : `<p class="placeholder-text" style="opacity:0.5;font-style:italic;">No ${section.title.replace(/^[^\s]+\s/, '').toLowerCase()} yet.</p>`}</div>
                        <div id="editor-${section.key}" class="place-inline-editor" style="display:none;">
                            <textarea id="input-${section.key}" rows="4" style="flex:1;padding:8px;background:var(--glass-bg);color:white;border:1px solid var(--border-color);border-radius:4px;resize:vertical;width:100%;">${escHtml(val || '')}</textarea>
                            <div style="display:flex;gap:8px;margin-top:6px;">
                                <button class="tool-btn inline-save-btn" data-field="${section.key}" style="border-color:#4ecdc4;color:#4ecdc4;">✔️ Save</button>
                                <button class="tool-btn btn-muted inline-cancel-btn" data-field="${section.key}">✖ Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }

            // Sub-places strip
            html += renderSubplacesStrip(parentId, places);

            // Gallery
            if (placeNode.gallery && placeNode.gallery.length > 0) {
                html += `<div class="char-section">
                    <h3 class="char-section-title">🖼️ Gallery</h3>
                    <div class="char-gallery">`;
                for (const img of placeNode.gallery) {
                    html += `<a href="${img}" target="_blank" style="display:block;overflow:hidden;border-radius:8px;"><img src="${img}" alt="Gallery" class="char-gallery-img"></a>`;
                }
                html += '</div></div>';
            }

            // Gallery editor (edit mode)
            html += `<div class="char-section edit-only" id="place-gallery-editor">
                <h3 class="char-section-title">🖼️ Edit Gallery</h3>
                <div class="char-section-body">
                    <div class="gallery-edit-strip" id="place-gallery-strip"></div>
                </div>
            </div>`;

            html += '</div>'; // .place-page-unified
        }

        container.innerHTML = html;

        // ── Event Bindings ──
        bindBreadcrumbEvents(container);

        if (parentId) {
            const places = manifest.places || {};
            const data = await window.db.getEntity('places', parentId);
            const mData = places[parentId] || { name: parentId };
            const placeNode = data || mData;

            bindMapButtons(container, parentId, placeNode);
            bindDeleteButton(container);
            bindMovePlace(container, parentId, placeNode);
            bindInlineEditing(container, parentId, placeNode);
            bindIconPicker(container, parentId, placeNode);
            bindGalleryEditor(container, parentId, placeNode);
        }

        bindSubplaceEvents(container);
    }

    // ── Sub-places Strip ──
    function renderSubplacesStrip(parentId, places) {
        const items = Object.entries(places).filter(([id, data]) => {
            return (data.parent || null) === parentId;
        });

        let html = `<div class="char-section">
            <h3 class="char-section-title">📍 Sub-Locations</h3>
            <div class="place-subplaces-strip">`;

        // Add button
        html += `<div class="place-strip-add edit-only" id="btn-add-place">
            <span style="font-size:2rem;">+</span>
            <span>New</span>
        </div>`;

        if (items.length === 0) {
            html += `<div class="placeholder-text" style="padding:20px 30px;white-space:nowrap;">No sub-locations yet.</div>`;
        }

        for (const [id, data] of items) {
            const iconUrl = data.icon || null;
            html += `<div class="place-strip-card" data-id="${id}">
                <div class="place-strip-thumb">
                    ${iconUrl ? `<img src="${iconUrl}" alt="${escAttr(data.name)}">` : `<span class="place-card-emoji">${getPlaceEmoji(data.type)}</span>`}
                </div>
                <h4 class="place-strip-name">${escHtml(data.name)}</h4>
                <span class="place-strip-type">${escHtml(data.type || 'Location')}</span>
            </div>`;
        }

        html += '</div></div>';
        return html;
    }

    // ── Breadcrumb ──
    function renderBreadcrumb(places) {
        let html = '<div class="breadcrumb">';
        html += `<a href="#" class="breadcrumb-link" data-depth="0">🌍 All</a>`;

        for (let i = 0; i < currentPath.length; i++) {
            const id = currentPath[i];
            const name = places[id] ? places[id].name : id;
            html += ` <span class="breadcrumb-sep">›</span> `;
            html += `<a href="#" class="breadcrumb-link" data-depth="${i + 1}">${escHtml(name)}</a>`;
        }

        html += '</div>';
        return html;
    }

    // ── Event Binding Functions ──

    function bindBreadcrumbEvents(container) {
        container.querySelectorAll('.breadcrumb-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const depth = parseInt(link.dataset.depth);
                currentPath = currentPath.slice(0, depth);
                renderPlacesView();
            });
        });
    }

    function bindSubplaceEvents(container) {
        container.querySelectorAll('.place-strip-card').forEach(card => {
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

    function bindMapButtons(container, placeId, placeNode) {
        const mapBtn = container.querySelector('.place-map-btn');
        if (mapBtn) {
            mapBtn.addEventListener('click', () => openMapEditor(mapBtn.dataset.map));
        }

        const mapCreateBtn = container.querySelector('.place-map-create-btn');
        if (mapCreateBtn) {
            mapCreateBtn.addEventListener('click', () => handleMapCreateClick(placeId, placeNode.parent));
        }
    }

    function bindDeleteButton(container) {
        const delBtn = container.querySelector('#btn-delete-place');
        if (delBtn) {
            delBtn.addEventListener('click', () => deletePlace(delBtn.dataset.id));
        }
    }

    function bindMovePlace(container, placeId, placeNode) {
        const moveBtn = container.querySelector('#btn-move-place');
        if (!moveBtn) return;

        moveBtn.addEventListener('click', () => {
            const modal = container.querySelector('#move-place-modal');
            const select = container.querySelector('#move-place-target');
            const places = window.db.manifest.places || {};

            // Collect descendants of the current place (to exclude from targets)
            const descendants = new Set();
            const collectDescendants = (pid) => {
                for (const [id, data] of Object.entries(places)) {
                    if (data.parent === pid && !descendants.has(id)) {
                        descendants.add(id);
                        collectDescendants(id);
                    }
                }
            };
            collectDescendants(placeId);

            // Build options: root + all valid places
            let optionsHtml = `<option value="__root__">🌌 Root (no parent)</option>`;
            for (const [id, data] of Object.entries(places)) {
                if (id === placeId) continue;           // can't be its own parent
                if (descendants.has(id)) continue;       // can't move under descendant
                if (id === (placeNode.parent || null)) continue; // already current parent
                const emoji = getPlaceEmoji(data.type);
                optionsHtml += `<option value="${id}">${emoji} ${escHtml(data.name)} (${escHtml(data.type || 'Location')})</option>`;
            }
            select.innerHTML = optionsHtml;

            modal.style.display = 'flex';
        });

        const cancelBtn = container.querySelector('#btn-cancel-move-place');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                container.querySelector('#move-place-modal').style.display = 'none';
            });
        }

        const confirmBtn = container.querySelector('#btn-confirm-move-place');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const select = container.querySelector('#move-place-target');
                const targetVal = select.value;
                const newParentId = targetVal === '__root__' ? null : targetVal;

                try {
                    const resp = await fetch('/api/places/move', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ place_id: placeId, new_parent_id: newParentId })
                    });

                    if (resp.ok) {
                        container.querySelector('#move-place-modal').style.display = 'none';
                        window.db.manifest = null;
                        await window.db.loadManifest();
                        if (window.db.cache) window.db.cache.delete(`places_${placeId}`);
                        // Update breadcrumb to reflect new parent
                        if (newParentId) {
                            currentPath = [newParentId, placeId];
                        } else {
                            currentPath = [placeId];
                        }
                        renderPlacesView();
                    } else {
                        const err = await resp.json().catch(() => ({}));
                        alert(err.detail || 'Move failed.');
                    }
                } catch (e) {
                    alert('Move failed: ' + e.message);
                }
            });
        }

        // Close modal on overlay click
        const modal = container.querySelector('#move-place-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
    }

    function bindInlineEditing(container, placeId, placeNode) {
        // Pencil buttons: toggle edit mode for each field
        container.querySelectorAll('.place-inline-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const field = btn.dataset.field;

                if (field === 'name') {
                    document.getElementById('inline-edit-name').style.display = 'flex';
                    document.getElementById('place-name-display').style.display = 'none';
                } else if (field === 'type') {
                    document.getElementById('inline-edit-type').style.display = 'flex';
                    document.getElementById('place-type-display').style.display = 'none';
                } else {
                    // Section fields
                    const display = document.getElementById(`display-${field}`);
                    const editor = document.getElementById(`editor-${field}`);
                    if (display) display.style.display = 'none';
                    if (editor) editor.style.display = 'block';
                }
            });
        });

        // Name save/cancel
        const nameSave = container.querySelector('#inline-name-save');
        const nameCancel = container.querySelector('#inline-name-cancel');
        if (nameSave) {
            nameSave.addEventListener('click', async () => {
                const newName = document.getElementById('inline-name-input').value.trim();
                if (!newName) return;
                const updatedData = { ...placeNode, name: newName };
                await window.db.saveEntity('places', placeId, updatedData);
                window.db.manifest = null;
                await window.db.loadManifest();
                if (window.db.cache) window.db.cache.delete(`places_${placeId}`);
                renderPlacesView();
            });
        }
        if (nameCancel) {
            nameCancel.addEventListener('click', () => {
                document.getElementById('inline-edit-name').style.display = 'none';
                document.getElementById('place-name-display').style.display = '';
            });
        }

        // Type save/cancel
        const typeSave = container.querySelector('#inline-type-save');
        const typeCancel = container.querySelector('#inline-type-cancel');
        if (typeSave) {
            typeSave.addEventListener('click', async () => {
                const newType = document.getElementById('inline-type-select').value;
                const updatedData = { ...placeNode, type: newType };
                await window.db.saveEntity('places', placeId, updatedData);
                window.db.manifest = null;
                await window.db.loadManifest();
                if (window.db.cache) window.db.cache.delete(`places_${placeId}`);
                renderPlacesView();
            });
        }
        if (typeCancel) {
            typeCancel.addEventListener('click', () => {
                document.getElementById('inline-edit-type').style.display = 'none';
                document.getElementById('place-type-display').style.display = '';
            });
        }

        // Section field save/cancel
        container.querySelectorAll('.inline-save-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const field = btn.dataset.field;
                const input = document.getElementById(`input-${field}`);
                const newVal = input.value;
                const updatedData = { ...placeNode, [field]: newVal };
                await window.db.saveEntity('places', placeId, updatedData);
                window.db.manifest = null;
                await window.db.loadManifest();
                if (window.db.cache) window.db.cache.delete(`places_${placeId}`);
                renderPlacesView();
            });
        });

        container.querySelectorAll('.inline-cancel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.field;
                const display = document.getElementById(`display-${field}`);
                const editor = document.getElementById(`editor-${field}`);
                // Restore original value
                const input = document.getElementById(`input-${field}`);
                if (input) input.value = placeNode[field] || '';
                if (display) display.style.display = '';
                if (editor) editor.style.display = 'none';
            });
        });
    }

    function bindIconPicker(container, placeId, placeNode) {
        const pickBtn = container.querySelector('#btn-pick-place-icon');
        if (pickBtn) {
            pickBtn.addEventListener('click', () => {
                window.openImagePicker(async (img) => {
                    const updatedData = { ...placeNode, icon: img.url };
                    await window.db.saveEntity('places', placeId, updatedData);
                    window.db.manifest = null;
                    await window.db.loadManifest();
                    if (window.db.cache) window.db.cache.delete(`places_${placeId}`);
                    renderPlacesView();
                }, { title: 'Choose Place Icon' });
            });
        }

        const clearBtn = container.querySelector('#btn-clear-place-icon');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                const updatedData = { ...placeNode };
                delete updatedData.icon;
                await window.db.saveEntity('places', placeId, updatedData);
                window.db.manifest = null;
                await window.db.loadManifest();
                if (window.db.cache) window.db.cache.delete(`places_${placeId}`);
                renderPlacesView();
            });
        }
    }

    function bindGalleryEditor(container, placeId, placeNode) {
        let currentGallery = [...(placeNode.gallery || [])];
        const strip = container.querySelector('#place-gallery-strip');
        if (!strip) return;

        function rebuildStrip() {
            strip.innerHTML =
                currentGallery.map((url, i) => `
                    <div class="gallery-thumb-edit" data-idx="${i}">
                        <img src="${url}" alt="">
                        <a href="${url}" target="_blank" class="gallery-thumb-view" title="View full size">🔍</a>
                        <button type="button" class="gallery-thumb-remove" data-idx="${i}">✕</button>
                    </div>`).join('') +
                `<button type="button" class="gallery-add-btn" id="btn-add-place-gallery">＋</button>`;

            strip.querySelectorAll('.gallery-thumb-remove').forEach(btn => {
                btn.addEventListener('click', async () => {
                    currentGallery.splice(parseInt(btn.dataset.idx), 1);
                    const updatedData = { ...placeNode, gallery: currentGallery };
                    await window.db.saveEntity('places', placeId, updatedData);
                    window.db.manifest = null;
                    await window.db.loadManifest();
                    if (window.db.cache) window.db.cache.delete(`places_${placeId}`);
                    rebuildStrip();
                });
            });

            const addGalleryBtn = strip.querySelector('#btn-add-place-gallery');
            if (addGalleryBtn) {
                addGalleryBtn.addEventListener('click', () => {
                    window.openImagePicker(async (imgs) => {
                        const arr = Array.isArray(imgs) ? imgs : [imgs];
                        arr.forEach(img => { if (!currentGallery.includes(img.url)) currentGallery.push(img.url); });
                        const updatedData = { ...placeNode, gallery: currentGallery };
                        await window.db.saveEntity('places', placeId, updatedData);
                        window.db.manifest = null;
                        await window.db.loadManifest();
                        if (window.db.cache) window.db.cache.delete(`places_${placeId}`);
                        rebuildStrip();
                    }, { title: 'Add to Gallery', multiple: true });
                });
            }
        }

        rebuildStrip();
    }

    // ── Map Editor ──
    async function openMapEditor(mapId) {
        const overlay = document.getElementById('map-editor-overlay');
        overlay.classList.remove('hidden');
        document.body.classList.add('map-editor-active');

        const manifest = window.db.manifest;
        const name = (manifest.places && manifest.places[mapId]) ? manifest.places[mapId].name : mapId;
        document.getElementById('map-editor-title').textContent = `Map Editor: ${name}`;

        const subList = document.getElementById('map-editor-subplaces-list');
        const children = Object.entries(manifest.places || {}).filter(([id, data]) => data.parent === mapId);

        let subHtml = `<h4 style="color:var(--text-dim);margin-bottom:10px;">Sub-Regions:</h4>`;
        if (children.length === 0) {
            subHtml += `<p class="placeholder-text" style="font-size:0.9rem;padding:10px;">No sub-regions. Create them in the places menu first.</p>`;
        } else {
            for (const [cId, cData] of children) {
                subHtml += `
                <div class="map-subplace-item" data-id="${cId}">
                    <span class="map-subplace-name">${cData.name}</span>
                    <button class="tool-btn edit-only map-assign-btn" data-assign="${cId}">Assign</button>
                    <button class="tool-btn edit-only map-assign-btn" style="border-color:red;color:red;display:none;" data-unassign="${cId}">Unassign</button>
                </div>`;
            }
        }
        subList.innerHTML = subHtml;

        subList.querySelectorAll('.map-subplace-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                subList.querySelectorAll('.map-subplace-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                if (window.mapTools) window.mapTools.selectPlace(item.dataset.id);
            });
        });

        subList.querySelectorAll('button[data-assign]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.mapTools) window.mapTools.activateAssignMode(btn.dataset.assign);
            });
        });

        if (window.mapTools) window.mapTools.bindEvents();

        document.getElementById('btn-close-map').onclick = () => {
            document.getElementById('map-editor-overlay').classList.add('hidden');
            document.body.classList.remove('map-editor-active');
            if (window.mapTools) window.mapTools.selectPlace(null);
            renderPlacesView();
        };

        if (window.mapRenderer) {
            await window.mapRenderer.loadMap(mapId);
        } else if (window.loadMap) {
            await window.loadMap(mapId);
        }
    }

    // ── CRUD: New Place ──
    function promptNewPlace() {
        const container = document.getElementById('places-page-content');
        const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;

        container.innerHTML = `
        <div class="place-page-unified">
            <button class="char-sheet-back tool-btn" id="btn-cancel-create-place">← Cancel</button>
            <h2 class="char-sheet-name" style="margin-bottom:20px;">New Location</h2>
            <form id="place-create-form" class="char-section">
                <div class="char-section-body">
                    <div class="edit-field">
                        <label>Name</label>
                        <input type="text" id="new-place-name" required autofocus />
                    </div>
                    <div class="edit-field">
                        <label>Type</label>
                        <select id="new-place-type" style="padding:8px;background:var(--glass-bg);color:white;border:1px solid var(--border-color);border-radius:4px;width:100%;">
                            ${PLACE_TYPES.map(t =>
            `<option value="${t}"${t === (localStorage.getItem('lastPlaceType') || 'region') ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
        ).join('')}
                        </select>
                    </div>
                </div>
                <div style="display:flex;gap:12px;margin-top:20px;">
                    <button type="submit" class="tool-btn" style="border-color:#4ecdc4;color:#4ecdc4;">💾 Create</button>
                </div>
            </form>
        </div>`;

        document.getElementById('btn-cancel-create-place').addEventListener('click', () => renderPlacesView());

        document.getElementById('place-create-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-place-name').value.trim();
            if (!name) return;
            const type = document.getElementById('new-place-type').value;
            localStorage.setItem('lastPlaceType', type);
            const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

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
        });
    }

    // ── CRUD: Delete ──
    async function deletePlace(id) {
        if (!confirm(`Are you sure you want to delete place ${id}?`)) return;

        await window.db.deleteEntity('places', id);
        window.db.manifest = null;
        await window.db.loadManifest();
        currentPath.pop();
        renderPlacesView();
    }

    // ── Map Create ──
    function handleMapCreateClick(placeId, parentId) {
        if (!parentId) {
            const popup = document.getElementById('map-create-popup');
            popup.style.display = 'block';

            // Wire grid checkbox toggle
            const gridCheck = document.getElementById('map-create-grid');
            const gridOpts = document.getElementById('map-grid-options');
            gridCheck.onchange = () => {
                gridOpts.style.display = gridCheck.checked ? 'block' : 'none';
            };
            // Reset state
            gridCheck.checked = false;
            gridOpts.style.display = 'none';

            document.getElementById('btn-cancel-map-create').onclick = () => popup.style.display = 'none';

            document.getElementById('btn-confirm-map-create').onclick = async () => {
                const w = parseInt(document.getElementById('map-create-w').value) || 1000;
                const h = parseInt(document.getElementById('map-create-h').value) || 1000;
                const useGrid = gridCheck.checked;
                const cols = useGrid ? (parseInt(document.getElementById('map-grid-cols').value) || 4) : 0;
                const rows = useGrid ? (parseInt(document.getElementById('map-grid-rows').value) || 4) : 0;
                popup.style.display = 'none';
                await createMapForPlace(placeId, parentId, w, h, useGrid, cols, rows);
            };
        } else {
            createMapForPlace(placeId, parentId);
        }
    }

    async function createMapForPlace(id, parentId, customW = 1000, customH = 1000, useGrid = false, gridCols = 4, gridRows = 4) {
        let mapData = {
            nodes: {},
            edges: {},
            polygons: {},
            layers: {}
        };

        if (!parentId) {
            if (useGrid && gridCols >= 1 && gridRows >= 1) {
                // ── Generate grid mesh ──
                let nId = 1, eId = 1, pId = 1;

                // Create (cols+1) × (rows+1) grid of nodes
                const nodeGrid = [];   // nodeGrid[row][col] = nodeId
                for (let r = 0; r <= gridRows; r++) {
                    nodeGrid[r] = [];
                    for (let c = 0; c <= gridCols; c++) {
                        const x = (c / gridCols) * customW;
                        const y = (r / gridRows) * customH;
                        const nodeKey = `n${nId++}`;
                        // Lock boundary nodes
                        const onBoundary = (r === 0 || r === gridRows || c === 0 || c === gridCols);
                        mapData.nodes[nodeKey] = { x, y, locked: onBoundary ? [x, y] : null };
                        nodeGrid[r][c] = nodeKey;
                    }
                }

                // Create horizontal edges (row-wise)
                const hEdges = [];  // hEdges[r][c] = edgeId for edge from (r,c)→(r,c+1)
                for (let r = 0; r <= gridRows; r++) {
                    hEdges[r] = [];
                    for (let c = 0; c < gridCols; c++) {
                        const edgeKey = `e${eId++}`;
                        mapData.edges[edgeKey] = { n1: nodeGrid[r][c], n2: nodeGrid[r][c + 1] };
                        hEdges[r][c] = edgeKey;
                    }
                }

                // Create vertical edges (column-wise)
                const vEdges = [];  // vEdges[r][c] = edgeId for edge from (r,c)→(r+1,c)
                for (let r = 0; r < gridRows; r++) {
                    vEdges[r] = [];
                    for (let c = 0; c <= gridCols; c++) {
                        const edgeKey = `e${eId++}`;
                        mapData.edges[edgeKey] = { n1: nodeGrid[r][c], n2: nodeGrid[r + 1][c] };
                        vEdges[r][c] = edgeKey;
                    }
                }

                // Create polygons for each cell
                for (let r = 0; r < gridRows; r++) {
                    for (let c = 0; c < gridCols; c++) {
                        // Edges: top, right, bottom (reversed), left (reversed)
                        // Winding: clockwise → top → right → bottom → left
                        const polyKey = `poly${pId++}`;
                        mapData.polygons[polyKey] = {
                            name: `Cell ${r + 1},${c + 1}`,
                            edges: [
                                hEdges[r][c],       // top: (r,c)→(r,c+1)
                                vEdges[r][c + 1],    // right: (r,c+1)→(r+1,c+1)
                                hEdges[r + 1][c],    // bottom: (r+1,c)→(r+1,c+1)  — traversed backwards
                                vEdges[r][c]         // left: (r,c)→(r+1,c) — traversed backwards
                            ],
                            color: `hsla(${(r * gridCols + c) * (360 / (gridRows * gridCols))}, 40%, 35%, 0.4)`
                        };
                    }
                }
            } else {
                // Simple single-polygon map (original behavior)
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
            }
        } else {
            const parentMap = await window.db.getEntity('maps', parentId);
            if (!parentMap) { alert("Parent map not found!"); return; }

            const polyEntry = Object.entries(parentMap.polygons || {}).find(([k, p]) => p.link === id);
            if (!polyEntry) {
                alert(`No polygon in parent map is assigned to ${id}. Please open the parent map and assign a region to this place first.`);
                return;
            }

            const [polyId, polyData] = polyEntry;
            const tempGraph = new MapGraph();
            tempGraph.load(parentMap);
            const { nodes } = tempGraph.getOrderedNodesForPolygon(polyId);

            if (!nodes || nodes.length < 3) { alert("Assigned polygon has too few nodes."); return; }

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const nId of nodes) {
                const n = parentMap.nodes[nId];
                if (n.x < minX) minX = n.x;
                if (n.y < minY) minY = n.y;
                if (n.x > maxX) maxX = n.x;
                if (n.y > maxY) maxY = n.y;
            }

            const pWidth = maxX - minX;
            const pHeight = maxY - minY;
            const size = Math.max(pWidth, pHeight);
            const targetW = 1000, targetH = 1000;
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
                currentPath = [e.detail.id];
            } else {
                currentPath = [];
            }
            renderPlacesView();
        }
    });
})();