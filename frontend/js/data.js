/**
 * DataManager Class
 * Handles caching, loading, saving, and deleting entities.
 * Abstracts the difference between Read-Only mode (fetching static JSON)
 * and Edit Mode (communicating with the Python API).
 *
 * HOOK POINT (Variables):
 * - `this.cache` (Map): In-memory data store to avoid redundant network requests.
 * - `this.manifest` (Object): The central registry of all entities.
 */
class DataManager {
    constructor() {
        this.cache = new Map();
        this.MAX_CACHE_SIZE = 50;
        this.manifest = null;
    }

    /**
     * Helper to check if the app is connected to the backend edit server.
     * @returns {boolean} True if the server responded previously.
     */
    get isEditMode() {
        return window.isEditMode || false;
    }

    /**
     * Determines the base URL for fetching data based on the current mode.
     * @returns {string} The base API or static folder path.
     */
    get apiBase() {
        return this.isEditMode ? 'http://127.0.0.1:8000/api' : '../data';
    }

    /**
     * Fetches the global manifest of all content.
     * @returns {Promise<Object>} The manifest dictionary.
     */
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

    /**
     * Forces a fresh reload of the manifest, bypassing the cache.
     * Use this after any mutation (create, rename, move, copy, delete, upload).
     * @returns {Promise<Object>} The freshly loaded manifest.
     */
    async reloadManifest() {
        this.manifest = null;
        return this.loadManifest();
    }

    /**
     * Fetches a specific entity's data. Hits the in-memory cache first.
     * memory limits apply to avoid blowing up memory over time.
     *
     * @param {string} type - The entity category (e.g., 'characters').
     * @param {string} id - The specific alphanumeric ID.
     * @returns {Promise<Object|null>} The entity data, or null if failed.
     */
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

    /**
     * Saves an entity's data to the server (only works in edit mode).
     * Automatically updates the local cache.
     *
     * HOOK POINT: Pre-save validation (e.g. checking required fields) can be added here.
     *
     * @param {string} type - The category.
     * @param {string} id - The ID.
     * @param {Object} data - The JSON payload to save.
     * @returns {Promise<void>}
     */
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

    /**
     * Deletes an entity from the server and removes it from the local cache.
     * Re-fetches the manifest to ensure consistency.
     *
     * @param {string} type - The category.
     * @param {string} id - The ID.
     * @returns {Promise<boolean>} True if deleted successfully.
     */
    async deleteEntity(type, id) {
        if (!this.isEditMode) {
            console.warn("Delete called in View Mode.");
            return false;
        }

        try {
            const response = await fetch(`${this.apiBase}/${type}/${id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" }
            });
            if (response.ok) {
                const cacheKey = `${type}_${id}`;
                this.cache.delete(cacheKey);
                // Force manifest reload
                this.manifest = null;
                await this.loadManifest();
                return true;
            }
        } catch (error) {
            console.error(`Failed to delete ${type}/${id}:`, error);
        }
        return false;
    }
}

// Global instance
window.db = new DataManager();
