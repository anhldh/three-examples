import { useEffect, useRef, useState } from "react";
import {
  BoundingSphere,
  Cartesian3,
  Cesium3DTileFeature,
  Cesium3DTileset,
  Color,
  HeadingPitchRange,
  Ion,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Thêm VITE_CESIUM_ION_TOKEN vào .env
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

const ION_ASSET_ID = 5069750;

// Vị trí đặt tạm tileset (Hà Nội). HEIGHT nâng model lên khỏi mặt đất.
const LON = 105.8342;
const LAT = 21.0278;
const HEIGHT = 2.6;

const CesiumViewer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<string[] | null>(null);

  useEffect(() => {
    const viewer = new Viewer(containerRef.current!, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      infoBox: false,
      selectionIndicator: false,
    });

    let activeFeature: Cesium3DTileFeature | null = null;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
      // Trả lại màu cho cấu kiện chọn trước đó
      if (activeFeature) {
        activeFeature.color = Color.WHITE;
        activeFeature = null;
      }

      const picked = viewer.scene.pick(event.position);
      if (!(picked instanceof Cesium3DTileFeature)) {
        setInfo(null);
        return;
      }

      picked.color = Color.YELLOW;
      activeFeature = picked;

      // Property table dùng chung cho mọi loại IFC nên đa số property rỗng,
      // chỉ hiện những cái feature này thực sự có giá trị.
      const props = picked
        .getPropertyIds()
        .map((id) => [id, picked.getProperty(id)] as const)
        .filter(
          ([, value]) => value !== undefined && value !== null && value !== "",
        );

      setInfo([
        `featureId: ${picked.featureId}`,
        ...props.map(([id, value]) => `${id}: ${value}`),
      ]);

      // Bay tới điểm vừa click
      const position = viewer.scene.pickPosition(event.position);
      if (position) {
        viewer.camera.flyToBoundingSphere(new BoundingSphere(position, 2), {
          offset: new HeadingPitchRange(
            viewer.camera.heading,
            CesiumMath.toRadians(-35),
            15,
          ),
          duration: 1,
        });
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    let disposed = false;

    Cesium3DTileset.fromIonAssetId(ION_ASSET_ID, {
      maximumScreenSpaceError: 16,
      // Tileset không georeference sẵn nên tự đặt vào toạ độ mong muốn.
      // Nếu Ion đã gán vị trí cho asset thì bỏ dòng này đi.
      modelMatrix: Transforms.eastNorthUpToFixedFrame(
        Cartesian3.fromDegrees(LON, LAT, HEIGHT),
      ),
    })
      .then((tileset) => {
        if (disposed) return;
        viewer.scene.primitives.add(tileset);
        return viewer.zoomTo(tileset);
      })
      .catch((err) => console.error("Cesium tileset load error:", err));

    return () => {
      disposed = true;
      handler.destroy();
      viewer.destroy();
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {info && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            maxHeight: "60%",
            overflow: "auto",
            padding: "10px 14px",
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            borderRadius: 6,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {info.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CesiumViewer;
