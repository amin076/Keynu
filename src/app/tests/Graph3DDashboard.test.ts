import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const html = readFileSync("src/app/dashboardHtml.ts", "utf8");
const server = readFileSync("src/app/dashboardServer.ts", "utf8");
const client = readFileSync("src/app/graph3d/graph3dClient.ts", "utf8");

assert(html.includes('data-panel="graph3d"'));
assert(html.includes('id="graph3d"'));
assert(html.includes('id="graph3dCanvas"'));
assert(html.includes('id="graph3dStatus"'));
assert(html.includes('/assets/graph3dClient.js'));
assert(server.includes('/assets/graph3dClient.js'));
assert(server.includes('text/javascript; charset=utf-8'));
assert(client.includes('new THREE.WebGLRenderer'));
assert(client.includes('Three.js connected'));
assert(client.includes('nodes and'));
assert(client.includes('edges loaded'));

assert(client.includes('/api/graph/effective/nodes'));
assert(client.includes('/api/graph/effective/edges'));
assert(client.includes('OrbitControls'));
assert(client.includes('createNodeMesh'));
assert(client.includes('createEdgeLines'));
assert(client.includes('Three.js connected'));

assert(html.includes('id="graph3dSelected"'));
assert(html.includes('id="graph3dSelectedKind"'));
assert(html.includes('id="graph3dSelectedState"'));
assert(html.includes('id="graph3dSelectedNeighbors"'));
assert(client.includes('new THREE.Raycaster'));
assert(client.includes('pointerdown'));
assert(client.includes('showNodeIntelligence'));
assert(client.includes('/api/graph/effective/neighbors'));
assert(client.includes('intersectObjects'));

assert(html.includes('id="graph3dSelectedImpact"'));
assert(html.includes('id="graph3dSelectedActivity"'));
assert(html.includes('id="graph3dImpact"'));
assert(html.includes('id="graph3dActivity"'));
assert(client.includes('/api/graph/effective/impact'));
assert(client.includes('/api/graph/effective/activity'));
assert(client.includes('impactedNodes'));
assert(client.includes('repositoryNodeId === node.id'));

assert(client.includes('Graph3DSelectionContext'));
assert(client.includes('applySelectionHighlight'));
assert(client.includes('relatedNodeIds'));
assert(client.includes('material.opacity'));
assert(client.includes('dblclick'));
assert(client.includes('applySelectionHighlight(nodeMeshes, edgeLines, null)'));

console.log("Graph 3D Dashboard tests passed.");
