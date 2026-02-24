class DataManager {
    constructor() {
        this.cache = new Map();
        this.MAX_CACHE_SIZE = 50; // Memory management
        this.manifest = null;
        
        // When running via file:// or GitHub pages, we fetch from local ./data folder.
        // When running on localhost:8000, we fetch from the backend API if we want to.
        // But to keep it simple and unifying, the view mode standard is fetching JSON.
        // For Edit mode, we will do POST requests to the python server.
        this.isEditMode = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
        this.apiBase = this.isEditMode ? 'http://127.0.0.1:8000/api' : '../data';
    }

    async loadManifest() {
        if (this.manifest) return this.manifest;
        try {
            const url = this.isEditMode ? `${this.apiBase}/manifest` : `${this.apiBase}/manifest.json`;
            const response = await fetch(url);
            this.manifest = await response.json();
            return this.manifest;
        } catch (error) {
            console.error("Failed to load manifest:", error);
            // Return empty structure if fails (first run)
            return { places: {}, characters: {}, maps: {}, events: {} };
        }
    }

    async getEntity(type, id) {
        // 1. Check memory cache
        const cacheKey = `${type}_${id}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // 2. Memory limits
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        // 3. Lazy Load
        try {
            const url = this.isEditMode ? `${this.apiBase}/${type}/${id}` : `${this.apiBase}/${type}/${id}.json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            // 4. Store and return
            this.cache.set(cacheKey, data);
            return data;
        } catch (error) {
            console.error(`Failed to load ${type}/${id}:`, error);
            return null;
        }
    }

    async saveEntity(type, id, data) {
        if (!this.isEditMode) {
            console.warn("Save called in View Mode (Not connected to Edit Server).");
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/${type}/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                // Update cache
                const cacheKey = `${type}_${id}`;
                this.cache.set(cacheKey, data);
            }
        } catch (error) {
            console.error(`Failed to save ${type}/${id}:`, error);
        }
    }
}

// Global instance
window.db = new DataManager();
