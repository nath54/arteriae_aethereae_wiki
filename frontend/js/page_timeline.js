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

        // Sort by date (numeric or string comparison)
        eventList.sort((a, b) => {
            const dateA = parseDateValue(a.date || '0');
            const dateB = parseDateValue(b.date || '0');
            return dateA - dateB;
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
            addBtn.addEventListener('click', () => promptNewEvent());
        }

        // Click to expand
        container.querySelectorAll('.timeline-event').forEach(evt => {
            evt.addEventListener('click', () => {
                evt.classList.toggle('expanded');
            });
        });
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

        // Date column (center)
        html += `<div class="timeline-col date-col">
            <div class="timeline-date-marker">
                <span class="timeline-date">${evt.date || '?'}</span>
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

    async function promptNewEvent() {
        const name = prompt('Event name:');
        if (!name) return;
        const date = prompt('Date (e.g. Year 15):') || '?';
        const world = prompt('World (teria/maria/linked):') || 'teria';
        const desc = prompt('Description:') || '';

        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const eventData = {
            name, date, world,
            description: desc,
            linked: world === 'linked'
        };

        await window.db.saveEntity('events', id, eventData);
        window.db.manifest = null;
        await window.db.loadManifest();
        renderTimeline(document.getElementById('timeline-content'));
    }

    // ── Page Lifecycle ──

    window.addEventListener('pagechange', (e) => {
        if (e.detail.page === 'timeline') {
            const container = document.getElementById('timeline-content');
            renderTimeline(container);
        }
    });
})();
