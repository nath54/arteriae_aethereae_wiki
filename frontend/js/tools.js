class MapTools {
    constructor() {
        window.currentTool = 'view';
        this.selectedNodeId = null;
        this.draggingNodeId = null;

        // Wait for DOM to load tool buttons
        document.addEventListener('DOMContentLoaded', () => {
            this.bindEvents();
        });
    }

    bindEvents() {
        const btns = document.querySelectorAll('.tool-btn[data-tool]');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.currentTool = btn.dataset.tool;
                this.selectedNodeId = null; // reset state

                // Rerender to clear visual selections if any
                if (window.mapRenderer) window.mapRenderer.render();
            });
        });

        // Setup exports
        const exportSvg = document.getElementById('btn-export-svg');
        if (exportSvg) exportSvg.addEventListener('click', () => this.exportSVG());

        const exportPng = document.getElementById('btn-export-png');
        if (exportPng) exportPng.addEventListener('click', () => this.exportPNG());

        const svg = document.getElementById('map-svg');
        svg.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        window.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
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
