import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { Bounds, OrbitControls, useKTX2 } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { PerfHeadless, usePerfData } from "r3f-monitor";
import {
  DoubleSide,
  PlaneGeometry,
  type CompressedTexture,
  type Texture,
} from "three";

const mono = "'JetBrains Mono', 'Fira Code', monospace";

interface TextureInfo {
  width: number;
  height: number;
  mipmaps: number;
  type: string;
}

function PerformanceHud() {
  const { cpu, gpu, vram } = usePerfData();

  return (
    <aside aria-label="Performance" style={styles.performanceHud}>
      <span style={styles.performanceTitle}>PERFORMANCE</span>
      <div style={styles.performanceRow}>
        <span>CPU</span>
        <strong>{cpu.toFixed(1)} ms</strong>
      </div>
      <div style={styles.performanceRow}>
        <span>GPU</span>
        <strong>{gpu.toFixed(1)} ms</strong>
      </div>
      <div style={styles.performanceRow}>
        <span>VRAM</span>
        <strong>{vram.toFixed(1)} MB</strong>
      </div>
    </aside>
  );
}

interface ViewerErrorBoundaryProps {
  children: ReactNode;
  onError: () => void;
}

interface ViewerErrorBoundaryState {
  error: Error | null;
}

class ViewerErrorBoundary extends Component<
  ViewerErrorBoundaryProps,
  ViewerErrorBoundaryState
> {
  state: ViewerErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.error) {
      return (
        <div style={styles.statusPanel}>
          <strong style={{ color: "#ff8f8f" }}>Không tải được KTX2</strong>
          <span style={styles.statusText}>
            File có thể bị lỗi hoặc sử dụng kiểu nén chưa được trình duyệt hỗ
            trợ.
          </span>
          <span style={styles.errorDetail}>{this.state.error.message}</span>
        </div>
      );
    }

    return this.props.children;
  }
}

function getTextureSize(texture: Texture) {
  const image = texture.image as
    | { width?: number; height?: number }
    | undefined;
  const firstMipmap = (texture as CompressedTexture).mipmaps?.[0];

  return {
    width: image?.width ?? firstMipmap?.width ?? 1,
    height: image?.height ?? firstMipmap?.height ?? 1,
  };
}

interface TexturePlaneProps {
  url: string;
  onLoaded: (info: TextureInfo) => void;
}

function TexturePlane({ url, onLoaded }: TexturePlaneProps) {
  const texture = useKTX2(url);
  const { width, height } = getTextureSize(texture);

  // Keep the longest edge at four world units and preserve the source ratio.
  const [planeWidth, planeHeight] = useMemo(() => {
    const longestEdge = Math.max(width, height);
    return [(width / longestEdge) * 4, (height / longestEdge) * 4];
  }, [height, width]);

  const geometry = useMemo(() => {
    const nextGeometry = new PlaneGeometry(planeWidth, planeHeight);
    const uv = nextGeometry.attributes.uv;

    // KTX2 textures use flipY=false, so the geometry UVs need to be rewritten.
    for (let index = 0; index < uv.count; index += 1) {
      uv.setY(index, 1 - uv.getY(index));
    }

    return nextGeometry;
  }, [planeHeight, planeWidth]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(
    () => () => {
      texture.dispose();
      useKTX2.clear(url);
    },
    [texture, url],
  );

  useEffect(() => {
    onLoaded({
      width,
      height,
      mipmaps: (texture as CompressedTexture).mipmaps?.length ?? 0,
      type: texture.constructor.name,
    });
  }, [height, onLoaded, texture, width]);

  return (
    <Bounds fit clip observe margin={1.2}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          map={texture}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
    </Bounds>
  );
}

function KtxViewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [textureInfo, setTextureInfo] = useState<TextureInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(
    () => () => {
      if (selectedFile) URL.revokeObjectURL(selectedFile.url);
    },
    [selectedFile],
  );

  const handleLoaded = useCallback((info: TextureInfo) => {
    setTextureInfo(info);
    setLoadError(false);
  }, []);

  const handleError = useCallback(() => setLoadError(true), []);

  const loadFile = useCallback((file?: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".ktx2")) {
      setFileError("Vui lòng chọn đúng file có đuôi .ktx2");
      return;
    }

    setSelectedFile({
      name: file.name,
      url: URL.createObjectURL(file),
    });
    setTextureInfo(null);
    setLoadError(false);
    setFileError(null);
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    loadFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  return (
    <section
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={styles.root}
    >
      <header style={styles.toolbar}>
        <div style={styles.toolbarRow}>
          <div style={styles.headingGroup}>
            <span style={styles.eyebrow}>TEXTURE VIEWER</span>
            <h1 style={styles.heading}>KTX2 file viewer</h1>
          </div>

          <button
            onClick={() => inputRef.current?.click()}
            style={styles.loadButton}
            type="button"
          >
            Chọn file KTX2
          </button>
          <input
            ref={inputRef}
            accept=".ktx2,image/ktx2"
            onChange={handleFileChange}
            style={{ display: "none" }}
            type="file"
          />
        </div>

        <p style={styles.hint}>
          Chọn hoặc kéo thả file .ktx2 vào đây. Có thể kéo, zoom và xoay để
          kiểm tra texture.
        </p>
        {fileError && <p style={styles.fileError}>{fileError}</p>}
      </header>

      <div style={styles.viewer}>
        {selectedFile ? (
          <ViewerErrorBoundary key={selectedFile.url} onError={handleError}>
            <Canvas
              camera={{ position: [0, 0, 6], fov: 45, near: 0.1, far: 100 }}
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true }}
            >
              <color attach="background" args={["#090a0f"]} />
              <PerfHeadless logsPerSecond={10} />
              <Suspense fallback={null}>
                <TexturePlane
                  url={selectedFile.url}
                  onLoaded={handleLoaded}
                />
              </Suspense>
              <OrbitControls
                makeDefault
                enableDamping
                minDistance={1}
                maxDistance={30}
              />
            </Canvas>
          </ViewerErrorBoundary>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            style={styles.emptyState}
            type="button"
          >
            <span style={styles.dropIcon}>KTX2</span>
            <strong style={styles.dropTitle}>Thả file KTX2 vào đây</strong>
            <span style={styles.dropHint}>hoặc bấm để chọn file từ máy</span>
          </button>
        )}

        {selectedFile && !loadError && <PerformanceHud />}

        {selectedFile && !textureInfo && !loadError && (
          <div style={styles.loadingBadge}>
            <span style={styles.loadingDot} />
            loading texture
          </div>
        )}

        {textureInfo && (
          <div style={styles.infoPanel}>
            <div>
              <span style={styles.infoLabel}>FILE</span>
              <strong style={styles.infoValue} title={selectedFile?.name}>
                {selectedFile?.name}
              </strong>
            </div>
            <div>
              <span style={styles.infoLabel}>RESOLUTION</span>
              <strong style={styles.infoValue}>
                {textureInfo.width} × {textureInfo.height}
              </strong>
            </div>
            <div>
              <span style={styles.infoLabel}>ASPECT</span>
              <strong style={styles.infoValue}>
                {(textureInfo.width / textureInfo.height).toFixed(3)}
              </strong>
            </div>
            <div>
              <span style={styles.infoLabel}>MIPMAPS</span>
              <strong style={styles.infoValue}>{textureInfo.mipmaps}</strong>
            </div>
            <div>
              <span style={styles.infoLabel}>TEXTURE</span>
              <strong style={styles.infoValue}>{textureInfo.type}</strong>
            </div>
          </div>
        )}

        {isDragging && (
          <div style={styles.dropOverlay}>
            <span style={styles.dropIcon}>KTX2</span>
            <strong style={styles.dropTitle}>Thả file để mở</strong>
          </div>
        )}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "#090a0f",
    color: "#e7e9ee",
    fontFamily: mono,
    textAlign: "left",
  },
  toolbar: {
    flexShrink: 0,
    padding: "20px 24px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.09)",
    background: "#111219",
  },
  toolbarRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  headingGroup: {
    display: "flex",
    alignItems: "baseline",
    gap: 14,
  },
  eyebrow: {
    color: "#6f98ff",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.14em",
  },
  heading: {
    margin: 0,
    color: "#f0f2f7",
    fontSize: 18,
    lineHeight: 1.2,
  },
  loadButton: {
    flexShrink: 0,
    padding: "10px 16px",
    border: "1px solid rgba(111,152,255,0.65)",
    borderRadius: 7,
    background: "rgba(91,140,255,0.16)",
    color: "#cbd8ff",
    fontFamily: mono,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  hint: {
    margin: "9px 0 0",
    color: "#74798a",
    fontSize: 10,
    lineHeight: 1.5,
  },
  fileError: {
    margin: "7px 0 0",
    color: "#ff8f8f",
    fontSize: 10,
    lineHeight: 1.5,
  },
  viewer: {
    position: "relative",
    minHeight: 0,
    flex: 1,
    overflow: "hidden",
    backgroundImage:
      "linear-gradient(45deg, #101119 25%, transparent 25%), linear-gradient(-45deg, #101119 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #101119 75%), linear-gradient(-45deg, transparent 75%, #101119 75%)",
    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
    backgroundSize: "16px 16px",
  },
  emptyState: {
    position: "absolute",
    left: "50%",
    top: "50%",
    display: "flex",
    minWidth: 280,
    flexDirection: "column",
    alignItems: "center",
    gap: 9,
    padding: "36px 42px",
    transform: "translate(-50%, -50%)",
    border: "1px dashed rgba(111,152,255,0.45)",
    borderRadius: 12,
    background: "rgba(17,18,25,0.82)",
    color: "#dfe2ea",
    fontFamily: mono,
    cursor: "pointer",
  },
  dropIcon: {
    display: "grid",
    width: 58,
    height: 58,
    marginBottom: 5,
    placeItems: "center",
    border: "1px solid rgba(111,152,255,0.55)",
    borderRadius: 10,
    background: "rgba(91,140,255,0.12)",
    color: "#9db8ff",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.05em",
  },
  dropTitle: {
    color: "#e4e7ef",
    fontSize: 13,
  },
  dropHint: {
    color: "#74798a",
    fontSize: 10,
  },
  dropOverlay: {
    position: "absolute",
    inset: 16,
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    border: "2px dashed rgba(111,152,255,0.75)",
    borderRadius: 12,
    background: "rgba(9,10,15,0.88)",
    backdropFilter: "blur(8px)",
    pointerEvents: "none",
  },
  performanceHud: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 4,
    width: 150,
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid rgba(111,152,255,0.28)",
    borderRadius: 8,
    background: "rgba(12,13,19,0.86)",
    color: "#858b9d",
    fontFamily: mono,
    fontSize: 10,
    lineHeight: 1.5,
    backdropFilter: "blur(10px)",
    pointerEvents: "none",
  },
  performanceTitle: {
    display: "block",
    marginBottom: 6,
    color: "#6f98ff",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.12em",
  },
  performanceRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    color: "#74798a",
  },
  infoPanel: {
    position: "absolute",
    left: 18,
    bottom: 18,
    display: "grid",
    gridTemplateColumns: "minmax(120px, 1.5fr) repeat(4, minmax(72px, auto))",
    gap: 18,
    padding: "12px 14px",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 8,
    background: "rgba(12,13,19,0.84)",
    backdropFilter: "blur(10px)",
    pointerEvents: "none",
  },
  infoLabel: {
    display: "block",
    marginBottom: 3,
    color: "#666c80",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "0.1em",
  },
  infoValue: {
    display: "block",
    maxWidth: 190,
    color: "#cfd4df",
    fontSize: 11,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  loadingBadge: {
    position: "absolute",
    left: "50%",
    top: "50%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    transform: "translate(-50%, -50%)",
    color: "#83899a",
    fontSize: 11,
    pointerEvents: "none",
  },
  loadingDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#6f98ff",
    boxShadow: "0 0 12px rgba(111,152,255,0.85)",
  },
  statusPanel: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: 30,
    boxSizing: "border-box",
    background: "#090a0f",
    textAlign: "center",
  },
  statusText: {
    maxWidth: 540,
    color: "#898e9c",
    fontSize: 12,
    lineHeight: 1.6,
  },
  errorDetail: {
    maxWidth: 600,
    color: "#626776",
    fontSize: 10,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
};

export default KtxViewer;
