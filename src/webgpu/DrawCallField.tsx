import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";

interface DrawCallFieldProps {
  meshCount: number;
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5));

/**
 * Intentionally creates individual meshes instead of instances or a batched
 * mesh. Every visible object is therefore submitted as its own draw call.
 */
const DrawCallField = ({ meshCount }: DrawCallFieldProps) => {
  const field = useMemo(() => {
    const geometry = new THREE.BoxGeometry(0.075, 0.075, 0.22);
    const material = new THREE.MeshNormalNodeMaterial();
    const group = new THREE.Group();
    const position = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, 1);

    group.name = `${meshCount.toLocaleString()} individual draw calls`;
    group.rotation.set(-0.12, 0, 0.18);
    group.matrixAutoUpdate = false;
    group.updateMatrix();

    for (let index = 0; index < meshCount; index += 1) {
      const ratio = (index + 0.5) / meshCount;
      const y = 1 - ratio * 2;
      const ringRadius = Math.sqrt(1 - y * y);
      const angle = goldenAngle * index;
      const shellRadius =
        2.65 + Math.sin(index * 12.9898) * 0.32 + (index % 7) * 0.025;

      position.set(
        Math.cos(angle) * ringRadius * shellRadius,
        y * shellRadius,
        Math.sin(angle) * ringRadius * shellRadius,
      );
      direction.copy(position).normalize();

      const mesh = new THREE.Mesh(geometry, material);
      const scale = 0.72 + ((index * 37) % 100) / 250;

      mesh.position.copy(position);
      mesh.quaternion.setFromUnitVectors(forward, direction);
      mesh.scale.setScalar(scale);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.updateMatrix();
      group.add(mesh);
    }

    return { geometry, group, material };
  }, [meshCount]);

  useEffect(
    () => () => {
      field.group.clear();
      field.geometry.dispose();
      field.material.dispose();
    },
    [field],
  );

  return <primitive object={field.group} />;
};

export default DrawCallField;
