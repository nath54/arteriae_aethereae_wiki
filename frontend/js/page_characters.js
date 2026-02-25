/**
 * Characters Page Module — Arteriae Aethereae Wiki
 * Renders the character grid from the manifest and manages the detailed character sheet view
 * alongside the edit mode form.
 *
 * HOOK POINT (Character Data): If you want to add new sections or stats
 * (e.g., "Relationships Grid" or "Inventory UI"), add keys to the `TEMPLATE_SECTIONS`
 * array below and update `createEmptyCharacter` accordingly.
 */
(function () {
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
        { key: 'narrative', icon: '🎭', title: 'Narrative Role' }
    ];

    // Default empty character template
    function createEmptyCharacter(name) {
        return {
            name: name || 'New Character',
            icon: null,
            gallery: [],
            identity: {
                firstName: '', lastName: '', aliases: '', titles: '',
                gender: '', age: '', birthDate: '', birthPlace: ''
            },
            appearance: {
                race: '', subRace: '', height: '', weight: '',
                lifespan: '', originPlanet: '', description: '',
                face: '', eyes: '', hair: '', skin: '',
                body: '', clothing: ''
            },
            combat: {
                strength: 0, agility: 0, endurance: 0, speed: 0, resistance: 0,
                etherLevel: 0, mainElement: '', specialization: '',
                weapons: '', fightingStyle: '', techniques: '', weaknesses: ''
            },
            personality: {
                temperament: '', values: '', morals: '',
                weaknesses: '', strengths: '', motivations: '',
                fears: '', dreams: ''
            },
            skills: {
                profession: '', expertise: '', naturalTalents: '',
                languages: '', education: '', specialKnowledge: ''
            },
            connections: {
                family: '', friends: '', allies: '', enemies: '',
                mentors: '', organizations: '', importantPlaces: ''
            },
            background: {
                childhood: '', importantEvents: '', quests: ''
            },
            preferences: {
                likes: '', dislikes: '', fears: ''
            },
            possessions: {
                wealth: '', valuables: '', magicItems: ''
            },
            special: {
                racialTraits: '', health: '', magicStatus: ''
            },
            notes: {
                evolution: '', secrets: '', creatorNotes: ''
            },
            narrative: {
                role: '', importance: '', storyArc: '', futureDevelopment: ''
            }
        };
    }

    // ── Render Functions ──

    function renderCardGrid(container) {
        const manifest = window.db.manifest;
        const characters = manifest.characters || {};

        let html = '<div class="char-grid">';

        // Add character button (edit mode)
        html += `<div class="char-add-card edit-only" id="btn-add-character">
            <div class="char-add-icon">+</div>
            <span>Add Character</span>
        </div>`;

        for (const [id, data] of Object.entries(characters)) {
            const iconUrl = data.icon ? `../data/characters/${id}_icon.png` : null;
            html += `
            <div class="char-card" data-id="${id}">
                <div class="char-card-icon">
                    ${iconUrl ? `<img src="${iconUrl}" alt="${data.name}">` : '<span class="char-card-placeholder">👤</span>'}
                </div>
                <h3 class="char-card-name">${data.name}</h3>
                <p class="char-card-type">${data.type || 'Character'}</p>
            </div>`;
        }

        html += '</div>';
        container.innerHTML = html;

        // Bind click events
        container.querySelectorAll('.char-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                openCharacterSheet(id);
            });
        });

        const addBtn = container.querySelector('#btn-add-character');
        if (addBtn) {
            addBtn.addEventListener('click', () => promptNewCharacter());
        }
    }

    async function openCharacterSheet(id) {
        const data = await window.db.getEntity('characters', id);
        if (!data) {
            console.error('Could not load character:', id);
            return;
        }

        const container = document.getElementById('characters-content');
        let html = `<div class="char-sheet">
            <button class="char-sheet-back tool-btn" id="btn-back-chars">← All Characters</button>
            <div class="char-sheet-header">
                <div class="char-sheet-icon">
                    ${data.icon ? `<img src="../data/characters/${id}_icon.png" alt="${data.name}">` : '<span class="char-placeholder-large">👤</span>'}
                </div>
                <div class="char-sheet-title-block">
                    <h2 class="char-sheet-name">${data.name}</h2>
                    ${data.identity ? `<p class="char-sheet-subtitle">${data.identity.titles || ''} ${data.identity.aliases ? '— ' + data.identity.aliases : ''}</p>` : ''}
                </div>
                <div class="char-sheet-actions edit-only">
                    <button class="tool-btn" id="btn-edit-char" data-id="${id}">✏️ Edit</button>
                    <button class="tool-btn" id="btn-delete-char" data-id="${id}" style="border-color:#ff5555;color:#ff5555;">🗑️ Delete</button>
                </div>
            </div>`;

        // Stats bars (if combat data exists)
        if (data.combat) {
            html += renderStatBars(data.combat);
        }

        // Sections
        for (const section of TEMPLATE_SECTIONS) {
            const sectionData = data[section.key];
            if (!sectionData) continue;

            const entries = Object.entries(sectionData).filter(([k, v]) => v && v !== '' && v !== 0 && v !== '/' && v !== '...');
            if (entries.length === 0) continue;

            html += `<div class="char-section">
                <h3 class="char-section-title">${section.icon} ${section.title}</h3>
                <div class="char-section-body">`;

            for (const [key, value] of entries) {
                const label = formatLabel(key);
                if (typeof value === 'number') {
                    html += `<div class="char-field"><span class="char-label">${label}:</span> <span class="char-value">${value}/10</span></div>`;
                } else {
                    html += `<div class="char-field"><span class="char-label">${label}:</span> <span class="char-value">${value}</span></div>`;
                }
            }

            html += '</div></div>';
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

        // Back button
        document.getElementById('btn-back-chars').addEventListener('click', () => {
            renderCardGrid(container);
        });

        // Edit button
        const editBtn = document.getElementById('btn-edit-char');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                openCharacterEditor(id, data);
            });
        }

        // Delete button
        const delBtn = document.getElementById('btn-delete-char');
        if (delBtn) {
            delBtn.addEventListener('click', async () => {
                if (confirm(`Delete character "${data.name}"? This cannot be undone.`)) {
                    const success = await window.db.deleteEntity('characters', id);
                    if (success) {
                        renderCardGrid(container);
                    } else {
                        alert('Failed to delete character.');
                    }
                }
            });
        }
    }

    // ── Character Editor ──

    function openCharacterEditor(id, data) {
        const container = document.getElementById('characters-content');

        let html = `<div class="char-sheet">
            <button class="char-sheet-back tool-btn" id="btn-cancel-edit">← Cancel</button>
            <h2 class="char-sheet-name" style="margin-bottom:20px;">Editing: ${data.name}</h2>
            <form id="char-edit-form">`;

        // Name field
        html += `<div class="char-section">
            <h3 class="char-section-title">📋 Basic Info</h3>
            <div class="char-section-body">
                <div class="edit-field">
                    <label>Name</label>
                    <input type="text" name="name" value="${escapeAttr(data.name || '')}" />
                </div>
            </div>
        </div>`;

        // All template sections as editable fields
        for (const section of TEMPLATE_SECTIONS) {
            const sectionData = data[section.key];
            if (!sectionData || typeof sectionData !== 'object') continue;

            html += `<div class="char-section">
                <h3 class="char-section-title">${section.icon} ${section.title}</h3>
                <div class="char-section-body">`;

            for (const [key, value] of Object.entries(sectionData)) {
                const label = formatLabel(key);
                if (typeof value === 'number') {
                    html += `<div class="edit-field">
                        <label>${label}</label>
                        <input type="number" name="${section.key}.${key}" value="${value}" min="0" max="10" />
                    </div>`;
                } else {
                    const isLong = (value || '').length > 60;
                    if (isLong) {
                        html += `<div class="edit-field">
                            <label>${label}</label>
                            <textarea name="${section.key}.${key}" rows="3">${escapeHtml(value || '')}</textarea>
                        </div>`;
                    } else {
                        html += `<div class="edit-field">
                            <label>${label}</label>
                            <input type="text" name="${section.key}.${key}" value="${escapeAttr(value || '')}" />
                        </div>`;
                    }
                }
            }
            html += '</div></div>';
        }

        html += `<div style="display:flex;gap:12px;margin-top:20px;">
            <button type="submit" class="tool-btn" style="border-color:#4ecdc4;color:#4ecdc4;">💾 Save</button>
            <button type="button" class="tool-btn" id="btn-cancel-edit2">Cancel</button>
        </div>`;

        html += '</form></div>';
        container.innerHTML = html;

        // Cancel
        const cancelHandler = () => openCharacterSheet(id);
        document.getElementById('btn-cancel-edit').addEventListener('click', cancelHandler);
        document.getElementById('btn-cancel-edit2').addEventListener('click', cancelHandler);

        // Save
        document.getElementById('char-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const updated = JSON.parse(JSON.stringify(data)); // deep clone

            for (const [field, val] of formData.entries()) {
                if (field === 'name') {
                    updated.name = val;
                } else if (field.includes('.')) {
                    const [section, key] = field.split('.');
                    if (!updated[section]) updated[section] = {};
                    // Try to preserve number types
                    const origVal = data[section] && data[section][key];
                    if (typeof origVal === 'number') {
                        updated[section][key] = parseInt(val) || 0;
                    } else {
                        updated[section][key] = val;
                    }
                }
            }

            await window.db.saveEntity('characters', id, updated);
            // Force manifest reload and show updated sheet
            window.db.manifest = null;
            await window.db.loadManifest();
            // Clear cache for this character
            window.db.cache.delete(`characters_${id}`);
            openCharacterSheet(id);
        });
    }

    function escapeHtml(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeAttr(text) {
        return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderStatBars(combat) {
        const stats = [
            { key: 'strength', label: 'STR', color: '#ff6b6b' },
            { key: 'agility', label: 'AGI', color: '#4ecdc4' },
            { key: 'endurance', label: 'END', color: '#f9ca24' },
            { key: 'speed', label: 'SPD', color: '#a29bfe' },
            { key: 'resistance', label: 'RES', color: '#fd79a8' },
            { key: 'etherLevel', label: 'ETH', color: '#00ffff' }
        ];

        let html = '<div class="char-stats">';
        for (const stat of stats) {
            const val = combat[stat.key] || 0;
            if (val === 0) continue;
            const pct = (val / 10) * 100;
            html += `<div class="stat-bar-wrap">
                <span class="stat-label">${stat.label}</span>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width:${pct}%;background:${stat.color}"></div>
                </div>
                <span class="stat-value">${val}</span>
            </div>`;
        }
        html += '</div>';
        return html;
    }

    function formatLabel(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    }

    function promptNewCharacter() {
        const container = document.getElementById('characters-content');
        container.innerHTML = `
        <div class="char-sheet">
            <button class="char-sheet-back tool-btn" id="btn-cancel-create-char">← Cancel</button>
            <h2 class="char-sheet-name" style="margin-bottom:20px;">New Character</h2>
            <form id="char-create-form" class="char-section">
                <div class="char-section-body">
                    <div class="edit-field">
                        <label>Name</label>
                        <input type="text" id="new-char-name" required autofocus />
                    </div>
                </div>
                <div style="display:flex;gap:12px;margin-top:20px;">
                    <button type="submit" class="tool-btn" style="border-color:#4ecdc4;color:#4ecdc4;">💾 Create</button>
                </div>
            </form>
        </div>`;

        document.getElementById('btn-cancel-create-char').addEventListener('click', () => {
            renderCardGrid(container);
        });

        document.getElementById('char-create-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-char-name').value.trim();
            if (!name) return;

            const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const charData = createEmptyCharacter(name);
            await window.db.saveEntity('characters', id, charData);

            // Rebuild manifest and re-render sheet immediately
            window.db.manifest = null; // Force reload
            await window.db.loadManifest();
            openCharacterEditor(id, charData); // Jump straight to full editor
        });
    }

    // ── Page Lifecycle ──

    window.addEventListener('pagechange', (e) => {
        if (e.detail.page === 'characters') {
            const container = document.getElementById('characters-content');
            if (e.detail.id) {
                openCharacterSheet(e.detail.id);
            } else {
                renderCardGrid(container);
            }
        }
    });
})();
