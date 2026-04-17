// src/spark/SplatViewer.tsx
import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import * as THREE from "three";
import "./SplatMesh";
import "./SparkRenderer";

interface SplatViewerProps {
  url: string;
  onLoad?: (bounds: THREE.Box3) => void;
  onError?: (error: Error) => void;
}

export function SplatViewer({ url, onLoad }: SplatViewerProps) {
  const { gl, camera, controls, invalidate } = useThree();

  // Dùng STATE thay vì ref - để React re-render đúng cách
  const [spark, setSpark] = useState<SparkRenderer | null>(null);
  const [splat, setSplat] = useState<SplatMesh | null>(null);

  // Tạo SparkRenderer trong effect
  useEffect(() => {
    const s = new SparkRenderer({ renderer: gl });
    console.log("[SplatViewer] SparkRenderer created");
    setSpark(s);

    return () => {
      console.log("[SplatViewer] Disposing SparkRenderer");
      s.dispose?.();
    };
  }, [gl]);

  // Tạo SplatMesh sau khi spark đã mount
  useEffect(() => {
    if (!spark) return; // Chờ spark mount xong

    console.log("[SplatViewer] Creating SplatMesh with url:", url);
    let cancelled = false;

    const instance = new SplatMesh({
      url,
      onLoad: () => {
        if (cancelled) return;
        console.log("[SplatViewer] SplatMesh loaded!");

        const box = new THREE.Box3().setFromObject(instance);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        console.log("[SplatViewer] Bounds:", {
          center: center.toArray(),
          size: size.toArray(),
        });

        instance.position.sub(center);

        if (camera instanceof THREE.PerspectiveCamera) {
          const fov = camera.fov * (Math.PI / 180);
          const distance = (maxDim / 2 / Math.tan(fov / 2)) * 1.8;
          camera.position.set(0, 0, distance);
          camera.near = Math.max(0.01, distance / 100);
          camera.far = distance * 100;
          camera.updateProjectionMatrix();
          camera.lookAt(0, 0, 0);

          const ctrl = controls as any;
          if (ctrl?.target) {
            ctrl.target.set(0, 0, 0);
            ctrl.update?.();
          }
        }

        // Force R3F re-render (quan trọng khi frameloop="demand")
        invalidate();

        onLoad?.(box);
      },
    });
    instance.quaternion.set(1, 0, 0, 0);
    setSplat(instance);

    return () => {
      console.log("[SplatViewer] Cleanup SplatMesh");
      cancelled = true;
      setSplat(null);
      instance.dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, spark]);

  // Render khi cả 2 đã sẵn sàng
  if (!spark) return null;

  return (
    <>
      <primitive object={spark} />
      {splat && <primitive object={splat} />}
    </>
  );
}
