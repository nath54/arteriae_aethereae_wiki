/**
 * UICards Module — Arteriae Aethereae Wiki
 * Manages the right-panel overlay used to display quick summaries of entities.
 *
 * HOOK POINT (Card Layout): If you add new data types to your JSON that you want
 * explicitly formatted in the card (e.g., custom rendering for "stats"),
 * add a new `else if` block in `openCard()` below.
 */
class UICards {
    constructor() {
        this.panel = document.getElementById('right-panel');
        this.card = document.getElementById('entity-card');
        this.cardContent = document.getElementById('card-content');
        this.closeBtn = document.getElementById('close-card');

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.closeCard();
            });
        }
    }

    async openCard(type, id) {
        this.cardContent.innerHTML = '<p>Loading...</p>';
        this.panel.classList.remove('hidden');
        this.panel.classList.add('visible');

        const data = await window.db.getEntity(type, id);

        if (!data) {
            this.cardContent.innerHTML = `<p>Error: Could not load data for ${id}</p>`;
            return;
        }

        let html = `<h3>${data.name || id}</h3>`;

        for (const [key, value] of Object.entries(data)) {
            if (key === 'id' || key === 'name') continue;

            html += `<div style="margin-bottom: 15px;"><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong><br>`;

            if (typeof value === 'object' && !Array.isArray(value)) {
                html += '<ul style="margin: 5px 0 0 20px; padding: 0;">';
                for (const [k, v] of Object.entries(value)) {
                    html += `<li>${k}: ${v}</li>`;
                }
                html += '</ul>';
            } else if (Array.isArray(value)) {
                html += '<ul style="margin: 5px 0 0 20px; padding: 0;">';
                for (const item of value) {
                    html += `<li>${item}</li>`;
                }
                html += '</ul>';
            } else if (typeof value === 'string') {
                html += `<div class="markdown-content">${window.parseMarkdown ? window.parseMarkdown(value) : value}</div>`;
            } else {
                html += `<span>${value}</span>`;
            }
            html += '</div>';
        }

        this.cardContent.innerHTML = html;
    }

    closeCard() {
        this.panel.classList.remove('visible');
        this.panel.classList.add('hidden');
    }
}
window.uiCards = new UICards();
