/**
 * Image Picker Component — Arteriae Aethereae Wiki
 *
 * Provides a global reusable image picker modal that can be opened from
 * any page (characters, places, etc.) to select images from the image library.
 *
 * Usage:
 *   window.openImagePicker(callback, options);
 *
 *   callback: function({ id, url, name, file }) — called when user selects an image.
 *   options:
 *     title    {string}  — modal title (default: "Select Image")
 *     multiple {boolean} — if true, a "Done" button appears and callback receives an array
 *
 * The modal HTML (#image-picker-modal) must exist in index.html.
 * This script exposes window.openImagePicker globally.
 */
(function () {

    // ── Internal state ──────────────────────────────────────────────────────
    let _callback = null;
    let _multiple = false;
    let _selected = [];

    const MODAL_ID = 'image-picker-modal';

    // ── Open ────────────────────────────────────────────────────────────────

    /**
     * Opens the image picker modal.
     *
     * @param {function} callback  - Called with selected image object(s).
     * @param {object}   options
     * @param {string}   options.title    - Header text.
     * @param {boolean}  options.multiple - Allow multi-select.
     */
    function openImagePicker(callback, options = {}) {
        _callback = callback;
        _multiple = !!options.multiple;
        _selected = [];

        const modal = document.getElementById(MODAL_ID);
        if (!modal) { console.error('[ImagePicker] Modal element not found in DOM.'); return; }

        const title = options.title || 'Select Image';
        modal.querySelector('.image-picker-title').textContent = title;

        // Reload images fresh from manifest
        renderImageGrid(modal);

        // Show
        modal.style.display = 'flex';

        // Update Done button visibility
        const doneBtn = modal.querySelector('#image-picker-done');
        if (doneBtn) doneBtn.style.display = _multiple ? 'inline-flex' : 'none';
    }

    // ── Render grid ─────────────────────────────────────────────────────────

    function renderImageGrid(modal) {
        const gallery = modal.querySelector('#image-picker-gallery');
        const searchEl = modal.querySelector('#image-picker-search');
        const images = window.db?.manifest?.images ?? {};
        const list = Object.entries(images);

        if (list.length === 0) {
            gallery.innerHTML = `
                <p class="placeholder-text" style="padding:40px;text-align:center;">
                    No images in the library yet.<br>
                    Upload images from the <strong>📁 Documents / 🖼️ Images</strong> section.
                </p>`;
            return;
        }

        gallery.innerHTML = list.map(([id, img]) => `
            <div class="picker-img-card" data-id="${id}" data-url="${img.url}"
                 data-name="${img.name}" data-file="${img.file}"
                 title="${img.name}">
                <div class="picker-img-thumb">
                    <img src="${img.url}" alt="${img.name}" loading="lazy"
                         onerror="this.style.display='none'">
                    <a href="${img.url}" target="_blank" class="picker-img-view-btn" title="View full size">🔍</a>
                </div>
                <div class="picker-img-label">${img.name}</div>
            </div>`).join('');

        // Bind card clicks
        gallery.querySelectorAll('.picker-img-card').forEach(card => {
            const viewBtn = card.querySelector('.picker-img-view-btn');
            if (viewBtn) {
                viewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }

            card.addEventListener('click', () => {
                const imgObj = {
                    id: card.dataset.id,
                    url: card.dataset.url,
                    name: card.dataset.name,
                    file: card.dataset.file,
                };

                if (_multiple) {
                    card.classList.toggle('selected');
                    const idx = _selected.findIndex(i => i.id === imgObj.id);
                    if (idx >= 0) {
                        _selected.splice(idx, 1);
                    } else {
                        _selected.push(imgObj);
                    }
                } else {
                    // Single: select and close immediately
                    const cb = _callback;
                    closeModal(modal);
                    if (cb) cb(imgObj);
                }
            });
        });

        // Wire search filter
        if (searchEl) {
            searchEl.value = '';
            searchEl.oninput = () => {
                const q = searchEl.value.toLowerCase();
                gallery.querySelectorAll('.picker-img-card').forEach(card => {
                    card.style.display = (!q || card.dataset.name.toLowerCase().includes(q))
                        ? '' : 'none';
                });
            };
        }
    }

    // ── Close ────────────────────────────────────────────────────────────────

    function closeModal(modal) {
        modal.style.display = 'none';
        _callback = null;
        _selected = [];
    }

    // ── Bind permanent modal controls ────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;

        // Close button
        modal.querySelector('#image-picker-close')?.addEventListener('click', () => closeModal(modal));

        // Click backdrop to close
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal(modal);
        });

        // Done (multi-select)
        modal.querySelector('#image-picker-done')?.addEventListener('click', () => {
            const result = [..._selected];
            const cb = _callback;
            closeModal(modal);
            if (cb) cb(result);
        });

        // Cancel
        modal.querySelector('#image-picker-cancel')?.addEventListener('click', () => closeModal(modal));
    });

    // ── Expose globally ──────────────────────────────────────────────────────
    window.openImagePicker = openImagePicker;

})();
