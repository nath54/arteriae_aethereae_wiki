/**
 * Documents Page Module — Arteriae Aethereae Wiki
 * Handles the file explorer UI and markdown viewer for lore and story drafts.
 *
 * HOOK POINT (Nav Tree): Currently uses a hardcoded `DOCUMENT_TREE`.
 * If you add new markdown files in `res_tmp/...`, add their references here
 * manually to display them in the UI.
 */
(function () {
    // Document tree structure — static definition for now
    // In edit mode with server, this would come from the API
    const DOCUMENT_TREE = {
        name: 'Root',
        type: 'folder',
        children: [
            {
                name: 'Univers',
                type: 'folder',
                icon: '🌍',
                children: [
                    { name: 'World Overview', type: 'doc', file: 'world.md', icon: '📄' },
                    { name: 'Races & Species', type: 'doc', file: 'races.md', icon: '📄' },
                    { name: 'Magic System', type: 'doc', file: 'magic.md', icon: '📄' },
                    { name: 'Languages', type: 'doc', file: 'languages.md', icon: '📄' },
                    { name: 'Religions', type: 'doc', file: 'religions.md', icon: '📄' }
                ]
            },
            {
                name: 'Histoire',
                type: 'folder',
                icon: '📚',
                children: [
                    {
                        name: 'v0 - Outline',
                        type: 'folder',
                        children: [
                            { name: 'Chapter 0', type: 'doc', file: 'histoire_v0_ch0.md', icon: '📜' },
                            { name: 'Chapter 1', type: 'doc', file: 'histoire_v0_ch1.md', icon: '📜' },
                            { name: 'Chapter 2', type: 'doc', file: 'histoire_v0_ch2.md', icon: '📜' }
                        ]
                    },
                    {
                        name: 'v1 - Draft',
                        type: 'folder',
                        children: [
                            { name: 'Chapter 0', type: 'doc', file: 'histoire_v1_ch0.md', icon: '📜' },
                            { name: 'Chapter 1', type: 'doc', file: 'histoire_v1_ch1.md', icon: '📜' }
                        ]
                    }
                ]
            },
            {
                name: 'Personnages',
                type: 'folder',
                icon: '👤',
                children: [
                    { name: 'Character Template', type: 'doc', file: 'Personnage_template.md', icon: '📋' }
                ]
            },
            {
                name: 'Inspirations',
                type: 'folder',
                icon: '💡',
                children: [
                    { name: 'Project README', type: 'doc', file: 'README.md', icon: '📄' }
                ]
            }
        ]
    };

    let searchQuery = '';

    function renderDocumentsPage(container) {
        let html = '';

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
        html += renderTree(DOCUMENT_TREE.children, 0);
        html += '</div>';
        html += '<div class="doc-viewer" id="doc-viewer">';
        html += '<div class="doc-viewer-empty"><span class="doc-viewer-icon">📜</span><p>Select a document to view</p></div>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;

        // Bind tree clicks
        container.querySelectorAll('.doc-tree-item[data-file]').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.doc-tree-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                loadDocument(item.dataset.file, item.dataset.name);
            });
        });

        // Bind folder toggling
        container.querySelectorAll('.doc-tree-folder').forEach(folder => {
            folder.addEventListener('click', (e) => {
                e.stopPropagation();
                const children = folder.nextElementSibling;
                if (children) {
                    children.classList.toggle('collapsed');
                    folder.classList.toggle('folder-open');
                }
            });
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

    function renderTree(nodes, depth) {
        let html = '';
        for (const node of nodes) {
            const indent = depth * 16;
            if (node.type === 'folder') {
                html += `<div class="doc-tree-folder folder-open" style="padding-left:${indent}px">
                    <span class="folder-toggle">▼</span>
                    <span class="folder-icon">${node.icon || '📁'}</span>
                    <span class="folder-name">${node.name}</span>
                </div>`;
                html += `<div class="doc-tree-children">`;
                if (node.children) {
                    html += renderTree(node.children, depth + 1);
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

    async function loadDocument(filename, displayName) {
        const viewer = document.getElementById('doc-viewer');
        viewer.innerHTML = '<p class="doc-loading">Loading...</p>';

        // Try multiple paths for the markdown file
        const paths = [
            `../res_tmp/arteriae_aethereae_content_and_templates/${filename}`,
            `../res_tmp/arteriae_aethereae_content_and_templates/Univers/${filename}`,
            `../res_tmp/arteriae_aethereae_content_and_templates/Histoire/v0/${filename}`,
            `../res_tmp/arteriae_aethereae_content_and_templates/Histoire/v1/${filename}`,
            `../res_tmp/arteriae_aethereae_content_and_templates/Personnages/${filename}`,
            `../data/documents/${filename}`
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
