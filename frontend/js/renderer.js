/**
 * MapRenderer Class
 * Responsible for drawing the interactive SVG map in the editor.
 * Handles pan/zoom mechanics and SVG DOM element construction based on the `MapGraph`.
 *
 * HOOK POINT (Custom Drawing): If you need to render new layers (e.g., Points of Interest,
 * player avatars, or animated weather effects), add the rendering logic to the `render()` method below.
 */
class MapRenderer {
    constructor() {
        this.svg = document.getElementById('map-svg');
        this.layerRegions = document.getElementById('layer-regions');
        this.layerBorders = document.getElementById('layer-borders');

        this.viewBox = { x: 0, y: 0, w: 1000, h: 1000 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };

        this.setupPanZoom();
    }

    setupPanZoom() {
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();

            const pt = this.svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());

            const scale = e.deltaY > 0 ? 1.1 : 0.9;

            this.viewBox.x = svgP.x - (svgP.x - this.viewBox.x) * scale;
            this.viewBox.y = svgP.y - (svgP.y - this.viewBox.y) * scale;
            this.viewBox.w *= scale;
            this.viewBox.h *= scale;

            this.updateViewBox();
        });

        this.svg.addEventListener('pointerdown', (e) => {
            if (e.button === 0 && window.currentTool !== 'view') return;
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            const dx = (e.clientX - this.dragStart.x) * (this.viewBox.w / this.svg.clientWidth);
            const dy = (e.clientY - this.dragStart.y) * (this.viewBox.h / this.svg.clientHeight);
            this.viewBox.x -= dx;
            this.viewBox.y -= dy;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.updateViewBox();
        });

        window.addEventListener('pointerup', () => {
            this.isDragging = false;
        });
    }

    updateViewBox() {
        this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
    }

    render() {
        if (!window.mapGraph) return;
        const g = window.mapGraph;

        this.layerRegions.innerHTML = '';
        this.layerBorders.innerHTML = '';

        // Render Polygons
        for (const [id, poly] of Object.entries(g.polygons)) {
            let pathD = this.buildPolygonPath(poly.edges, g);

            const pathNode = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathNode.setAttribute('d', pathD);
            pathNode.setAttribute('fill', poly.color || '#4A6B5C');
            pathNode.setAttribute('id', `poly-${id}`);
            pathNode.classList.add('map-polygon');

            if (window.db.isEditMode) pathNode.classList.add('interactive');

            // Highlight if linked to the actively selected subplace
            if (window.mapTools && window.mapTools.selectedPlaceId === poly.link) {
                pathNode.setAttribute('fill', '#00ffff');
                pathNode.setAttribute('stroke', '#ffffff');
                pathNode.setAttribute('stroke-width', '4');
            }

            // Highlight if this polygon is selected
            if (window.mapTools && window.mapTools.selectedPolyId === id) {
                pathNode.setAttribute('stroke', '#ffdd00');
                pathNode.setAttribute('stroke-width', '4');
                pathNode.style.filter = 'url(#glow)';
            }

            pathNode.addEventListener('click', async () => {
                if (window.currentTool === 'assign_region') {
                    const tools = window.mapTools;

                    if (tools && tools.selectedPlaceId) {
                        // Quick assign mode: selected subplace -> clicked polygon
                        poly.link = tools.selectedPlaceId;
                        await tools.saveCurrentMap();
                        this.render();
                    } else {
                        // Manual prompted mode
                        const placeId = prompt('Enter the Place ID to assign to this region (e.g., bruine):', poly.link || '');
                        if (placeId !== null) {
                            const manifest = window.db.manifest;
                            if (placeId && (!manifest.places || !manifest.places[placeId])) {
                                alert(`Warning: Place ID '${placeId}' does not exist in the manifest. You might need to create it first.`);
                            }
                            poly.link = placeId;
                            if (tools) await tools.saveCurrentMap();
                            this.render();
                        }
                    }
                } else if (window.currentTool === 'unassign_region') {
                    // Unassign by clicking a polygon directly
                    if (poly.link) {
                        delete poly.link;
                        const tools = window.mapTools;
                        if (tools) await tools.saveCurrentMap();
                        this.render();
                    }
                } else if (window.currentTool === 'view') {
                    // ── Polygon selection system ──
                    const tools = window.mapTools;
                    if (tools) {
                        if (tools.selectedPolyId === id) {
                            // Deselect on re-click
                            tools.selectedPolyId = null;
                        } else {
                            tools.selectedPolyId = id;
                        }
                        this.render();
                        this.renderPolyActionBar();
                    }
                }
            });

            this.layerRegions.appendChild(pathNode);
        }

        // Render Edges
        for (const [id, edge] of Object.entries(g.edges)) {
            const n1 = g.nodes[edge.n1];
            const n2 = g.nodes[edge.n2];
            if (!n1 || !n2) continue;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', n1.x);
            line.setAttribute('y1', n1.y);
            line.setAttribute('x2', n2.x);
            line.setAttribute('y2', n2.y);
            line.setAttribute('id', `edge-${id}`);
            line.classList.add('map-edge');

            if (window.db.isEditMode) {
                // Event delegation is handled in tools.js handlePointerDown
            }

            this.layerBorders.appendChild(line);
        }

        // Render Nodes
        if (window.db.isEditMode) {
            for (const [id, node] of Object.entries(g.nodes)) {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', node.x);
                circle.setAttribute('cy', node.y);
                circle.setAttribute('r', 4);
                circle.setAttribute('id', `node-${id}`);
                circle.classList.add('map-node');

                if (window.mapTools && window.mapTools.selectedNodeId === id) {
                    circle.classList.add('selected');
                }

                // Event delegation handled in tools.js
                this.layerBorders.appendChild(circle);
            }
        }
    }

    /**
     * Renders (or removes) the floating polygon action bar at the bottom of the map.
     */
    renderPolyActionBar() {
        // Remove existing bar
        let bar = document.getElementById('poly-action-bar');
        if (bar) bar.remove();

        const tools = window.mapTools;
        if (!tools || !tools.selectedPolyId) return;

        const g = window.mapGraph;
        const poly = g.polygons[tools.selectedPolyId];
        if (!poly) {
            tools.selectedPolyId = null;
            return;
        }

        const linkedPlaceId = poly.link || null;
        const polyName = poly.name || tools.selectedPolyId;

        // Build action bar
        bar = document.createElement('div');
        bar.id = 'poly-action-bar';
        bar.innerHTML = `
            <span class="poly-action-label">📍 <strong>${polyName}</strong></span>
            ${linkedPlaceId
                ? `<button class="tool-btn" id="poly-btn-goto-place">🏠 Go to place page</button>
                   <button class="tool-btn" id="poly-btn-zoom">🔎 Zoom into sub-map</button>`
                : `<span style="color:var(--text-dim);font-size:0.9rem;">No place assigned</span>`
            }
            <button class="tool-btn btn-muted" id="poly-btn-deselect">✖</button>
        `;

        document.getElementById('map-editor-main').appendChild(bar);

        // ── Wire action buttons ──
        const deselectBtn = document.getElementById('poly-btn-deselect');
        if (deselectBtn) {
            deselectBtn.addEventListener('click', () => {
                tools.selectedPolyId = null;
                this.render();
                this.renderPolyActionBar();
            });
        }

        if (linkedPlaceId) {
            const gotoBtn = document.getElementById('poly-btn-goto-place');
            if (gotoBtn) {
                gotoBtn.addEventListener('click', () => {
                    // Close map editor and navigate to place
                    document.getElementById('map-editor-overlay').classList.add('hidden');
                    tools.selectedPolyId = null;
                    window.location.hash = `#places`;
                    // Dispatch pagechange with the place id
                    window.dispatchEvent(new CustomEvent('pagechange', {
                        detail: { page: 'places', id: linkedPlaceId }
                    }));
                });
            }

            const zoomBtn = document.getElementById('poly-btn-zoom');
            if (zoomBtn) {
                zoomBtn.addEventListener('click', async () => {
                    // Check if sub-map exists
                    const subMapData = await window.db.getEntity('maps', linkedPlaceId);
                    if (subMapData) {
                        tools.selectedPolyId = null;
                        tools.selectPlace(null);
                        await window.loadMap(linkedPlaceId);
                        // Update title
                        const titleEl = document.getElementById('map-editor-title');
                        if (titleEl) {
                            const manifest = window.db.manifest;
                            const placeName = manifest?.places?.[linkedPlaceId]?.name || linkedPlaceId;
                            titleEl.textContent = `Map Editor — ${placeName}`;
                        }
                        this.renderPolyActionBar();
                    } else {
                        alert(`No sub-map exists for "${linkedPlaceId}". Create a map from the place page first.`);
                    }
                });
            }
        }
    }

    buildPolygonPath(edgeIds, g) {
        if (!edgeIds || edgeIds.length === 0) return '';
        let d = '';
        let currentNodeStr = null;

        for (let i = 0; i < edgeIds.length; i++) {
            const edge = g.edges[edgeIds[i]];
            if (!edge) continue;

            if (i === 0) {
                // Determine correct winding direction for first edge
                if (edgeIds.length > 1) {
                    const nextEdge = g.edges[edgeIds[1]];
                    if (nextEdge && (edge.n2 === nextEdge.n1 || edge.n2 === nextEdge.n2)) {
                        // n1 → n2 is correct (n2 connects to next edge)
                        d += `M ${g.nodes[edge.n1].x} ${g.nodes[edge.n1].y} L ${g.nodes[edge.n2].x} ${g.nodes[edge.n2].y}`;
                        currentNodeStr = edge.n2;
                    } else {
                        // n2 → n1 (reversed: n1 connects to next edge)
                        d += `M ${g.nodes[edge.n2].x} ${g.nodes[edge.n2].y} L ${g.nodes[edge.n1].x} ${g.nodes[edge.n1].y}`;
                        currentNodeStr = edge.n1;
                    }
                } else {
                    d += `M ${g.nodes[edge.n1].x} ${g.nodes[edge.n1].y} L ${g.nodes[edge.n2].x} ${g.nodes[edge.n2].y}`;
                    currentNodeStr = edge.n2;
                }
            } else {
                if (edge.n1 === currentNodeStr) {
                    d += ` L ${g.nodes[edge.n2].x} ${g.nodes[edge.n2].y}`;
                    currentNodeStr = edge.n2;
                } else if (edge.n2 === currentNodeStr) {
                    d += ` L ${g.nodes[edge.n1].x} ${g.nodes[edge.n1].y}`;
                    currentNodeStr = edge.n1;
                } else {
                    d += ` M ${g.nodes[edge.n1].x} ${g.nodes[edge.n1].y} L ${g.nodes[edge.n2].x} ${g.nodes[edge.n2].y}`;
                    currentNodeStr = null;
                }
            }
        }
        d += ' Z';
        return d;
    }
}

window.loadMap = async function (mapId) {
    // Store the current map ID for saveCurrentMap() to use
    window.currentMapId = mapId;

    const data = await window.db.getEntity('maps', mapId);
    if (!data) {
        window.mapGraph.load({
            nodes: {
                n1: { x: 0, y: 0, locked: [0, 0] },
                n2: { x: 1000, y: 0, locked: [1000, 0] },
                n3: { x: 1000, y: 1000, locked: [1000, 1000] },
                n4: { x: 0, y: 1000, locked: [0, 1000] }
            },
            edges: {
                e1: { n1: 'n1', n2: 'n2' },
                e2: { n1: 'n2', n2: 'n3' },
                e3: { n1: 'n3', n2: 'n4' },
                e4: { n1: 'n4', n2: 'n1' }
            },
            polygons: {
                poly1: { name: 'World', edges: ['e1', 'e2', 'e3', 'e4'], color: 'rgba(0,0,0,0.1)' }
            }
        });
    } else {
        window.mapGraph.load(data);
    }

    if (!window.mapRenderer) {
        window.mapRenderer = new MapRenderer();
    }
    window.mapRenderer.updateViewBox();
    window.mapRenderer.render();
};
