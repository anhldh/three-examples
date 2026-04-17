// src/components/LoadingOverlay.tsx
export function LoadingOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.8)",
          padding: "20px 40px",
          borderRadius: 8,
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Đang phân tích PLY...
      </div>
    </div>
  );
}
