/* eslint-disable react-hooks/purity */
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * TrainSmoke — khói đầu tàu hỏa, 1 draw call.
 *
 * Toàn bộ chuyển động tính trong vertex shader, CPU chỉ update 1 uniform uTime.
 * Hạt được chia thành từng "puff" (nhịp xả hơi), mỗi puff gồm `particlesPerPuff`
 * hạt spawn cùng lúc rồi bung ra — đây là thứ tạo cảm giác tàu hỏa thay vì
 * cột khói liên tục.
 */

export type TrainSmokeProps = {
  /** tổng số hạt. 200–400 là đủ dày cho một ống khói */
  count?: number;
  /** số hạt trong một nhịp xả. càng nhiều thì puff càng "đặc" */
  particlesPerPuff?: number;
  /** thời gian sống của một hạt (giây) */
  lifetime?: number;
  /** hệ số tua nhanh/chậm toàn bộ hiệu ứng */
  speed?: number;
  /** vận tốc phun ra khỏi ống khói (đơn vị/giây) */
  ejectSpeed?: number;
  /** vận tốc bốc lên do nhiệt */
  riseSpeed?: number;
  /** độ loe của chùm khói lúc mới phun, 0 = thẳng đứng */
  spread?: number;
  /** gió tương đối. tàu chạy về +Z thì gió là [0, 0, -x] */
  wind?: [number, number, number];
  /** biên độ nhiễu loạn, làm khói uốn lượn */
  turbulence?: number;
  /** kích thước hạt lúc mới ra / lúc tan */
  startSize?: number;
  endSize?: number;
  /** màu khói sát ống (bồ hóng) và khi đã loãng */
  colorNear?: THREE.ColorRepresentation;
  colorFar?: THREE.ColorRepresentation;
  /** độ đục tổng thể */
  opacity?: number;
  /** render order — để trên các mesh trong suốt khác */
  renderOrder?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
};

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uLifetime;
  uniform float uEjectSpeed;
  uniform float uRiseSpeed;
  uniform float uSpread;
  uniform float uTurbulence;
  uniform float uStartSize;
  uniform float uEndSize;
  uniform vec3  uWind;

  attribute vec3  aSeed;      // 3 số random 0..1 cho mỗi hạt
  attribute float aPuffPhase; // 0..1 — lệch pha giữa các nhịp xả
  attribute float aAngle;     // góc xoay ban đầu của quad

  varying float vAge;
  varying float vSeed;
  varying vec2  vUv;

  void main() {
    // age chạy 0 -> 1 rồi lặp lại. mỗi puff lệch pha một chút
    float age    = fract(uTime / uLifetime - aPuffPhase);
    float ageSec = age * uLifetime;

    // hướng phun: chủ yếu lên trên, loe ra theo uSpread
    vec3 dir = normalize(vec3(
      (aSeed.x - 0.5) * uSpread,
      1.0,
      (aSeed.z - 0.5) * uSpread
    ));

    // vận tốc phun tắt dần do ma sát không khí (tích phân của v0 * e^-kt)
    float k = 1.6;
    vec3 pos = dir * uEjectSpeed * (1.0 - exp(-ageSec * k)) / k;

    // lực nổi: khói nóng nhẹ hơn không khí, bốc lên đều
    pos.y += uRiseSpeed * ageSec;

    // gió tương đối do tàu chạy — khói tụt lại phía sau
    pos += uWind * ageSec;

    // nhiễu loạn: biên độ tăng dần theo tuổi, mỗi hạt một pha riêng
    float w = ageSec * 0.9 + aSeed.y * 6.2831;
    float amp = uTurbulence * age;
    pos.x += sin(w * 1.3 + aSeed.x * 12.0) * amp;
    pos.z += cos(w * 1.1 + aSeed.z * 12.0) * amp;
    pos.y += sin(w * 0.6 + aSeed.y *  8.0) * amp * 0.35;

    // nở ra nhanh lúc đầu rồi chậm lại
    float grow = 1.0 - pow(1.0 - age, 2.2);
    float size = mix(uStartSize, uEndSize, grow);

    // xoay quad chậm, mỗi hạt một chiều
    float rot = aAngle + ageSec * (aSeed.x - 0.5) * 0.9;
    float c = cos(rot);
    float s = sin(rot);
    vec2 q = position.xy * size;
    vec2 rq = vec2(q.x * c - q.y * s, q.x * s + q.y * c);

    // billboard: dựng quad trong view space nên luôn hướng về camera
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    mv.xy += rq;

    vAge  = age;
    vSeed = aSeed.y;
    vUv   = uv;

    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3  uColorNear;
  uniform vec3  uColorFar;
  uniform float uOpacity;

  varying float vAge;
  varying float vSeed;
  varying vec2  vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // 3 octave là đủ cho hạt khói; thêm octave chỉ tốn fill-rate
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * valueNoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float r = length(uv) * 2.0;

    // cắt tròn mềm ở rìa quad
    float mask = 1.0 - smoothstep(0.35, 1.0, r);
    if (mask <= 0.001) discard;

    // noise phá vỡ hình tròn -> ra mảng khói lởm chởm.
    // offset theo seed để không hạt nào giống hạt nào.
    // scale noise theo tuổi: khói loãng dần thì vân to ra.
    vec2 np = vUv * mix(4.0, 2.0, vAge) + vSeed * 53.0;
    float n = fbm(np);

    float alpha = mask * smoothstep(0.22, 0.78, n * 0.85 + 0.35);

    // vào nhanh, tan chậm
    float fadeIn  = smoothstep(0.0, 0.06, vAge);
    float fadeOut = 1.0 - smoothstep(0.30, 1.0, vAge);
    alpha *= fadeIn * fadeOut * uOpacity;

    if (alpha < 0.004) discard;

    vec3 col = mix(uColorNear, uColorFar, smoothstep(0.0, 0.55, vAge));

    gl_FragColor = vec4(col, alpha);

    #include <colorspace_fragment>
  }
`;

export default function TrainSmoke({
  count = 260,
  particlesPerPuff = 13,
  lifetime = 4.5,
  speed = 1,
  ejectSpeed = 2.6,
  riseSpeed = 0.75,
  spread = 0.55,
  wind = [0, 0, -1.1],
  turbulence = 0.35,
  startSize = 0.35,
  endSize = 2.4,
  colorNear = "#3c3733",
  colorFar = "#c9c4bc",
  opacity = 0.5,
  renderOrder = 10,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: TrainSmokeProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();

    geo.index = base.index;
    geo.setAttribute("position", base.attributes.position);
    geo.setAttribute("uv", base.attributes.uv);
    geo.instanceCount = count;

    const seeds = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const angles = new Float32Array(count);

    const puffCount = Math.max(1, Math.ceil(count / particlesPerPuff));

    for (let i = 0; i < count; i++) {
      seeds[i * 3 + 0] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();

      // các hạt cùng puff chia sẻ pha, thêm jitter nhỏ để không quá "cơ khí"
      const puffIndex = Math.floor(i / particlesPerPuff);
      const jitter = (Math.random() - 0.5) * (0.35 / puffCount);
      phases[i] = puffIndex / puffCount + jitter;

      angles[i] = Math.random() * Math.PI * 2;
    }

    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 3));
    geo.setAttribute(
      "aPuffPhase",
      new THREE.InstancedBufferAttribute(phases, 1),
    );
    geo.setAttribute("aAngle", new THREE.InstancedBufferAttribute(angles, 1));

    // vị trí hạt do shader quyết định nên bounding sphere mặc định sai.
    // đặt tay một quả cầu đủ to thay vì tắt hẳn frustum culling.
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, lifetime * riseSpeed * 0.5, 0),
      lifetime * (riseSpeed + ejectSpeed * 0.5) + endSize,
    );

    return geo;
  }, [count, particlesPerPuff, lifetime, riseSpeed, ejectSpeed, endSize]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Tự dựng material thay vì <shaderMaterial uniforms={...}>: R3F clone object
  // uniform khi applyProps, nên mutate uniform từ useFrame sẽ không tới được
  // material. Giữ material trong tay thì uTime mới chạy.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uLifetime: { value: lifetime },
          uEjectSpeed: { value: ejectSpeed },
          uRiseSpeed: { value: riseSpeed },
          uSpread: { value: spread },
          uTurbulence: { value: turbulence },
          uStartSize: { value: startSize },
          uEndSize: { value: endSize },
          uWind: { value: new THREE.Vector3(...wind) },
          uColorNear: { value: new THREE.Color(colorNear) },
          uColorFar: { value: new THREE.Color(colorFar) },
          uOpacity: { value: opacity },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    const u = materialRef.current?.uniforms;
    if (u) u.uTime.value += delta * speed;
  });

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      renderOrder={renderOrder}
    >
      {/* props -> uniform qua pierced props, R3F tự ghi thẳng vào material */}
      <primitive
        object={material}
        attach="material"
        ref={materialRef}
        uniforms-uLifetime-value={lifetime}
        uniforms-uEjectSpeed-value={ejectSpeed}
        uniforms-uRiseSpeed-value={riseSpeed}
        uniforms-uSpread-value={spread}
        uniforms-uTurbulence-value={turbulence}
        uniforms-uStartSize-value={startSize}
        uniforms-uEndSize-value={endSize}
        uniforms-uOpacity-value={opacity}
        uniforms-uWind-value={wind}
        uniforms-uColorNear-value={colorNear}
        uniforms-uColorFar-value={colorFar}
      />
    </mesh>
  );
}
