/* eslint-disable react-hooks/purity */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SimpleRain — chỉ hiệu ứng mưa rơi, không collision, không ripple.
 *
 * Không cần GPGPU ping-pong: vị trí hạt tính thẳng trong vertex shader theo time.
 * Mỗi hạt có vị trí gốc (x,z) + offset ngẫu nhiên, y rơi theo công thức
 * y = startY - mod(time * speed + seed, range). Khi rơi hết range thì wrap về đỉnh.
 *
 * GPU cost gần như bằng 0: 1 draw call instanced, không render target, không pass nào thừa.
 */

const rainVert = /* glsl */ `
  uniform float uTime;
  uniform float uTopY;       // độ cao đỉnh mưa
  uniform float uRangeY;     // chiều cao vùng mưa
  attribute vec3 aOffset;    // x,z vị trí; y = seed pha rơi
  attribute float aSpeed;
  varying vec2 vUv;

  void main() {
    vUv = uv;

    float fall = mod(uTime * aSpeed + aOffset.y * uRangeY, uRangeY);
    vec3 instancePos = vec3(aOffset.x, uTopY - fall, aOffset.z);

    // billboarding: quad luôn quay về camera
    vec4 mvCenter = modelViewMatrix * vec4(instancePos, 1.0);
    mvCenter.xy += position.xy;
    gl_Position = projectionMatrix * mvCenter;
  }
`;

const rainFrag = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    // sáng dần về đáy giọt, giống bản gốc
    float d = distance(vUv, vec2(0.5, 0.0));
    float c = exp((1.0 - d) * 3.0) * 0.1;
    gl_FragColor = vec4(vec3(c), uOpacity);
  }
`;

export default function SimpleRain({
  count = 8000,
  area = 100, // bề rộng vùng mưa (x,z trải từ -area/2 đến area/2)
  topY = 25, // đỉnh
  rangeY = 25, // chiều cao rơi
  dropSize = [0.1, 2],
  opacity = 0.2,
}) {
  const matRef = useRef<any>(null);

  const geometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(dropSize[0], dropSize[1]);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    g.attributes.uv = base.attributes.uv;

    const offsets = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      offsets[i * 3 + 0] = (Math.random() - 0.5) * area;
      offsets[i * 3 + 1] = Math.random(); // seed pha [0,1]
      offsets[i * 3 + 2] = (Math.random() - 0.5) * area;
      speeds[i] = 8 + Math.random() * 6; // tốc độ rơi
    }
    g.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    g.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speeds, 1));
    g.instanceCount = count;
    return g;
  }, [count, area, dropSize]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: rainVert,
        fragmentShader: rainFrag,
        uniforms: {
          uTime: { value: 0 },
          uTopY: { value: topY },
          uRangeY: { value: rangeY },
          uOpacity: { value: opacity },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [topY, rangeY, opacity],
  );

  useFrame((state) => {
    if (matRef.current)
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <primitive object={material} ref={matRef} attach="material" />
    </mesh>
  );
}
