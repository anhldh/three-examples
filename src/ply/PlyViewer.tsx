// ═══════════════════════════════════════════════════════════════
// PLYViewer.tsx — TypeScript React component for viewing .ply files
// Uses Three.js directly (compatible with any React project)
// Supports ASCII & Binary PLY, Point Clouds & Meshes
// ═══════════════════════════════════════════════════════════════

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FC,
  type DragEvent,
  type ChangeEvent,
} from "react";
import * as THREE from "three";

// ── Types & Interfaces ──────────────────────────────────────────

interface VertexProperty {
  type: string;
  name: string;
}

interface PLYData {
  positions: Float32Array;
  colors: Float32Array | null;
  normals: Float32Array | null;
  indices: Uint32Array | null;
  vertexCount: number;
  faceCount: number;
}

interface FileInfo {
  name: string;
  vertices: string;
  faces: string;
  hasColor: boolean;
  hasNormals: boolean;
  type: "Mesh" | "Point Cloud";
  size: string;
}

interface OrbitControls {
  update: () => void;
  setTarget: (t: THREE.Vector3) => void;
  setRadius: (r: number) => void;
  dispose: () => void;
}

type PLYFormat = "ascii" | "binary_little" | "binary_big";

// ── PLY Parser ──────────────────────────────────────────────────

function readBinaryValue(
  view: DataView,
  offset: { value: number },
  type: string,
  littleEndian: boolean,
): number {
  const t = type.toLowerCase();
  let val: number;

  switch (t) {
    case "float":
    case "float32":
      val = view.getFloat32(offset.value, littleEndian);
      offset.value += 4;
      break;
    case "double":
    case "float64":
      val = view.getFloat64(offset.value, littleEndian);
      offset.value += 8;
      break;
    case "uchar":
    case "uint8":
      val = view.getUint8(offset.value);
      offset.value += 1;
      break;
    case "char":
    case "int8":
      val = view.getInt8(offset.value);
      offset.value += 1;
      break;
    case "short":
    case "int16":
      val = view.getInt16(offset.value, littleEndian);
      offset.value += 2;
      break;
    case "ushort":
    case "uint16":
      val = view.getUint16(offset.value, littleEndian);
      offset.value += 2;
      break;
    case "int":
    case "int32":
      val = view.getInt32(offset.value, littleEndian);
      offset.value += 4;
      break;
    case "uint":
    case "uint32":
      val = view.getUint32(offset.value, littleEndian);
      offset.value += 4;
      break;
    default:
      val = view.getFloat32(offset.value, littleEndian);
      offset.value += 4;
  }

  return val;
}

function parseBinaryPLY(
  buffer: ArrayBuffer,
  headerEnd: number,
  vertexCount: number,
  faceCount: number,
  vertexProps: VertexProperty[],
  littleEndian: boolean,
  hasColor: boolean,
  hasNormals: boolean,
): PLYData {
  const headerText =
    new TextDecoder().decode(buffer).substring(0, headerEnd) + "end_header\n";
  const dataOffset = new TextEncoder().encode(headerText).byteLength;
  const view = new DataView(buffer, dataOffset);

  const positions = new Float32Array(vertexCount * 3);
  const colors = hasColor ? new Float32Array(vertexCount * 3) : null;
  const normals = hasNormals ? new Float32Array(vertexCount * 3) : null;

  const offset = { value: 0 };

  for (let i = 0; i < vertexCount; i++) {
    const vals: Record<string, number> = {};
    for (const prop of vertexProps) {
      vals[prop.name] = readBinaryValue(view, offset, prop.type, littleEndian);
    }
    positions[i * 3] = vals.x;
    positions[i * 3 + 1] = vals.y;
    positions[i * 3 + 2] = vals.z;
    if (colors) {
      colors[i * 3] = (vals.red ?? 0) / 255;
      colors[i * 3 + 1] = (vals.green ?? 0) / 255;
      colors[i * 3 + 2] = (vals.blue ?? 0) / 255;
    }
    if (normals) {
      normals[i * 3] = vals.nx ?? 0;
      normals[i * 3 + 1] = vals.ny ?? 0;
      normals[i * 3 + 2] = vals.nz ?? 0;
    }
  }

  let indices: Uint32Array | null = null;
  if (faceCount > 0) {
    const faceIndices: number[] = [];
    for (let i = 0; i < faceCount; i++) {
      const n = view.getUint8(offset.value);
      offset.value += 1;
      const face: number[] = [];
      for (let j = 0; j < n; j++) {
        face.push(view.getInt32(offset.value, littleEndian));
        offset.value += 4;
      }
      for (let j = 0; j <= n - 3; j++) {
        faceIndices.push(face[0], face[1 + j], face[2 + j]);
      }
    }
    indices = new Uint32Array(faceIndices);
  }

  return { positions, colors, normals, indices, vertexCount, faceCount };
}

function parsePLY(buffer: ArrayBuffer): PLYData {
  const decoder = new TextDecoder();
  const text = decoder.decode(buffer);

  const headerEnd = text.indexOf("end_header");
  if (headerEnd === -1) throw new Error("Invalid PLY: missing end_header");

  const headerText = text.substring(0, headerEnd);
  const lines = headerText.split("\n").map((l) => l.trim());

  let vertexCount = 0;
  let faceCount = 0;
  let format: PLYFormat = "ascii";
  const vertexProps: VertexProperty[] = [];
  let inVertex = false;
  let inFace = false;

  for (const line of lines) {
    if (line.startsWith("format")) {
      if (line.includes("binary_little_endian")) format = "binary_little";
      else if (line.includes("binary_big_endian")) format = "binary_big";
      else format = "ascii";
    }
    if (line.startsWith("element vertex")) {
      vertexCount = parseInt(line.split(" ")[2], 10);
      inVertex = true;
      inFace = false;
    }
    if (line.startsWith("element face")) {
      faceCount = parseInt(line.split(" ")[2], 10);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      inFace = true;
      inVertex = false;
    }
    if (line.startsWith("property") && inVertex) {
      const parts = line.split(" ");
      vertexProps.push({ type: parts[1], name: parts[2] });
    }
  }

  const hasColor = vertexProps.some((p) => p.name === "red");
  const hasNormals = vertexProps.some((p) => p.name === "nx");

  if (format !== "ascii") {
    return parseBinaryPLY(
      buffer,
      headerEnd,
      vertexCount,
      faceCount,
      vertexProps,
      format === "binary_little",
      hasColor,
      hasNormals,
    );
  }

  // ── ASCII parsing ──
  const bodyText = text.substring(headerEnd + "end_header".length).trim();
  const bodyLines = bodyText.split("\n");

  const positions = new Float32Array(vertexCount * 3);
  const colors = hasColor ? new Float32Array(vertexCount * 3) : null;
  const normals = hasNormals ? new Float32Array(vertexCount * 3) : null;

  const propIndex = (name: string): number =>
    vertexProps.findIndex((p) => p.name === name);

  const xI = propIndex("x"),
    yI = propIndex("y"),
    zI = propIndex("z");
  const rI = propIndex("red"),
    gI = propIndex("green"),
    bI = propIndex("blue");
  const nxI = propIndex("nx"),
    nyI = propIndex("ny"),
    nzI = propIndex("nz");

  for (let i = 0; i < vertexCount; i++) {
    const vals = bodyLines[i].trim().split(/\s+/);
    positions[i * 3] = parseFloat(vals[xI]);
    positions[i * 3 + 1] = parseFloat(vals[yI]);
    positions[i * 3 + 2] = parseFloat(vals[zI]);
    if (colors) {
      colors[i * 3] = parseFloat(vals[rI]) / 255;
      colors[i * 3 + 1] = parseFloat(vals[gI]) / 255;
      colors[i * 3 + 2] = parseFloat(vals[bI]) / 255;
    }
    if (normals) {
      normals[i * 3] = parseFloat(vals[nxI]);
      normals[i * 3 + 1] = parseFloat(vals[nyI]);
      normals[i * 3 + 2] = parseFloat(vals[nzI]);
    }
  }

  let indices: Uint32Array | null = null;
  if (faceCount > 0) {
    const faceIndices: number[] = [];
    for (let i = 0; i < faceCount; i++) {
      const vals = bodyLines[vertexCount + i].trim().split(/\s+/).map(Number);
      const n = vals[0];
      for (let j = 1; j <= n - 2; j++) {
        faceIndices.push(vals[1], vals[1 + j], vals[2 + j]);
      }
    }
    indices = new Uint32Array(faceIndices);
  }

  return { positions, colors, normals, indices, vertexCount, faceCount };
}

// ── Orbit Controls ──────────────────────────────────────────────

function createOrbitControls(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
): OrbitControls {
  let theta = Math.PI / 4;
  let phi = Math.PI / 3;
  let radius = 5;
  const target = new THREE.Vector3(0, 0, 0);
  let isDown = false;
  let prevX = 0;
  let prevY = 0;
  let isPanning = false;

  function update(): void {
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    camera.position.set(target.x + x, target.y + y, target.z + z);
    camera.lookAt(target);
  }

  const onPointerDown = (e: PointerEvent): void => {
    isDown = true;
    prevX = e.clientX;
    prevY = e.clientY;
    isPanning = e.button === 2 || e.shiftKey;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!isDown) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    prevX = e.clientX;
    prevY = e.clientY;

    if (isPanning) {
      const panSpeed = 0.003 * radius;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      right.setFromMatrixColumn(camera.matrix, 0);
      up.setFromMatrixColumn(camera.matrix, 1);
      target.add(right.multiplyScalar(-dx * panSpeed));
      target.add(up.multiplyScalar(dy * panSpeed));
    } else {
      theta -= dx * 0.008;
      phi -= dy * 0.008;
      phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi));
    }
    update();
  };

  const onPointerUp = (): void => {
    isDown = false;
    isPanning = false;
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    radius *= 1 + e.deltaY * 0.001;
    radius = Math.max(0.1, Math.min(1000, radius));
    update();
  };

  const onContext = (e: Event): void => e.preventDefault();

  domElement.addEventListener("pointerdown", onPointerDown);
  domElement.addEventListener("pointermove", onPointerMove);
  domElement.addEventListener("pointerup", onPointerUp);
  domElement.addEventListener("pointerleave", onPointerUp);
  domElement.addEventListener("wheel", onWheel, { passive: false });
  domElement.addEventListener("contextmenu", onContext);

  update();

  return {
    update,
    setTarget(t: THREE.Vector3) {
      target.copy(t);
      update();
    },
    setRadius(r: number) {
      radius = r;
      update();
    },
    dispose() {
      domElement.removeEventListener("pointerdown", onPointerDown);
      domElement.removeEventListener("pointermove", onPointerMove);
      domElement.removeEventListener("pointerup", onPointerUp);
      domElement.removeEventListener("pointerleave", onPointerUp);
      domElement.removeEventListener("wheel", onWheel);
      domElement.removeEventListener("contextmenu", onContext);
    },
  };
}

// ── Styles ──────────────────────────────────────────────────────

const styles = {
  root: {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    color: "#c8cad0",
  },
  topBar: {
    display: "flex",
    alignItems: "center" as const,
    gap: 16,
    padding: "10px 16px",
    background: "rgba(255,255,255,0.03)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
    flexWrap: "wrap" as const,
  },
  logoWrap: {
    display: "flex",
    alignItems: "center" as const,
    gap: 8,
  },
  logoText: {
    fontWeight: 700,
    fontSize: 14,
    color: "#e0e2e8",
    letterSpacing: 1,
  },
  openBtn: {
    background: "linear-gradient(135deg, #3b5dff, #6b3bff)",
    border: "none",
    color: "#fff",
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer" as const,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    fontFamily: "inherit",
  },
  sliderWrap: {
    display: "flex",
    alignItems: "center" as const,
    gap: 6,
    marginLeft: "auto",
  },
  canvasArea: {
    flex: 1,
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  canvas: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  dropOverlay: {
    position: "absolute" as const,
    inset: 0,
    background: "rgba(59,93,255,0.15)",
    border: "3px dashed #5b8cff",
    borderRadius: 12,
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 10,
  },
  emptyState: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 16,
    pointerEvents: "none" as const,
  },
  loadingOverlay: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    background: "rgba(0,0,0,0.5)",
    zIndex: 20,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(91,140,255,0.2)",
    borderTop: "3px solid #5b8cff",
    borderRadius: "50%",
    animation: "ply-spin 0.8s linear infinite",
  },
  errorBanner: {
    position: "absolute" as const,
    bottom: 16,
    left: 16,
    right: 16,
    background: "rgba(255,60,60,0.15)",
    border: "1px solid rgba(255,60,60,0.3)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 12,
    color: "#ff6b6b",
  },
  infoPanel: {
    position: "absolute" as const,
    bottom: 12,
    left: 12,
    background: "rgba(10,10,15,0.85)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 11,
    lineHeight: 1.7,
    minWidth: 180,
  },
  controlsHint: {
    position: "absolute" as const,
    bottom: 12,
    right: 12,
    background: "rgba(10,10,15,0.7)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 10,
    color: "#555577",
    lineHeight: 1.6,
  },
} as const;

// ── Icons ───────────────────────────────────────────────────────

const LayersIcon: FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = "#5b8cff",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
  >
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

// ── Component ───────────────────────────────────────────────────

const BG_PRESETS: string[] = ["#0a0a0f", "#1a1a2e", "#fafafa"];

const PLYViewer: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | THREE.Points | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [pointSize, setPointSize] = useState<number>(2.0);
  const [bgColor, setBgColor] = useState<string>("#0a0a0f");

  // ── Setup Three.js scene ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(new THREE.Color(bgColor));
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 2000);
    cameraRef.current = camera;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(5, 10, 7);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0x8888ff, 0.3);
    dir2.position.set(-5, -3, -5);
    scene.add(dir2);

    // Grid
    const grid = new THREE.GridHelper(10, 20, 0x222233, 0x111122);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    scene.add(grid);

    // Controls
    const controls = createOrbitControls(camera, canvas);
    controlsRef.current = controls;

    const resize = (): void => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const animate = (): void => {
      rafRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      controls.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync bg color ──
  useEffect(() => {
    rendererRef.current?.setClearColor(new THREE.Color(bgColor));
  }, [bgColor]);

  // ── Sync point size ──
  useEffect(() => {
    const obj = meshRef.current;
    if (obj && obj instanceof THREE.Points) {
      (obj.material as THREE.PointsMaterial).size = pointSize * 0.005;
    }
  }, [pointSize]);

  // ── Load PLY file ──
  const loadPLY = useCallback(
    async (file: File): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const buffer = await file.arrayBuffer();
        const data = parsePLY(buffer);

        const scene = sceneRef.current!;

        // Cleanup previous
        if (meshRef.current) {
          scene.remove(meshRef.current);
          meshRef.current.geometry.dispose();
          const mat = meshRef.current.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else (mat as THREE.Material).dispose();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(data.positions, 3),
        );
        if (data.colors)
          geometry.setAttribute(
            "color",
            new THREE.BufferAttribute(data.colors, 3),
          );
        if (data.normals)
          geometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(data.normals, 3),
          );
        if (data.indices)
          geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));

        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        geometry.translate(-center.x, -center.y, -center.z);

        let obj: THREE.Mesh | THREE.Points;

        if (data.indices && data.faceCount > 0) {
          if (!data.normals) geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            vertexColors: !!data.colors,
            color: data.colors ? 0xffffff : 0x66aaff,
            metalness: 0.1,
            roughness: 0.6,
            side: THREE.DoubleSide,
          });
          obj = new THREE.Mesh(geometry, material);
        } else {
          const material = new THREE.PointsMaterial({
            size: pointSize * 0.005,
            vertexColors: !!data.colors,
            color: data.colors ? 0xffffff : 0x66aaff,
            sizeAttenuation: true,
          });
          obj = new THREE.Points(geometry, material);
        }

        scene.add(obj);
        meshRef.current = obj;

        const camDist = maxDim * 1.8;
        controlsRef.current!.setTarget(new THREE.Vector3(0, 0, 0));
        controlsRef.current!.setRadius(camDist);

        setInfo({
          name: file.name,
          vertices: data.vertexCount.toLocaleString(),
          faces: data.faceCount.toLocaleString(),
          hasColor: !!data.colors,
          hasNormals: !!data.normals,
          type: data.faceCount > 0 ? "Mesh" : "Point Cloud",
          size: (file.size / 1024).toFixed(1) + " KB",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [pointSize],
  );

  // ── Event handlers ──
  const onDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (): void => setIsDragOver(false);

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadPLY(file);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) loadPLY(file);
  };

  // ── Render ──
  return (
    <div style={{ ...styles.root, background: bgColor }}>
      {/* Keyframes */}
      <style>{`@keyframes ply-spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Top Bar ── */}
      <div style={styles.topBar}>
        <div style={styles.logoWrap}>
          <LayersIcon />
          <span style={styles.logoText}>PLY VIEWER</span>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          style={styles.openBtn}
        >
          Open File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ply"
          onChange={onFileChange}
          style={{ display: "none" }}
        />

        {/* Point size slider */}
        <div style={styles.sliderWrap}>
          <span style={{ fontSize: 11, opacity: 0.5 }}>Point Size</span>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            value={pointSize}
            onChange={(e) => setPointSize(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: "#5b8cff" }}
          />
          <span style={{ fontSize: 11, width: 28 }}>
            {pointSize.toFixed(1)}
          </span>
        </div>

        {/* Background presets */}
        <div style={{ display: "flex", gap: 4 }}>
          {BG_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => setBgColor(c)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                border:
                  bgColor === c
                    ? "2px solid #5b8cff"
                    : "1px solid rgba(255,255,255,0.1)",
                background: c,
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        style={styles.canvasArea}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <canvas ref={canvasRef} style={styles.canvas} />

        {/* Drop overlay */}
        {isDragOver && (
          <div style={styles.dropOverlay}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#5b8cff" }}>
              Drop .ply file here
            </span>
          </div>
        )}

        {/* Empty state */}
        {!info && !loading && !error && (
          <div style={styles.emptyState}>
            <LayersIcon size={64} color="#333355" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#555577", fontWeight: 600 }}>
                Drag &amp; drop a .ply file
              </div>
              <div style={{ fontSize: 11, color: "#444466", marginTop: 4 }}>
                or click &quot;Open File&quot; above
              </div>
              <div style={{ fontSize: 10, color: "#333355", marginTop: 8 }}>
                ASCII &amp; Binary PLY · Point Clouds &amp; Meshes
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={styles.loadingOverlay}>
            <div style={styles.spinner} />
          </div>
        )}

        {/* Error */}
        {error && <div style={styles.errorBanner}>⚠ {error}</div>}

        {/* Info panel */}
        {info && (
          <div style={styles.infoPanel}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: "#e0e2e8",
                marginBottom: 4,
              }}
            >
              {info.name}
            </div>
            {(
              [
                ["Type", info.type],
                ["Vertices", info.vertices],
                ["Faces", info.faces],
                ["Color", info.hasColor ? "✓" : "✗"],
                ["Normals", info.hasNormals ? "✓" : "✗"],
                ["Size", info.size],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <span style={{ color: "#5b8cff" }}>{label}:</span> {value}
              </div>
            ))}
          </div>
        )}

        {/* Controls hint */}
        {info && (
          <div style={styles.controlsHint}>
            <div>🖱 Drag → Orbit</div>
            <div>⇧+Drag / Right → Pan</div>
            <div>Scroll → Zoom</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PLYViewer;
