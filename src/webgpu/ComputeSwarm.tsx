import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import {
  Fn,
  TWO_PI,
  color,
  cos,
  hash,
  instanceIndex,
  max,
  mix,
  range,
  sin,
  step,
  storage,
  time,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";

const PARTICLE_COUNT = 65_536;

/**
 * A genuine GPU simulation: velocity and position are stored in GPU buffers,
 * updated by two compute dispatches, then consumed directly by the draw pass.
 */
const ComputeSwarm = () => {
  const { gl } = useThree();
  const renderer = gl as unknown as THREE.WebGPURenderer;

  const system = useMemo(() => {
    const frameDelta = uniform(1 / 60);
    const positionAttribute = new THREE.StorageInstancedBufferAttribute(
      PARTICLE_COUNT,
      4,
    );
    const velocityAttribute = new THREE.StorageInstancedBufferAttribute(
      PARTICLE_COUNT,
      4,
    );
    const positions = storage(positionAttribute, "vec4", PARTICLE_COUNT);
    const velocities = storage(velocityAttribute, "vec4", PARTICLE_COUNT);

    const initializeParticles = Fn(() => {
      const index = instanceIndex;
      const radius = hash(index).pow(0.65).mul(4.6).add(0.35);
      const angle = hash(index.add(1)).mul(TWO_PI);
      const height = hash(index.add(2))
        .sub(0.5)
        .mul(0.7)
        .div(radius.mul(0.35).add(1));
      const orbitSpeed = radius.mul(0.28).sqrt();

      positions
        .element(index)
        .assign(
          vec4(
            cos(angle).mul(radius),
            height,
            sin(angle).mul(radius),
            1,
          ),
        );
      velocities
        .element(index)
        .assign(
          vec4(
            sin(angle).negate().mul(orbitSpeed),
            hash(index.add(3)).sub(0.5).mul(0.04),
            cos(angle).mul(orbitSpeed),
            0,
          ),
        );
    })()
      .compute(PARTICLE_COUNT)
      .setName("Initialize compute swarm");

    const updateVelocities = Fn(() => {
      const position = positions.element(instanceIndex).xyz;
      const velocity = velocities.element(instanceIndex).xyz;
      const radius = max(position.length(), 0.15);
      const inwardAcceleration = position
        .div(radius)
        .negate()
        .mul(radius.mul(0.28));
      const verticalWave = sin(
        time.mul(1.4).add(hash(instanceIndex).mul(TWO_PI)),
      ).mul(0.035);

      velocity.addAssign(
        inwardAcceleration
          .add(vec3(0, verticalWave, 0))
          .mul(frameDelta),
      );
      velocity.mulAssign(0.9998);
    })()
      .compute(PARTICLE_COUNT)
      .setName("Update swarm velocities");

    const integratePositions = Fn(() => {
      const position = positions.element(instanceIndex).xyz;
      const velocity = velocities.element(instanceIndex).xyz;

      position.addAssign(velocity.mul(frameDelta));
    })()
      .compute(PARTICLE_COUNT)
      .setName("Integrate swarm positions");

    const geometry = new THREE.PlaneGeometry(0.035, 0.035);
    const material = new THREE.SpriteNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particlePosition = positions.toAttribute();
    const particleVelocity = velocities.toAttribute();
    const colorRatio = particlePosition.length().mul(0.2).clamp();
    const speedGlow = particleVelocity.length().mul(0.45).clamp(0.65, 1.4);

    material.positionNode = particlePosition;
    material.scaleNode = range(0.45, 1).mul(0.9);
    material.colorNode = mix(
      color("#7ce7ff"),
      color("#d85cff"),
      colorRatio,
    ).mul(speedGlow);
    material.opacityNode = step(uv().sub(0.5).length(), 0.5);

    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      PARTICLE_COUNT,
    );
    mesh.name = "TSL compute orbital swarm";
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;

    return {
      frameDelta,
      geometry,
      initializeParticles,
      integratePositions,
      material,
      mesh,
      positionAttribute,
      updateVelocities,
      velocityAttribute,
    };
  }, []);
  const systemRef = useRef(system);
  const initialized = useRef(false);

  useEffect(
    () => () => {
      system.mesh.dispose();
      system.geometry.dispose();
      system.material.dispose();
      system.positionAttribute.dispose();
      system.velocityAttribute.dispose();
    },
    [system],
  );

  useFrame((_, delta) => {
    const gpu = systemRef.current;

    gpu.frameDelta.value = Math.min(delta, 1 / 30);

    if (!initialized.current) {
      renderer.compute(gpu.initializeParticles);
      initialized.current = true;
    }

    renderer.compute(gpu.updateVelocities);
    renderer.compute(gpu.integratePositions);
  }, -1);

  return <primitive object={system.mesh} />;
};

export default ComputeSwarm;
