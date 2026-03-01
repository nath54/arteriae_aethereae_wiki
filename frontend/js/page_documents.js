/**
 * Documents Page Module — Arteriae Aethereae Wiki
 *
 * Handles the file explorer (all files under data/), the markdown viewer / entity
 * preview panel, and all file management operations (create, rename, move, copy,
 * delete, upload).  Inline panels and modals use direct style.display assignments
 * for show/hide so they work reliably alongside .hidden and .edit-only CSS rules.
 */
(function () {

    // ─── Module State ─────────────────────────────────────────────────────────
    let searchQuery = '';
    let selectedFolderPath = '';   // folder selected in the tree (for New Doc / New Folder context)
    let activeContextNode = null; // { path: string, type: 'doc'|'folder', name: string }
    let contextMenuHideListener = null;

    // Persist folder states
    const STORAGE_KEY = 'wiki_open_folders';
    const SCROLL_KEY = 'wiki_tree_scroll';
    let openFolders = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

    function saveOpenFolders() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(openFolders)));
    }

    function saveScrollPosition(pos) {
        localStorage.setItem(SCROLL_KEY, pos);
    }

    function getScrollPosition() {
        return parseInt(localStorage.getItem(SCROLL_KEY) || '0', 10);
    }



    // ─── Visibility Helpers ───────────────────────────────────────────────────
    // Use direct style.display manipulation — simple and reliable.

    /** Hide an element. */
    function hide(el) { if (el) el.style.display = 'none'; }

    /** Show an element as flex (panels, modals). */
    function showFlex(el) { if (el) el.style.display = 'flex'; }

    /** Show an element as block (context menu). */
    function showBlock(el) { if (el) el.style.display = 'block'; }

    /** Toggle a panel between hidden and visible-flex. */
    function togglePanel(el) {
        if (!el) return;
        if (el.style.display !== 'none' && el.style.display !== '') { hide(el); } else { showFlex(el); }
    }

    // ─── Folder Icon Helper ───────────────────────────────────────────────────

    function getFolderIcon(name) {
        const n = name.toLowerCase();
        if (n.includes('univers') || n.includes('world')) return '🌍';
        if (n.includes('histoire') || n.includes('story')) return '📚';
        if (n.includes('personnage') || n.includes('character')) return '👤';
        if (n.includes('inspiration') || n.includes('idea')) return '💡';
        if (n.includes('timeline') || n.includes('chronolog')) return '⏳';
        if (n.includes('image') || n.includes('art')) return '🖼️';
        if (n.includes('map') || n.includes('carte')) return '🗺️';
        if (n.includes('place') || n.includes('lieu')) return '📍';
        if (n.includes('event') || n.includes('evenement')) return '📅';
        return '📁';
    }

    // ─── Tree Builder ─────────────────────────────────────────────────────────

    /**
     * Builds a nested tree structure from the manifest documents section.
     * Each document entry from manifest.documents has `{ file, name }`.
     * The `doc.file` is the real filesystem path (e.g. "Histoire/v0/draft.md").
     * We use that as both the display path and the operation path.
     *
     * @returns {{ name: string, type: 'folder', children: Array }}
     */
    function buildTreeFromManifest() {
        const root = { name: 'Root', type: 'folder', children: [] };
        const manifestDocs = (window.db?.manifest?.documents) || {};
        const manifestFolders = (window.db?.manifest?.folders) || [];

        // 1. Ensure all explicit folders from manifest are present in the tree
        for (const folderPath of manifestFolders) {
            const parts = folderPath.split('/');
            let level = root.children;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const pathSoFar = parts.slice(0, i + 1).join('/');

                let folder = level.find(n => n.name === part && n.type === 'folder');
                if (!folder) {
                    folder = {
                        name: part,
                        type: 'folder',
                        path: pathSoFar,
                        icon: getFolderIcon(part),
                        children: []
                    };
                    level.push(folder);
                }
                level = folder.children;
            }
        }

        // 2. Add documents to their respective folders
        for (const [id, doc] of Object.entries(manifestDocs)) {
            const parts = doc.file.split('/');
            let level = root.children;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = (i === parts.length - 1);
                const pathSoFar = parts.slice(0, i + 1).join('/');

                if (isLast) {
                    // Use a different icon for JSON files vs Markdown
                    const icon = doc.ext === '.json' ? '📦' : '📄';
                    level.push({
                        name: doc.name || part.replace(/\.(md|json)$/i, ''),
                        type: 'doc',
                        id,                // manifest document ID (slug)
                        path: doc.file,    // REAL filesystem relative path
                        icon: icon
                    });
                } else {
                    let folder = level.find(n => n.name === part && n.type === 'folder');
                    if (!folder) {
                        folder = {
                            name: part,
                            type: 'folder',
                            path: pathSoFar,
                            icon: getFolderIcon(part),
                            children: []
                        };
                        level.push(folder);
                    }
                    level = folder.children;
                }
            }
        }

        // Sort: folders first, then files alphabetically
        const sort = nodes => {
            nodes.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            nodes.forEach(n => { if (n.children) sort(n.children); });
        };
        sort(root.children);
        return root;
    }

    // ─── Render Page ──────────────────────────────────────────────────────────

    function renderDocumentsPage(container) {
        const tree = buildTreeFromManifest();

        container.innerHTML = `
        <div class="doc-toolbar">
            <div class="doc-search-wrap">
                <input type="text" id="doc-search" class="doc-search" placeholder="🔍 Search documents..." value="${searchQuery}">
            </div>
            ${window.isEditMode ? `
            <button class="tool-btn" id="btn-upload-doc">📤 Upload</button>
            <button class="tool-btn" id="btn-new-folder">📁 New Folder</button>
            <button class="tool-btn" id="btn-new-doc">📄 New Document</button>
            <button class="tool-btn" id="btn-images">🖼️ Images</button>
            <input type="file" id="hidden-file-upload" style="display:none" accept="*/*">
            ` : ''}
        </div>

        ${window.isEditMode ? `
        <!-- Inline: New Folder Panel -->
        <div id="panel-new-folder" class="inline-panel" style="display: none;">
            <span class="inline-panel-label">📁 New folder in <em id="panel-folder-context">Root</em>:</span>
            <input type="text" id="input-new-folder" placeholder="Folder name…">
            <button class="tool-btn" id="btn-confirm-new-folder">✔ Create</button>
            <button class="tool-btn btn-muted" id="btn-cancel-new-folder">✖ Cancel</button>
        </div>

        <!-- Inline: New Document Panel -->
        <div id="panel-new-doc" class="inline-panel" style="display: none;">
            <span class="inline-panel-label">📄 New document in <em id="panel-doc-context">Root</em>:</span>
            <input type="text" id="input-new-doc" placeholder="Document name (.md)…">
            <button class="tool-btn" id="btn-confirm-new-doc">✔ Create</button>
            <button class="tool-btn btn-muted" id="btn-cancel-new-doc">✖ Cancel</button>
        </div>
        ` : ''}

        <div class="doc-layout">
            <div class="doc-tree" id="doc-tree">
                ${renderTreeHtml(tree.children, 0)}
            </div>
            <div class="doc-viewer" id="doc-viewer">
                <div class="doc-viewer-empty">
                    <span class="doc-viewer-icon">📜</span>
                    <p>Select a document to view</p>
                </div>
            </div>
        </div>`;

        bindTreeEvents(container);
        if (window.isEditMode) {
            bindToolbarEvents(container);
        }
        bindSearchEvents(container);
        setupContextMenus(container);

        // Restore scroll position
        const treeEl = container.querySelector('#doc-tree');
        if (treeEl) {
            treeEl.scrollTop = getScrollPosition();
        }
    }

    /**
     * Renders the tree HTML recursively.
     * IMPORTANT: data-path holds the REAL filesystem path for all file operations.
     *            data-id holds the manifest ID (slug) used for loading/viewing.
     */
    function renderTreeHtml(nodes, depth, currentFolderPath = '') {
        let html = '';
        for (const node of nodes) {
            const indent = depth * 16;
            if (node.type === 'folder') {
                const isSelected = selectedFolderPath === node.path;
                const isOpen = openFolders.has(node.path);
                html += `<div class="doc-tree-folder ${isSelected ? 'selected' : ''} ${isOpen ? 'folder-open' : ''}"
                              data-path="${node.path}" style="padding-left:${indent}px">
                    <span class="folder-toggle">${isOpen ? '▼' : '▶'}</span>
                    <span class="folder-icon">${node.icon || '📁'}</span>
                    <span class="folder-name">${node.name}</span>
                </div>`;
                html += `<div class="doc-tree-children ${isOpen ? '' : 'collapsed'}">`;
                if (node.children) html += renderTreeHtml(node.children, depth + 1, node.path);
                html += `</div>`;
            } else {
                // data-id  = manifest slug (for loading)
                // data-path = real filesystem relative path (for mutations: rename/move/delete/copy)
                html += `<div class="doc-tree-item"
                              data-id="${node.id}"
                              data-path="${node.path}"
                              data-name="${node.name}"
                              style="padding-left:${indent + 16}px">
                    <span class="doc-icon">${node.icon || '📄'}</span>
                    <span class="doc-name">${node.name}</span>
                </div>`;
            }
        }
        return html;
    }

    // ─── Tree Event Binding ───────────────────────────────────────────────────

    function bindTreeEvents(container) {
        // Document item: single click = load viewer, used data-id for loading content
        container.querySelectorAll('.doc-tree-item[data-id]').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.doc-tree-item').forEach(i => i.classList.remove('active'));
                container.querySelectorAll('.doc-tree-folder').forEach(f => f.classList.remove('selected'));
                selectedFolderPath = '';
                item.classList.add('active');
                updatePanelContextLabels(container);
                loadDocument(item.dataset.id, item.dataset.name, item.dataset.path);
            });
        });

        // Folder: click to select (sets context for new items), arrow to collapse
        container.querySelectorAll('.doc-tree-folder').forEach(folder => {
            folder.addEventListener('click', e => {
                if (e.target.classList.contains('folder-toggle')) return;
                const isSelected = folder.classList.contains('selected');
                container.querySelectorAll('.doc-tree-folder').forEach(f => f.classList.remove('selected'));
                container.querySelectorAll('.doc-tree-item').forEach(i => i.classList.remove('active'));
                if (isSelected) {
                    selectedFolderPath = '';
                } else {
                    folder.classList.add('selected');
                    selectedFolderPath = folder.dataset.path;
                }
                updatePanelContextLabels(container);
            });
        });

        // Folder toggle arrow
        container.querySelectorAll('.folder-toggle').forEach(toggle => {
            toggle.addEventListener('click', e => {
                e.stopPropagation();
                const folder = toggle.closest('.doc-tree-folder');
                const children = folder.nextElementSibling;
                if (children) {
                    children.classList.toggle('collapsed');
                    const isOpen = !children.classList.contains('collapsed');
                    folder.classList.toggle('folder-open', isOpen);
                    toggle.textContent = isOpen ? '▼' : '▶';

                    if (isOpen) {
                        openFolders.add(folder.dataset.path);
                    } else {
                        openFolders.delete(folder.dataset.path);
                    }
                    saveOpenFolders();
                }
            });
        });

        // Track scroll position
        const treeEl = container.querySelector('#doc-tree');
        if (treeEl) {
            let scrollTimeout;
            treeEl.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    saveScrollPosition(treeEl.scrollTop);
                }, 100);
            });
        }
    }

    function updatePanelContextLabels(container) {
        const ctx = selectedFolderPath || 'Root';
        const fl = container.querySelector('#panel-folder-context');
        const dl = container.querySelector('#panel-doc-context');
        if (fl) fl.textContent = ctx;
        if (dl) dl.textContent = ctx;
    }

    // ─── Toolbar Events ───────────────────────────────────────────────────────

    function bindToolbarEvents(container) {
        const fileInput = container.querySelector('#hidden-file-upload');

        // ── Upload Document ──
        container.querySelector('#btn-upload-doc').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async e => {
            if (!e.target.files.length) return;
            const file = e.target.files[0];
            const fd = new FormData();
            fd.append('path', selectedFolderPath || '');
            fd.append('file', file);
            const r = await fetch('/api/documents/upload', { method: 'POST', body: fd });
            fileInput.value = '';
            if (r.ok) {
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else { showToast('Upload failed.', 'error'); }
        });

        // ── New Folder ──
        container.querySelector('#btn-new-folder').addEventListener('click', () => {
            const panel = container.querySelector('#panel-new-folder');
            const docPanel = container.querySelector('#panel-new-doc');
            hide(docPanel);
            togglePanel(panel);
            if (panel.style.display !== 'none' && panel.style.display !== '') {
                container.querySelector('#input-new-folder').value = '';
                container.querySelector('#input-new-folder').focus();
            }
        });

        container.querySelector('#btn-cancel-new-folder').addEventListener('click', () =>
            hide(container.querySelector('#panel-new-folder')));

        container.querySelector('#btn-confirm-new-folder').addEventListener('click', async () => {
            const nameInput = container.querySelector('#input-new-folder');
            const folderName = nameInput.value.trim();
            if (!folderName) return;
            const path = selectedFolderPath ? `${selectedFolderPath}/${folderName}` : folderName;
            const r = await fetch('/api/folders/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (r.ok) {
                hide(container.querySelector('#panel-new-folder'));
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else { showToast('Folder already exists or invalid name.', 'error'); }
        });

        container.querySelector('#input-new-folder').addEventListener('keydown', e => {
            if (e.key === 'Enter') container.querySelector('#btn-confirm-new-folder').click();
            if (e.key === 'Escape') hide(container.querySelector('#panel-new-folder'));
        });

        // ── New Document ──
        container.querySelector('#btn-new-doc').addEventListener('click', () => {
            const panel = container.querySelector('#panel-new-doc');
            const folderPanel = container.querySelector('#panel-new-folder');
            hide(folderPanel);
            togglePanel(panel);
            if (panel.style.display !== 'none' && panel.style.display !== '') {
                container.querySelector('#input-new-doc').value = '';
                container.querySelector('#input-new-doc').focus();
            }
        });

        container.querySelector('#btn-cancel-new-doc').addEventListener('click', () =>
            hide(container.querySelector('#panel-new-doc')));

        container.querySelector('#btn-confirm-new-doc').addEventListener('click', async () => {
            const nameInput = container.querySelector('#input-new-doc');
            let docName = nameInput.value.trim();
            if (!docName) return;
            if (!docName.endsWith('.md')) docName += '.md';
            const path = selectedFolderPath ? `${selectedFolderPath}/${docName}` : docName;
            const r = await fetch('/api/documents/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (r.ok) {
                hide(container.querySelector('#panel-new-doc'));
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else { showToast('Document already exists or invalid name.', 'error'); }
        });

        container.querySelector('#input-new-doc').addEventListener('keydown', e => {
            if (e.key === 'Enter') container.querySelector('#btn-confirm-new-doc').click();
            if (e.key === 'Escape') hide(container.querySelector('#panel-new-doc'));
        });

        // ── Image Gallery ──
        container.querySelector('#btn-images').addEventListener('click', () =>
            openImageGallery(container));
    }

    // ─── Search ───────────────────────────────────────────────────────────────

    function bindSearchEvents(container) {
        const input = container.querySelector('#doc-search');
        if (input) {
            input.addEventListener('input', e => {
                searchQuery = e.target.value;
                filterTree(container, searchQuery);
            });
        }
    }

    function filterTree(container, query) {
        const q = query.toLowerCase().trim();
        const items = container.querySelectorAll('.doc-tree-item');
        const folders = container.querySelectorAll('.doc-tree-folder');

        if (!q) {
            // Restore default folded state
            items.forEach(i => i.style.display = '');
            folders.forEach(f => {
                f.style.display = '';
                f.classList.remove('folder-open');
                const toggle = f.querySelector('.folder-toggle');
                if (toggle) toggle.textContent = '▶';
                const children = f.nextElementSibling;
                if (children && children.classList.contains('doc-tree-children')) {
                    children.classList.add('collapsed');
                }
            });
            return;
        }

        // Search mode: hide everything initially
        items.forEach(i => i.style.display = 'none');
        folders.forEach(f => f.style.display = 'none');

        // Show matching items and their parent chains
        items.forEach(item => {
            const name = (item.dataset.name || '').toLowerCase();
            if (name.includes(q)) {
                // Show the item
                item.style.display = 'flex';

                // Show and expand all parents
                let parentChildren = item.parentElement;
                while (parentChildren && parentChildren.classList.contains('doc-tree-children')) {
                    const folder = parentChildren.previousElementSibling;
                    if (folder && folder.classList.contains('doc-tree-folder')) {
                        folder.style.display = 'flex';
                        folder.classList.add('folder-open');
                        const toggle = folder.querySelector('.folder-toggle');
                        if (toggle) toggle.textContent = '▼';
                        parentChildren.classList.remove('collapsed');
                        parentChildren = folder.parentElement;
                    } else {
                        break;
                    }
                }
            }
        });
    }

    // ─── Document Viewer / Editor ─────────────────────────────────────────────

    /**
     * Loads and displays a document in the right panel.
     *
     * @param {string} id          - Manifest document ID (slug), used as fallback path
     * @param {string} displayName - Human-readable name shown in the header
     * @param {string} realPath    - Real filesystem relative path (e.g. "Histoire/v0/draft.md")
     */
    async function loadDocument(id, displayName, realPath) {
        // Redirection for JSON files (entity categories)
        if (realPath && realPath.toLowerCase().endsWith('.json')) {
            const parts = realPath.split('/');
            const category = parts[0]; // e.g., 'characters', 'places', 'maps', 'events'

            // Generate entity ID by stripping category prefix and filename extension
            // e.g., 'characters/protagonists/aeron.json' -> 'protagonists/aeron'
            let entityId = parts.slice(1).join('/').replace(/\.json$/i, '');

            // Special handling for places/maps which are stored as folders containing place.json/map.json
            if (category === 'places' || category === 'maps') {
                entityId = entityId.replace(/\/(place|map)$/i, '');
                window.location.hash = `#places:${entityId}`;
                return;
            }

            if (category === 'characters') {
                window.location.hash = `#characters:${entityId}`;
                return;
            }

            if (category === 'events') {
                window.location.hash = `#timeline`; // Timeline doesn't support direct ID focus yet
                return;
            }
        }

        const viewer = document.getElementById('doc-viewer');
        viewer.innerHTML = '<p class="doc-loading">Loading…</p>';

        // Use the real filesystem path when available; fall back to the manifest ID.
        // Paths are absolute from the server root (/data/...) so they work when
        // served via FastAPI at any URL depth.
        const fetchPaths = [
            realPath ? `/data/${realPath}` : null,
            `/data/${id}`,
        ].filter(Boolean);

        let content = null;
        for (const path of fetchPaths) {
            try {
                const resp = await fetch(path);
                if (resp.ok) { content = await resp.text(); break; }
            } catch (_) { /* try next */ }
        }

        if (content !== null) {
            const rendered = window.parseMarkdown ? window.parseMarkdown(content)
                : escapeHtml(content);
            viewer.innerHTML = `
                <div class="doc-header">
                    <h2 class="doc-title">${displayName}</h2>
                    <div class="doc-actions" style="display:flex; gap:8px;">
                        ${window.isEditMode
                    ? `<button class="tool-btn" id="btn-edit-doc">✏️ Edit</button>`
                    : ''}
                    </div>
                </div>
                <div class="markdown-content doc-body">${rendered}</div>`;

            const editBtn = viewer.querySelector('#btn-edit-doc');
            if (editBtn) {
                editBtn.addEventListener('click', () =>
                    openEditor(viewer, id, displayName, realPath || id, content));
            }
        } else {
            viewer.innerHTML = `
                <div class="doc-header"><h2 class="doc-title">${displayName}</h2></div>
                <p class="placeholder-text">Could not load document. The file may not exist yet.</p>
                ${window.isEditMode
                    ? `<button class="tool-btn" id="btn-create-empty" style="margin:16px;">
                          ✨ Create empty file
                       </button>`
                    : ''}`;
            const createBtn = viewer.querySelector('#btn-create-empty');
            if (createBtn) {
                createBtn.addEventListener('click', async () => {
                    const path = realPath || `${id}.md`;
                    const r = await fetch('/api/documents/new', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path })
                    });
                    if (r.ok) {
                        await window.db.reloadManifest();
                        loadDocument(id, displayName, path);
                    }
                });
            }
        }
    }

    /**
     * Replaces the viewer content with a full-height textarea editor.
     */
    function openEditor(viewer, id, displayName, realPath, currentContent) {
        viewer.innerHTML = `
            <div class="doc-header">
                <h2 class="doc-title">✏️ Editing: ${displayName}</h2>
                <div class="doc-actions" style="display:flex; gap:8px;">
                    <button class="tool-btn btn-muted" id="btn-cancel-edit">✖ Cancel</button>
                    <button class="tool-btn" id="btn-save-doc">💾 Save</button>
                </div>
            </div>
            <div class="doc-body doc-editor-wrap">
                <textarea id="doc-editor-textarea" class="editor-textarea">${escapeHtmlForTextarea(currentContent)}</textarea>
            </div>`;

        viewer.querySelector('#btn-cancel-edit').addEventListener('click', () =>
            loadDocument(id, displayName, realPath));

        viewer.querySelector('#btn-save-doc').addEventListener('click', async () => {
            const newContent = viewer.querySelector('#doc-editor-textarea').value;
            const r = await fetch('/api/documents/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: realPath, content: newContent })
            });
            if (r.ok) {
                showToast('Document saved!', 'success');
                loadDocument(id, displayName, realPath);
            } else { showToast('Failed to save document.', 'error'); }
        });
    }

    // ─── Escape Helpers ───────────────────────────────────────────────────────

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    function escapeHtmlForTextarea(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ─── Context Menu ─────────────────────────────────────────────────────────

    function setupContextMenus(container) {
        const menu = document.getElementById('doc-context-menu');
        if (!menu) return;

        let pressTimer = null;

        const showMenu = (e, path, type, name) => {
            if (!window.isEditMode) return;
            e.preventDefault();
            e.stopPropagation();
            activeContextNode = { path, type, name };

            showBlock(menu);

            // Position: prefer pageX/Y (mouse), fallback to touch
            const x = e.pageX ?? (e.touches?.[0]?.pageX ?? 0);
            const y = e.pageY ?? (e.touches?.[0]?.pageY ?? 0);
            const mW = menu.offsetWidth || 180;
            const mH = menu.offsetHeight || 160;
            menu.style.left = `${Math.min(x, window.innerWidth - mW - 8)}px`;
            menu.style.top = `${Math.min(y, window.innerHeight + window.scrollY - mH - 8)}px`;
        };

        const hideMenu = () => hide(menu);

        // Only register the document-click-to-close once per session
        if (contextMenuHideListener) {
            document.removeEventListener('click', contextMenuHideListener);
        }
        contextMenuHideListener = hideMenu;
        document.addEventListener('click', contextMenuHideListener);

        // The menu itself shouldn't close when clicked
        menu.addEventListener('click', e => e.stopPropagation());

        // Bind document tree items — pass data-path (real path) as `path`
        container.querySelectorAll('.doc-tree-item').forEach(item => {
            item.addEventListener('contextmenu', e =>
                showMenu(e, item.dataset.path, 'doc', item.dataset.name));
            item.addEventListener('touchstart', e => {
                pressTimer = setTimeout(() =>
                    showMenu(e, item.dataset.path, 'doc', item.dataset.name), 600);
            });
            item.addEventListener('touchend', () => clearTimeout(pressTimer));
            item.addEventListener('touchmove', () => clearTimeout(pressTimer));
        });

        // Bind folder rows — data-path already holds the correct folder path
        container.querySelectorAll('.doc-tree-folder').forEach(folder => {
            folder.addEventListener('contextmenu', e => {
                e.stopPropagation();
                showMenu(e, folder.dataset.path, 'folder',
                    folder.querySelector('.folder-name').textContent.trim());
            });
            folder.addEventListener('touchstart', e => {
                e.stopPropagation();
                pressTimer = setTimeout(() =>
                    showMenu(e, folder.dataset.path, 'folder',
                        folder.querySelector('.folder-name').textContent.trim()), 600);
            });
            folder.addEventListener('touchend', () => clearTimeout(pressTimer));
            folder.addEventListener('touchmove', () => clearTimeout(pressTimer));
        });

        // Wire the action buttons ONCE (persists across renders because the menu
        // element lives in the DOM permanently in index.html)
        if (!menu.dataset.initialized) {
            menu.dataset.initialized = 'true';
            document.getElementById('ctx-btn-rename').addEventListener('click', () => {
                hideMenu(); handleMenuAction('rename', container);
            });
            document.getElementById('ctx-btn-move').addEventListener('click', () => {
                hideMenu(); handleMenuAction('move', container);
            });
            document.getElementById('ctx-btn-copy').addEventListener('click', () => {
                hideMenu(); handleMenuAction('copy', container);
            });
            document.getElementById('ctx-btn-delete').addEventListener('click', () => {
                hideMenu(); handleMenuAction('delete', container);
            });
            setupModals(container);
        }
    }

    // ─── Modals ───────────────────────────────────────────────────────────────

    function setupModals(container) {
        const renameModal = document.getElementById('doc-rename-modal');
        const moveModal = document.getElementById('doc-move-modal');

        // Cancel / overlay-click to close
        document.getElementById('btn-cancel-rename').addEventListener('click', () => hide(renameModal));
        document.getElementById('btn-cancel-move').addEventListener('click', () => hide(moveModal));
        renameModal.addEventListener('click', e => { if (e.target === renameModal) hide(renameModal); });
        moveModal.addEventListener('click', e => { if (e.target === moveModal) hide(moveModal); });

        // ── Rename confirm ──
        document.getElementById('btn-confirm-rename').addEventListener('click', async () => {
            const newName = document.getElementById('doc-rename-input').value.trim();
            if (!newName || !activeContextNode) return;
            let nameWithExt = newName;
            if (activeContextNode.type === 'doc' && !nameWithExt.endsWith('.md')) {
                nameWithExt += '.md';
            }
            const r = await fetch('/api/documents/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_path: activeContextNode.path, new_name: nameWithExt })
            });
            if (r.ok) {
                hide(renameModal);
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else { showToast('Rename failed (file may already exist).', 'error'); }
        });

        document.getElementById('doc-rename-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('btn-confirm-rename').click();
            if (e.key === 'Escape') hide(renameModal);
        });

        // ── Move confirm ──
        document.getElementById('btn-confirm-move').addEventListener('click', async () => {
            if (!activeContextNode) return;
            const destPath = moveModal.dataset.selectedDest || '';
            const r = await fetch('/api/documents/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_path: activeContextNode.path, new_dest_dir: destPath })
            });
            if (r.ok) {
                hide(moveModal);
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else { showToast('Move failed — destination may already contain a file with that name.', 'error'); }
        });
    }

    // ─── Context Menu Actions ─────────────────────────────────────────────────

    async function handleMenuAction(action, container) {
        if (!activeContextNode) return;
        const { path, type, name } = activeContextNode;

        if (action === 'delete') {
            if (!confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return;
            const r = await fetch(`/api/documents/${path}`, { method: 'DELETE' });
            if (r.ok) {
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else { showToast('Delete failed.', 'error'); }
        }

        else if (action === 'copy') {
            const r = await fetch('/api/documents/copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (r.ok) {
                await window.db.reloadManifest();
                renderDocumentsPage(container);
                showToast('Document copied!', 'success');
            } else { showToast('Copy failed.', 'error'); }
        }

        else if (action === 'rename') {
            const renameModal = document.getElementById('doc-rename-modal');
            const input = document.getElementById('doc-rename-input');
            // Pre-fill with current name (strip .md for docs so user edits just the name)
            input.value = type === 'doc'
                ? name.replace(/\.md$/i, '')
                : name;
            showFlex(renameModal);
            input.focus();
            input.select();
        }

        else if (action === 'move') {
            const moveModal = document.getElementById('doc-move-modal');
            const treeContainer = document.getElementById('doc-move-tree-container');
            moveModal.dataset.selectedDest = '';

            const tree = buildTreeFromManifest();

            // Render folder-only tree for destination picking
            const renderFolderNodes = (nodes, depth, basePath) => {
                let h = '';
                for (const node of nodes) {
                    if (node.type !== 'folder') continue;
                    const indent = depth * 14;
                    h += `<div class="move-tree-item" data-path="${node.path}"
                               style="padding-left:${indent + 10}px">
                        <span class="move-folder-toggle">▼</span>
                        <span>${node.icon || '📁'}</span>
                        <span>${node.name}</span>
                    </div>`;
                    if (node.children?.length) {
                        h += `<div class="move-tree-children">${renderFolderNodes(node.children, depth + 1, node.path)}</div>`;
                    }
                }
                return h;
            };

            treeContainer.innerHTML = `
                <div class="move-tree-root-item" data-path="">
                    <span>📂</span> <span>Root (top level)</span>
                </div>
                ${renderFolderNodes(tree.children, 1, '')}`;

            // Root item selection
            treeContainer.querySelectorAll('.move-tree-root-item').forEach(el => {
                el.addEventListener('click', () => {
                    treeContainer.querySelectorAll('.move-tree-root-item, .move-tree-item')
                        .forEach(x => x.classList.remove('selected'));
                    el.classList.add('selected');
                    moveModal.dataset.selectedDest = '';
                });
            });

            // Folder item selection + collapse toggle
            treeContainer.querySelectorAll('.move-tree-item').forEach(item => {
                item.addEventListener('click', e => {
                    if (e.target.classList.contains('move-folder-toggle')) {
                        const next = item.nextElementSibling;
                        if (next?.classList.contains('move-tree-children')) {
                            next.classList.toggle('collapsed');
                            e.target.textContent = next.classList.contains('collapsed') ? '▶' : '▼';
                        }
                        return;
                    }
                    treeContainer.querySelectorAll('.move-tree-root-item, .move-tree-item')
                        .forEach(x => x.classList.remove('selected'));
                    item.classList.add('selected');
                    moveModal.dataset.selectedDest = item.dataset.path;
                });
            });

            showFlex(moveModal);
        }
    }

    // ─── Image Gallery ────────────────────────────────────────────────────────

    function openImageGallery(container) {
        const viewer = document.getElementById('doc-viewer');
        const images = window.db?.manifest?.images ?? {};
        const imageList = Object.entries(images);

        viewer.innerHTML = `
            <div class="doc-header">
                <h2 class="doc-title">🖼️ Image Library</h2>
                ${window.isEditMode ? `
                <div class="doc-actions" style="display:flex; gap:8px;">
                    <button class="tool-btn" id="btn-upload-image">📤 Upload Image</button>
                    <input type="file" id="hidden-img-upload" style="display:none" accept="image/*">
                </div>` : ''}
            </div>
            <div class="image-gallery-toolbar">
                <input type="text" id="img-gallery-search" class="doc-search"
                    placeholder="🔍 Search images…" style="max-width:300px;">
            </div>
            <div class="image-gallery" id="image-gallery">
                ${imageList.length === 0
                ? '<p class="placeholder-text" style="padding:40px;">No images yet. Upload an image to get started.</p>'
                : imageList.map(([id, img]) => `
                        <div class="image-card" data-id="${id}">
                            <div class="image-card-preview">
                                <img src="${img.url}" alt="${img.name}" loading="lazy"
                                    onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
                                <div class="image-card-fallback" style="display:none">🖼️</div>
                            </div>
                            <div class="image-card-info">
                                <span class="image-card-name" title="${img.name}">${img.name}</span>
                                <span class="image-card-id" title="${id}">${id}</span>
                            </div>
                            <div class="image-card-actions">
                                <button class="tool-btn btn-small btn-copy-id"
                                    data-id="${id}" title="Copy ID">🔗 ID</button>
                                <button class="tool-btn btn-small btn-copy-url"
                                    data-url="${img.url}" title="Copy URL">📋 URL</button>
                                ${window.isEditMode
                        ? `<button class="tool-btn btn-small btn-delete-img"
                                            data-file="${img.file}" title="Delete">🗑️</button>`
                        : ''}
                            </div>
                        </div>`).join('')
            }
            </div>`;

        // Upload
        if (window.isEditMode) {
            const uploadBtn = viewer.querySelector('#btn-upload-image');
            const imgFileInput = viewer.querySelector('#hidden-img-upload');
            uploadBtn.addEventListener('click', () => imgFileInput.click());
            imgFileInput.addEventListener('change', async e => {
                if (!e.target.files.length) return;
                const file = e.target.files[0];
                const fd = new FormData();
                fd.append('path', '');
                fd.append('file', file);
                const r = await fetch('/api/images/upload', { method: 'POST', body: fd });
                imgFileInput.value = '';
                if (r.ok) {
                    await window.db.reloadManifest();
                    openImageGallery(container);
                    showToast('Image uploaded!', 'success');
                } else { showToast('Upload failed. Only jpg/png/gif/webp/svg allowed.', 'error'); }
            });

            // Delete
            viewer.querySelectorAll('.btn-delete-img').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm(`Delete this image?\n${btn.dataset.file}\n\nCannot be undone.`)) return;
                    const r = await fetch(`/api/images/${btn.dataset.file}`, { method: 'DELETE' });
                    if (r.ok) {
                        await window.db.reloadManifest();
                        openImageGallery(container);
                        showToast('Image deleted.', 'success');
                    } else { showToast('Delete failed.', 'error'); }
                });
            });
        }

        // Copy ID / URL
        viewer.querySelectorAll('.btn-copy-id').forEach(btn => {
            btn.addEventListener('click', () =>
                navigator.clipboard.writeText(btn.dataset.id)
                    .then(() => showToast('ID copied!', 'success')));
        });
        viewer.querySelectorAll('.btn-copy-url').forEach(btn => {
            btn.addEventListener('click', () =>
                navigator.clipboard.writeText(btn.dataset.url)
                    .then(() => showToast('URL copied!', 'success')));
        });

        // Gallery search filter
        viewer.querySelector('#img-gallery-search').addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            viewer.querySelectorAll('.image-card').forEach(card => {
                card.style.display = (!q || (card.dataset.id || '').toLowerCase().includes(q)) ? '' : 'none';
            });
        });
    }

    // ─── Toast Notification ───────────────────────────────────────────────────

    /**
     * Shows a brief toast notification at the bottom of the screen.
     * @param {string} message - Text to display
     * @param {'info'|'success'|'error'} type - Visual style
     */
    function showToast(message, type = 'info') {
        let toast = document.getElementById('doc-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'doc-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `doc-toast doc-toast-${type} doc-toast-show`;
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('doc-toast-show'), 3000);
    }

    // ─── Page Lifecycle ───────────────────────────────────────────────────────

    window.addEventListener('pagechange', e => {
        if (e.detail.page === 'documents') {
            const container = document.getElementById('documents-content');
            renderDocumentsPage(container);
        }
    });

})();
