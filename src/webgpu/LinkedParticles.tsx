import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import {
  Fn,
  If,
  Loop,
  TWO_PI,
  atan,
  color,
  cos,
  float,
  hash,
  hue,
  instanceIndex,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  mx_fractal_noise_vec3,
  sin,
  step,
  storage,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";

const PARTICLE_COUNT = 1024;
const PARTICLES_PER_FRAME = 8;

/**
 * GPU simulation adapted from three.js' webgpu_tsl_vfx_linkedparticles demo.
 * Particle state and nearest-neighbour links live entirely in storage buffers.
 */
const LinkedParticles = () => {
  const { gl } = useThree();
  const renderer = gl as unknown as THREE.WebGPURenderer;

  const pointerPlane = useRef(
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
  );
  const pointerPosition = useRef(new THREE.Vector3());

  const system = useMemo(() => {
    const frameDelta = uniform(1 / 60);
    const particleLifetime = uniform(1.35);
    const particleSize = uniform(0.85);
    const linkWidth = uniform(0.008);
    const colorOffset = uniform(0);
    const colorVariance = uniform(1.8);

    const spawnIndex = uniform(0);
    const spawnPosition = uniform(new THREE.Vector3());
    const previousSpawnPosition = uniform(new THREE.Vector3());

    const turbulenceFrequency = uniform(0.62);
    const turbulenceAmplitude = uniform(0.72);
    const turbulenceFriction = uniform(0.028);

    const positionAttribute = new THREE.StorageInstancedBufferAttribute(
      PARTICLE_COUNT,
      4,
    );
    const velocityAttribute = new THREE.StorageInstancedBufferAttribute(
      PARTICLE_COUNT,
      4,
    );
    const particlePositions = storage(
      positionAttribute,
      "vec4",
      PARTICLE_COUNT,
    );
    const particleVelocities = storage(
      velocityAttribute,
      "vec4",
      PARTICLE_COUNT,
    );

    const getParticleColor = (index: typeof instanceIndex) => {
      const noise = mx_fractal_noise_float(
        index.toFloat().mul(0.075),
        2,
        2,
        0.5,
        colorVariance,
      );

      return hue(color(0x3157ff), colorOffset.add(noise));
    };

    // Each particle is rendered as a camera-facing quad.
    const particleGeometry = new THREE.PlaneGeometry(0.055, 0.055);
    const particleMaterial = new THREE.SpriteNodeMaterial();
    particleMaterial.transparent = true;
    particleMaterial.blending = THREE.AdditiveBlending;
    particleMaterial.depthWrite = false;
    particleMaterial.positionNode = particlePositions.toAttribute();
    particleMaterial.scaleNode = vec2(particleSize);
    particleMaterial.rotationNode = atan(
      particleVelocities.toAttribute().y,
      particleVelocities.toAttribute().x,
    );
    particleMaterial.colorNode = Fn(() => {
      const pulse = sin(
        time.mul(3.5).add(hash(instanceIndex).mul(TWO_PI)),
      )
        .mul(0.2)
        .add(0.8);

      return getParticleColor(instanceIndex).mul(pulse);
    })();
    particleMaterial.opacityNode = Fn(() => {
      const circle = step(uv().xy.sub(0.5).length(), 0.5);
      const life = max(particlePositions.toAttribute().w, 0).pow(0.65);

      return circle.mul(life);
    })();

    const particleMesh = new THREE.InstancedMesh(
      particleGeometry,
      particleMaterial,
      PARTICLE_COUNT,
    );
    particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleMesh.frustumCulled = false;

    // One quad per particle connects it to its closest living neighbour.
    const linkIndices: number[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const offset = i * 4;
      linkIndices.push(
        offset,
        offset + 1,
        offset + 2,
        offset,
        offset + 2,
        offset + 3,
      );
    }

    const linkVertexCount = PARTICLE_COUNT * 4;
    const linkPositionAttribute = new THREE.StorageBufferAttribute(
      linkVertexCount,
      4,
    );
    const linkColorAttribute = new THREE.StorageBufferAttribute(
      linkVertexCount,
      4,
    );
    const linkPositions = storage(
      linkPositionAttribute,
      "vec4",
      linkVertexCount,
    );
    const linkColors = storage(linkColorAttribute, "vec4", linkVertexCount);

    const linkGeometry = new THREE.BufferGeometry();
    linkGeometry.setAttribute("position", linkPositionAttribute);
    linkGeometry.setAttribute("color", linkColorAttribute);
    linkGeometry.setIndex(linkIndices);

    const linkMaterial = new THREE.MeshBasicNodeMaterial();
    linkMaterial.vertexColors = true;
    linkMaterial.side = THREE.DoubleSide;
    linkMaterial.transparent = true;
    linkMaterial.depthWrite = false;
    linkMaterial.depthTest = false;
    linkMaterial.blending = THREE.AdditiveBlending;
    linkMaterial.opacityNode = linkColors.toAttribute().w;

    const linkMesh = new THREE.Mesh(linkGeometry, linkMaterial);
    linkMesh.frustumCulled = false;

    const updateParticles = Fn(() => {
      const position = particlePositions.element(instanceIndex).xyz;
      const life = particlePositions.element(instanceIndex).w;
      const velocity = particleVelocities.element(instanceIndex).xyz;

      If(life.greaterThan(0), () => {
        const turbulence = mx_fractal_noise_vec3(
          position.mul(turbulenceFrequency),
          2,
          2,
          0.5,
          turbulenceAmplitude,
        ).mul(life.add(0.05));

        velocity.addAssign(turbulence.mul(frameDelta));
        velocity.mulAssign(turbulenceFriction.oneMinus());
        position.addAssign(velocity.mul(frameDelta));
        life.subAssign(frameDelta.mul(particleLifetime.reciprocal()));

        const closestDistance = float(10000).toVar();
        const closestPosition = vec3(0).toVar();
        const closestLife = float(0).toVar();

        Loop(PARTICLE_COUNT, ({ i }) => {
          const otherParticle = particlePositions.element(i);
          const distance = position.sub(otherParticle.xyz).lengthSq();

          If(
            i
              .notEqual(instanceIndex)
              .and(otherParticle.w.greaterThan(0))
              .and(distance.greaterThan(0))
              .and(distance.lessThan(closestDistance)),
            () => {
              closestDistance.assign(distance);
              closestPosition.assign(otherParticle.xyz);
              closestLife.assign(otherParticle.w);
            },
          );
        });

        const firstVertex = instanceIndex.mul(4);
        linkPositions.element(firstVertex).xyz.assign(position);
        linkPositions.element(firstVertex).y.addAssign(linkWidth);
        linkPositions.element(firstVertex.add(1)).xyz.assign(position);
        linkPositions.element(firstVertex.add(1)).y.subAssign(linkWidth);
        linkPositions
          .element(firstVertex.add(2))
          .xyz.assign(closestPosition);
        linkPositions.element(firstVertex.add(2)).y.subAssign(linkWidth);
        linkPositions
          .element(firstVertex.add(3))
          .xyz.assign(closestPosition);
        linkPositions.element(firstVertex.add(3)).y.addAssign(linkWidth);

        const linkColor = getParticleColor(instanceIndex);
        const linkOpacity = max(0, min(closestLife, life)).pow(0.9);

        Loop(4, ({ i }) => {
          const vertexColor = linkColors.element(firstVertex.add(i.toUint()));
          vertexColor.xyz.assign(linkColor);
          vertexColor.w.assign(linkOpacity);
        });
      });
    })()
      .compute(PARTICLE_COUNT)
      .setName("Update linked particles");

    const spawnParticles = Fn(() => {
      const particleIndex = spawnIndex
        .add(instanceIndex)
        .mod(PARTICLE_COUNT)
        .toInt();
      const position = particlePositions.element(particleIndex).xyz;
      const life = particlePositions.element(particleIndex).w;
      const velocity = particleVelocities.element(particleIndex).xyz;

      const theta = hash(particleIndex).mul(TWO_PI);
      const phi = hash(particleIndex.add(1)).mul(Math.PI);
      const direction = vec3(
        sin(theta).mul(cos(phi)),
        sin(theta).mul(sin(phi)),
        cos(theta),
      );
      const pathPosition = mix(
        previousSpawnPosition,
        spawnPosition,
        instanceIndex
          .toFloat()
          .div(PARTICLES_PER_FRAME - 1)
          .clamp(),
      );

      life.assign(1);
      position.assign(pathPosition.add(direction.mul(0.025)));
      velocity.assign(direction.mul(2.8));
    })()
      .compute(PARTICLES_PER_FRAME)
      .setName("Spawn linked particles");

    return {
      colorOffset,
      frameDelta,
      linkColorAttribute,
      linkGeometry,
      linkMaterial,
      linkMesh,
      linkPositionAttribute,
      particleGeometry,
      particleMaterial,
      particleMesh,
      positionAttribute,
      previousSpawnPosition,
      spawnIndex,
      spawnParticles,
      spawnPosition,
      updateParticles,
      velocityAttribute,
    };
  }, []);
  const systemRef = useRef(system);

  useEffect(
    () => () => {
      system.particleGeometry.dispose();
      system.particleMaterial.dispose();
      system.linkGeometry.dispose();
      system.linkMaterial.dispose();
      system.positionAttribute.dispose();
      system.velocityAttribute.dispose();
      system.linkPositionAttribute.dispose();
      system.linkColorAttribute.dispose();
    },
    [system],
  );

  useFrame((state, delta) => {
    const gpu = systemRef.current;

    // Use a camera-facing plane through the origin as the 3D pointer surface.
    state.camera.getWorldDirection(pointerPlane.current.normal);
    state.raycaster.setFromCamera(state.pointer, state.camera);
    state.raycaster.ray.intersectPlane(
      pointerPlane.current,
      pointerPosition.current,
    );

    gpu.previousSpawnPosition.value.copy(gpu.spawnPosition.value);
    gpu.spawnPosition.value.lerp(pointerPosition.current, 0.16);
    gpu.frameDelta.value = Math.min(delta, 1 / 30);
    gpu.colorOffset.value += delta * 0.18;

    renderer.compute(gpu.updateParticles);
    renderer.compute(gpu.spawnParticles);
    gpu.spawnIndex.value =
      (gpu.spawnIndex.value + PARTICLES_PER_FRAME) % PARTICLE_COUNT;
  }, -1);

  return (
    <>
      <primitive object={system.particleMesh} />
      <primitive object={system.linkMesh} />
    </>
  );
};

export default LinkedParticles;
