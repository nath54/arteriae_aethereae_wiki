/**
 * MapGraph Class
 * Represents the mathematical map data structure (nodes, edges, regions, and layers).
 * Handles graph manipulation logic independent of its visual representation.
 *
 * HOOK POINT (Topology data): If you add specialized properties to nodes/edges
 * (e.g. edge traversal costs, node elevation), store them inside these data structures.
 */
class MapGraph {
    constructor() {
        this.nodes = {};
        this.edges = {};
        this.polygons = {};
        this.layers = {}; // additional layers like POIs, roads

        this.nextNodeId = 1;
        this.nextEdgeId = 1;
    }

    load(data) {
        if (!data) return;
        this.nodes = data.nodes || {};
        this.edges = data.edges || {};
        this.polygons = data.polygons || {};
        this.layers = data.layers || {};

        // Find max IDs to continue incrementing cleanly
        const nIds = Object.keys(this.nodes).map(id => parseInt(id.replace('n', ''))).filter(n => !isNaN(n));
        if (nIds.length > 0) this.nextNodeId = Math.max(...nIds) + 1;

        const eIds = Object.keys(this.edges).map(id => parseInt(id.replace('e', ''))).filter(n => !isNaN(n));
        if (eIds.length > 0) this.nextEdgeId = Math.max(...eIds) + 1;
    }

    export() {
        return {
            nodes: this.nodes,
            edges: this.edges,
            polygons: this.polygons,
            layers: this.layers
        };
    }

    addNode(x, y, locked = null) {
        const id = 'n' + this.nextNodeId++;
        this.nodes[id] = { x, y, locked };
        return id;
    }

    addEdge(n1, n2) {
        const id = 'e' + this.nextEdgeId++;
        this.edges[id] = { n1, n2 };
        return id;
    }

    updateNodePosition(id, x, y) {
        if (!this.nodes[id]) return false;

        const locked = this.nodes[id].locked;
        if (locked) {
            const [xConst, yConst] = locked;

            if (xConst !== null && xConst !== undefined) {
                if (Array.isArray(xConst)) {
                    x = Math.max(xConst[0], Math.min(xConst[1], x));
                } else {
                    x = xConst;
                }
            }

            if (yConst !== null && yConst !== undefined) {
                if (Array.isArray(yConst)) {
                    y = Math.max(yConst[0], Math.min(yConst[1], y));
                } else {
                    y = yConst;
                }
            }
        }

        this.nodes[id].x = x;
        this.nodes[id].y = y;
        return true;
    }

    mergeConstraint(c1, c2) {
        if (c1 === undefined || c1 === null || c2 === undefined || c2 === null) return null;

        const isNum1 = typeof c1 === 'number';
        const isNum2 = typeof c2 === 'number';

        if (isNum1 && isNum2 && c1 === c2) return c1;

        const min1 = isNum1 ? c1 : c1[0];
        const max1 = isNum1 ? c1 : c1[1];
        const min2 = isNum2 ? c2 : c2[0];
        const max2 = isNum2 ? c2 : c2[1];

        return [Math.min(min1, min2), Math.max(max1, max2)];
    }

    subdivideEdge(edgeId) {
        const edge = this.edges[edgeId];
        if (!edge) return null;

        const node1 = this.nodes[edge.n1];
        const node2 = this.nodes[edge.n2];

        // Midpoint
        const midX = (node1.x + node2.x) / 2;
        const midY = (node1.y + node2.y) / 2;

        let locked = null;
        if (node1.locked && node2.locked) {
            const xLock = this.mergeConstraint(node1.locked[0], node2.locked[0]);
            const yLock = this.mergeConstraint(node1.locked[1], node2.locked[1]);

            // If both constraints span a range, it implies an internal edge traversing open space.
            // Ergo, the subdivided point should be completely free.
            if (Array.isArray(xLock) && Array.isArray(yLock)) {
                locked = null;
            } else if (xLock !== null || yLock !== null) {
                locked = [xLock, yLock];
            }
        }

        const newNodeId = this.addNode(midX, midY, locked);

        // Remove old edge, create 2 new edges
        delete this.edges[edgeId];
        const newEdge1 = this.addEdge(edge.n1, newNodeId);
        const newEdge2 = this.addEdge(newNodeId, edge.n2);

        // Update all polygons using this edge
        for (const polyId in this.polygons) {
            const poly = this.polygons[polyId];
            const edgeIndex = poly.edges.indexOf(edgeId);
            if (edgeIndex !== -1) {
                // Must insert in same direction flow
                let e1 = newEdge1;
                let e2 = newEdge2;

                if (poly.edges.length > 1) {
                    const prevEdgeIndex = (edgeIndex - 1 + poly.edges.length) % poly.edges.length;
                    const prevEdge = this.edges[poly.edges[prevEdgeIndex]];
                    // If prevEdge connects to our old edge at n2, the polygon is traversing n2 -> n1.
                    // Since newEdge1 is (n1, M) and newEdge2 is (M, n2), tracing n2->n1 means we first cross newEdge2 then newEdge1.
                    if (prevEdge && (prevEdge.n1 === edge.n2 || prevEdge.n2 === edge.n2)) {
                        e1 = newEdge2;
                        e2 = newEdge1;
                    }
                }

                poly.edges.splice(edgeIndex, 1, e1, e2);
            }
        }
        return { newNodeId, edges: [newEdge1, newEdge2] };

    }

    unsubdivideNode(nodeId) {
        const connectedEdges = [];
        for (const [eId, edge] of Object.entries(this.edges)) {
            if (edge.n1 === nodeId || edge.n2 === nodeId) {
                connectedEdges.push(eId);
            }
        }

        if (connectedEdges.length === 2) {
            const e1Id = connectedEdges[0];
            const e2Id = connectedEdges[1];
            const e1 = this.edges[e1Id];
            const e2 = this.edges[e2Id];

            const neighborA = e1.n1 === nodeId ? e1.n2 : e1.n1;
            const neighborB = e2.n1 === nodeId ? e2.n2 : e2.n1;

            const newEdgeId = this.addEdge(neighborA, neighborB);

            for (const [polyId, poly] of Object.entries(this.polygons)) {
                let idx1 = poly.edges.indexOf(e1Id);
                let idx2 = poly.edges.indexOf(e2Id);
                if (idx1 !== -1 && idx2 !== -1) {
                    const minIdx = Math.min(idx1, idx2);
                    const maxIdx = Math.max(idx1, idx2);

                    if (minIdx === 0 && maxIdx === poly.edges.length - 1) {
                        poly.edges[0] = newEdgeId;
                        poly.edges.pop();
                    } else {
                        poly.edges.splice(minIdx, 2, newEdgeId);
                    }
                }
            }

            delete this.edges[e1Id];
            delete this.edges[e2Id];
            delete this.nodes[nodeId];
            return true;
        }
        return false;
    }

    getOrderedNodesForPolygon(polyId) {
        const poly = this.polygons[polyId];
        if (!poly || !poly.edges || poly.edges.length === 0) return { nodes: [], edges: [] };

        let nodes = [];
        let edges = poly.edges;

        for (let i = 0; i < edges.length; i++) {
            const edge = this.edges[edges[i]];
            if (!edge) continue;

            if (i === 0) {
                if (edges.length > 1) {
                    const nextEdge = this.edges[edges[1]];
                    if (nextEdge && (edge.n2 === nextEdge.n1 || edge.n2 === nextEdge.n2)) {
                        nodes.push(edge.n1);
                        nodes.push(edge.n2);
                    } else {
                        nodes.push(edge.n2);
                        nodes.push(edge.n1);
                    }
                } else {
                    nodes.push(edge.n1);
                    nodes.push(edge.n2);
                }
            } else {
                const prevNode = nodes[nodes.length - 1];
                if (edge.n1 === prevNode) {
                    nodes.push(edge.n2);
                } else if (edge.n2 === prevNode) {
                    nodes.push(edge.n1);
                } else {
                    if (!nodes.includes(edge.n1)) nodes.push(edge.n1);
                    if (!nodes.includes(edge.n2)) nodes.push(edge.n2);
                }
            }
        }

        if (nodes.length > 1 && nodes[0] === nodes[nodes.length - 1]) {
            nodes.pop();
        }

        return { nodes, edges };
    }

    splitPolygonAtNodes(node1Id, node2Id) {
        let targetPolyId = null;
        let pNodes = null;
        let pEdges = null;

        for (const [polyId, poly] of Object.entries(this.polygons)) {
            const result = this.getOrderedNodesForPolygon(polyId);
            const idx1 = result.nodes.indexOf(node1Id);
            const idx2 = result.nodes.indexOf(node2Id);

            if (idx1 !== -1 && idx2 !== -1 && idx1 !== idx2) {
                targetPolyId = polyId;
                pNodes = result.nodes;
                pEdges = result.edges;
                break;
            }
        }

        if (!targetPolyId) {
            console.warn("No single polygon found containing both nodes.");
            return false;
        }

        const poly = this.polygons[targetPolyId];

        let idxA = pNodes.indexOf(node1Id);
        let idxB = pNodes.indexOf(node2Id);
        if (idxA > idxB) {
            let temp = idxA; idxA = idxB; idxB = temp;
        }

        if (idxB - idxA <= 1 || (idxA === 0 && idxB === pNodes.length - 1)) {
            console.warn("Nodes are adjacent, cannot split.");
            return false;
        }

        const newEdgeId = this.addEdge(node1Id, node2Id);

        const edges1 = pEdges.slice(idxA, idxB);
        edges1.push(newEdgeId);

        const edges2 = pEdges.slice(idxB).concat(pEdges.slice(0, idxA));
        edges2.push(newEdgeId);

        poly.edges = edges1;

        let newPolyIdNum = 1;
        while (this.polygons['poly' + newPolyIdNum]) {
            newPolyIdNum++;
        }
        const newPolyId = 'poly' + newPolyIdNum;

        this.polygons[newPolyId] = {
            name: poly.name + " (Split)",
            edges: edges2,
            color: poly.color
        };

        if (poly.parentId) {
            this.polygons[newPolyId].parentId = poly.parentId;
        }
        if (poly.link) {
            this.polygons[newPolyId].link = poly.link;
        } else {
            this.polygons[newPolyId].link = targetPolyId;
            poly.link = targetPolyId;
        }

        return true;
    }
}

window.mapGraph = new MapGraph();
