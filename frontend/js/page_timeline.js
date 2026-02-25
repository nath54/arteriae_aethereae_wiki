/**
 * Timeline Page Module — Arteriae Aethereae Wiki
 * Renders a vertical, 3-column scrollable timeline (Teria events vs. Maria events).
 * Linked events span across columns.
 *
 * HOOK POINT (Timeline Logic): Event rendering happens in `renderTimelineRow`.
 * If you want to add eras, tags, or custom event images, parse them out in `renderTimelineRow()` below.
 */
(function () {

    function renderTimeline(container) {
        const manifest = window.db.manifest;
        const events = manifest.events || {};

        // Group events by date
        const eventList = Object.entries(events).map(([id, data]) => ({
            id, ...data
        }));

        // Sort by structured date (year, month, day)
        eventList.sort((a, b) => {
            const yA = parseInt(a.date_year || a.date || 0);
            const yB = parseInt(b.date_year || b.date || 0);
            if (yA !== yB) return yA - yB;

            const mA = parseInt(a.date_month || 0);
            const mB = parseInt(b.date_month || 0);
            if (mA !== mB) return mA - mB;

            const dA = parseInt(a.date_day || 0);
            const dB = parseInt(b.date_day || 0);
            return dA - dB;
        });

        let html = '';

        // Filter controls
        html += `<div class="timeline-controls">
            <button class="tool-btn timeline-filter active" data-filter="all">All</button>
            <button class="tool-btn timeline-filter" data-filter="teria">Teria Only</button>
            <button class="tool-btn timeline-filter" data-filter="maria">Maria Only</button>
            <button class="tool-btn edit-only" id="btn-add-event">+ Add Event</button>
        </div>`;

        // Timeline structure
        html += '<div class="timeline-wrapper">';
        html += '<div class="timeline-header-row">';
        html += '<div class="timeline-col-header teria-header">Teria</div>';
        html += '<div class="timeline-col-header date-header">Date</div>';
        html += '<div class="timeline-col-header maria-header">Maria</div>';
        html += '</div>';

        html += '<div class="timeline-body">';
        html += '<div class="timeline-line"></div>';

        if (eventList.length === 0) {
            // Show sample events for demo
            const sampleEvents = getSampleEvents();
            for (const evt of sampleEvents) {
                html += renderTimelineRow(evt);
            }
        } else {
            for (const evt of eventList) {
                html += renderTimelineRow(evt);
            }
        }

        html += '</div></div>';
        container.innerHTML = html;

        // Bind filter buttons
        container.querySelectorAll('.timeline-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.timeline-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterTimeline(container, btn.dataset.filter);
            });
        });

        // Add event
        const addBtn = container.querySelector('#btn-add-event');
        if (addBtn) {
            addBtn.addEventListener('click', () => openTimelineSidebar(null));
        }

        // Click to expand/open sidebar
        container.querySelectorAll('.timeline-event').forEach(evt => {
            evt.addEventListener('click', () => {
                const isEditMode = document.body.classList.contains('server-active');
                if (isEditMode) {
                    const eventData = eventList.find(e => e.id === evt.dataset.id) || events[evt.dataset.id];
                    openTimelineSidebar(evt.dataset.id, eventData);
                } else {
                    evt.classList.toggle('expanded');
                }
            });
        });

        // Ensure sidebar container exists
        if (!document.getElementById('timeline-sidebar')) {
            const sb = document.createElement('div');
            sb.id = 'timeline-sidebar';
            container.appendChild(sb);
        }
    }

    function renderTimelineRow(evt) {
        const world = (evt.world || 'teria').toLowerCase();
        const isLinked = evt.linked || false;
        const linkClass = isLinked ? 'timeline-linked' : '';

        let html = `<div class="timeline-row ${linkClass}" data-world="${world}">`;

        // Teria column
        html += '<div class="timeline-col teria-col">';
        if (world === 'teria' || isLinked) {
            html += `<div class="timeline-event teria-event" data-id="${evt.id}">
                <div class="timeline-event-title">${evt.name || 'Untitled'}</div>
                ${evt.description ? `<div class="timeline-event-desc">${evt.description}</div>` : ''}
            </div>`;
        }
        html += '</div>';

        // Date formatting based on Calendrier de l'Ancien Monde
        let dateDisplay = '';
        if (evt.date_year !== undefined) {
            dateDisplay += `An ${evt.date_year}`;
            if (evt.date_month) dateDisplay += ` - ${getMonthName(evt.date_month)}`;
            if (evt.date_day) dateDisplay += ` ${evt.date_day}`;
        } else {
            dateDisplay = evt.date || '?';
        }

        // Date column (center)
        html += `<div class="timeline-col date-col">
            <div class="timeline-date-marker">
                <span class="timeline-date">${dateDisplay}</span>
            </div>
        </div>`;

        // Maria column
        html += '<div class="timeline-col maria-col">';
        if (world === 'maria' || isLinked) {
            html += `<div class="timeline-event maria-event" data-id="${evt.id}">
                <div class="timeline-event-title">${isLinked && world !== 'maria' ? evt.name + ' (linked)' : evt.name || 'Untitled'}</div>
                ${evt.mariaDescription || evt.description ? `<div class="timeline-event-desc">${evt.mariaDescription || evt.description}</div>` : ''}
            </div>`;
        }
        html += '</div>';

        html += '</div>';
        return html;
    }

    function filterTimeline(container, filter) {
        container.querySelectorAll('.timeline-row').forEach(row => {
            const world = row.dataset.world;
            if (filter === 'all') {
                row.style.display = '';
            } else if (filter === world || row.classList.contains('timeline-linked')) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    function getMonthName(monthNumber) {
        const months = {
            1: "Nouvelle-Lune",
            2: "Fleur-Naissante",
            3: "Haut-Soleil",
            4: "Moisson-Dorée",
            5: "Vent-Hurlant",
            6: "Longue-Glace",
            7: "Renaissance",
            8: "Clair-Obscur",
            9: "Ciel-Ardent",
            10: "Brouillard-Gris",
            11: "Nuit-Étoilée",
            12: "Éther-Silencieux"
        };
        return months[parseInt(monthNumber)] || monthNumber;
    }

    function parseDateValue(dateStr) {
        const num = parseInt(dateStr);
        return isNaN(num) ? 0 : num;
    }

    function getSampleEvents() {
        return [
            { id: 'birth_twins', name: 'Birth of Aeron & Aeria', date: 'Year 0', world: 'maria', linked: true, description: 'The royal twins are born on Maria.', mariaDescription: 'Royal celebration, but danger looms.' },
            { id: 'exile', name: 'Exile to Teria', date: 'Year 0', world: 'teria', linked: true, description: 'Queen Lysandra sacrifices herself to send the twins to Teria.', mariaDescription: 'The queen is lost, the kingdom falls to darkness.' },
            { id: 'adoption', name: 'Adopted by Bulon family', date: 'Year 0', world: 'teria', description: 'Malvin and Elise Bulon discover and adopt the twin infants.' },
            { id: 'childhood', name: 'Childhood in Bruine', date: 'Years 1-15', world: 'teria', description: 'The twins grow up in the village, unaware of their origins.' },
            { id: 'resistance_forms', name: 'Cadfael forms Resistance', date: 'Year 5', world: 'maria', description: 'Elder brother Cadfael begins building a resistance movement against the usurper.' },
            { id: 'tournament', name: 'The Tournament', date: 'Year 15', world: 'teria', description: 'Aeron and Aeria discover their ether powers during a village tournament.' },
            { id: 'ether_awakening', name: 'Ether Awakening', date: 'Year 15', world: 'teria', linked: true, description: 'The twins\' latent ether powers fully manifest.', mariaDescription: 'Cadfael detects the awakening across worlds.' },
            { id: 'cadfael_arrives', name: 'Cadfael\'s Arrival', date: 'Year 16', world: 'teria', linked: true, description: 'Cadfael arrives on Teria, finding his siblings.', mariaDescription: 'The resistance\'s last hope — bringing the twins home.' }
        ];
    }

    function openTimelineSidebar(eventId, data = null) {
        const sidebar = document.getElementById('timeline-sidebar');
        const isNew = !data;

        const existingData = data || {
            name: '', date_year: '', date_month: '', date_day: '',
            world: 'teria', description: '', mariaDescription: '',
            linked: false, location: '', linked_entities: ''
        };

        const escAttr = str => String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escHtml = str => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        let html = `<div class="char-sheet" style="max-width:100%;">`;
        html += `
            <button class="close-btn" id="btn-close-timeline-sidebar">×</button>
            <h2 class="char-sheet-name" style="margin-bottom:20px;">${isNew ? 'New Event' : 'Editing Event'}</h2>
            <form id="event-edit-form" class="char-section">
                <div class="char-section-body">
                    <div class="edit-field">
                        <label>Event Name</label>
                        <input type="text" id="ev-name" value="${escAttr(existingData.name)}" required autofocus />
                    </div>
                    
                    <div style="display:flex; gap:10px;">
                        <div class="edit-field" style="flex:1;">
                            <label>Year</label>
                            <input type="number" id="ev-year" value="${existingData.date_year || existingData.date || ''}" placeholder="e.g. 15" />
                        </div>
                        <div class="edit-field" style="flex:2;">
                            <label>Month</label>
                            <select id="ev-month" style="padding:8px; background:var(--bg-lighter); color:white; border:1px solid var(--border-color); border-radius:4px; width:100%;">
                                <option value="">-- None --</option>
                                <option value="1" ${existingData.date_month == 1 ? 'selected' : ''}>1. Nouvelle-Lune</option>
                                <option value="2" ${existingData.date_month == 2 ? 'selected' : ''}>2. Fleur-Naissante</option>
                                <option value="3" ${existingData.date_month == 3 ? 'selected' : ''}>3. Haut-Soleil</option>
                                <option value="4" ${existingData.date_month == 4 ? 'selected' : ''}>4. Moisson-Dorée</option>
                                <option value="5" ${existingData.date_month == 5 ? 'selected' : ''}>5. Vent-Hurlant</option>
                                <option value="6" ${existingData.date_month == 6 ? 'selected' : ''}>6. Longue-Glace</option>
                                <option value="7" ${existingData.date_month == 7 ? 'selected' : ''}>7. Renaissance</option>
                                <option value="8" ${existingData.date_month == 8 ? 'selected' : ''}>8. Clair-Obscur</option>
                                <option value="9" ${existingData.date_month == 9 ? 'selected' : ''}>9. Ciel-Ardent</option>
                                <option value="10" ${existingData.date_month == 10 ? 'selected' : ''}>10. Brouillard-Gris</option>
                                <option value="11" ${existingData.date_month == 11 ? 'selected' : ''}>11. Nuit-Étoilée</option>
                                <option value="12" ${existingData.date_month == 12 ? 'selected' : ''}>12. Éther-Silencieux</option>
                            </select>
                        </div>
                        <div class="edit-field" style="flex:1;">
                            <label>Day</label>
                            <input type="number" id="ev-day" value="${existingData.date_day || ''}" min="1" max="28" placeholder="1-28" />
                        </div>
                    </div>

                    <div class="edit-field">
                        <label>World</label>
                        <select id="ev-world" style="padding:8px; background:var(--bg-lighter); color:white; border:1px solid var(--border-color); border-radius:4px; width:100%;">
                            <option value="teria" ${existingData.world === 'teria' && !existingData.linked ? 'selected' : ''}>Teria</option>
                            <option value="maria" ${existingData.world === 'maria' && !existingData.linked ? 'selected' : ''}>Maria</option>
                            <option value="linked" ${existingData.linked ? 'selected' : ''}>Linked (Both Worlds)</option>
                        </select>
                    </div>

                    <div class="edit-field">
                        <label>Description (Teria/Main)</label>
                        <textarea id="ev-desc" rows="3">${escHtml(existingData.description || '')}</textarea>
                    </div>

                    <div class="edit-field">
                        <label>Description (Maria) [Optional]</label>
                        <textarea id="ev-mdesc" rows="3">${escHtml(existingData.mariaDescription || '')}</textarea>
                    </div>

                    <div class="edit-field">
                        <label>Location (ID or Name)</label>
                        <input type="text" id="ev-loc" value="${escAttr(existingData.location || '')}" />
                    </div>

                    <div class="edit-field">
                        <label>Linked Entities (comma separated IDs)</label>
                        <input type="text" id="ev-entities" value="${escAttr(existingData.linked_entities || '')}" />
                    </div>
                </div>

                <div style="display:flex;gap:12px;margin-top:20px;justify-content:space-between;">
                    <div>
                        <button type="submit" class="tool-btn" style="border-color:#4ecdc4;color:#4ecdc4;">💾 Save</button>
                    </div>
                    ${!isNew ? `<button type="button" class="tool-btn danger" id="btn-delete-event">🗑️ Delete</button>` : ''}
                </div>
            </form>
        </div>`;

        sidebar.innerHTML = html;
        sidebar.classList.add('visible');

        document.getElementById('btn-close-timeline-sidebar').addEventListener('click', () => {
            sidebar.classList.remove('visible');
        });

        const delBtn = document.getElementById('btn-delete-event');
        if (delBtn) {
            delBtn.addEventListener('click', async () => {
                if (confirm(`Delete event "${existingData.name}"?`)) {
                    await window.db.deleteEntity('events', eventId);
                    window.db.manifest = null;
                    await window.db.loadManifest();
                    sidebar.classList.remove('visible');
                    renderTimeline(document.getElementById('timeline-content'));
                }
            });
        }

        document.getElementById('event-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('ev-name').value.trim();
            if (!name) return;

            const id = isNew ? name.toLowerCase().replace(/[^a-z0-9]/g, '_') : eventId;
            const worldVal = document.getElementById('ev-world').value;

            const eventData = {
                name: name,
                date_year: document.getElementById('ev-year').value,
                date_month: document.getElementById('ev-month').value,
                date_day: document.getElementById('ev-day').value,
                world: worldVal === 'linked' ? 'teria' : worldVal,
                linked: worldVal === 'linked',
                description: document.getElementById('ev-desc').value,
                mariaDescription: document.getElementById('ev-mdesc').value,
                location: document.getElementById('ev-loc').value,
                linked_entities: document.getElementById('ev-entities').value
            };

            await window.db.saveEntity('events', id, eventData);
            window.db.manifest = null;
            await window.db.loadManifest();
            sidebar.classList.remove('visible');
            renderTimeline(document.getElementById('timeline-content'));
        });
    }

    // ── Page Lifecycle ──

    window.addEventListener('pagechange', (e) => {
        if (e.detail.page === 'timeline') {
            const container = document.getElementById('timeline-content');
            renderTimeline(container);
        }
    });
})();
