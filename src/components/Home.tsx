export type ExampleId = "model" | "ply" | "lod" | "spark" | "animation-pointer";

interface Example {
  id: ExampleId;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  accent: string;
}

const EXAMPLES: Example[] = [
  {
    id: "model",
    title: "Model Viewer",
    subtitle: "GLB + Ground Shadow",
    description:
      "Xem model GLB với ground shadow, environment HDR và điều khiển ánh sáng / ground qua Leva.",
    tags: ["react-three-fiber", "drei", "leva", "shadow"],
    accent: "linear-gradient(135deg, #3b5dff, #6b3bff)",
  },
  {
    id: "ply",
    title: "PLY Viewer",
    subtitle: "Point Cloud & Mesh",
    description:
      "Kéo thả file .ply để xem point cloud hoặc mesh. Hỗ trợ cả định dạng ASCII và Binary PLY.",
    tags: ["three.js", "point cloud", "mesh", "drag & drop"],
    accent: "linear-gradient(135deg, #ff6b9d, #ff3b5d)",
  },
  {
    id: "lod",
    title: "GLB LOD",
    subtitle: "LOD",
    description: "Bộ hiển thị gltf với nhiều mức độ chi tiết (LOD).",
    tags: ["three.js", "gltf", "lod"],
    accent: "linear-gradient(135deg, #6a7429, #7b9a1c)",
  },
  {
    id: "spark",
    title: "Spark Viewer",
    subtitle: "Spark",
    description: "Bọ hiển thị gaussian splatting, ply.",
    tags: ["three.js", "gaussian-splatting"],
    accent: "linear-gradient(135deg, #19c64a, #19c64a)",
  },
  {
    id: "animation-pointer",
    title: "Animation Pointer",
    subtitle: "Animation Pointer",
    description: "Xử lý Animation Pointer",
    tags: ["three.js", "gltf", "animation-pointer"],
    accent: "linear-gradient(135deg, #0b1072ff, #2210e7ff)",
  },
];

interface HomeProps {
  onSelect: (id: ExampleId) => void;
}

const Home = ({ onSelect }: HomeProps) => {
  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 20%, #1a1a2e 0%, #0a0a0f 60%)",
        color: "#c8cad0",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        padding: "64px 32px",
        boxSizing: "border-box",
        overflowX: "hidden", // Tránh lỗi cuộn ngang
      }}
    >
      {/* SỬA 1: Nới rộng maxWidth lên 1600 để hiển thị được nhiều item hơn trên màn hình to */}
      <div style={{ maxWidth: 1600, width: "100%", margin: "0 auto" }}>
        <header style={{ marginBottom: 48, textAlign: "center" }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 2,
              color: "#5b8cff",
              marginBottom: 8,
            }}
          >
            THREE.JS · PLAYGROUND
          </div>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 800,
              margin: 0,
              color: "#e0e2e8",
              letterSpacing: -0.5,
            }}
          >
            Examples
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#777799",
              margin: "12px auto 0",
              maxWidth: 620,
              lineHeight: 1.6,
            }}
          >
            Danh sách các ví dụ trong dự án. Nhấn vào một thẻ bên dưới để mở ví
            dụ tương ứng.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {EXAMPLES.map((ex, idx) => (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              style={{
                // SỬA 2: Ép button thành dạng flex-column & height 100%
                display: "flex",
                flexDirection: "column",
                height: "100%",
                textAlign: "left",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: 0,
                cursor: "pointer",
                color: "inherit",
                fontFamily: "inherit",
                overflow: "hidden",
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "rgba(91,140,255,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <div
                style={{
                  height: 140,
                  width: "100%",
                  background: ex.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  flexShrink: 0, // Đảm bảo phần màu không bị ép lùn đi
                }}
              >
                <span
                  style={{
                    fontSize: 72,
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.25)",
                    letterSpacing: -2,
                  }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 14,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    color: "rgba(255,255,255,0.85)",
                    fontWeight: 700,
                  }}
                >
                  {ex.subtitle.toUpperCase()}
                </div>
              </div>

              {/* SỬA 3: Cho content flexGrow: 1 để tự chiếm khoảng trống, đẩy các tags xuống sát đáy */}
              <div
                style={{
                  padding: "18px 20px 20px",
                  display: "flex",
                  flexDirection: "column",
                  flexGrow: 1,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#e0e2e8",
                    marginBottom: 6,
                  }}
                >
                  {ex.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#888",
                    lineHeight: 1.6,
                    marginBottom: 14,
                    flexGrow: 1, // Điểm mấu chốt để ép các card có chiều cao bằng nhau
                  }}
                >
                  {ex.description}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ex.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: "rgba(91,140,255,0.1)",
                        color: "#8ba6ff",
                        border: "1px solid rgba(91,140,255,0.2)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
