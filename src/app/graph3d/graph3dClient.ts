import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Graph3DEdge, Graph3DNode } from "./Graph3DTypes.js";

type GraphResponse<T> = {
  ok?: boolean;
  items?: T[];
};

const NODE_LIMIT = 140;
const EDGE_LIMIT = 320;

function setGraph3DText(id: string, value: unknown): void {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value ?? "--");
}

function escapeGraph3DHtml(value: unknown): string {
  return String(value ?? "--").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

async function showNodeIntelligence(node: Graph3DNode): Promise<void> {
  setGraph3DText("graph3dSelected", node.path ?? node.label);
  setGraph3DText("graph3dSelectedKind", node.kind);
  setGraph3DText("graph3dSelectedState", node.state);

  const response = await fetch(
    "/api/graph/effective/neighbors?nodeId=" + encodeURIComponent(node.id) + "&depth=1",
    { cache: "no-store" },
  );

  if (!response.ok) throw new Error("Unable to load selected-node neighbors");

  const result = await response.json() as { nodes?: Graph3DNode[] };
  const neighbors = result.nodes ?? [];
  setGraph3DText("graph3dSelectedNeighbors", neighbors.length);

  const related = document.getElementById("graph3dRelated");
  if (related) {
    related.innerHTML = neighbors.length
      ? neighbors.slice(0, 20).map((item) =>
          '<div class="logline"><strong>' +
          escapeGraph3DHtml(item.kind) +
          "</strong> — " +
          escapeGraph3DHtml(item.path ?? item.label) +
          " — " +
          escapeGraph3DHtml(item.state) +
          "</div>",
        ).join("")
      : '<div class="logline">No neighboring nodes</div>';
  }
}

function colorForNode(node: Graph3DNode): number {
  if (node.state === "failed") return 0xfb7185;
  if (node.state === "active" || node.state === "queued") return 0xf59e0b;
  if (node.kind === "project") return 0xa78bfa;
  if (node.kind === "folder") return 0x22d3ee;
  if (node.kind === "job") return 0x38bdf8;
  if (node.kind === "command") return 0xfacc15;
  if (node.kind === "report") return 0x4ade80;
  return 0x22c55e;
}

function radiusForNode(node: Graph3DNode): number {
  if (node.kind === "project") return 0.75;
  if (node.kind === "folder") return 0.48;
  if (node.kind === "job") return 0.4;
  if (node.kind === "command") return 0.25;
  return 0.3;
}

function positionNodes(nodes: Graph3DNode[]): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>();
  const count = Math.max(1, nodes.length);

  nodes.forEach((node, index) => {
    if (node.kind === "project") {
      positions.set(node.id, new THREE.Vector3(0, 0, 0));
      return;
    }

    const ratio = index / count;
    const angle = ratio * Math.PI * 14;
    const radius = 3 + Math.sqrt(index + 1) * 0.58;
    const height = ((index % 13) - 6) * 0.52;

    positions.set(
      node.id,
      new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius,
      ),
    );
  });

  return positions;
}

async function readGraphData(): Promise<{
  nodes: Graph3DNode[];
  edges: Graph3DEdge[];
}> {
  const [nodeResponse, edgeResponse] = await Promise.all([
    fetch(`/api/graph/effective/nodes?limit=${NODE_LIMIT}`, {
      cache: "no-store",
    }),
    fetch(`/api/graph/effective/edges?limit=${EDGE_LIMIT}`, {
      cache: "no-store",
    }),
  ]);

  if (!nodeResponse.ok || !edgeResponse.ok) {
    throw new Error("Effective graph API request failed");
  }

  const nodeData = (await nodeResponse.json()) as GraphResponse<Graph3DNode>;
  const edgeData = (await edgeResponse.json()) as GraphResponse<Graph3DEdge>;

  return {
    nodes: nodeData.items ?? [],
    edges: edgeData.items ?? [],
  };
}

function createNodeMesh(node: Graph3DNode): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radiusForNode(node), 16, 12);
  const material = new THREE.MeshStandardMaterial({
    color: colorForNode(node),
    emissive: colorForNode(node),
    emissiveIntensity: node.state === "active" ? 0.55 : 0.16,
    roughness: 0.42,
    metalness: 0.18,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.graphNode = node;
  return mesh;
}

function createEdgeLines(
  edges: Graph3DEdge[],
  positions: Map<string, THREE.Vector3>,
): THREE.LineSegments {
  const points: number[] = [];

  for (const edge of edges) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) continue;

    points.push(source.x, source.y, source.z);
    points.push(target.x, target.y, target.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3),
  );

  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.34,
    }),
  );
}

export async function startGraph3D(): Promise<void> {
  const container = document.getElementById("graph3dCanvas");
  const status = document.getElementById("graph3dStatus");
  if (!container) return;

  if (status) status.textContent = "Loading effective graph…";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);
  scene.fog = new THREE.FogExp2(0x020617, 0.018);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 3000);
  camera.position.set(0, 11, 26);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.replaceChildren(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 4;
  controls.maxDistance = 90;

  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const directional = new THREE.DirectionalLight(0x9be7ff, 2.2);
  directional.position.set(8, 14, 10);
  scene.add(directional);

  const graph = await readGraphData();
  const positions = positionNodes(graph.nodes);
  const graphGroup = new THREE.Group();
  const nodeMeshes: THREE.Mesh[] = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selectedMesh: THREE.Mesh | null = null;

  for (const node of graph.nodes) {
    const mesh = createNodeMesh(node);
    mesh.position.copy(positions.get(node.id) ?? new THREE.Vector3());
    nodeMeshes.push(mesh);
    graphGroup.add(mesh);
  }

  graphGroup.add(createEdgeLines(graph.edges, positions));
  scene.add(graphGroup);

  if (status) {
    status.textContent =
      `Three.js connected — ${graph.nodes.length} nodes and ${graph.edges.length} edges loaded`;
  }

  renderer.domElement.addEventListener("pointerdown", (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(nodeMeshes, false)[0];
    if (!hit) return;

    if (selectedMesh) {
      selectedMesh.scale.setScalar(1);
      const previousMaterial = selectedMesh.material as THREE.MeshStandardMaterial;
      previousMaterial.emissiveIntensity =
        selectedMesh.userData.graphNode?.state === "active" ? 0.55 : 0.16;
    }

    selectedMesh = hit.object as THREE.Mesh;
    selectedMesh.scale.setScalar(1.65);
    const selectedMaterial = selectedMesh.material as THREE.MeshStandardMaterial;
    selectedMaterial.emissiveIntensity = 1;

    const node = selectedMesh.userData.graphNode as Graph3DNode | undefined;
    if (node) {
      showNodeIntelligence(node).catch((error) => {
        setGraph3DText(
          "graph3dSelected",
          error instanceof Error ? error.message : "Node selection failed",
        );
      });
    }
  });

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  window.addEventListener("resize", resize);
  resize();
  animate();
}

startGraph3D().catch((error) => {
  const status = document.getElementById("graph3dStatus");
  if (status) {
    status.textContent =
      error instanceof Error ? error.message : "Graph 3D failed";
  }
  console.error(error);
});
