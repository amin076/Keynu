import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Graph3DEdge, Graph3DNode } from "./Graph3DTypes.js";

export type Graph3DRendererOptions = {
  onNodeSelected?: (node: Graph3DNode | null) => void;
  backgroundColor?: number;
};

type GraphEdgeRenderRecord = {
  edge: Graph3DEdge;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
};

export class Graph3DRenderer {
  private readonly container: HTMLElement;
  private readonly options: Graph3DRendererOptions;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;

  private readonly graphGroup = new THREE.Group();
  private readonly nodeMeshes: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshStandardMaterial
  >[] = [];
  private readonly edgeRecords: GraphEdgeRenderRecord[] = [];

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;

  private animationFrameId: number | null = null;
  private selectedNodeId: string | null = null;
  private disposed = false;

  public constructor(
    container: HTMLElement,
    options: Graph3DRendererOptions = {},
  ) {
    this.container = container;
    this.options = options;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(
      options.backgroundColor ?? 0x020617,
    );
    this.scene.fog = new THREE.FogExp2(
      options.backgroundColor ?? 0x020617,
      0.018,
    );

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 3000);
    this.camera.position.set(0, 11, 26);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.controls = new OrbitControls(
      this.camera,
      this.renderer.domElement,
    );

    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 200;

    this.scene.add(this.graphGroup);

    this.addLights();

    this.container.replaceChildren(this.renderer.domElement);

    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });

    this.resizeObserver.observe(this.container);

    this.resize();
    this.startAnimation();
  }

  public setGraph(
    nodes: Graph3DNode[],
    edges: Graph3DEdge[],
  ): void {
    this.assertNotDisposed();
    this.clearGraph();

    const positions = this.positionNodes(nodes);

    for (const node of nodes) {
      const mesh = this.createNodeMesh(node);
      const position = positions.get(node.id);

      if (!position) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        continue;
      }

      mesh.position.copy(position);
      this.nodeMeshes.push(mesh);
      this.graphGroup.add(mesh);
    }

    for (const edge of edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);

      if (!source || !target) {
        continue;
      }

      const geometry = new THREE.BufferGeometry().setFromPoints([
        source,
        target,
      ]);

      const material = new THREE.LineBasicMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.34,
      });

      const line = new THREE.Line(geometry, material);
      line.userData.graphEdge = edge;

      this.edgeRecords.push({
        edge,
        line,
      });

      this.graphGroup.add(line);
    }

    this.selectedNodeId = null;
    this.applySelectionHighlight(null);
    this.fitCameraToGraph();
  }

  public selectNode(nodeId: string | null): void {
    this.assertNotDisposed();

    this.selectedNodeId = nodeId;
    this.applySelectionHighlight(nodeId);

    const selectedMesh = this.nodeMeshes.find((mesh) => {
      const node = mesh.userData.graphNode as
        | Graph3DNode
        | undefined;

      return node?.id === nodeId;
    });

    const selectedNode = selectedMesh?.userData.graphNode as
      | Graph3DNode
      | undefined;

    this.options.onNodeSelected?.(selectedNode ?? null);
  }

  public resize(): void {
    if (this.disposed) {
      return;
    }

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.resizeObserver.disconnect();

    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    this.clearGraph();

    this.controls.dispose();
    this.renderer.dispose();

    this.scene.clear();

    if (
      this.renderer.domElement.parentElement === this.container
    ) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private readonly handlePointerDown = (
    event: PointerEvent,
  ): void => {
    if (this.disposed) {
      return;
    }

    const bounds =
      this.renderer.domElement.getBoundingClientRect();

    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    this.pointer.x =
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1;

    this.pointer.y =
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersections = this.raycaster.intersectObjects(
      this.nodeMeshes,
      false,
    );

    const selectedMesh = intersections[0]?.object as
      | THREE.Mesh<
          THREE.SphereGeometry,
          THREE.MeshStandardMaterial
        >
      | undefined;

    const selectedNode = selectedMesh?.userData.graphNode as
      | Graph3DNode
      | undefined;

    this.selectNode(selectedNode?.id ?? null);
  };

  private addLights(): void {
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      0.75,
    );

    const keyLight = new THREE.DirectionalLight(
      0xffffff,
      1.4,
    );

    keyLight.position.set(10, 18, 14);

    const fillLight = new THREE.DirectionalLight(
      0x38bdf8,
      0.65,
    );

    fillLight.position.set(-12, -4, -8);

    this.scene.add(
      ambientLight,
      keyLight,
      fillLight,
    );
  }

  private createNodeMesh(
    node: Graph3DNode,
  ): THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshStandardMaterial
  > {
    const color = this.colorForNode(node);

    const geometry = new THREE.SphereGeometry(
      this.radiusForNode(node),
      20,
      16,
    );

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity:
        node.state === "active" ? 0.55 : 0.16,
      roughness: 0.42,
      metalness: 0.18,
      transparent: true,
      opacity: 1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.graphNode = node;

    return mesh;
  }

  private positionNodes(
    nodes: Graph3DNode[],
  ): Map<string, THREE.Vector3> {
    const positions = new Map<string, THREE.Vector3>();
    const count = Math.max(1, nodes.length);

    const projectNodes = nodes.filter(
      (node) => node.kind === "project",
    );

    projectNodes.forEach((node, index) => {
      positions.set(
        node.id,
        new THREE.Vector3(index * 2.5, 0, 0),
      );
    });

    let distributedIndex = 0;

    for (const node of nodes) {
      if (node.kind === "project") {
        continue;
      }

      const ratio = distributedIndex / count;
      const angle = ratio * Math.PI * 14;
      const radius =
        3 + Math.sqrt(distributedIndex + 1) * 0.58;
      const height =
        ((distributedIndex % 13) - 6) * 0.52;

      positions.set(
        node.id,
        new THREE.Vector3(
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius,
        ),
      );

      distributedIndex += 1;
    }

    return positions;
  }

  private fitCameraToGraph(): void {
    if (this.nodeMeshes.length === 0) {
      this.camera.position.set(0, 11, 26);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      return;
    }

    const bounds = new THREE.Box3();

    for (const mesh of this.nodeMeshes) {
      bounds.expandByObject(mesh);
    }

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maximumDimension = Math.max(
      size.x,
      size.y,
      size.z,
      1,
    );

    const fieldOfViewRadians =
      THREE.MathUtils.degToRad(this.camera.fov);

    const distance =
      maximumDimension /
      (2 * Math.tan(fieldOfViewRadians / 2));

    const direction = new THREE.Vector3(
      0.35,
      0.3,
      1,
    ).normalize();

    this.camera.position.copy(
      center
        .clone()
        .add(
          direction.multiplyScalar(
            Math.max(distance * 1.7, 12),
          ),
        ),
    );

    this.camera.near = Math.max(distance / 100, 0.1);
    this.camera.far = Math.max(distance * 20, 1000);
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(center);
    this.controls.update();
  }

  private applySelectionHighlight(
    selectedNodeId: string | null,
  ): void {
    const relatedNodeIds = new Set<string>();

    if (selectedNodeId) {
      for (const record of this.edgeRecords) {
        if (record.edge.source === selectedNodeId) {
          relatedNodeIds.add(record.edge.target);
        }

        if (record.edge.target === selectedNodeId) {
          relatedNodeIds.add(record.edge.source);
        }
      }
    }

    for (const mesh of this.nodeMeshes) {
      const node = mesh.userData.graphNode as
        | Graph3DNode
        | undefined;

      const isSelected =
        node?.id === selectedNodeId;

      const isRelated =
        node !== undefined &&
        relatedNodeIds.has(node.id);

      const isVisible =
        !selectedNodeId ||
        isSelected ||
        isRelated;

      mesh.scale.setScalar(
        isSelected ? 1.65 : isRelated ? 1.25 : 1,
      );

      mesh.material.opacity = isVisible ? 1 : 0.14;

      mesh.material.emissiveIntensity = isSelected
        ? 1
        : isRelated
          ? 0.45
          : node?.state === "active"
            ? 0.55
            : 0.16;
    }

    for (const record of this.edgeRecords) {
      const connected =
        selectedNodeId !== null &&
        (record.edge.source === selectedNodeId ||
          record.edge.target === selectedNodeId);

      record.line.material.color.setHex(
        connected ? 0x22d3ee : 0x64748b,
      );

      record.line.material.opacity = selectedNodeId
        ? connected
          ? 0.95
          : 0.05
        : 0.34;
    }
  }

  private colorForNode(node: Graph3DNode): number {
    if (node.state === "failed") {
      return 0xfb7185;
    }

    if (
      node.state === "active" ||
      node.state === "queued"
    ) {
      return 0xf59e0b;
    }

    if (node.kind === "project") {
      return 0xa78bfa;
    }

    if (node.kind === "folder") {
      return 0x22d3ee;
    }

    if (node.kind === "job") {
      return 0x38bdf8;
    }

    if (node.kind === "command") {
      return 0xfacc15;
    }

    if (node.kind === "report") {
      return 0x4ade80;
    }

    if (node.kind === "driver") {
      return 0xf472b6;
    }

    return 0x22c55e;
  }

  private radiusForNode(node: Graph3DNode): number {
    if (node.kind === "project") {
      return 0.75;
    }

    if (node.kind === "folder") {
      return 0.48;
    }

    if (node.kind === "job") {
      return 0.4;
    }

    if (node.kind === "command") {
      return 0.25;
    }

    if (node.kind === "report") {
      return 0.3;
    }

    return 0.32;
  }

  private clearGraph(): void {
    for (const mesh of this.nodeMeshes) {
      this.graphGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    this.nodeMeshes.length = 0;

    for (const record of this.edgeRecords) {
      this.graphGroup.remove(record.line);
      record.line.geometry.dispose();
      record.line.material.dispose();
    }

    this.edgeRecords.length = 0;
    this.selectedNodeId = null;
  }

  private startAnimation(): void {
    const animate = (): void => {
      if (this.disposed) {
        return;
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);

      this.animationFrameId =
        window.requestAnimationFrame(animate);
    };

    animate();
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error(
        "Graph3DRenderer has already been disposed.",
      );
    }
  }
}