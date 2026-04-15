// Bỏ useHelper đi, dùng CameraHelper thủ công
import { useRef, useEffect, useMemo } from "react";
import { DirectionalLight, Object3D, CameraHelper } from "three";
import { useThree } from "@react-three/fiber";
import { useControls } from "leva";

export function Lighting() {
  const lightRef = useRef<DirectionalLight>(null!);
  const target = useMemo(() => new Object3D(), []);
  const { scene } = useThree();

  const { color, intensity } = useControls("Directional Light", {
    color: { value: "#ffffff" },
    intensity: { value: 5.5, min: 0, max: 20, step: 0.1 },
  });

  const position = useControls("DL Position", {
    x: { value: 200, min: -200, max: 200, step: 1 },
    y: { value: 181, min: -200, max: 200, step: 1 },
    z: { value: 102, min: -200, max: 200, step: 1 },
  });

  const targetPos = useControls("DL Target", {
    tx: { value: 0, min: -200, max: 200, step: 1, label: "X" },
    ty: { value: 0, min: -200, max: 200, step: 1, label: "Y" },
    tz: { value: 0, min: -200, max: 200, step: 1, label: "Z" },
  });

  const shadow = useControls("DL Shadow", {
    bias: { value: -0.001, min: -0.01, max: 0.01, step: 0.0001 },
    mapSize: { value: 4096, min: 512, max: 8192, step: 512 },
    near: { value: 0.5, min: 0.1, max: 50, step: 0.1 },
    far: { value: 500, min: 10, max: 1000, step: 10 },
    left: { value: -200, min: -500, max: 0, step: 5 },
    right: { value: 200, min: 0, max: 500, step: 5 },
    top: { value: 200, min: 0, max: 500, step: 5 },
    bottom: { value: -200, min: -500, max: 0, step: 5 },
  });

  const { showHelper } = useControls("Debug", {
    showHelper: { value: true, label: "Shadow Camera" },
  });

  // Shadow camera helper - add/remove manually
  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;

    let helper: CameraHelper | null = null;

    if (showHelper) {
      helper = new CameraHelper(light.shadow.camera);
      scene.add(helper);
    }

    return () => {
      if (helper) {
        scene.remove(helper);
        helper.dispose();
      }
    };
  }, [showHelper, scene]);

  // Update shadow camera + target
  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;

    target.position.set(targetPos.tx, targetPos.ty, targetPos.tz);
    target.updateMatrixWorld();
    light.target = target;

    const cam = light.shadow.camera;
    cam.near = shadow.near;
    cam.far = shadow.far;
    cam.left = shadow.left;
    cam.right = shadow.right;
    cam.top = shadow.top;
    cam.bottom = shadow.bottom;
    cam.updateProjectionMatrix();

    light.shadow.needsUpdate = true;
  }, [
    shadow.near,
    shadow.far,
    shadow.left,
    shadow.right,
    shadow.top,
    shadow.bottom,
    targetPos.tx,
    targetPos.ty,
    targetPos.tz,
    target,
  ]);

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={lightRef}
        color={color}
        position={[position.x, position.y, position.z]}
        intensity={intensity}
        castShadow
        shadow-bias={shadow.bias}
        shadow-mapSize={[shadow.mapSize, shadow.mapSize]}
      />
    </>
  );
}
