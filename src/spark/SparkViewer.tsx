// src/spark/SparkViewer.tsx
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Grid,
  Stats,
  PerspectiveCamera,
} from "@react-three/drei";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useControls } from "leva";
import { detectPlyType, type PlyInfo } from "./plyDetect";
import { SplatViewer } from "./SplatViewer";
import { MeshViewer } from "./MeshViewer";
import { PointCloudViewer } from "./PointCloudViewer";
import { LoadingOverlay } from "../common/LoadingOverlay";

interface DetectResult {
  url: string;
  info: PlyInfo | null;
  error: string | null;
}

export default function SparkViewer() {
  const [url, setUrl] = useState<string>(
    "https://sparkjs.dev/assets/splats/butterfly.spz",
  );
  const [detectResult, setDetectResult] = useState<DetectResult>({
    url: "",
    info: null,
    error: null,
  });
  // Trạng thái hover cho nút upload
  const [isDragOver, setIsDragOver] = useState(false);

  // Loading = khi url hiện tại CHƯA có result tương ứng
  const loading = detectResult.url !== url && !detectResult.error;
  const info = detectResult.url === url ? detectResult.info : null;
  const error = detectResult.url === url ? detectResult.error : null;

  const { showGrid, showStats, pointSize, background } = useControls({
    showGrid: false,
    showStats: false,
    pointSize: { value: 0.01, min: 0.001, max: 0.1, step: 0.001 },
    background: "#1a1a2e", // Chỉnh màu tối một chút cho hợp với theme Playground
  });

  // Effect chỉ gọi setState trong callback async, không gọi đồng bộ ở đầu
  useEffect(() => {
    let cancelled = false;

    detectPlyType(url)
      .then((info) => {
        if (!cancelled) {
          setDetectResult({ url, info, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDetectResult({ url, info: null, error: err.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validExts = ["ply", "spz", "splat", "ksplat", "sog"];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !validExts.includes(ext)) {
        setDetectResult({
          url,
          info: null,
          error: `Định dạng không hỗ trợ. Dùng: ${validExts.join(", ")}`,
        });
        return;
      }

      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }

      setUrl(URL.createObjectURL(file));
    },
    [url],
  );

  const handleUrlSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newUrl = formData.get("url") as string;
    if (newUrl) setUrl(newUrl);
  }, []);

  const renderViewer = () => {
    if (!info) return null;
    console.log(info.type);

    switch (info.type) {
      case "gaussian-splat":
        return (
          <SplatViewer
            url={url}
            onError={(err) =>
              setDetectResult({ url, info: null, error: err.message })
            }
          />
        );
      case "mesh":
        return <MeshViewer url={url} hasColor={info.hasColor} />;
      case "pointcloud":
        return (
          <PointCloudViewer
            url={url}
            hasColor={info.hasColor}
            pointSize={pointSize}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* --- BẮT ĐẦU PHẦN CONTROL UI ĐÃ ĐƯỢC LÀM ĐẸP --- */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          zIndex: 10,
          background: "rgba(15, 15, 20, 0.85)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          padding: 20,
          borderRadius: 16,
          color: "#e0e2e8",
          width: 340,
          fontFamily: "'JetBrains Mono', 'Fira Code', system-ui, sans-serif",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
            color: "#fff",
          }}
        >
          Tải Mô Hình
        </div>

        {/* Nút Upload File (Ẩn input mặc định) */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 12px",
              background: isDragOver
                ? "rgba(91, 140, 255, 0.1)"
                : "rgba(255, 255, 255, 0.03)",
              border: `2px dashed ${isDragOver ? "#5b8cff" : "rgba(255, 255, 255, 0.2)"}`,
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={() => setIsDragOver(true)}
            onMouseLeave={() => setIsDragOver(false)}
          >
            <span style={{ fontSize: 24, marginBottom: 8 }}>📁</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: isDragOver ? "#5b8cff" : "#ccc",
              }}
            >
              Chọn file từ máy tính
            </span>
            <span style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              Hỗ trợ: .ply, .spz, .splat
            </span>
            <input
              type="file"
              accept=".ply,.spz,.splat,.ksplat,.sog"
              onChange={handleFileUpload}
              style={{ display: "none" }} // Ẩn input xấu xí đi
            />
          </label>
        </div>

        {/* Đường kẻ ngang (Divider) */}
        <div
          style={{ display: "flex", alignItems: "center", margin: "16px 0" }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: "rgba(255, 255, 255, 0.1)",
            }}
          />
          <span
            style={{
              padding: "0 12px",
              fontSize: 11,
              color: "#777",
              fontWeight: 600,
            }}
          >
            HOẶC
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: "rgba(255, 255, 255, 0.1)",
            }}
          />
        </div>

        {/* Form nhập URL */}
        <form
          onSubmit={handleUrlSubmit}
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          <input
            name="url"
            type="url"
            placeholder="Nhập URL..."
            defaultValue={url}
            style={{
              flex: 1,
              padding: "10px 12px",
              background: "rgba(0, 0, 0, 0.3)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#5b8cff")}
            onBlur={(e) =>
              (e.target.style.borderColor = "rgba(255, 255, 255, 0.15)")
            }
          />
          <button
            type="submit"
            style={{
              padding: "0 16px",
              background: "linear-gradient(135deg, #3b5dff, #6b3bff)",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Load
          </button>
        </form>

        {/* Hiển thị Thông tin file */}
        {info && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              background: "rgba(255, 255, 255, 0.03)",
              padding: 12,
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ color: "#888" }}>Phân loại:</span>
              <span
                style={{
                  color: "#5b8cff",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {info.type.replace("-", " ")}
              </span>
            </div>
            {info.vertexCount > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "#888" }}>Điểm ảnh (Vertices):</span>
                <span>{info.vertexCount.toLocaleString()}</span>
              </div>
            )}
            {info.faceCount > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "#888" }}>Mặt cắt (Faces):</span>
                <span>{info.faceCount.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {info.hasColor && (
                <span
                  style={{
                    background: "rgba(25, 198, 74, 0.1)",
                    color: "#19c64a",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                  }}
                >
                  ✓ Màu Vertex
                </span>
              )}
              {info.hasNormal && (
                <span
                  style={{
                    background: "rgba(107, 59, 255, 0.1)",
                    color: "#9a7bff",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                  }}
                >
                  ✓ Normals
                </span>
              )}
            </div>
          </div>
        )}

        {/* Hiển thị Lỗi */}
        {error && (
          <div
            style={{
              color: "#ff6b9d",
              background: "rgba(255, 59, 93, 0.1)",
              padding: "10px 12px",
              borderRadius: 8,
              marginTop: 12,
              fontSize: 12,
              border: "1px solid rgba(255, 59, 93, 0.2)",
            }}
          >
            ⚠️ {error}
          </div>
        )}
      </div>
      {/* --- KẾT THÚC PHẦN CONTROL UI --- */}

      {/* Loading overlay */}
      {loading && <LoadingOverlay />}

      {/* Canvas */}
      <Canvas style={{ background }}>
        <PerspectiveCamera position={[0, 0, 0]} />
        <Suspense fallback={null}>{renderViewer()}</Suspense>

        {info?.type !== "gaussian-splat" && (
          <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <directionalLight position={[-5, -5, -5]} intensity={0.3} />
            <Environment preset="studio" background={false} />
          </>
        )}

        {showGrid && <Grid infiniteGrid cellSize={0.5} sectionSize={5} />}
        {showStats && <Stats />}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
