/**
 * Documents Page Module — Arteriae Aethereae Wiki
 * Handles the file explorer UI and markdown viewer for lore and story drafts.
 * Context menus, modals, inline creation panels, file editing, and image upload.
 */
(function () {

    // ─── State ──────────────────────────────────────────────────────────────
    let searchQuery = '';
    let selectedFolderPath = '';     // Context for new documents/folders
    let activeContextNode = null;    // { path, type, name }
    let contextMenuHideListener = null;

    // ─── Helpers ────────────────────────────────────────────────────────────

    function getFolderIcon(name) {
        const lower = name.toLowerCase();
        if (lower.includes('univers') || lower.includes('world') || lower.includes('worldbuilding')) return '🌍';
        if (lower.includes('histoire') || lower.includes('story') || lower.includes('plot')) return '📚';
        if (lower.includes('personnage') || lower.includes('character') || lower.includes('npc')) return '👤';
        if (lower.includes('inspiration') || lower.includes('idea')) return '💡';
        if (lower.includes('timeline') || lower.includes('chronology')) return '⏳';
        return '📁';
    }

    function buildTreeFromManifest() {
        const root = { name: 'Root', type: 'folder', children: [] };
        const manifestDocs = (window.db && window.db.manifest && window.db.manifest.documents) || {};

        for (const [id, doc] of Object.entries(manifestDocs)) {
            const parts = doc.file.split('/');
            let currentLevel = root.children;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = (i === parts.length - 1);

                if (isLast) {
                    currentLevel.push({
                        name: doc.name || part.replace('.md', ''),
                        type: 'doc',
                        file: id,
                        icon: '📄'
                    });
                } else {
                    let folder = currentLevel.find(item => item.name === part && item.type === 'folder');
                    if (!folder) {
                        folder = {
                            name: part,
                            type: 'folder',
                            icon: getFolderIcon(part),
                            children: []
                        };
                        currentLevel.push(folder);
                    }
                    currentLevel = folder.children;
                }
            }
        }

        // Sort: folders first, then files, both alphabetically
        const sortNodes = (nodes) => {
            nodes.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            nodes.forEach(node => { if (node.children) sortNodes(node.children); });
        };
        sortNodes(root.children);
        return root;
    }

    // ─── Render ─────────────────────────────────────────────────────────────

    function renderDocumentsPage(container) {
        const tree = buildTreeFromManifest();

        container.innerHTML = `
        <div class="doc-toolbar">
            <div class="doc-search-wrap">
                <input type="text" id="doc-search" class="doc-search" placeholder="🔍 Search documents..." value="${searchQuery}">
            </div>
            <button class="tool-btn edit-only" id="btn-upload-doc">📤 Upload</button>
            <button class="tool-btn edit-only" id="btn-new-folder">📁 New Folder</button>
            <button class="tool-btn edit-only" id="btn-new-doc">📄 New Document</button>
            <button class="tool-btn edit-only" id="btn-images">🖼️ Images</button>
            <input type="file" id="hidden-file-upload" style="display:none" accept="*/*">
        </div>

        <!-- Inline: New Folder Panel -->
        <div id="panel-new-folder" class="inline-panel edit-only" style="display:none !important;">
            <span class="inline-panel-label">📁 New folder in <em id="panel-folder-context">Root</em>:</span>
            <input type="text" id="input-new-folder" placeholder="Folder name…">
            <button class="tool-btn" id="btn-confirm-new-folder">✔ Create</button>
            <button class="tool-btn btn-muted" id="btn-cancel-new-folder">✖ Cancel</button>
        </div>

        <!-- Inline: New Document Panel -->
        <div id="panel-new-doc" class="inline-panel edit-only" style="display: none !important;">
            <span class="inline-panel-label">📄 New document in <em id="panel-doc-context">Root</em>:</span>
            <input type="text" id="input-new-doc" placeholder="Document name (.md)…">
            <button class="tool-btn" id="btn-confirm-new-doc">✔ Create</button>
            <button class="tool-btn btn-muted" id="btn-cancel-new-doc">✖ Cancel</button>
        </div>

        <div class="doc-layout">
            <div class="doc-tree" id="doc-tree">
                ${renderTree(tree.children, 0)}
            </div>
            <div class="doc-viewer" id="doc-viewer">
                <div class="doc-viewer-empty">
                    <span class="doc-viewer-icon">📜</span>
                    <p>Select a document to view</p>
                </div>
            </div>
        </div>`;

        bindTreeEvents(container);
        bindToolbarEvents(container);
        bindSearchEvents(container);
        setupContextMenus(container);
    }

    function renderTree(nodes, depth, currentPath = '') {
        let html = '';
        for (const node of nodes) {
            const indent = depth * 16;
            const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

            if (node.type === 'folder') {
                const isSelected = selectedFolderPath === nodePath;
                html += `<div class="doc-tree-folder folder-open ${isSelected ? 'selected' : ''}" data-path="${nodePath}" style="padding-left:${indent}px">
                    <span class="folder-toggle">▼</span>
                    <span class="folder-icon">${node.icon || '📁'}</span>
                    <span class="folder-name">${node.name}</span>
                </div>`;
                html += `<div class="doc-tree-children">`;
                if (node.children) html += renderTree(node.children, depth + 1, nodePath);
                html += '</div>';
            } else {
                html += `<div class="doc-tree-item" data-file="${node.file}" data-name="${node.name}" style="padding-left:${indent + 16}px">
                    <span class="doc-icon">${node.icon || '📄'}</span>
                    <span class="doc-name">${node.name}</span>
                </div>`;
            }
        }
        return html;
    }

    // ─── Event Binding ──────────────────────────────────────────────────────

    function bindTreeEvents(container) {
        // Document item click → load
        container.querySelectorAll('.doc-tree-item[data-file]').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.doc-tree-item').forEach(i => i.classList.remove('active'));
                container.querySelectorAll('.doc-tree-folder').forEach(f => f.classList.remove('selected'));
                selectedFolderPath = '';
                item.classList.add('active');
                loadDocument(item.dataset.file, item.dataset.name);
            });
        });

        // Folder row click → select/deselect
        container.querySelectorAll('.doc-tree-folder').forEach(folder => {
            folder.addEventListener('click', (e) => {
                if (e.target.classList.contains('folder-toggle')) return;
                const path = folder.dataset.path;
                const isSelected = folder.classList.contains('selected');
                container.querySelectorAll('.doc-tree-folder').forEach(f => f.classList.remove('selected'));
                container.querySelectorAll('.doc-tree-item').forEach(i => i.classList.remove('active'));
                if (isSelected) {
                    selectedFolderPath = '';
                } else {
                    folder.classList.add('selected');
                    selectedFolderPath = path;
                }
                updatePanelContextLabels(container);
            });
        });

        // Folder toggle arrow → collapse/expand
        container.querySelectorAll('.folder-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const folder = toggle.closest('.doc-tree-folder');
                const children = folder.nextElementSibling;
                if (children) {
                    children.classList.toggle('collapsed');
                    folder.classList.toggle('folder-open');
                }
            });
        });
    }

    function updatePanelContextLabels(container) {
        const ctx = selectedFolderPath || 'Root';
        const fl = container.querySelector('#panel-folder-context');
        const dl = container.querySelector('#panel-doc-context');
        if (fl) fl.textContent = ctx;
        if (dl) dl.textContent = ctx;
    }

    function bindToolbarEvents(container) {
        const fileInput = container.querySelector('#hidden-file-upload');

        // ── Upload Document
        container.querySelector('#btn-upload-doc').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
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
            } else {
                showToast('Upload failed.', 'error');
            }
        });

        // ── New Folder button → show inline panel
        container.querySelector('#btn-new-folder').addEventListener('click', () => {
            const panel = container.querySelector('#panel-new-folder');
            const docPanel = container.querySelector('#panel-new-doc');

            // hide the other panel
            docPanel.style.display = "none !important";
            panel.style.display = "flex !important";

            // focus on the input
            container.querySelector('#input-new-folder').value = '';
            container.querySelector('#input-new-folder').focus();
        });

        container.querySelector('#btn-cancel-new-folder').addEventListener('click', () => {
            container.querySelector('#panel-new-folder').style.display = "none !important";
        });

        container.querySelector('#btn-confirm-new-folder').addEventListener('click', async () => {
            const nameInput = container.querySelector('#input-new-folder');
            const folderName = nameInput.value.trim();
            if (!folderName) return;
            const path = selectedFolderPath ? `${selectedFolderPath}/${folderName}` : folderName;
            const fd = new FormData();
            fd.append('path', path);
            const r = await fetch('/api/folders/new', { method: 'POST', body: fd });
            if (r.ok) {
                container.querySelector('#panel-new-folder').style.display = "none !important";
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else {
                showToast('Folder already exists or invalid name.', 'error');
            }
        });

        // Enter key in folder input
        container.querySelector('#input-new-folder').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') container.querySelector('#btn-confirm-new-folder').click();
            if (e.key === 'Escape') container.querySelector('#panel-new-folder').style.display = "none !important";
        });

        // ── New Document button → show inline panel
        container.querySelector('#btn-new-doc').addEventListener('click', () => {

            // Get the two panels nodes
            const panel = container.querySelector('#panel-new-doc');
            const folderPanel = container.querySelector('#panel-new-folder');

            // Ensure the other panel is hidden
            folderPanel.style.display = "none !important";
            panel.style.display = "flex !important";

            // focus on the input
            container.querySelector('#input-new-doc').value = '';
            container.querySelector('#input-new-doc').focus();
        });

        container.querySelector('#btn-cancel-new-doc').addEventListener('click', () => {
            container.querySelector('#panel-new-doc').style.display = "none !important";
        });

        container.querySelector('#btn-confirm-new-doc').addEventListener('click', async () => {
            const nameInput = container.querySelector('#input-new-doc');
            let docName = nameInput.value.trim();
            if (!docName) return;
            if (!docName.endsWith('.md')) docName += '.md';
            const path = selectedFolderPath ? `${selectedFolderPath}/${docName}` : docName;
            const fd = new FormData();
            fd.append('path', path);
            const r = await fetch('/api/documents/new', { method: 'POST', body: fd });
            if (r.ok) {
                // hide the panel
                container.querySelector('#panel-new-doc').style.display = "none !important";
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else {
                showToast('Document already exists or invalid name.', 'error');
            }
        });

        container.querySelector('#input-new-doc').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') container.querySelector('#btn-confirm-new-doc').click();
            if (e.key === 'Escape') container.querySelector('#panel-new-doc').style.display = "none !important";
        });

        // ── Images tab
        container.querySelector('#btn-images').addEventListener('click', () => {
            openImageGallery(container);
        });
    }

    function bindSearchEvents(container) {
        const searchInput = container.querySelector('#doc-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                filterTree(container, searchQuery);
            });
        }
    }

    // ─── Document Viewer & Editor ────────────────────────────────────────────

    async function loadDocument(idOrFilename, displayName) {
        const viewer = document.getElementById('doc-viewer');
        viewer.innerHTML = '<p class="doc-loading">Loading…</p>';

        let relativePath = idOrFilename;
        if (window.db && window.db.manifest && window.db.manifest.documents) {
            const doc = window.db.manifest.documents[idOrFilename];
            if (doc && doc.file) relativePath = doc.file;
        }

        const paths = [
            `../data/documents/${relativePath}`,
            `../data/documents/${idOrFilename}`
        ];

        let content = null;
        for (const path of paths) {
            try {
                const resp = await fetch(path);
                if (resp.ok) { content = await resp.text(); break; }
            } catch (_) { /* try next */ }
        }

        if (content !== null) {
            const rendered = window.parseMarkdown ? window.parseMarkdown(content) : escapeHtml(content);
            viewer.innerHTML = `
                <div class="doc-header">
                    <h2 class="doc-title">${displayName}</h2>
                    <div class="doc-actions edit-only">
                        <button class="tool-btn" id="btn-edit-doc">✏️ Edit</button>
                    </div>
                </div>
                <div class="markdown-content doc-body">${rendered}</div>`;

            const editBtn = viewer.querySelector('#btn-edit-doc');
            if (editBtn) {
                editBtn.addEventListener('click', () => openEditor(viewer, idOrFilename, displayName, relativePath, content));
            }
        } else {
            viewer.innerHTML = `
                <div class="doc-header"><h2 class="doc-title">${displayName}</h2></div>
                <p class="placeholder-text">Could not load. File may not exist yet.</p>`;
        }
    }

    function openEditor(viewer, idOrFilename, displayName, relativePath, content) {
        viewer.innerHTML = `
            <div class="doc-header">
                <h2 class="doc-title">✏️ Editing: ${displayName}</h2>
                <div class="doc-actions">
                    <button class="tool-btn btn-muted" id="btn-cancel-edit">✖ Cancel</button>
                    <button class="tool-btn" id="btn-save-doc">💾 Save</button>
                </div>
            </div>
            <div class="doc-body doc-editor-wrap">
                <textarea id="doc-editor-textarea" class="editor-textarea">${escapeHtmlForTextarea(content)}</textarea>
            </div>`;

        viewer.querySelector('#btn-cancel-edit').addEventListener('click', () => {
            loadDocument(idOrFilename, displayName);
        });

        viewer.querySelector('#btn-save-doc').addEventListener('click', async () => {
            const newContent = viewer.querySelector('#doc-editor-textarea').value;
            const fd = new FormData();
            fd.append('path', relativePath);
            fd.append('content', newContent);
            const r = await fetch('/api/documents/write', { method: 'POST', body: fd });
            if (r.ok) {
                showToast('Document saved!', 'success');
                loadDocument(idOrFilename, displayName);
            } else {
                showToast('Failed to save document.', 'error');
            }
        });
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    function escapeHtmlForTextarea(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ─── Context Menu ────────────────────────────────────────────────────────

    function setupContextMenus(container) {
        const menu = document.getElementById('doc-context-menu');
        if (!menu) return;

        let pressTimer = null;

        const showMenu = (e, path, type, name) => {
            if (!document.body.classList.contains('edit-mode')) return;
            e.preventDefault();
            e.stopPropagation();
            activeContextNode = { path, type, name };

            // Ensure menu is visible before measuring
            menu.style.display = 'block';

            const x = e.pageX || (e.touches && e.touches[0] ? e.touches[0].pageX : 0);
            const y = e.pageY || (e.touches && e.touches[0] ? e.touches[0].pageY : 0);

            // Keep within viewport bounds
            const menuW = menu.offsetWidth || 180;
            const menuH = menu.offsetHeight || 160;
            menu.style.left = `${Math.min(x, window.innerWidth - menuW - 8)}px`;
            menu.style.top = `${Math.min(y, window.innerHeight + window.scrollY - menuH - 8)}px`;
        };

        const hideMenu = () => {
            menu.style.display = 'none';
        };

        // Remove previous listener if it exists (avoid duplicate listeners on re-render)
        if (contextMenuHideListener) {
            document.removeEventListener('click', contextMenuHideListener);
        }
        contextMenuHideListener = hideMenu;
        document.addEventListener('click', contextMenuHideListener);

        // Prevent the menu itself from triggering hide
        menu.addEventListener('click', (e) => e.stopPropagation());

        // Bind document items
        container.querySelectorAll('.doc-tree-item').forEach(item => {
            const file = item.dataset.file;
            const name = item.dataset.name;
            item.addEventListener('contextmenu', (e) => showMenu(e, file, 'doc', name));
            item.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => showMenu(e, file, 'doc', name), 600);
            });
            item.addEventListener('touchend', () => clearTimeout(pressTimer));
            item.addEventListener('touchmove', () => clearTimeout(pressTimer));
        });

        // Bind folder rows
        container.querySelectorAll('.doc-tree-folder').forEach(folder => {
            const path = folder.dataset.path;
            const name = folder.querySelector('.folder-name').textContent;
            folder.addEventListener('contextmenu', (e) => {
                e.stopPropagation();
                showMenu(e, path, 'folder', name);
            });
            folder.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                pressTimer = setTimeout(() => showMenu(e, path, 'folder', name), 600);
            });
            folder.addEventListener('touchend', () => clearTimeout(pressTimer));
            folder.addEventListener('touchmove', () => clearTimeout(pressTimer));
        });

        // Wire up the global context menu action buttons (only once per document load)
        if (!menu.dataset.initialized) {
            menu.dataset.initialized = 'true';
            document.getElementById('ctx-btn-rename').addEventListener('click', () => {
                hideMenu();
                handleMenuAction('rename', container);
            });
            document.getElementById('ctx-btn-move').addEventListener('click', () => {
                hideMenu();
                handleMenuAction('move', container);
            });
            document.getElementById('ctx-btn-copy').addEventListener('click', () => {
                hideMenu();
                handleMenuAction('copy', container);
            });
            document.getElementById('ctx-btn-delete').addEventListener('click', () => {
                hideMenu();
                handleMenuAction('delete', container);
            });

            // Set up modal cancel/confirm buttons
            setupModals(container);
        }
    }

    // ─── Modals ──────────────────────────────────────────────────────────────

    function setupModals(container) {
        const renameModal = document.getElementById('doc-rename-modal');
        const moveModal = document.getElementById('doc-move-modal');

        document.getElementById('btn-cancel-rename').addEventListener('click', () => {
            renameModal.style.display = 'none';
        });
        document.getElementById('btn-cancel-move').addEventListener('click', () => {
            moveModal.style.display = 'none';
        });

        // Close modals by clicking the overlay background
        renameModal.addEventListener('click', (e) => {
            if (e.target === renameModal) renameModal.style.display = 'none';
        });
        moveModal.addEventListener('click', (e) => {
            if (e.target === moveModal) moveModal.style.display = 'none';
        });

        document.getElementById('btn-confirm-rename').addEventListener('click', async () => {
            const newName = document.getElementById('doc-rename-input').value.trim();
            if (!newName || !activeContextNode) return;
            let nameWithExt = newName;
            if (activeContextNode.type === 'doc' && !nameWithExt.endsWith('.md')) nameWithExt += '.md';
            const fd = new FormData();
            fd.append('old_path', activeContextNode.path);
            fd.append('new_name', nameWithExt);
            const r = await fetch('/api/documents/rename', { method: 'POST', body: fd });
            if (r.ok) {
                renameModal.style.display = 'none';
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else {
                showToast('Rename failed (file may already exist).', 'error');
            }
        });

        // Enter key on rename input
        document.getElementById('doc-rename-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('btn-confirm-rename').click();
            if (e.key === 'Escape') { document.getElementById('doc-rename-modal').style.display = 'none'; }
        });

        document.getElementById('btn-confirm-move').addEventListener('click', async () => {
            if (!activeContextNode) return;
            const destPath = document.getElementById('doc-move-modal').dataset.selectedDest || '';
            const fd = new FormData();
            fd.append('old_path', activeContextNode.path);
            fd.append('new_dest_dir', destPath);
            const r = await fetch('/api/documents/move', { method: 'POST', body: fd });
            if (r.ok) {
                moveModal.style.display = 'none';
                await window.db.reloadManifest();
                renderDocumentsPage(container);
            } else {
                showToast('Move failed. Destination may already have a file with that name.', 'error');
            }
        });
    }

    // ─── Menu Action Handlers ────────────────────────────────────────────────

    async function handleMenuAction(action, container) {
        if (!activeContextNode) return;
        const { path, type, name } = activeContextNode;

        if (action === 'delete') {
            if (confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) {
                const r = await fetch(`/api/documents/${path}`, { method: 'DELETE' });
                if (r.ok) {
                    await window.db.reloadManifest();
                    renderDocumentsPage(container);
                } else {
                    showToast('Delete failed.', 'error');
                }
            }
        }
        else if (action === 'copy') {
            const fd = new FormData();
            fd.append('path', path);
            const r = await fetch('/api/documents/copy', { method: 'POST', body: fd });
            if (r.ok) {
                await window.db.reloadManifest();
                renderDocumentsPage(container);
                showToast('Document copied!', 'success');
            } else {
                showToast('Copy failed.', 'error');
            }
        }
        else if (action === 'rename') {
            const renameModal = document.getElementById('doc-rename-modal');
            const input = document.getElementById('doc-rename-input');
            // Pre-fill with the current name (without extension for docs)
            input.value = type === 'doc' ? name.replace(/\.md$/i, '') : name;
            renameModal.style.display = 'flex';
            input.focus();
            input.select();
        }
        else if (action === 'move') {
            const moveModal = document.getElementById('doc-move-modal');
            const treeContainer = document.getElementById('doc-move-tree-container');
            moveModal.dataset.selectedDest = '';

            const tree = buildTreeFromManifest();

            const renderFolderTree = (nodes, depth, currentPath = '') => {
                let html = '<div class="move-tree-root-item" data-path="" style="padding-left:0px"><span>📂 Root</span></div>';
                if (depth === 0) html = '';
                const renderNodes = (nodes, depth, currentPath) => {
                    let h = '';
                    for (const node of nodes) {
                        if (node.type !== 'folder') continue;
                        const indent = depth * 14;
                        const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
                        h += `<div class="move-tree-item" data-path="${nodePath}" style="padding-left:${indent + 10}px">
                            <span class="move-folder-toggle">▼</span>
                            <span>${node.icon || '📁'}</span>
                            <span>${node.name}</span>
                        </div>`;
                        if (node.children && node.children.length > 0) {
                            h += `<div class="move-tree-children">${renderNodes(node.children, depth + 1, nodePath)}</div>`;
                        }
                    }
                    return h;
                };
                return renderNodes(nodes, depth, currentPath);
            };

            treeContainer.innerHTML = `
                <div class="move-tree-root-item" data-path="">
                    <span>📂</span> <span>Root (top level)</span>
                </div>
                ${renderFolderTree(tree.children, 1, '')}`;

            // Root item click
            treeContainer.querySelectorAll('.move-tree-root-item').forEach(el => {
                el.addEventListener('click', () => {
                    treeContainer.querySelectorAll('.move-tree-root-item, .move-tree-item').forEach(x => x.classList.remove('selected'));
                    el.classList.add('selected');
                    moveModal.dataset.selectedDest = '';
                });
            });

            // Folder item clicks
            treeContainer.querySelectorAll('.move-tree-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // Toggle collapse if clicking the arrow
                    if (e.target.classList.contains('move-folder-toggle')) {
                        const next = item.nextElementSibling;
                        if (next && next.classList.contains('move-tree-children')) {
                            next.classList.toggle('collapsed');
                            e.target.textContent = next.classList.contains('collapsed') ? '▶' : '▼';
                        }
                        return;
                    }
                    treeContainer.querySelectorAll('.move-tree-root-item, .move-tree-item').forEach(x => x.classList.remove('selected'));
                    item.classList.add('selected');
                    moveModal.dataset.selectedDest = item.dataset.path;
                });
            });

            moveModal.style.display = 'flex';
        }
    }

    // ─── Image Gallery ───────────────────────────────────────────────────────

    function openImageGallery(container) {
        const viewer = document.getElementById('doc-viewer');
        const images = (window.db && window.db.manifest && window.db.manifest.images) || {};
        const imageList = Object.entries(images);

        viewer.innerHTML = `
            <div class="doc-header">
                <h2 class="doc-title">🖼️ Image Library</h2>
                <div class="doc-actions edit-only">
                    <button class="tool-btn" id="btn-upload-image">📤 Upload Image</button>
                    <input type="file" id="hidden-img-upload" style="display:none" accept="image/*">
                </div>
            </div>
            <div class="image-gallery-toolbar edit-only">
                <input type="text" id="img-gallery-search" class="doc-search" placeholder="🔍 Search images..." style="max-width:300px;">
            </div>
            <div class="image-gallery" id="image-gallery">
                ${imageList.length === 0
                ? '<p class="placeholder-text" style="padding:40px;">No images yet. Upload an image to get started.</p>'
                : imageList.map(([id, img]) => `
                        <div class="image-card" data-id="${id}" data-url="${img.url}">
                            <div class="image-card-preview">
                                <img src="${img.url}" alt="${img.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
                                <div class="image-card-fallback" style="display:none">🖼️</div>
                            </div>
                            <div class="image-card-info">
                                <span class="image-card-name" title="${img.name}">${img.name}</span>
                                <span class="image-card-id" title="ID: ${id}">${id}</span>
                            </div>
                            <div class="image-card-actions">
                                <button class="tool-btn btn-small btn-copy-id" data-id="${id}" title="Copy ID">🔗 ID</button>
                                <button class="tool-btn btn-small btn-copy-url" data-url="${img.url}" title="Copy URL">📋 URL</button>
                                <button class="tool-btn btn-small btn-delete-img edit-only" data-file="${img.file}" title="Delete">🗑️</button>
                            </div>
                        </div>`).join('')
            }
            </div>`;

        // Image upload
        const uploadBtn = viewer.querySelector('#btn-upload-image');
        const imgFileInput = viewer.querySelector('#hidden-img-upload');
        if (uploadBtn && imgFileInput) {
            uploadBtn.addEventListener('click', () => imgFileInput.click());
            imgFileInput.addEventListener('change', async (e) => {
                if (!e.target.files.length) return;
                const file = e.target.files[0];
                const fd = new FormData();
                fd.append('path', '');   // root of data/images/
                fd.append('file', file);
                const r = await fetch('/api/images/upload', { method: 'POST', body: fd });
                imgFileInput.value = '';
                if (r.ok) {
                    await window.db.reloadManifest();
                    openImageGallery(container);
                    showToast('Image uploaded!', 'success');
                } else {
                    showToast('Upload failed. Only jpg/png/gif/webp/svg/avif are allowed.', 'error');
                }
            });
        }

        // Copy ID / URL buttons
        viewer.querySelectorAll('.btn-copy-id').forEach(btn => {
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(btn.dataset.id).then(() => showToast('ID copied!', 'success'));
            });
        });
        viewer.querySelectorAll('.btn-copy-url').forEach(btn => {
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(btn.dataset.url).then(() => showToast('URL copied!', 'success'));
            });
        });

        // Delete image buttons
        viewer.querySelectorAll('.btn-delete-img').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm(`Delete this image?\n\n${btn.dataset.file}\n\nThis cannot be undone.`)) return;
                const r = await fetch(`/api/images/${btn.dataset.file}`, { method: 'DELETE' });
                if (r.ok) {
                    await window.db.reloadManifest();
                    openImageGallery(container);
                    showToast('Image deleted.', 'success');
                } else {
                    showToast('Delete failed.', 'error');
                }
            });
        });

        // Gallery search filter
        const gallerySearch = viewer.querySelector('#img-gallery-search');
        if (gallerySearch) {
            gallerySearch.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase();
                viewer.querySelectorAll('.image-card').forEach(card => {
                    const name = (card.dataset.id || '').toLowerCase();
                    card.style.display = (!q || name.includes(q)) ? '' : 'none';
                });
            });
        }
    }

    // ─── Tree Search ─────────────────────────────────────────────────────────

    function filterTree(container, query) {
        const items = container.querySelectorAll('.doc-tree-item');
        const folders = container.querySelectorAll('.doc-tree-folder');
        const q = query.toLowerCase();

        if (!q) {
            items.forEach(i => { i.style.display = ''; });
            folders.forEach(f => { f.style.display = ''; if (f.nextElementSibling) f.nextElementSibling.classList.remove('collapsed'); f.classList.add('folder-open'); });
            return;
        }

        // Show items that match, reveal their parent folders
        items.forEach(item => {
            const name = (item.dataset.name || '').toLowerCase();
            item.style.display = name.includes(q) ? '' : 'none';
        });

        // Reveal all folders when searching (simplest approach)
        folders.forEach(f => {
            f.style.display = '';
            f.classList.add('folder-open');
            if (f.nextElementSibling) f.nextElementSibling.classList.remove('collapsed');
        });
    }

    // ─── Toast Notification ──────────────────────────────────────────────────

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
        toast._timer = setTimeout(() => {
            toast.classList.remove('doc-toast-show');
        }, 3000);
    }

    // ─── Page Lifecycle ──────────────────────────────────────────────────────

    window.addEventListener('pagechange', (e) => {
        if (e.detail.page === 'documents') {
            const container = document.getElementById('documents-content');
            renderDocumentsPage(container);
        }
    });

})();
