class UICards {
    constructor() {
        this.card = document.getElementById('entity-card');
        this.cardContent = document.getElementById('card-content');
        this.closeBtn = document.getElementById('close-card');

        this.closeBtn.addEventListener('click', () => {
            this.closeCard();
            // Clear hash
            window.location.hash = '';
        });
    }

    async openCard(type, id) {
        this.cardContent.innerHTML = '<p>Loading...</p>';
        this.card.classList.remove('hidden');

        const data = await window.db.getEntity(type, id);

        if (!data) {
            this.cardContent.innerHTML = `<p>Error: Could not load data for ${id}</p>`;
            return;
        }

        let html = `<h3>${data.name || id}</h3>`;

        // Add specific fields
        for (const [key, value] of Object.entries(data)) {
            if (key === 'id' || key === 'name') continue;

            html += `<div style="margin-bottom: 15px;"><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong><br>`;

            if (typeof value === 'object' && !Array.isArray(value)) {
                // Object (like relationships)
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
                html += `<div class="markdown-content">${window.parseMarkdown(value)}</div>`;
            } else {
                html += `<span>${value}</span>`;
            }
            html += '</div>';
        }

        this.cardContent.innerHTML = html;
    }

    closeCard() {
        this.card.classList.add('hidden');
    }
}
window.uiCards = new UICards();
