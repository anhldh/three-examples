import "@anhldh/model-viewer";
import "@anhldh/model-viewer/react";

const ModelViewerGoogle = () => {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <model-viewer
        // src="/thuydien.glb"
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
          backgroundColor: "#f0f0f0",
        }}
      ></model-viewer>
    </div>
  );
};

export default ModelViewerGoogle;
