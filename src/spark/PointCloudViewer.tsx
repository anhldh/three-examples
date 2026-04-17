// src/components/viewers/PointCloudViewer.tsx
import { useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import * as THREE from "three";

interface PointCloudViewerProps {
  url: string;
  hasColor?: boolean;
  pointSize?: number;
  onLoad?: (bounds: THREE.Box3) => void;
}

export function PointCloudViewer({
  url,
  hasColor,
  pointSize = 0.01,
  onLoad,
}: PointCloudViewerProps) {
  const geometry = useLoader(PLYLoader, url);
  const { camera } = useThree();

  const { centeredGeometry, bounds } = useMemo(() => {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const center = bb.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingBox();
    return { centeredGeometry: geometry, bounds: geometry.boundingBox! };
  }, [geometry]);

  useEffect(() => {
    const size = bounds.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = camera.fov * (Math.PI / 180);
      const distance = (maxDim / 2 / Math.tan(fov / 2)) * 2;
      camera.position.set(distance, distance, distance);
      camera.lookAt(0, 0, 0);
    }

    onLoad?.(bounds);
  }, [bounds, camera, onLoad]);

  return (
    <points geometry={centeredGeometry}>
      <pointsMaterial
        size={pointSize}
        sizeAttenuation
        vertexColors={hasColor}
        color={hasColor ? 0xffffff : 0x88ccff}
      />
    </points>
  );
}
