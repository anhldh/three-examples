import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import {
  TWO_PI,
  color,
  cos,
  float,
  mix,
  range,
  sin,
  time,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";

interface GalaxySceneProps {
  particleCount: number;
}

const GalaxyScene = ({ particleCount }: GalaxySceneProps) => {
  const galaxy = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.SpriteNodeMaterial({
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const size = uniform(0.08);
    material.scaleNode = range(0, 1).mul(size);

    const radiusRatio = range(0, 1);
    const radius = radiusRatio.pow(1.5).mul(5).toVar();
    const branches = 3;
    const branchAngle = range(0, branches)
      .floor()
      .mul(TWO_PI.div(branches));
    const angle = branchAngle.add(time.mul(radiusRatio.oneMinus()));
    const position = vec3(cos(angle), 0, sin(angle)).mul(radius);
    const randomOffset = range(vec3(-1), vec3(1))
      .pow3()
      .mul(radiusRatio)
      .add(0.2);

    material.positionNode = position.add(randomOffset);

    const colorInside = uniform(color("#ffa575"));
    const colorOutside = uniform(color("#311599"));
    const colorFinal = mix(
      colorInside,
      colorOutside,
      radiusRatio.oneMinus().pow(2).oneMinus(),
    );
    const alpha = float(0.1).div(uv().sub(0.5).length()).sub(0.2);
    material.colorNode = vec4(colorFinal, alpha);

    const mesh = new THREE.InstancedMesh(geometry, material, particleCount);
    mesh.name = `Galaxy ${particleCount.toLocaleString()} particles`;
    mesh.frustumCulled = false;

    return { geometry, material, mesh };
  }, [particleCount]);

  useEffect(
    () => () => {
      galaxy.mesh.dispose();
      galaxy.geometry.dispose();
      galaxy.material.dispose();
    },
    [galaxy],
  );

  return <primitive object={galaxy.mesh} />;
};

export default GalaxyScene;
