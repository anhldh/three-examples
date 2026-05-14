import { useEffect } from "react";

const ModelViewerGoogle = () => {
  useEffect(() => {
    const loadScript = (id: string, src: string) => {
      if (document.getElementById(id)) return;

      const script = document.createElement("script");
      script.id = id;
      script.type = "module";
      script.src = src;
      document.head.appendChild(script);
    };
    loadScript("gltf-lod-loader", "/gltf-lod-loader.min.js");
    loadScript(
      "google-model-viewer",
      "https://ajax.googleapis.com/ajax/libs/model-viewer/4.2.0/model-viewer.min.js",
    );
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <model-viewer
        src="https://development.imaxhitech.com:9990/models/rPsVVr_M0A9xNNiQC_/lod/file.glb"
        alt="A 3D model"
        auto-rotate
        camera-controls
        autoplay
        camera-orbit="-29.44deg 90deg 10.67m"
        field-of-view="30deg"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#f0f0f0", // Thêm màu nền cho dễ debug lúc model đang load
        }}
      ></model-viewer>
    </div>
  );
};

export default ModelViewerGoogle;
