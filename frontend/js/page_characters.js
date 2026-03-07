/**
 * Characters Page Module — Arteriae Aethereae Wiki
 *
 * Renders a folder-based grid of characters (real disk folders under data/characters/).
 * Each character's path-based ID is their relative path in that directory
 * (e.g. "protagonists/aeron").
 *
 * Features:
 *  - Folder navigation breadcrumb (Root → folder → character sheet)
 *  - Relationships tab wired to page_graph.js ForceGraph canvas
 *  - Image picker for icon and gallery (via component_image_picker.js)
 *  - All manifest refreshes use reloadManifest()
 *
 * HOOKs:
 *  - TEMPLATE_SECTIONS: edit to add/remove character sheet sections
 *  - createEmptyCharacter(): default fields for new characters
 */
(function () {

    // ─── Configuration ─────────────────────────────────────────────────────────
    const TEMPLATE_SECTIONS = [
        { key: 'identity', icon: '📋', title: 'Identity' },
        { key: 'appearance', icon: '🎭', title: 'Appearance' },
        { key: 'combat', icon: '⚔️', title: 'Combat & Magic' },
        { key: 'personality', icon: '🧠', title: 'Personality' },
        { key: 'skills', icon: '🎯', title: 'Skills & Talents' },
        { key: 'connections', icon: '🌍', title: 'Connections & History' },
        { key: 'background', icon: '📚', title: 'Background' },
        { key: 'preferences', icon: '🎨', title: 'Preferences' },
        { key: 'possessions', icon: '💰', title: 'Possessions' },
        { key: 'special', icon: '🔮', title: 'Special Aspects' },
        { key: 'notes', icon: '📝', title: 'Development Notes' },
        { key: 'narrative', icon: '🎭', title: 'Narrative Role' },
    ];

    // ─── State ─────────────────────────────────────────────────────────────────
    let currentFolder = '';   // Path-based folder prefix, e.g. "protagonists"

    // ─── Template ──────────────────────────────────────────────────────────────

    function createEmptyCharacter(name, folder = '') {
        return {
            _type: 'character',
            name: name || 'New Character',
            folder: folder,
            icon: null,
            gallery: [],
            linked_characters: [],
            identity: {
                firstName: '', lastName: '', aliases: '', titles: '',
                gender: '', age: '', birthDate: '', birthPlace: '',
            },
            appearance: {
                race: '', subRace: '', height: '', weight: '',
                lifespan: '', originPlanet: '', description: '',
                face: '', eyes: '', hair: '', skin: '', body: '', clothing: '',
            },
            combat: {
                strength: 0, agility: 0, endurance: 0, speed: 0, resistance: 0,
                etherLevel: 0, mainElement: '', specialization: '',
                weapons: '', fightingStyle: '', techniques: '', weaknesses: '',
            },
            personality: {
                temperament: '', values: '', morals: '',
                weaknesses: '', strengths: '', motivations: '', fears: '', dreams: '',
            },
            skills: {
                profession: '', expertise: '', naturalTalents: '',
                languages: '', education: '', specialKnowledge: '',
            },
            connections: {
                family: '', friends: '', allies: '', enemies: '',
                mentors: '', organizations: '', importantPlaces: '',
            },
            background: { childhood: '', importantEvents: '', quests: '' },
            preferences: { likes: '', dislikes: '', fears: '' },
            possessions: { wealth: '', valuables: '', magicItems: '' },
            special: { racialTraits: '', health: '', magicStatus: '' },
            notes: { evolution: '', secrets: '', creatorNotes: '' },
            narrative: { role: '', importance: '', storyArc: '', futureDevelopment: '' },
        };
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escapeAttr(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function formatLabel(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    }

    // ─── Folder Navigation ─────────────────────────────────────────────────────

    /**
     * Returns the list of unique folder names visible at the current level.
     * e.g. if currentFolder = '' and IDs are ['protagonists/aeron', 'npcs/dara'],
     * returns ['protagonists', 'npcs'].
     * If currentFolder = 'protagonists', returns [] (shows characters directly).
     */
    function getFoldersAtCurrentLevel(characters) {
        const prefix = currentFolder ? currentFolder + '/' : '';
        const folders = new Set();
        for (const id of Object.keys(characters)) {
            if (!id.startsWith(prefix)) continue;
            const rest = id.slice(prefix.length);
            const parts = rest.split('/');
            if (parts.length > 1) folders.add(parts[0]);
        }
        return [...folders].sort();
    }

    function getCharsAtCurrentLevel(characters) {
        const prefix = currentFolder ? currentFolder + '/' : '';
        const result = {};
        for (const [id, data] of Object.entries(characters)) {
            if (!id.startsWith(prefix)) continue;
            const rest = id.slice(prefix.length);
            if (!rest.includes('/')) result[id] = data;
        }
        return result;
    }

    // ─── Card Grid Renderer ────────────────────────────────────────────────────

    function renderCardGrid(container) {
        const characters = window.db.manifest?.characters || {};
        const folders = getFoldersAtCurrentLevel(characters);
        const chars = getCharsAtCurrentLevel(characters);

        let html = '';

        // ── Toolbar ──
        html += `<div class="char-toolbar" style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">`;

        // Breadcrumb
        html += `<div class="char-breadcrumb" style="flex:1;display:flex;align-items:center;gap:6px;">`;
        html += `<span class="char-bc-item" data-folder="" style="cursor:pointer;color:var(--aether-cyan);">👥 All Characters</span>`;
        if (currentFolder) {
            const parts = currentFolder.split('/');
            let built = '';
            parts.forEach((p, i) => {
                built = built ? `${built}/${p}` : p;
                const bc = built;
                html += `<span style="color:var(--text-dim);">›</span>`;
                html += `<span class="char-bc-item" data-folder="${bc}"
                    style="cursor:pointer;color:${i === parts.length - 1 ? 'var(--text-light)' : 'var(--aether-cyan)'};">
                    📁 ${p}
                </span>`;
            });
        }
        html += `</div>`;

        // Buttons (edit mode only)
        if (window.isEditMode) {
            html += `<button class="tool-btn" id="btn-new-folder-char">📁 New Folder</button>`;
            html += `<button class="tool-btn" id="btn-add-character">+ Add Character</button>`;
        }

        html += '</div>';

        // ── Folder cards ──
        if (folders.length > 0) {
            html += `<div class="char-folder-grid">`;
            folders.forEach(fname => {
                const prefix = currentFolder ? `${currentFolder}/${fname}/` : `${fname}/`;
                const count = Object.keys(characters).filter(id => id.startsWith(prefix)).length;
                html += `<div class="char-folder-card" data-folder="${currentFolder ? currentFolder + '/' : ''}${fname}">
                    <span class="folder-icon">📁</span>
                    <span class="folder-label">${fname}</span>
                    <span class="folder-count">${count} character${count !== 1 ? 's' : ''}</span>
                </div>`;
            });
            html += `</div>`;
        }

        // ── Character cards ──
        html += `<div class="char-grid">`;
        for (const [id, data] of Object.entries(chars)) {
            const iconUrl = data.icon || null;
            html += `<div class="char-card" data-id="${id}">
                <div class="char-card-icon">
                    ${iconUrl
                    ? `<img src="${iconUrl}" alt="${escapeAttr(data.name)}" loading="lazy" style="object-fit:cover;">`
                    : `<span class="char-card-placeholder">👤</span>`}
                </div>
                <h3 class="char-card-name">${escapeHtml(data.name || id)}</h3>
                <p class="char-card-type">${escapeHtml(data.type || 'Character')}</p>
            </div>`;
        }

        if (Object.keys(chars).length === 0 && folders.length === 0) {
            html += `<p class="placeholder-text" style="padding:40px;text-align:center;">
                No characters here yet.${window.isEditMode ? ' Click <strong>+ Add Character</strong> to create one.' : ''}
            </p>`;
        }
        html += `</div>`;

        container.innerHTML = html;

        // ── Events ──

        // Breadcrumb navigation
        container.querySelectorAll('.char-bc-item').forEach(item => {
            item.addEventListener('click', () => {
                currentFolder = item.dataset.folder;
                renderCardGrid(container);
            });
        });

        // Folder card navigation
        container.querySelectorAll('.char-folder-card').forEach(card => {
            card.addEventListener('click', () => {
                currentFolder = card.dataset.folder;
                renderCardGrid(container);
            });
        });

        // Character card: open sheet
        container.querySelectorAll('.char-card').forEach(card => {
            card.addEventListener('click', () => openCharacterSheet(card.dataset.id, container));
        });

        // New folder button
        const newFolderBtn = container.querySelector('#btn-new-folder-char');
        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', () => {
                const name = window.prompt('New folder name:');
                if (!name) return;
                // Folder is created implicitly when a character is saved in it.
                // We just set the current folder context for the next character creation.
                currentFolder = currentFolder ? `${currentFolder}/${name.toLowerCase().replace(/\s+/g, '_')}` : name.toLowerCase().replace(/\s+/g, '_');
                renderCardGrid(container);
            });
        }

        // Add character button
        const addBtn = container.querySelector('#btn-add-character');
        if (addBtn) {
            addBtn.addEventListener('click', () => promptNewCharacter(container));
        }

        // Setup Context Menus
        setupCharacterContextMenu(container);
    }

    // ─── Character Sheet ───────────────────────────────────────────────────────

    async function openCharacterSheet(id, container) {
        if (!container) container = document.getElementById('characters-content');
        const data = await window.db.getEntity('characters', id);
        if (!data) { console.error('Could not load character:', id); return; }

        let html = `<div class="char-sheet">
            <button class="char-sheet-back tool-btn" id="btn-back-chars">← All Characters</button>
            <div class="char-sheet-header">
                <div class="char-sheet-icon">
            ${data.icon
                ? `<a href="${data.icon}" target="_blank" title="View full size" style="width: 100%; height: 100%;"><img src="${data.icon}" alt="${escapeAttr(data.name)}" style="object-fit:cover; width: 100%; height: 100%;"></a>`
                : `<span class="char-placeholder-large">👤</span>`
            }
                </div>
                <div class="char-sheet-title-block">
                    <h2 class="char-sheet-name">${escapeHtml(data.name)}</h2>
                    ${data.identity ? `<p class="char-sheet-subtitle">${escapeHtml(data.identity.titles || '')} ${data.identity.aliases ? '— ' + escapeHtml(data.identity.aliases) : ''}</p>` : ''}
                </div>
                <div class="char-sheet-actions" style="display:flex; gap:8px; flex-wrap: wrap;">
                    <button class="tool-btn" id="btn-char-local-graph" data-id="${id}">🕸️ Relationships</button>
                    ${window.isEditMode ? `<button class="tool-btn" id="btn-edit-char" data-id="${id}">✏️ Edit</button>
                    <button class="tool-btn" id="btn-delete-char" data-id="${id}"
                        style="border-color:#ff5555;color:#ff5555;">🗑️ Delete</button>` : ''}
                </div>
            </div>`;

        if (data.combat) html += renderStatBars(data.combat);

        for (const section of TEMPLATE_SECTIONS) {
            const sd = data[section.key];
            if (!sd) continue;
            const entries = Object.entries(sd).filter(([, v]) => v && v !== '' && v !== 0 && v !== '/' && v !== '...');
            if (!entries.length) continue;
            html += `<div class="char-section">
                <h3 class="char-section-title">${section.icon} ${section.title}</h3>
                <div class="char-section-body">`;
            for (const [k, v] of entries) {
                html += `<div class="char-field"><span class="char-label">${formatLabel(k)}:</span> <span class="char-value">${typeof v === 'number' ? `${v}/10` : escapeHtml(String(v))}</span></div>`;
            }
            html += '</div></div>';
        }

        // Linked characters (supports both legacy string[] and new {id,type}[] formats)
        const normalizedLinks = (data.linked_characters || []).map(lc =>
            typeof lc === 'string' ? { id: lc, type: '' } : lc
        );
        if (normalizedLinks.length) {
            html += `<div class="char-section">
                <h3 class="char-section-title">🕸️ Connections</h3>
                <div class="char-section-body" style="display:flex;flex-direction:column;gap:8px;">
                    ${normalizedLinks.map(lc => {
                const cName = window.db.manifest?.characters?.[lc.id]?.name || lc.id;
                const cIcon = window.db.manifest?.characters?.[lc.id]?.icon;
                return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(155,89,255,0.08);border:1px solid rgba(155,89,255,0.2);border-radius:8px;">
                            <div style="width:32px;height:32px;border-radius:50%;overflow:hidden;background:var(--glass-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                ${cIcon ? `<img src="${cIcon}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:1.1rem;">👤</span>`}
                            </div>
                            <span style="color:var(--aether-cyan);font-family:'Balgruf',serif;">${escapeHtml(cName)}</span>
                            ${lc.type ? `<span style="color:var(--text-dim);font-size:0.85rem;margin-left:auto;font-style:italic;">${escapeHtml(lc.type)}</span>` : ''}
                        </div>`;
            }).join('')}
                </div></div>`;
        }

        // Gallery
        if (data.gallery?.length) {
            html += `<div class="char-section"><h3 class="char-section-title">🖼️ Gallery</h3><div class="char-gallery">`;
            data.gallery.forEach(url => {
                html += `<a href="${url}" target="_blank" style="display:block; overflow:hidden; border-radius:8px;"><img src="${url}" alt="Gallery image" class="char-gallery-img" loading="lazy" style="object-fit:cover;"></a>`;
            });
            html += '</div></div>';
        }

        html += '</div>';
        container.innerHTML = html;

        document.getElementById('btn-back-chars').addEventListener('click', () => renderCardGrid(container));

        const graphBtn = document.getElementById('btn-char-local-graph');
        if (graphBtn) {
            graphBtn.addEventListener('click', () => {
                if (window.renderGraphPage) {
                    container.innerHTML = `
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                            <button class="tool-btn" id="btn-back-from-graph">← Character Sheet</button>
                            <h2 style="font-family:'Balgruf',serif;color:var(--aether-cyan);margin:0;">🕸️ Relationships: ${escapeHtml(data.name || id)}</h2>
                        </div>
                        <div id="graph-page-container" style="display:flex;height:600px;gap:0;border-radius:10px;overflow:hidden;border:1px solid var(--glass-border);"></div>`;
                    document.getElementById('btn-back-from-graph').addEventListener('click', () => {
                        openCharacterSheet(id, container);
                    });
                    window.renderGraphPage(document.getElementById('graph-page-container'), id);
                }
            });
        }

        const editBtn = document.getElementById('btn-edit-char');
        if (editBtn) editBtn.addEventListener('click', () => openCharacterEditor(id, data, container));

        const delBtn = document.getElementById('btn-delete-char');
        if (delBtn) {
            delBtn.addEventListener('click', async () => {
                if (!confirm(`Delete character "${data.name}"?\n\nThis cannot be undone.`)) return;
                const ok = await window.db.deleteEntity('characters', id);
                if (ok) {
                    await window.db.reloadManifest();
                    renderCardGrid(container);
                } else {
                    alert('Failed to delete character.');
                }
            });
        }
    }

    // Expose for cross-page navigation (from graph)
    window.requestCharacterFocus = (id) => {
        const container = document.getElementById('characters-content');
        if (container) openCharacterSheet(id, container);
    };

    // ─── Character Editor ──────────────────────────────────────────────────────

    function openCharacterEditor(id, data, container) {
        if (!container) container = document.getElementById('characters-content');

        // Icon URL (from data.icon) — may be a full URL or a data-images path
        const iconUrl = data.icon || null;

        let html = `<div class="char-sheet">
            <button class="char-sheet-back tool-btn" id="btn-cancel-edit">← Cancel</button>
            <h2 class="char-sheet-name" style="margin-bottom:20px;">✏️ Editing: ${escapeHtml(data.name)}</h2>
            <form id="char-edit-form">`;

        // ── Icon picker ──
        html += `<div class="char-section">
            <h3 class="char-section-title">🖼️ Profile Image</h3>
            <div class="char-section-body" style="flex-direction:row;align-items:center;gap:20px;">
                <div class="char-icon-clickable" id="char-icon-wrap" style="width:80px;height:80px;">
            ${iconUrl
                ? `<img id="char-icon-preview" src="${iconUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:50%;">`
                : `<span id="char-icon-placeholder" style="font-size:3rem;opacity:0.6;">👤</span>`
            }
                </div>
                <div>
                    <button type="button" class="tool-btn" id="btn-pick-icon">🖼 Choose Icon</button>
                    <input type="hidden" name="icon" id="input-icon" value="${escapeAttr(iconUrl || '')}">
                    ${iconUrl ? `<button type="button" class="tool-btn btn-muted" id="btn-clear-icon" style="margin-top:8px;">✖ Clear</button>` : ''}
                </div>
            </div>
        </div>`;

        // ── Name & folder ──
        html += `<div class="char-section">
            <h3 class="char-section-title">📋 Basic Info</h3>
            <div class="char-section-body">
                <div class="edit-field">
                    <label>Name</label>
                    <input type="text" name="name" value="${escapeAttr(data.name || '')}" required />
                </div>
                <div class="edit-field">
                    <label>Folder / Group <span style="font-size:0.8em;color:var(--text-dim);">(e.g. protagonists, npcs)</span></label>
                    <input type="text" name="folder" value="${escapeAttr(data.folder || currentFolder || '')}" />
                </div>
                <div class="edit-field">
                    <label>Linked Characters</label>
                    <div id="linked-chars-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
                        <!-- Populated by JS -->
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <select id="linked-chars-select" style="flex:1;min-width:150px;padding:8px;background:var(--glass-bg);color:white;border:1px solid var(--border-color);border-radius:4px;">
                            <option value="">— Select a character —</option>
                        </select>
                        <input type="text" id="linked-chars-type-input" placeholder="Relationship type (e.g. brother)" style="flex:1;min-width:140px;padding:8px;background:var(--glass-bg);color:white;border:1px solid var(--border-color);border-radius:4px;" />
                        <button type="button" class="tool-btn" id="btn-add-linked-char" style="white-space:nowrap;">+ Link</button>
                    </div>
                    <input type="hidden" name="linked_characters" id="input-linked-chars" value="" />
                </div>
            </div>
        </div>`;

        // ── Template sections ──
        for (const section of TEMPLATE_SECTIONS) {
            const sd = data[section.key];
            if (!sd || typeof sd !== 'object') continue;
            html += `<div class="char-section">
                <h3 class="char-section-title">${section.icon} ${section.title}</h3>
                <div class="char-section-body">`;
            for (const [k, v] of Object.entries(sd)) {
                const label = formatLabel(k);
                if (typeof v === 'number') {
                    html += `<div class="edit-field">
                        <label>${label}</label>
                        <input type="number" name="${section.key}.${k}" value="${v}" min="0" max="10" />
                    </div>`;
                } else {
                    const isLong = String(v || '').length > 60;
                    html += isLong
                        ? `<div class="edit-field"><label>${label}</label><textarea name="${section.key}.${k}" rows="3">${escapeHtml(String(v || ''))}</textarea></div>`
                        : `<div class="edit-field"><label>${label}</label><input type="text" name="${section.key}.${k}" value="${escapeAttr(String(v || ''))}" /></div>`;
                }
            }
            html += '</div></div>';
        }

        // ── Gallery editor ──
        const gallery = data.gallery || [];
        html += `<div class="char-section">
            <h3 class="char-section-title">🖼️ Gallery</h3>
            <div class="char-section-body">
                <div class="gallery-edit-strip" id="gallery-edit-strip">
                    ${gallery.map((url, i) => `
                        <div class="gallery-thumb-edit" data-idx="${i}">
                            <img src="${url}" alt="" style="object-fit:cover;">
                            <button type="button" class="gallery-thumb-remove" data-idx="${i}">✕</button>
                        </div>`).join('')}
                    <button type="button" class="gallery-add-btn" id="btn-add-gallery">＋</button>
                </div>
                <input type="hidden" name="gallery" id="input-gallery" value="${escapeAttr(JSON.stringify(gallery))}">
            </div>
        </div>`;

        html += `<div style="display:flex;gap:12px;margin-top:20px;">
            <button type="submit" class="tool-btn" style="border-color:#4ecdc4;color:#4ecdc4;">💾 Save</button>
            <button type="button" class="tool-btn btn-muted" id="btn-cancel-edit2">Cancel</button>
        </div>`;

        html += '</form></div>';
        container.innerHTML = html;

        // ── Cancel ──
        const cancelHandler = () => openCharacterSheet(id, container);
        document.getElementById('btn-cancel-edit').addEventListener('click', cancelHandler);
        document.getElementById('btn-cancel-edit2').addEventListener('click', cancelHandler);

        // ── Icon picker ──
        const iconInput = document.getElementById('input-icon');
        const iconPreview = document.getElementById('char-icon-preview');
        const iconWrap = document.getElementById('char-icon-wrap');

        document.getElementById('btn-pick-icon').addEventListener('click', () => {
            window.openImagePicker(img => {
                iconInput.value = img.url;
                if (iconPreview) {
                    iconPreview.src = img.url;
                } else {
                    iconWrap.innerHTML = `<img id="char-icon-preview" src="${img.url}" style="width:80px;height:80px;object-fit:cover;border-radius:50%;">`;
                }
            }, { title: 'Choose Character Icon' });
        });

        const clearIconBtn = document.getElementById('btn-clear-icon');
        if (clearIconBtn) {
            clearIconBtn.addEventListener('click', () => {
                iconInput.value = '';
                iconWrap.innerHTML = `<span style="font-size:3rem;opacity:0.6;">👤</span>`;
            });
        }

        // ── Gallery management ──
        let currentGallery = [...gallery];

        function rebuildGalleryStrip() {
            const strip = document.getElementById('gallery-edit-strip');
            const galleryInput = document.getElementById('input-gallery');
            strip.innerHTML =
                currentGallery.map((url, i) => `
                    <div class="gallery-thumb-edit" data-idx="${i}">
                        <img src="${url}" alt="" style="object-fit:cover;">
                        <a href="${url}" target="_blank" class="gallery-thumb-view" title="View full size">🔍</a>
                        <button type="button" class="gallery-thumb-remove" data-idx="${i}">✕</button>
                    </div>`).join('') +
                `<button type="button" class="gallery-add-btn" id="btn-add-gallery">＋</button>`;

            galleryInput.value = JSON.stringify(currentGallery);

            // Remove buttons
            strip.querySelectorAll('.gallery-thumb-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentGallery.splice(parseInt(btn.dataset.idx), 1);
                    rebuildGalleryStrip();
                });
            });

            // Add button
            document.getElementById('btn-add-gallery').addEventListener('click', () => {
                window.openImagePicker(imgs => {
                    // multi-select returns array
                    const arr = Array.isArray(imgs) ? imgs : [imgs];
                    arr.forEach(img => { if (!currentGallery.includes(img.url)) currentGallery.push(img.url); });
                    rebuildGalleryStrip();
                }, { title: 'Add to Gallery', multiple: true });
            });
        }

        rebuildGalleryStrip();

        // ── Linked Characters Picker (typed relationships) ──
        // Normalize legacy string[] to {id, type}[]
        let currentLinked = (data.linked_characters || []).map(lc =>
            typeof lc === 'string' ? { id: lc, type: '' } : { ...lc }
        );
        const linkedInput = document.getElementById('input-linked-chars');
        const linkedSelect = document.getElementById('linked-chars-select');
        const linkedListDiv = document.getElementById('linked-chars-list');
        const linkedTypeInput = document.getElementById('linked-chars-type-input');

        function populateLinkedSelect() {
            const allChars = window.db.manifest?.characters || {};
            const linkedIds = currentLinked.map(lc => lc.id);
            linkedSelect.innerHTML = '<option value="">— Select a character —</option>';
            for (const [cid, cData] of Object.entries(allChars)) {
                if (cid === id) continue;
                if (linkedIds.includes(cid)) continue;
                const opt = document.createElement('option');
                opt.value = cid;
                opt.textContent = cData.name || cid;
                linkedSelect.appendChild(opt);
            }
        }

        function rebuildLinkedList() {
            linkedListDiv.innerHTML = '';
            currentLinked.forEach((lc, idx) => {
                const cName = window.db.manifest?.characters?.[lc.id]?.name || lc.id;
                const cIcon = window.db.manifest?.characters?.[lc.id]?.icon;
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(155,89,255,0.08);border:1px solid rgba(155,89,255,0.2);border-radius:8px;';
                row.innerHTML = `
                    <div style="width:32px;height:32px;border-radius:50%;overflow:hidden;background:var(--glass-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${cIcon ? `<img src="${cIcon}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:1.1rem;">👤</span>`}
                    </div>
                    <span style="color:var(--aether-cyan);font-family:'Balgruf',serif;min-width:80px;">${escapeHtml(cName)}</span>
                    <input type="text" class="linked-type-edit" data-idx="${idx}" value="${escapeAttr(lc.type || '')}" placeholder="Type (e.g. brother)" style="flex:1;padding:6px 8px;background:var(--glass-bg);color:white;border:1px solid var(--border-color);border-radius:4px;font-size:0.85rem;min-width:100px;" />
                    <button type="button" class="linked-char-remove" data-idx="${idx}" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:1.1rem;padding:2px 6px;line-height:1;flex-shrink:0;">✕</button>`;

                // Type change handler
                row.querySelector('.linked-type-edit').addEventListener('change', (e) => {
                    currentLinked[idx].type = e.target.value.trim();
                    linkedInput.value = JSON.stringify(currentLinked);
                });

                // Remove handler
                row.querySelector('.linked-char-remove').addEventListener('click', () => {
                    currentLinked.splice(idx, 1);
                    linkedInput.value = JSON.stringify(currentLinked);
                    rebuildLinkedList();
                    populateLinkedSelect();
                });

                linkedListDiv.appendChild(row);
            });
            linkedInput.value = JSON.stringify(currentLinked);
        }

        populateLinkedSelect();
        rebuildLinkedList();

        document.getElementById('btn-add-linked-char').addEventListener('click', () => {
            const charId = linkedSelect.value;
            if (!charId || currentLinked.some(lc => lc.id === charId)) return;
            const relType = linkedTypeInput.value.trim();
            currentLinked.push({ id: charId, type: relType });
            linkedTypeInput.value = '';
            rebuildLinkedList();
            populateLinkedSelect();
        });

        // ── Save form ──
        document.getElementById('char-edit-form').addEventListener('submit', async e => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const updated = JSON.parse(JSON.stringify(data));   // deep clone

            for (const [field, val] of formData.entries()) {
                if (field === 'name') {
                    updated.name = val;
                } else if (field === 'folder') {
                    updated.folder = val;
                } else if (field === 'icon') {
                    updated.icon = val || null;
                } else if (field === 'gallery') {
                    try { updated.gallery = JSON.parse(val); } catch (_) { updated.gallery = []; }
                } else if (field === 'linked_characters') {
                    try { updated.linked_characters = JSON.parse(val); } catch (_) { updated.linked_characters = []; }
                } else if (field.includes('.')) {
                    const [sec, key] = field.split('.');
                    if (!updated[sec]) updated[sec] = {};
                    const orig = data[sec]?.[key];
                    updated[sec][key] = typeof orig === 'number' ? (parseInt(val) || 0) : val;
                }
            }

            // Determine new entity ID (respect folder field)
            const folder = updated.folder?.trim();
            const safeName = (updated.name || 'character')
                .toLowerCase().replace(/[^a-z0-9]/g, '_');
            const newId = folder ? `${folder}/${safeName}` : safeName;

            await window.db.saveEntity('characters', newId, updated);

            // If ID changed, delete old entry
            if (newId !== id) {
                await window.db.deleteEntity('characters', id);
            }

            await window.db.reloadManifest();
            window.db.cache?.delete?.(`characters_${id}`);
            openCharacterSheet(newId, container);
        });
    }

    // ─── New Character ─────────────────────────────────────────────────────────

    function promptNewCharacter(container) {
        if (!container) container = document.getElementById('characters-content');

        container.innerHTML = `
        <div class="char-sheet">
            <button class="char-sheet-back tool-btn" id="btn-cancel-create-char">← Cancel</button>
            <h2 class="char-sheet-name" style="margin-bottom:20px;">✨ New Character</h2>
            <form id="char-create-form" class="char-section">
                <div class="char-section-body">
                    <div class="edit-field">
                        <label>Name</label>
                        <input type="text" id="new-char-name" required autofocus placeholder="Character name…" />
                    </div>
                    <div class="edit-field">
                        <label>Folder <span style="font-size:0.8em;color:var(--text-dim);">(optional, e.g. protagonists)</span></label>
                        <input type="text" id="new-char-folder"
                            value="${escapeAttr(currentFolder || '')}"
                            placeholder="existing or new folder name" />
                    </div>
                </div>
                <div style="display:flex;gap:12px;margin-top:20px;">
                    <button type="submit" class="tool-btn" style="border-color:#4ecdc4;color:#4ecdc4;">✔ Create & Edit</button>
                </div>
            </form>
        </div>`;

        document.getElementById('btn-cancel-create-char').addEventListener('click', () => renderCardGrid(container));

        document.getElementById('char-create-form').addEventListener('submit', async e => {
            e.preventDefault();
            const name = document.getElementById('new-char-name').value.trim();
            const folder = document.getElementById('new-char-folder').value.trim();
            if (!name) return;

            const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const id = folder ? `${folder}/${safeName}` : safeName;
            const charData = createEmptyCharacter(name, folder);

            await window.db.saveEntity('characters', id, charData);
            await window.db.reloadManifest();
            openCharacterEditor(id, charData, container);
        });
    }

    // ─── Utility renderers ────────────────────────────────────────────────────

    function renderStatBars(combat) {
        const stats = [
            { key: 'strength', label: 'STR', color: '#ff6b6b' },
            { key: 'agility', label: 'AGI', color: '#4ecdc4' },
            { key: 'endurance', label: 'END', color: '#f9ca24' },
            { key: 'speed', label: 'SPD', color: '#a29bfe' },
            { key: 'resistance', label: 'RES', color: '#fd79a8' },
            { key: 'etherLevel', label: 'ETH', color: '#00ffff' },
        ];
        let html = '<div class="char-stats">';
        for (const stat of stats) {
            const val = combat[stat.key] || 0;
            if (!val) continue;
            const pct = (val / 10) * 100;
            html += `<div class="stat-bar-wrap">
                <span class="stat-label">${stat.label}</span>
                <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${pct}%;background:${stat.color}"></div></div>
                <span class="stat-value">${val}</span>
            </div>`;
        }
        return html + '</div>';
    }

    // ─── Page Lifecycle ────────────────────────────────────────────────────────

    window.addEventListener('pagechange', e => {
        if (e.detail.page === 'characters') {
            currentFolder = '';   // Reset breadcrumb on page enter
            const container = document.getElementById('characters-content');
            if (e.detail.id) {
                openCharacterSheet(e.detail.id, container);
            } else {
                renderCardGrid(container);
            }
        }
    });

    // ─── Context Menu ─────────────────────────────────────────────────────────

    let activeCharContextNode = null;
    let charContextMenuHideListener = null;

    function setupCharacterContextMenu(container) {
        const menu = document.getElementById('char-context-menu');
        if (!menu) return;

        let pressTimer = null;

        const showMenu = (e, path, type, name) => {
            if (!window.isEditMode) return;
            e.preventDefault();
            e.stopPropagation();
            activeCharContextNode = { path, type, name };

            menu.style.display = 'block';

            // Position: prefer pageX/Y (mouse), fallback to touch
            const x = e.pageX ?? (e.touches?.[0]?.pageX ?? 0);
            const y = e.pageY ?? (e.touches?.[0]?.pageY ?? 0);
            const mW = menu.offsetWidth || 150;
            const mH = menu.offsetHeight || 120;
            menu.style.left = `${Math.min(x, window.innerWidth - mW - 8)}px`;
            menu.style.top = `${Math.min(y, window.innerHeight + window.scrollY - mH - 8)}px`;
        };

        const hideMenu = () => { menu.style.display = 'none'; };

        if (charContextMenuHideListener) {
            document.removeEventListener('click', charContextMenuHideListener);
        }
        charContextMenuHideListener = hideMenu;
        document.addEventListener('click', charContextMenuHideListener);

        menu.addEventListener('click', e => e.stopPropagation());

        container.querySelectorAll('.char-card').forEach(card => {
            // Document API expects path starting inside data/, e.g. "characters/protagonists/aeron.json"
            const realPath = `characters/${card.dataset.id}.json`;
            const name = card.querySelector('.char-card-name')?.textContent || card.dataset.id;

            card.addEventListener('contextmenu', e => showMenu(e, realPath, 'char', name));
            card.addEventListener('touchstart', e => {
                pressTimer = setTimeout(() => showMenu(e, realPath, 'char', name), 600);
            });
            card.addEventListener('touchend', () => clearTimeout(pressTimer));
            card.addEventListener('touchmove', () => clearTimeout(pressTimer));
        });

        // Initialize actions once
        if (!menu.dataset.initialized) {
            menu.dataset.initialized = 'true';
            document.getElementById('ctx-char-btn-rename').addEventListener('click', () => {
                hideMenu(); handleCharMenuAction('rename', container);
            });
            document.getElementById('ctx-char-btn-move').addEventListener('click', () => {
                hideMenu(); handleCharMenuAction('move', container);
            });
            document.getElementById('ctx-char-btn-copy').addEventListener('click', () => {
                hideMenu(); handleCharMenuAction('copy', container);
            });
            setupCharModals(container);
        }
    }

    function setupCharModals(container) {
        const renameModal = document.getElementById('char-rename-modal');
        const moveModal = document.getElementById('char-move-modal');

        document.getElementById('btn-cancel-char-rename').addEventListener('click', () => renameModal.style.display = 'none');
        document.getElementById('btn-cancel-char-move').addEventListener('click', () => moveModal.style.display = 'none');
        renameModal.addEventListener('click', e => { if (e.target === renameModal) renameModal.style.display = 'none'; });
        moveModal.addEventListener('click', e => { if (e.target === moveModal) moveModal.style.display = 'none'; });

        // Rename confirm
        document.getElementById('btn-confirm-char-rename').addEventListener('click', async () => {
            const newName = document.getElementById('char-rename-input').value.trim();
            if (!newName || !activeCharContextNode) return;

            let nameWithExt = newName;
            if (!nameWithExt.endsWith('.json')) nameWithExt += '.json';

            const r = await fetch('/api/documents/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_path: activeCharContextNode.path, new_name: nameWithExt })
            });
            if (r.ok) {
                renameModal.style.display = 'none';
                await updateCharacterInternalFolder(activeCharContextNode.path, newName, null);
                await window.db.reloadManifest();
                renderCardGrid(container);
            } else { alert('Rename failed (file may already exist).'); }
        });

        // Move confirm
        document.getElementById('btn-confirm-char-move').addEventListener('click', async () => {
            if (!activeCharContextNode) return;
            const destPath = moveModal.dataset.selectedDest || 'characters';
            const r = await fetch('/api/documents/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_path: activeCharContextNode.path, new_dest_dir: destPath })
            });
            if (r.ok) {
                moveModal.style.display = 'none';
                await updateCharacterInternalFolder(activeCharContextNode.path, null, destPath);
                await window.db.reloadManifest();
                renderCardGrid(container);
            } else { alert('Move failed.'); }
        });
    }

    /** Helper to fix the internal 'folder' and 'name' properties when moved/renamed via filesystem */
    async function updateCharacterInternalFolder(oldPath, newNameStr, newDestDir) {
        // oldPath is e.g. "characters/protagonists/aeron.json"
        try {
            // compute the new path
            let newPathId;
            let folderVal = '';

            if (newNameStr) {
                // renamed
                const dirStr = oldPath.split('/').slice(1, -1).join('/'); // rm 'characters/' and 'aeron.json'
                folderVal = dirStr;
                const safeName = newNameStr.replace('.json', '');
                newPathId = dirStr ? `${dirStr}/${safeName}` : safeName;
            } else if (newDestDir) {
                // moved (e.g. newDestDir "characters/npcs")
                const safeName = oldPath.split('/').pop().replace('.json', '');
                const destFolder = newDestDir.startsWith('characters/') ? newDestDir.substring(11) : (newDestDir === 'characters' ? '' : newDestDir);
                folderVal = destFolder;
                newPathId = destFolder ? `${destFolder}/${safeName}` : safeName;
            }

            if (newPathId) {
                const data = await window.db.getEntity('characters', newPathId);
                if (data) {
                    data.folder = folderVal;
                    if (newNameStr) {
                        const rawName = newNameStr.replace('.json', '');
                        // only overwrite name if it really needs to change (or maybe don't touch display name)
                    }
                    await window.db.saveEntity('characters', newPathId, data);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function handleCharMenuAction(action, container) {
        if (!activeCharContextNode) return;
        const { path, type, name } = activeCharContextNode;

        if (action === 'copy') {
            const r = await fetch('/api/documents/copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (r.ok) {
                await window.db.reloadManifest();
                renderCardGrid(container);
            } else { alert('Copy failed.'); }
            return;
        }

        if (action === 'rename') {
            const modal = document.getElementById('char-rename-modal');
            const input = document.getElementById('char-rename-input');
            input.value = name;
            modal.style.display = 'flex';
            input.focus();
            input.select();
        }

        if (action === 'move') {
            const modal = document.getElementById('char-move-modal');
            modal.style.display = 'flex';
            renderCharMoveTree();
        }
    }

    function renderCharMoveTree() {
        const container = document.getElementById('char-move-tree-container');
        const modal = document.getElementById('char-move-modal');
        const characters = window.db.manifest?.characters || {};
        const folders = new Set();
        folders.add(''); // Root

        for (const id of Object.keys(characters)) {
            const parts = id.split('/');
            if (parts.length > 1) {
                let p = '';
                for (let i = 0; i < parts.length - 1; i++) {
                    p = p ? p + '/' + parts[i] : parts[i];
                    folders.add(p);
                }
            }
        }

        let html = '';
        for (const f of Array.from(folders).sort()) {
            const depth = f ? f.split('/').length : 0;
            const indent = depth * 16;
            const isSelected = modal.dataset.selectedDest === (f ? `characters/${f}` : 'characters');
            html += `
                <div class="move-tree-row ${isSelected ? 'selected' : ''}" 
                     data-dest="${f ? 'characters/' + f : 'characters'}"
                     style="padding-left: ${indent + 8}px; padding-top:4px; padding-bottom:4px; cursor:pointer;">
                    📁 ${f || '(Root)'}
                </div>`;
        }
        container.innerHTML = html;

        container.querySelectorAll('.move-tree-row').forEach(row => {
            row.addEventListener('click', () => {
                container.querySelectorAll('.move-tree-row').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
                modal.dataset.selectedDest = row.dataset.dest;
            });
        });

        // Default select root if none
        if (!modal.dataset.selectedDest) {
            modal.dataset.selectedDest = 'characters';
            const rootEl = container.querySelector('[data-dest="characters"]');
            if (rootEl) rootEl.classList.add('selected');
        }
    }

})();
