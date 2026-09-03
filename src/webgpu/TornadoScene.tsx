import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import {
  Fn,
  PI,
  TWO_PI,
  atan,
  cos,
  luminance,
  min,
  pass,
  positionLocal,
  sin,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

type FloatNode = THREE.Node<"float">;
type Vec2Node = THREE.Node<"vec2">;
type Vec3Node = THREE.Node<"vec3">;

const NOISE_SIZE = 128;

const wrap = (value: number, length: number) =>
  ((value % length) + length) % length;

const gridHash = (x: number, y: number, seed: number) => {
  let value =
    Math.imul(x, 374_761_393) +
    Math.imul(y, 668_265_263) +
    Math.imul(seed, 1_442_695_041);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);

  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_295;
};

const valueNoise = (
  x: number,
  y: number,
  cellSize: number,
  seed: number,
) => {
  const cellCount = NOISE_SIZE / cellSize;
  const gridX = Math.floor(x / cellSize);
  const gridY = Math.floor(y / cellSize);
  const fractionX = (x % cellSize) / cellSize;
  const fractionY = (y % cellSize) / cellSize;
  const smoothX = fractionX * fractionX * (3 - 2 * fractionX);
  const smoothY = fractionY * fractionY * (3 - 2 * fractionY);

  const topLeft = gridHash(
    wrap(gridX, cellCount),
    wrap(gridY, cellCount),
    seed,
  );
  const topRight = gridHash(
    wrap(gridX + 1, cellCount),
    wrap(gridY, cellCount),
    seed,
  );
  const bottomLeft = gridHash(
    wrap(gridX, cellCount),
    wrap(gridY + 1, cellCount),
    seed,
  );
  const bottomRight = gridHash(
    wrap(gridX + 1, cellCount),
    wrap(gridY + 1, cellCount),
    seed,
  );
  const top = THREE.MathUtils.lerp(topLeft, topRight, smoothX);
  const bottom = THREE.MathUtils.lerp(bottomLeft, bottomRight, smoothX);

  return THREE.MathUtils.lerp(top, bottom, smoothY);
};

/** Creates a deterministic, tileable RGB fractal-noise texture. */
const createNoiseTexture = () => {
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4);
  const cellSizes = [64, 32, 16, 8, 4];
  const channelSeeds = [11, 37, 83];

  for (let y = 0; y < NOISE_SIZE; y += 1) {
    for (let x = 0; x < NOISE_SIZE; x += 1) {
      const pixelOffset = (y * NOISE_SIZE + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        let amplitude = 0.5;
        let amplitudeSum = 0;
        let noise = 0;

        for (const cellSize of cellSizes) {
          noise += valueNoise(x, y, cellSize, channelSeeds[channel]) * amplitude;
          amplitudeSum += amplitude;
          amplitude *= 0.5;
        }

        const normalized = noise / amplitudeSum;
        const contrasted = THREE.MathUtils.clamp(
          (normalized - 0.5) * 1.35 + 0.5,
          0,
          1,
        );
        data[pixelOffset + channel] = Math.round(contrasted * 255);
      }

      data[pixelOffset + 3] = 255;
    }
  }

  const noiseTexture = new THREE.DataTexture(
    data,
    NOISE_SIZE,
    NOISE_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  noiseTexture.name = "Procedural tornado noise";
  noiseTexture.colorSpace = THREE.NoColorSpace;
  noiseTexture.wrapS = THREE.RepeatWrapping;
  noiseTexture.wrapT = THREE.RepeatWrapping;
  noiseTexture.magFilter = THREE.LinearFilter;
  noiseTexture.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTexture.generateMipmaps = true;
  noiseTexture.needsUpdate = true;

  return noiseTexture;
};

const toSkewedUv = (sourceUv: Vec2Node, skew: Vec2Node) =>
  vec2(
    sourceUv.x.add(sourceUv.y.mul(skew.x)),
    sourceUv.y.add(sourceUv.x.mul(skew.y)),
  );

const toRadialUv = (
  sourceUv: Vec2Node,
  multiplier: Vec2Node,
  rotation: FloatNode,
  offset: FloatNode,
) => {
  const centeredUv = sourceUv.sub(0.5);
  const radialUv = vec2(
    atan(centeredUv.y, centeredUv.x).add(PI).div(TWO_PI),
    centeredUv.length(),
  ).mul(multiplier);

  return radialUv.add(vec2(rotation, offset));
};

const twistCylinder = (
  position: Vec3Node,
  parabolStrength: FloatNode,
  parabolOffset: FloatNode,
  parabolAmplitude: FloatNode,
  scaledTime: FloatNode,
) => {
  const angle = atan(position.z, position.x);
  const elevation = position.y;
  const turbulence = sin(
    elevation.sub(scaledTime).mul(20).add(angle.mul(2)),
  ).mul(0.05);
  const radius = parabolStrength
    .mul(elevation.sub(parabolOffset))
    .pow(2)
    .add(parabolAmplitude)
    .add(turbulence);

  return vec3(
    cos(angle).mul(radius),
    elevation,
    sin(angle).mul(radius),
  );
};

const TornadoMeshes = () => {
  const tornado = useMemo(() => {
    const noiseTexture = createNoiseTexture();
    const emissiveColor = uniform(new THREE.Color("#ff8b4d"));
    const timeScale = uniform(0.2);
    const parabolStrength = uniform(1);
    const parabolOffset = uniform(0.3);
    const parabolAmplitude = uniform(0.2);

    const floorGeometry = new THREE.PlaneGeometry(2, 2, 1, 1);
    const floorMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
    });
    floorMaterial.outputNode = Fn(() => {
      const scaledTime = time.mul(timeScale);
      const noise1Uv = toSkewedUv(
        toRadialUv(
          uv(),
          vec2(0.5, 0.5),
          scaledTime,
          scaledTime,
        ),
        vec2(-1, 0),
      ).mul(vec2(4, 1));
      const noise1 = texture(noiseTexture, noise1Uv, 1).r.remap(0.45, 0.7);

      const noise2Uv = toSkewedUv(
        toRadialUv(
          uv(),
          vec2(2, 8),
          scaledTime.mul(2),
          scaledTime.mul(8),
        ),
        vec2(-0.25, 0),
      ).mul(vec2(2, 0.25));
      const noise2 = texture(noiseTexture, noise2Uv, 1).b.remap(0.45, 0.7);
      const distanceToCenter = uv().sub(0.5).length();
      const outerFade = min(
        distanceToCenter.oneMinus().smoothstep(0.5, 0.9),
        distanceToCenter.smoothstep(0, 0.2),
      );
      const effect = noise1.mul(noise2).mul(outerFade);

      return vec4(
        emissiveColor.mul(effect.step(0.2)).mul(3),
        effect.smoothstep(0, 0.01),
      );
    })();

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI * 0.5;
    floor.renderOrder = 0;

    const cylinderGeometry = new THREE.CylinderGeometry(
      1,
      1,
      1,
      32,
      32,
      true,
    );
    cylinderGeometry.translate(0, 0.5, 0);

    const emissiveMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    emissiveMaterial.positionNode = twistCylinder(
      positionLocal,
      parabolStrength,
      parabolOffset,
      parabolAmplitude.sub(0.05),
      time.mul(timeScale),
    );
    emissiveMaterial.outputNode = Fn(() => {
      const scaledTime = time.mul(timeScale);
      const noise1Uv = toSkewedUv(
        uv().add(vec2(scaledTime, scaledTime.negate())),
        vec2(-1, 0),
      ).mul(vec2(2, 0.25));
      const noise1 = texture(noiseTexture, noise1Uv, 1).r.remap(0.45, 0.7);
      const noise2Uv = toSkewedUv(
        uv().add(vec2(scaledTime.mul(0.5), scaledTime.negate())),
        vec2(-1, 0),
      ).mul(vec2(5, 1));
      const noise2 = texture(noiseTexture, noise2Uv, 1).g.remap(0.45, 0.7);
      const outerFade = min(
        uv().y.smoothstep(0, 0.1),
        uv().y.oneMinus().smoothstep(0, 0.4),
      );
      const effect = noise1.mul(noise2).mul(outerFade);

      return vec4(
        emissiveColor.mul(1.2).div(luminance(emissiveColor)),
        effect.smoothstep(0, 0.1),
      );
    })();

    const emissiveMesh = new THREE.Mesh(
      cylinderGeometry,
      emissiveMaterial,
    );
    emissiveMesh.renderOrder = 2;

    const darkMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    darkMaterial.positionNode = twistCylinder(
      positionLocal,
      parabolStrength,
      parabolOffset,
      parabolAmplitude,
      time.mul(timeScale),
    );
    darkMaterial.outputNode = Fn(() => {
      const scaledTime = time.mul(timeScale).add(123.4);
      const noise1Uv = toSkewedUv(
        uv().add(vec2(scaledTime, scaledTime.negate())),
        vec2(-1, 0),
      ).mul(vec2(2, 0.25));
      const noise1 = texture(noiseTexture, noise1Uv, 1).g.remap(0.45, 0.7);
      const noise2Uv = toSkewedUv(
        uv().add(vec2(scaledTime.mul(0.5), scaledTime.negate())),
        vec2(-1, 0),
      ).mul(vec2(5, 1));
      const noise2 = texture(noiseTexture, noise2Uv, 1).b.remap(0.45, 0.7);
      const outerFade = min(
        uv().y.smoothstep(0, 0.2),
        uv().y.oneMinus().smoothstep(0, 0.4),
      );
      const effect = noise1.mul(noise2).mul(outerFade);

      return vec4(vec3(0), effect.smoothstep(0, 0.01));
    })();

    const darkMesh = new THREE.Mesh(cylinderGeometry, darkMaterial);
    darkMesh.renderOrder = 1;

    return {
      cylinderGeometry,
      darkMaterial,
      darkMesh,
      emissiveMaterial,
      emissiveMesh,
      floor,
      floorGeometry,
      floorMaterial,
      noiseTexture,
    };
  }, []);

  useEffect(
    () => () => {
      tornado.floorGeometry.dispose();
      tornado.cylinderGeometry.dispose();
      tornado.floorMaterial.dispose();
      tornado.emissiveMaterial.dispose();
      tornado.darkMaterial.dispose();
      tornado.noiseTexture.dispose();
    },
    [tornado],
  );

  return (
    <>
      <primitive object={tornado.floor} />
      <primitive object={tornado.darkMesh} />
      <primitive object={tornado.emissiveMesh} />
    </>
  );
};

const TornadoPostProcessing = () => {
  const { camera, gl, scene } = useThree();
  const renderSetup = useMemo(() => {
    const renderer = gl as unknown as THREE.WebGPURenderer;
    const renderPipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode("output");
    const bloomPass = bloom(sceneColor, 1, 0.1, 1);
    renderPipeline.outputNode = sceneColor.add(bloomPass);

    return { bloomPass, renderPipeline, scenePass };
  }, [camera, gl, scene]);
  const renderSetupRef = useRef(renderSetup);

  useEffect(
    () => () => {
      renderSetup.renderPipeline.dispose();
      renderSetup.scenePass.dispose();
      (
        renderSetup.bloomPass as typeof renderSetup.bloomPass & {
          dispose: () => void;
        }
      ).dispose();
    },
    [renderSetup],
  );

  useFrame(() => {
    renderSetupRef.current.renderPipeline.render();
  }, 1);

  return null;
};

const TornadoScene = () => (
  <>
    <TornadoMeshes />
    <TornadoPostProcessing />
  </>
);

export default TornadoScene;
