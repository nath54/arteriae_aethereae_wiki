/**
 * Documents Page Module — Arteriae Aethereae Wiki
 * Handles the file explorer UI and markdown viewer for lore and story drafts.
 *
 * HOOK POINT (Nav Tree): Currently uses a hardcoded `DOCUMENT_TREE`.
 * If you add new markdown files in `res_tmp/...`, add their references here
 * manually to display them in the UI.
 */
(function () {
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
                    // It's the file
                    currentLevel.push({
                        name: doc.name || part.replace('.md', ''),
                        type: 'doc',
                        file: id, // Use the slugified ID
                        icon: '📄'
                    });
                } else {
                    // It's a folder
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
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
            nodes.forEach(node => {
                if (node.children) sortNodes(node.children);
            });
        };

        sortNodes(root.children);
        return root;
    }

    let searchQuery = '';
    let selectedFolderPath = ''; // Context for new documents/folders


    function renderDocumentsPage(container) {
        let html = '';

        // Build tree dynamically
        const tree = buildTreeFromManifest();

        // Search bar
        html += `<div class="doc-toolbar">
            <div class="doc-search-wrap">
                <input type="text" id="doc-search" class="doc-search" placeholder="🔍 Search documents..." value="${searchQuery}">
            </div>
            <button class="tool-btn edit-only" id="btn-new-folder">📁 New Folder</button>
            <button class="tool-btn edit-only" id="btn-new-doc">📄 New Document</button>
        </div>`;

        // File tree + content pane
        html += '<div class="doc-layout">';
        html += '<div class="doc-tree" id="doc-tree">';
        html += renderTree(tree.children, 0);
        html += '</div>';
        html += '<div class="doc-viewer" id="doc-viewer">';
        html += '<div class="doc-viewer-empty"><span class="doc-viewer-icon">📜</span><p>Select a document to view</p></div>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;

        // Bind tree clicks (Items)
        container.querySelectorAll('.doc-tree-item[data-file]').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.doc-tree-item').forEach(i => i.classList.remove('active'));
                container.querySelectorAll('.doc-tree-folder').forEach(f => f.classList.remove('selected'));
                selectedFolderPath = ''; // Clear folder selection when selecting a doc
                item.classList.add('active');
                loadDocument(item.dataset.file, item.dataset.name);
            });
        });

        // Bind folder selection (Clicking the row)
        container.querySelectorAll('.doc-tree-folder').forEach(folder => {
            folder.addEventListener('click', (e) => {
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
            });
        });

        // Bind folder toggling (Clicking the arrow only)
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

        // New Folder / New Doc Actions
        container.querySelector('#btn-new-folder').addEventListener('click', () => {
            const folderName = prompt(`Create new folder in [${selectedFolderPath || 'Root'}]:`);
            if (folderName) {
                console.log(`Creating folder "${folderName}" in "${selectedFolderPath}"`);
                // TODO: Call API
            }
        });

        container.querySelector('#btn-new-doc').addEventListener('click', () => {
            const docName = prompt(`Create new document in [${selectedFolderPath || 'Root'}]:`);
            if (docName) {
                console.log(`Creating document "${docName}" in "${selectedFolderPath}"`);
                // TODO: Call API
            }
        });

        // Search
        const searchInput = container.querySelector('#doc-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                filterTree(container, searchQuery);
            });
        }
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
                if (node.children) {
                    html += renderTree(node.children, depth + 1, nodePath);
                }
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

    async function loadDocument(idOrFilename, displayName) {
        const viewer = document.getElementById('doc-viewer');
        viewer.innerHTML = '<p class="doc-loading">Loading...</p>';

        let relativePath = idOrFilename;

        // Try to find the document in the manifest to get its real path
        if (window.db && window.db.manifest && window.db.manifest.documents) {
            const doc = window.db.manifest.documents[idOrFilename];
            if (doc && doc.file) {
                relativePath = doc.file;
            }
        }

        const paths = [
            `../data/documents/${relativePath}`,
            `../data/documents/${idOrFilename}`
        ];

        let content = null;
        for (const path of paths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    content = await response.text();
                    break;
                }
            } catch (e) { /* try next path */ }
        }

        if (content) {
            const rendered = window.parseMarkdown ? window.parseMarkdown(content) : escapeHtml(content);
            viewer.innerHTML = `
                <div class="doc-header">
                    <h2 class="doc-title">${displayName}</h2>
                    <div class="doc-actions edit-only">
                        <button class="tool-btn" id="btn-edit-doc">✏️ Edit</button>
                    </div>
                </div>
                <div class="markdown-content doc-body">${rendered}</div>`;
        } else {
            viewer.innerHTML = `
                <div class="doc-header"><h2 class="doc-title">${displayName}</h2></div>
                <p class="placeholder-text">Could not load ${filename}. File may not exist yet.</p>`;
        }
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    function filterTree(container, query) {
        const items = container.querySelectorAll('.doc-tree-item');
        const folders = container.querySelectorAll('.doc-tree-folder');
        const q = query.toLowerCase();

        if (!q) {
            items.forEach(i => i.style.display = '');
            folders.forEach(f => f.style.display = '');
            return;
        }

        items.forEach(item => {
            const name = (item.dataset.name || '').toLowerCase();
            item.style.display = name.includes(q) ? '' : 'none';
        });
    }

    // ── Page Lifecycle ──
    window.addEventListener('pagechange', (e) => {
        if (e.detail.page === 'documents') {
            const container = document.getElementById('documents-content');
            renderDocumentsPage(container);
        }
    });
})();
