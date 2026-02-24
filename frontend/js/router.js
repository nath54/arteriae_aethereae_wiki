class Router {
    constructor() {
        this.currentHash = '';
        window.addEventListener('hashchange', this.handleHashChange.bind(this));
    }

    init() {
        this.handleHashChange();
    }

    handleHashChange() {
        const hash = window.location.hash.substring(1); // remove '#'
        this.currentHash = hash;

        if (!hash) {
            // Default view (e.g. world map)
            this.navigate('maps', 'map_teria'); // Example default
            return;
        }

        // Hash format: type:id
        const parts = hash.split(':');
        if (parts.length === 2) {
            const type = parts[0];
            const id = parts[1];
            this.navigate(type, id);
        }
    }

    async navigate(type, id) {
        // Depending on type, trigger UI updates
        if (type === 'maps' || type === 'map') {
            // Load map globally using renderer
            if (window.loadMap) {
                window.loadMap(id);
            }
        }
        else if (['character', 'characters', 'places', 'place', 'events', 'event'].includes(type) || type === 'loc' || type === 'char') {
            // It's an entity to show in card
            // normalize type
            let normalizedType = type;
            if (type === 'character' || type === 'char') normalizedType = 'characters';
            if (type === 'place' || type === 'loc') normalizedType = 'places';
            if (type === 'event') normalizedType = 'events';

            if (window.uiCards) {
                window.uiCards.openCard(normalizedType, id);
            }
        }
    }
}

window.router = new Router();
