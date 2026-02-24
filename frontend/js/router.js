/**
 * SPA Router for Arteriae Aethereae Wiki
 * Handles hash-based page navigation: #page or #page:id
 */
class Router {
    constructor() {
        this.currentPage = '';
        this.currentId = null;
        this.pages = ['landing', 'documents', 'characters', 'places', 'timeline'];
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    init() {
        this.handleRoute();
    }

    handleRoute() {
        const hash = window.location.hash.substring(1); // remove '#'

        if (!hash) {
            this.showPage('landing');
            return;
        }

        const parts = hash.split(':');
        const page = parts[0];
        const id = parts.length > 1 ? parts.slice(1).join(':') : null;

        if (this.pages.includes(page)) {
            this.showPage(page, id);
        } else {
            // Legacy support: type:id format for entities
            this.showPage('landing');
        }
    }

    showPage(pageName, id = null) {
        this.currentPage = pageName;
        this.currentId = id;

        // Hide all pages
        document.querySelectorAll('.page-container').forEach(p => {
            p.classList.remove('active', 'with-nav');
        });

        // Show target page
        const target = document.getElementById(`page-${pageName}`);
        if (target) {
            target.classList.add('active');
            if (pageName !== 'landing') {
                target.classList.add('with-nav');
            }
        }

        // Nav bar visibility
        const nav = document.getElementById('nav-bar');
        if (pageName === 'landing') {
            nav.classList.add('hidden');
            nav.classList.remove('visible');
        } else {
            nav.classList.remove('hidden');
            nav.classList.add('visible');
        }

        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === pageName);
        });

        // Scroll to top
        window.scrollTo(0, 0);

        // Dispatch page change event for page-specific JS
        window.dispatchEvent(new CustomEvent('pagechange', {
            detail: { page: pageName, id: id }
        }));
    }
}

window.router = new Router();
