/**
 * MapTools Class
 * Manages the state and user interactions of the interactive map editor tools
 * (view, move point, subdivide edge, split polygon, assign regions, etc.).
 *
 * HOOK POINT (New Editor Tools): If you add a new tool button in `index.html`
 * (e.g., `data-tool="flood_fill"`), register it here and add logic in `handlePointerDown`.
 */
class MapTools {
    constructor() {
        window.currentTool = 'view';
        this.selectedNodeId = null;
        this.draggingNodeId = null;
        this.selectedPlaceId = null; // Used for sidebar place highlighting
        this.selectedPolyId = null;  // Currently selected polygon in view mode
        this.bound = false;
    }

    /**
     * Bind events when map editor is opened.
     * Can be called multiple times safely.
     */
    bindEvents() {
        if (this.bound) return;
        this.bound = true;

        const btns = document.querySelectorAll('.map-tools-grid .tool-btn[data-tool]');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active from *all* tool buttons
                document.querySelectorAll('.map-tools-grid .tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.currentTool = btn.dataset.tool;
                this.selectedNodeId = null;
                this.selectedPolyId = null;
                if (window.mapRenderer) {
                    window.mapRenderer.render();
                    window.mapRenderer.renderPolyActionBar();
                }
            });
        });

        const layerSelect = document.getElementById('map-layer-select');
        const gridVector = document.getElementById('tools-grid-vector');
        const gridGrid = document.getElementById('tools-grid-grid');
        const gridPoi = document.getElementById('tools-grid-poi');
        if (layerSelect && gridVector && gridGrid && gridPoi) {
            layerSelect.addEventListener('change', (e) => {
                const layerType = e.target.value;
                gridVector.style.display = 'none';
                gridGrid.style.display = 'none';
                gridPoi.style.display = 'none';

                if (layerType === 'geography') {
                    gridVector.style.display = 'grid';
                    window.currentTool = 'view';
                    document.querySelector('#tools-grid-vector .tool-btn[data-tool="view"]')?.click();
                } else if (layerType === 'biomes') {
                    gridGrid.style.display = 'grid';
                    window.currentTool = 'view';
                    document.querySelector('#tools-grid-grid .tool-btn[data-tool="view"]')?.click();
                } else if (layerType === 'cities') {
                    gridPoi.style.display = 'grid';
                    window.currentTool = 'view';
                    document.querySelector('#tools-grid-poi .tool-btn[data-tool="view"]')?.click();
                }
            });
        }

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

        // Help menu toggle
        const helpBtn = document.getElementById('btn-map-help');
        const exitHelpBtn = document.getElementById('btn-exit-help');
        const mainSidebar = document.getElementById('map-sidebar-main');
        const helpSidebar = document.getElementById('map-sidebar-help');
        if (helpBtn && exitHelpBtn && mainSidebar && helpSidebar) {
            helpBtn.addEventListener('click', () => {
                mainSidebar.style.display = 'none';
                helpSidebar.style.display = 'flex';
            });
            exitHelpBtn.addEventListener('click', () => {
                helpSidebar.style.display = 'none';
                mainSidebar.style.display = 'block';
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
            document.querySelectorAll('.map-tools-grid .tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
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

        // Handle Grid Painting Layer
        const activeLayerSelect = document.getElementById('map-layer-select');
        if (activeLayerSelect && activeLayerSelect.value === 'biomes' && window.currentTool === 'paint_biome') {
            this.isPainting = true;
            this.paintGridCell(e.clientX, e.clientY);
            return;
        }

        // Handle POI City Placing
        if (activeLayerSelect && activeLayerSelect.value === 'cities' && window.currentTool === 'place_city') {
            const svg = document.getElementById('map-svg');
            let pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            let svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            this.placeCity(svgP.x, svgP.y);
            return;
        }

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
            const edgeId = target.id.replace('edge-', '');
            if (window.currentTool === 'subdivide_segment') {
                e.stopPropagation();
                this.handleSubdivide(edgeId);
            } else if (window.currentTool === 'unsplit_segment') {
                e.stopPropagation();
                this.handleJoinAtEdge(edgeId);
            }
        }
    }

    /**
     * Checks if a given SVG coordinate is within the permitted boundaries of the current map.
     * Uses the `clip-path` defined in renderer.js for parent bounds constraint.
     */
    isPointWithinBoundaries(svgX, svgY) {
        if (!window.mapRenderer || !window.mapRenderer.hasClipPath) return true;

        const clipPathNode = document.getElementById('boundary-clip');
        if (!clipPathNode) return true;

        const paths = clipPathNode.querySelectorAll('path');
        if (paths.length === 0) return true;

        const svg = document.getElementById('map-svg');
        const pt = svg.createSVGPoint();
        pt.x = svgX;
        pt.y = svgY;

        for (const p of paths) {
            if (p.isPointInFill(pt)) return true;
        }

        return false;
    }

    handlePointerMove(e) {
        if (this.draggingNodeId && window.currentTool === 'move_point') {
            // Check if node is locked (cannot be moved)
            const node = window.mapGraph.nodes[this.draggingNodeId];
            if (node && node.locked) return; // Ignore drag entirely

            const svg = document.getElementById('map-svg');
            let pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            let svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

            // Check if new position violates parent boundaries
            if (this.isPointWithinBoundaries(svgP.x, svgP.y)) {
                window.mapGraph.updateNodePosition(this.draggingNodeId, svgP.x, svgP.y);
                window.mapRenderer.render();
            }
        } else if (this.isPainting && window.currentTool === 'paint_biome') {
            this.paintGridCell(e.clientX, e.clientY);
        }
    }

    handlePointerUp(e) {
        if (this.draggingNodeId) {
            this.draggingNodeId = null;
            this.saveCurrentMap();
        }
        if (this.isPainting) {
            this.isPainting = false;
            this.saveCurrentMap();
        }
    }

    paintGridCell(clientX, clientY) {
        const svg = document.getElementById('map-svg');
        const brushSelect = document.getElementById('biome-brush-select');
        if (!svg || !brushSelect) return;

        let pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        let svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

        if (!this.isPointWithinBoundaries(svgP.x, svgP.y)) return;

        const biome = brushSelect.value;
        const res = 50; // Grid resolution
        const gridX = Math.floor(svgP.x / res);
        const gridY = Math.floor(svgP.y / res);
        const coordKey = `${gridX},${gridY}`;

        if (!window.mapGraph.layers) window.mapGraph.layers = {};
        if (!window.mapGraph.layers['biomes']) {
            window.mapGraph.layers['biomes'] = {
                type: 'grid',
                resolution: res,
                data: {}
            };
        }

        const layer = window.mapGraph.layers['biomes'];
        // Brush size: 3x3
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const tx = gridX + dx;
                const ty = gridY + dy;
                // Simple circular brush check
                if (dx * dx + dy * dy <= 2) {
                    const tk = `${tx},${ty}`;
                    const targetX = tx * res + res / 2;
                    const targetY = ty * res + res / 2;
                    // Only paint cells that visually fall inside the map constraints
                    if (this.isPointWithinBoundaries(targetX, targetY)) {
                        layer.data[tk] = biome;
                    }
                }
            }
        }

        window.mapRenderer.render();
    }

    placeCity(svgX, svgY) {
        if (!this.isPointWithinBoundaries(svgX, svgY)) {
            alert("Cannot place city outside map boundaries.");
            return;
        }

        const name = prompt("Enter city name:");
        if (!name) return;

        const importanceInput = document.getElementById('poi-importance');
        const importance = importanceInput ? parseInt(importanceInput.value) : 5;

        if (!window.mapGraph.layers) window.mapGraph.layers = {};
        if (!window.mapGraph.layers['cities']) {
            window.mapGraph.layers['cities'] = {
                type: 'poi',
                entities: {}
            };
        }

        const newId = 'city_' + Date.now();
        window.mapGraph.layers['cities'].entities[newId] = {
            name: name,
            x: svgX,
            y: svgY,
            importance: importance
        };

        window.mapRenderer.render();
        this.saveCurrentMap();
    }

    handleSubdivide(edgeId) {
        // Subdivide creates a new point exactly halfway between n1 and n2
        const edge = window.mapGraph.edges[edgeId];
        if (!edge) return;
        const n1 = window.mapGraph.nodes[edge.n1];
        const n2 = window.mapGraph.nodes[edge.n2];
        const midX = (n1.x + n2.x) / 2;
        const midY = (n1.y + n2.y) / 2;

        if (this.isPointWithinBoundaries(midX, midY)) {
            window.mapGraph.subdivideEdge(edgeId);
            window.mapRenderer.render();
            this.saveCurrentMap();
        } else {
            alert('Cannot subdivide here: the new point would fall outside the regional boundaries.');
        }
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

    handleJoinAtEdge(edgeId) {
        const result = window.mapGraph.joinPolygonsAtEdge(edgeId);
        if (result.ok) {
            window.mapRenderer.render();
            this.saveCurrentMap();
        } else {
            alert(result.reason);
        }
    }

    async saveCurrentMap() {
        if (!window.db.isEditMode) return;
        const currentId = window.currentMapId;
        if (!currentId) {
            console.warn('[MapTools] No currentMapId set, cannot save.');
            return;
        }
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
        const svgElement = document.getElementById('map-svg');
        if (!svgElement) return;

        // Serialize SVG to string
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);

        // Create an Image element to load the SVG
        const img = new Image();
        img.onload = () => {
            // Create a canvas with the same dimensions as the SVG
            const canvas = document.createElement('canvas');
            const rect = svgElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            const ctx = canvas.getContext('2d');

            // Draw a white background (SVG background is usually transparent)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the SVG image
            ctx.drawImage(img, 0, 0, rect.width, rect.height);

            // Convert canvas to PNG data URL
            const pngUrl = canvas.toDataURL("image/png");

            // Trigger download
            const link = document.createElement("a");
            link.href = pngUrl;
            link.download = "map_export.png";
            link.click();

            // Cleanup
            URL.revokeObjectURL(svgUrl);
        };
        img.src = svgUrl;
    }
}
window.mapTools = new MapTools();
