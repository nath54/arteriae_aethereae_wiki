/**
 * Relationship Graph Module — Arteriae Aethereae Wiki
 *
 * Renders a canvas-based force-directed graph showing connections between characters.
 * No external libraries required — uses vanilla canvas 2D API.
 *
 * Public API:
 *   window.renderGraphPage(container)  — renders the full graph tab into a container element
 *   window.ForceGraph                  — the graph engine class (for direct use)
 *
 * Graph data is read from window.db.manifest.characters, using each character's
 * `linked_characters` array (list of character IDs they're connected to).
 */
(function () {

    // ─── Constants ─────────────────────────────────────────────────────────────
    const NODE_RADIUS = 28;
    const SPRING_K = 0.02;   // Spring stiffness
    const REPEL_K = 8000;   // Repulsion constant
    const DAMPING = 0.85;   // Velocity damping
    const EDGE_COLOR = 'rgba(0, 255, 255, 0.25)';
    const NODE_COLOR = 'rgba(20, 16, 50, 0.9)';
    const NODE_BORDER = 'rgba(155, 89, 255, 0.7)';
    const TEXT_COLOR = 'rgba(224, 224, 224, 0.95)';
    const SELECT_COLOR = 'rgba(0, 255, 255, 0.9)';
    const REST_LENGTH = 140;    // Ideal edge length

    // ─── ForceGraph class ─────────────────────────────────────────────────────

    class ForceGraph {
        /**
         * @param {HTMLCanvasElement} canvas
         * @param {{ id: string, name: string, links: string[] }[]} nodes
         */
        constructor(canvas, nodes) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.nodes = nodes;
            this.edges = [];
            this.animFrame = null;
            this.dragging = null;   // Node being dragged
            this.hovering = null;   // Node under pointer
            this.onSelect = null;   // Callback(nodeId) when a node is clicked
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            this._panning = false;
            this._panStart = { x: 0, y: 0 };

            this._buildEdges();
            this._scatterNodes();
            this._bindEvents();
        }

        /** Build deduplicated edge list from node link arrays */
        _buildEdges() {
            const seen = new Set();
            this.nodes.forEach(n => {
                (n.links || []).forEach(targetId => {
                    const key = [n.id, targetId].sort().join('|');
                    if (!seen.has(key)) {
                        seen.add(key);
                        this.edges.push({ a: n.id, b: targetId });
                    }
                });
            });
        }

        /** Initial random scatter within the canvas */
        _scatterNodes() {
            const W = this.canvas.width;
            const H = this.canvas.height;
            this.nodes.forEach(n => {
                if (!n.x) {
                    n.x = W / 2 + (Math.random() - 0.5) * W * 0.6;
                    n.y = H / 2 + (Math.random() - 0.5) * H * 0.6;
                    n.vx = 0;
                    n.vy = 0;
                }
            });
        }

        /** Map node ID → node for fast lookup */
        _idx() {
            if (!this._nodeMap) {
                this._nodeMap = {};
                this.nodes.forEach(n => { this._nodeMap[n.id] = n; });
            }
            return this._nodeMap;
        }

        /** Single simulation tick */
        _tick() {
            const idx = this._idx();
            const nodes = this.nodes;
            const edges = this.edges;

            // Repulsion between all node pairs
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = nodes[i];
                    const b = nodes[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const d2 = dx * dx + dy * dy || 0.1;
                    const d = Math.sqrt(d2);
                    const f = REPEL_K / d2;
                    const fx = (dx / d) * f;
                    const fy = (dy / d) * f;
                    a.vx -= fx; a.vy -= fy;
                    b.vx += fx; b.vy += fy;
                }
            }

            // Spring attraction along edges
            edges.forEach(e => {
                const a = idx[e.a];
                const b = idx[e.b];
                if (!a || !b) return;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
                const f = SPRING_K * (d - REST_LENGTH);
                const fx = (dx / d) * f;
                const fy = (dy / d) * f;
                a.vx += fx; a.vy += fy;
                b.vx -= fx; b.vy -= fy;
            });

            // Center gravity (gentle pull toward canvas center)
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            nodes.forEach(n => {
                n.vx += (cx - n.x) * 0.002;
                n.vy += (cy - n.y) * 0.002;
            });

            // Integrate + damp
            nodes.forEach(n => {
                if (n === this.dragging) return;
                n.vx *= DAMPING;
                n.vy *= DAMPING;
                n.x += n.vx;
                n.y += n.vy;
            });
        }

        /** Draw one frame */
        _draw() {
            const ctx = this.ctx;
            const W = this.canvas.width;
            const H = this.canvas.height;
            const idx = this._idx();

            ctx.clearRect(0, 0, W, H);
            ctx.save();
            ctx.translate(this.panX, this.panY);
            ctx.scale(this.zoom, this.zoom);

            // Edges
            ctx.strokeStyle = EDGE_COLOR;
            ctx.lineWidth = 1.5;
            this.edges.forEach(e => {
                const a = idx[e.a];
                const b = idx[e.b];
                if (!a || !b) return;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });

            // Nodes
            this.nodes.forEach(n => {
                const isHover = n === this.hovering;
                const isSelected = n === this._selected;
                const r = NODE_RADIUS;

                // Shadow
                ctx.shadowBlur = isHover || isSelected ? 20 : 8;
                ctx.shadowColor = isSelected ? SELECT_COLOR : 'rgba(155, 89, 255, 0.5)';

                // Circle
                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
                ctx.fillStyle = NODE_COLOR;
                ctx.fill();
                ctx.strokeStyle = isSelected ? SELECT_COLOR : NODE_BORDER;
                ctx.lineWidth = isSelected ? 2.5 : 1.5;
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Icon or initial
                if (n.icon) {
                    ctx.drawImage(n._img, n.x - r, n.y - r, r * 2, r * 2);
                } else {
                    ctx.fillStyle = TEXT_COLOR;
                    ctx.font = `bold ${Math.round(r * 0.65)}px Gothica, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText((n.name || '?')[0].toUpperCase(), n.x, n.y);
                }

                // Label below
                ctx.fillStyle = isHover ? 'rgba(0,255,255,0.9)' : TEXT_COLOR;
                ctx.font = `${14}px Gothica, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(n.name, n.x, n.y + r + 4);
            });

            ctx.restore();
        }

        /** Main animation loop */
        _loop() {
            this._tick();
            this._draw();
            this.animFrame = requestAnimationFrame(() => this._loop());
        }

        start() { if (!this.animFrame) this._loop(); }
        stop() { cancelAnimationFrame(this.animFrame); this.animFrame = null; }

        /** Resize canvas to fill its parent */
        resize() {
            const wrap = this.canvas.parentElement;
            this.canvas.width = wrap.clientWidth || 800;
            this.canvas.height = wrap.clientHeight || 600;
        }

        // ── Mouse/Touch interactions ──────────────────────────────────────────

        _toGraph(x, y) {
            return {
                x: (x - this.panX) / this.zoom,
                y: (y - this.panY) / this.zoom,
            };
        }

        _nodeAt(x, y) {
            const { x: gx, y: gy } = this._toGraph(x, y);
            return this.nodes.find(n => {
                const dx = n.x - gx;
                const dy = n.y - gy;
                return Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS;
            }) || null;
        }

        _bindEvents() {
            const el = this.canvas;
            let isPanning = false;
            let panStartX = 0, panStartY = 0;
            let panOriginX = 0, panOriginY = 0;

            el.addEventListener('mousedown', e => {
                const n = this._nodeAt(e.offsetX, e.offsetY);
                if (n) {
                    this.dragging = n;
                } else {
                    isPanning = true;
                    panStartX = e.offsetX;
                    panStartY = e.offsetY;
                    panOriginX = this.panX;
                    panOriginY = this.panY;
                }
            });

            el.addEventListener('mousemove', e => {
                if (this.dragging) {
                    const g = this._toGraph(e.offsetX, e.offsetY);
                    this.dragging.x = g.x;
                    this.dragging.y = g.y;
                    this.dragging.vx = 0;
                    this.dragging.vy = 0;
                } else if (isPanning) {
                    this.panX = panOriginX + (e.offsetX - panStartX);
                    this.panY = panOriginY + (e.offsetY - panStartY);
                } else {
                    this.hovering = this._nodeAt(e.offsetX, e.offsetY);
                    el.style.cursor = this.hovering ? 'pointer' : 'grab';
                }
            });

            el.addEventListener('mouseup', e => {
                if (this.dragging) {
                    // Click (not drag) = select
                    const g = this._toGraph(e.offsetX, e.offsetY);
                    const dx = g.x - this.dragging.x;
                    const dy = g.y - this.dragging.y;
                    if (Math.sqrt(dx * dx + dy * dy) < 5) {
                        this._selected = this.dragging;
                        if (this.onSelect) this.onSelect(this.dragging.id);
                    }
                    this.dragging = null;
                }
                isPanning = false;
            });

            el.addEventListener('mouseleave', () => {
                this.dragging = null;
                isPanning = false;
                this.hovering = null;
            });

            // Zoom with wheel
            el.addEventListener('wheel', e => {
                e.preventDefault();
                const factor = e.deltaY > 0 ? 0.9 : 1.1;
                this.zoom = Math.max(0.2, Math.min(3, this.zoom * factor));
            }, { passive: false });
        }
    }

    // ─── Build graph data from manifest ───────────────────────────────────────

    function buildGraphFromManifest() {
        const characters = window.db?.manifest?.characters ?? {};
        return Object.entries(characters).map(([id, c]) => ({
            id,
            name: c.name || id,
            links: c.linked_characters || [],
            icon: c.icon || null,
        }));
    }

    // ─── Render the full graph page ────────────────────────────────────────────

    /**
     * Renders the relationship graph into `container`.
     * Called by page_characters.js when the Relationships tab is clicked.
     *
     * @param {HTMLElement} container
     */
    function renderGraphPage(container) {
        const nodes = buildGraphFromManifest();

        container.innerHTML = `
            <div class="graph-canvas-wrap" id="graph-wrap">
                <canvas id="graph-canvas"></canvas>
                <div class="graph-controls">
                    <button class="tool-btn" id="btn-graph-reset" title="Reset View">🎯 Reset</button>
                    <button class="tool-btn" id="btn-graph-center" title="Center">⊙ Center</button>
                </div>
                <div class="graph-tooltip" id="graph-tooltip"></div>
            </div>
            <div id="graph-char-preview" style="
                max-width:260px; padding:16px; flex-shrink:0;
                border-left:1px solid var(--glass-border);">
                <p class="placeholder-text" style="padding:16px;text-align:center;">
                    Click a node to preview the character.
                </p>
            </div>`;

        container.style.display = 'flex';
        container.style.height = '600px';
        container.style.gap = '0';

        const wrap = container.querySelector('#graph-wrap');
        const canvas = container.querySelector('#graph-canvas');
        const tooltip = container.querySelector('#graph-tooltip');
        const preview = container.querySelector('#graph-char-preview');

        if (nodes.length === 0) {
            wrap.innerHTML = `<p class="placeholder-text" style="padding:40px;text-align:center;">
                No characters with relationships yet.<br>
                Add <em>linked_characters</em> in character editor to create connections.
            </p>`;
            return;
        }

        canvas.width = wrap.clientWidth || 700;
        canvas.height = wrap.clientHeight || 600;

        const graph = new ForceGraph(canvas, nodes);

        graph.onSelect = (id) => {
            const c = window.db.manifest.characters[id];
            if (!c) return;
            preview.innerHTML = `
                <h3 style="font-family:'Balgruf',serif;color:var(--aether-cyan);margin:0 0 10px;">
                    ${c.name || id}
                </h3>
                ${c.icon ? `<img src="${c.icon}" alt="" style="width:80px;height:80px;object-fit:cover;border-radius:50%;margin-bottom:10px;">` : ''}
                <p style="font-size:0.9rem;color:var(--text-dim);">
                    <b>Links:</b> ${(c.linked_characters || []).length} character(s)
                </p>
                <button class="tool-btn" style="margin-top:12px;width:100%;"
                    onclick="window.location.hash='#characters'; setTimeout(()=>window.requestCharacterFocus && window.requestCharacterFocus('${id}'),300);">
                    👤 Open Character
                </button>`;
        };

        // Tooltip on hover
        canvas.addEventListener('mousemove', e => {
            const n = graph.hovering;
            if (n) {
                tooltip.textContent = n.name;
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.offsetX + 16}px`;
                tooltip.style.top = `${e.offsetY + 16}px`;
            } else {
                tooltip.style.display = 'none';
            }
        });

        // Control buttons
        container.querySelector('#btn-graph-reset').addEventListener('click', () => {
            graph.zoom = 1; graph.panX = 0; graph.panY = 0;
        });
        container.querySelector('#btn-graph-center').addEventListener('click', () => {
            if (nodes.length === 0) return;
            const avgX = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
            const avgY = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
            graph.panX = canvas.width / 2 - avgX * graph.zoom;
            graph.panY = canvas.height / 2 - avgY * graph.zoom;
        });

        // Resize on container size change
        const ro = new ResizeObserver(() => { graph.resize(); });
        ro.observe(wrap);

        graph.start();

        // Clean up when leaving the page
        const cleanup = () => { graph.stop(); ro.disconnect(); };
        window.addEventListener('pagechange', cleanup, { once: true });
    }

    // ─── Expose globally ──────────────────────────────────────────────────────
    window.ForceGraph = ForceGraph;
    window.renderGraphPage = renderGraphPage;

})();
