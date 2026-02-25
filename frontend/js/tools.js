class MapTools {
    constructor() {
        window.currentTool = 'view';
        this.selectedNodeId = null;
        this.draggingNodeId = null;
        this.selectedPlaceId = null; // Used for sidebar place highlighting
        this.bound = false;
    }

    /**
     * Bind events when map editor is opened.
     * Can be called multiple times safely.
     */
    bindEvents() {
        if (this.bound) return;
        this.bound = true;

        const btns = document.querySelectorAll('#map-editor-header .tool-btn[data-tool]');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.currentTool = btn.dataset.tool;
                this.selectedNodeId = null;
                if (window.mapRenderer) window.mapRenderer.render();
            });
        });

        // Export buttons
        const exportSvg = document.getElementById('btn-export-svg');
        if (exportSvg) exportSvg.addEventListener('click', () => this.exportSVG());

        const exportPng = document.getElementById('btn-export-png');
        if (exportPng) exportPng.addEventListener('click', () => this.exportPNG());

        // Close map editor
        const closeBtn = document.getElementById('btn-close-map');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('map-editor-overlay').classList.add('hidden');
                this.selectPlace(null);
            });
        }

        const svg = document.getElementById('map-svg');
        if (svg) {
            svg.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
            window.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        }
    }

    selectPlace(placeId) {
        this.selectedPlaceId = placeId;

        // Update unassign button visibility
        const subList = document.getElementById('map-editor-subplaces-list');
        if (subList) {
            subList.querySelectorAll('.map-subplace-item').forEach(item => {
                const assignBtn = item.querySelector('button[data-assign]');
                const unassignBtn = item.querySelector('button[data-unassign]');
                if (assignBtn && unassignBtn) {
                    if (item.dataset.id === placeId) {
                        // Check if it's actually assigned in the map to show unassign vs assign
                        let isAssigned = false;
                        if (window.mapGraph) {
                            for (const poly of Object.values(window.mapGraph.polygons)) {
                                if (poly.link === placeId) {
                                    isAssigned = true;
                                    break;
                                }
                            }
                        }

                        if (isAssigned) {
                            assignBtn.style.display = 'none';
                            unassignBtn.style.display = 'inline-block';
                            unassignBtn.onclick = async (e) => {
                                e.stopPropagation();
                                await this.unassignPlace(placeId);
                            };
                        } else {
                            assignBtn.style.display = 'inline-block';
                            unassignBtn.style.display = 'none';
                        }
                    } else {
                        assignBtn.style.display = 'inline-block';
                        unassignBtn.style.display = 'none';
                    }
                }
            });
        }

        if (window.mapRenderer) {
            window.mapRenderer.render();
        }
    }

    activateAssignMode(placeId) {
        this.selectPlace(placeId);

        // Emulate clicking the assign tool button
        const assignBtn = document.querySelector('.tool-btn[data-tool="assign_region"]');
        if (assignBtn) {
            document.querySelectorAll('#map-editor-header .tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
            assignBtn.classList.add('active');
        }
        window.currentTool = 'assign_region';
    }

    async unassignPlace(placeId) {
        if (!window.mapGraph) return;
        let modified = false;
        for (const poly of Object.values(window.mapGraph.polygons)) {
            if (poly.link === placeId) {
                delete poly.link;
                modified = true;
            }
        }
        if (modified) {
            await this.saveCurrentMap();
            if (window.mapRenderer) window.mapRenderer.render();
            this.selectPlace(this.selectedPlaceId); // Refresh BTN state
        }
    }

    handlePointerDown(e) {
        if (!window.db.isEditMode) return;

        const target = e.target;
        if (target.classList.contains('map-node')) {
            const nodeId = target.id.replace('node-', '');

            if (window.currentTool === 'move_point') {
                e.stopPropagation();
                this.draggingNodeId = nodeId;
            } else if (window.currentTool === 'split_segment') {
                e.stopPropagation();
                this.handleSplitSelection(nodeId, target);
            } else if (window.currentTool === 'delete_point') {
                e.stopPropagation();
                this.handleDeletePoint(nodeId);
            }
        }
        else if (target.classList.contains('map-edge')) {
            if (window.currentTool === 'subdivide_segment') {
                e.stopPropagation();
                const edgeId = target.id.replace('edge-', '');
                this.handleSubdivide(edgeId);
            }
        }
    }

    handlePointerMove(e) {
        if (this.draggingNodeId && window.currentTool === 'move_point') {
            const svg = document.getElementById('map-svg');
            let pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            let svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

            window.mapGraph.updateNodePosition(this.draggingNodeId, svgP.x, svgP.y);
            window.mapRenderer.render();
        }
    }

    handlePointerUp(e) {
        if (this.draggingNodeId) {
            this.draggingNodeId = null;
            this.saveCurrentMap();
        }
    }

    handleSubdivide(edgeId) {
        window.mapGraph.subdivideEdge(edgeId);
        window.mapRenderer.render();
        this.saveCurrentMap();
    }

    handleSplitSelection(nodeId, circleElement) {
        if (!this.selectedNodeId) {
            this.selectedNodeId = nodeId;
            circleElement.classList.add('selected');
        } else {
            const n1 = this.selectedNodeId;
            const n2 = nodeId;

            if (n1 !== n2) {
                const success = window.mapGraph.splitPolygonAtNodes(n1, n2);
                if (!success) {
                    window.mapGraph.addEdge(n1, n2);
                }
                window.mapRenderer.render();
                this.saveCurrentMap();
            }
            this.selectedNodeId = null;
        }
    }

    handleDeletePoint(nodeId) {
        if (window.mapGraph.unsubdivideNode(nodeId)) {
            window.mapRenderer.render();
            this.saveCurrentMap();
        }
    }

    async saveCurrentMap() {
        if (!window.db.isEditMode) return;
        const currentId = window.location.hash.split(':')[1] || 'map_teria';
        await window.db.saveEntity('maps', currentId, window.mapGraph.export());
    }

    exportSVG() {
        const svgElement = document.getElementById('map-svg');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "map_export.svg";
        link.click();
    }

    async exportPNG() {
        alert("PNG export requires full canvas integration, SVG export used currently.");
    }
}
window.mapTools = new MapTools();
