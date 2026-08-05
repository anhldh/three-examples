import { useState } from "react";

export type ExampleId =
  | "model"
  | "ply"
  | "lod"
  | "spark"
  | "animation-pointer"
  | "model-viewer"
  | "environment-light"
  | "fireball"
  | "explosion"
  | "snows"
  | "clouds"
  | "baked"
  | "rain"
  | "path"
  | "train"
  | "nobook"
  | "camera-controls"
  | "3dtiles"
  | "cesium";

interface Example {
  id: ExampleId;
  title: string;
  description: string;
  tags: string[];
  // Ảnh thumbnail. Tự thay link ở đây.
  image?: string;
}

const EXAMPLES: Example[] = [
  {
    id: "snows",
    title: "shader / snow",
    description: "Hiển thị hiệu ứng tuyết rơi",
    tags: ["three.js", "shader", "snow"],
    image: "/example-thumbnail/8.jpg",
  },
  {
    id: "lod",
    title: "gltf / lod",
    description: "Bộ hiển thị gltf với nhiều mức độ chi tiết (LOD).",
    tags: ["three.js", "gltf", "lod"],
    image: "/example-thumbnail/3.jpg",
  },
  {
    id: "animation-pointer",
    title: "animation / pointer",
    description: "Xử lý Animation Pointer",
    tags: ["three.js", "gltf", "animation-pointer"],
    image: "/example-thumbnail/4.jpg",
  },
  {
    id: "train",
    title: "game / train",
    description: "Game threejs",
    tags: ["three.js", "gltf", "game"],
    image: "/example-thumbnail/12.jpg",
  },
  {
    id: "path",
    title: "navmesh / path finding",
    description: "Tìm đường đi cho nhân vật trong model",
    tags: ["three.js", "navmesh", "path"],
    image: "/example-thumbnail/10.jpg",
  },
  {
    id: "nobook",
    title: "nobook /simulation",
    description: "Mô phỏng nobook",
    tags: ["three.js", "simulation", "nobook"],
    image: "/example-thumbnail/13.jpg",
  },
  {
    id: "model-viewer",
    title: "model-viewer / google",
    description:
      "Hiển thị glb với nhiều mức độ chi tiết (LOD) cho model-viewer (google).",
    tags: ["glb", "lod", "model-viewer"],
    image: "/example-thumbnail/3.jpg",
  },
  {
    id: "model",
    title: "model / glb / shadow",
    description:
      "Xem model GLB với ground shadow, environment HDR và điều khiển ánh sáng / ground qua Leva.",
    tags: ["react-three-fiber", "drei", "leva", "shadow"],
    image: "/example-thumbnail/1.jpg",
  },
  {
    id: "ply",
    title: "ply / point cloud",
    description:
      "Kéo thả file .ply để xem point cloud hoặc mesh. Hỗ trợ cả định dạng ASCII và Binary PLY.",
    tags: ["three.js", "point cloud", "mesh", "drag & drop"],
    image: "/example-thumbnail/2.jpg",
  },

  {
    id: "spark",
    title: "spark / gaussian splatting",
    description: "Bọ hiển thị gaussian splatting, ply.",
    tags: ["three.js", "gaussian-splatting"],
    image: "/example-thumbnail/11.jpg",
  },

  {
    id: "environment-light",
    title: "environment / light",
    description: "Ánh sáng hiển thị model",
    tags: ["glb", "light", "environment"],
    image: "/example-thumbnail/5.jpg",
  },
  {
    id: "fireball",
    title: "shader / fireball",
    description: "Hiển thị hiệu ứng fireball",
    tags: ["three.js", "shader", "fire"],
    image: "/example-thumbnail/6.jpg",
  },
  {
    id: "explosion",
    title: "shader / explosion",
    description: "Hiển thị hiệu ứng nổ",
    tags: ["three.js", "shader", "explosion"],
    image: "/example-thumbnail/7.jpg",
  },
  // {
  //   id: "baked",
  //   title: "shader / baked lighting",
  //   description: "Hiển thị hiệu ứng baked Lighting",
  //   tags: ["three.js", "shader", "baked Lighting"],
  //   image: "",
  // },
  {
    id: "rain",
    title: "shader / rain",
    description: "Hiển thị hiệu ứng mưa",
    tags: ["three.js", "shader", "rain"],
    image: "/example-thumbnail/9.jpg",
  },
  {
    id: "3dtiles",
    title: "3d-tiles / viewer",
    description: "Hiển thị tileset 3D Tiles bằng 3d-tiles-renderer.",
    tags: ["three.js", "3d-tiles", "streaming"],
  },
  {
    id: "cesium",
    title: "cesium / 3d-tiles",
    description: "Hiển thị cùng tileset bằng CesiumJS để so sánh.",
    tags: ["cesium", "3d-tiles"],
  },
  {
    id: "camera-controls",
    title: "camera-controls / demo",
    description: "Demo camera-controls",
    tags: ["three.js", "camera-controls", "demo"],
    // image: "/example-thumbnail/14.jpg",
  },
];

interface HomeProps {
  current: ExampleId | null;
  onSelect: (id: ExampleId) => void;
}

const mono = "'JetBrains Mono', 'Fira Code', monospace";

const Home = ({ current, onSelect }: HomeProps) => {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? EXAMPLES.filter(
        (ex) =>
          ex.title.toLowerCase().includes(q) ||
          ex.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : EXAMPLES;

  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        height: "100vh",
        boxSizing: "border-box",
        background: "#0e0e12",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        color: "#c8cad0",
        fontFamily: mono,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          padding: "18px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 800, color: "#5b8cff" }}>
          r3f
        </span>
        <span style={{ fontSize: 14, color: "#e0e2e8" }}>playground</span>
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ color: "#777799", fontSize: 14 }}>⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#e0e2e8",
            fontFamily: mono,
            fontSize: 13,
          }}
        />
      </div>

      {/* Category */}
      <div
        style={{
          padding: "16px 20px 8px",
          fontSize: 13,
          fontWeight: 700,
          color: "#5b8cff",
        }}
      >
        webgl
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 20px" }}>
        {filtered.map((ex) => {
          const active = ex.id === current;
          return (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                marginBottom: 14,
                padding: 6,
                border: "1px solid",
                borderColor: active ? "rgba(91,140,255,0.6)" : "transparent",
                borderRadius: 8,
                background: active ? "rgba(91,140,255,0.08)" : "transparent",
                cursor: "pointer",
                color: "inherit",
                fontFamily: "inherit",
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  borderRadius: 6,
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #26263a, #16161f)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {ex.image ? (
                  <img
                    src={ex.image}
                    alt={ex.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 11, color: "#555577" }}>
                    no preview
                  </span>
                )}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: active ? "#e0e2e8" : "#b6b8c2",
                  lineHeight: 1.4,
                }}
              >
                {ex.title}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: "#777799",
                  lineHeight: 1.4,
                }}
              >
                {ex.description}
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: "20px 6px", fontSize: 12, color: "#777799" }}>
            Không có kết quả.
          </div>
        )}
      </div>
    </aside>
  );
};

export default Home;
