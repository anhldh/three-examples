import {
  AdditiveBlending, BufferAttribute, DoubleSide, DynamicDrawUsage,
  InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial,
} from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { Fn, Loop, instancedArray, instanceIndex, positionLocal, vec3 } from "three/tsl";

export type Backend = "webgl" | "webgpu";
export const STEP = 0.001;

// Deterministic starting state, shared by both implementations on every reset.
export function seedPositions(count: number) {
  const positions = new Float32Array(count * 3);
  let seed = 42;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (random() - 0.5) * 30;
    positions[i * 3 + 1] = (random() - 0.5) * 30;
    positions[i * 3 + 2] = 5 + random() * 35;
  }
  return positions;
}

export function stepCPU(positions: Float32Array, substeps: number) {
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i], y = positions[i + 1], z = positions[i + 2];
    for (let s = 0; s < substeps; s++) {
      const dx = 10 * (y - x);
      const dy = x * (28 - z) - y;
      const dz = x * y - (8 / 3) * z;
      x = Math.fround(x + dx * STEP);
      y = Math.fround(y + dy * STEP);
      z = Math.fround(z + dz * STEP);
    }
    positions[i] = x;
    positions[i + 1] = y;
    positions[i + 2] = z;
  }
}

export function createSimulation(backend: Backend, count: number, substeps: number) {
  const positions = seedPositions(count);
  const geometry = new InstancedBufferGeometry();
  // One small triangle per particle, one instanced draw on both backends.
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([
    -0.045, -0.035, 0, 0.045, -0.035, 0, 0, 0.055, 0,
  ]), 3));
  geometry.instanceCount = count;

  if (backend === "webgl") {
    const offset = new InstancedBufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute("offset", offset);
    const material = new ShaderMaterial({
      vertexShader: `attribute vec3 offset;
        void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + offset, 1.0); }`,
      fragmentShader: `void main() { gl_FragColor = vec4(0.08, 0.65, 1.0, 0.32); }`,
      transparent: true, blending: AdditiveBlending, depthWrite: false,
      side: DoubleSide, forceSinglePass: true, toneMapped: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.z = -25;
    mesh.frustumCulled = false;
    return {
      mesh, compute: null,
      update: () => { stepCPU(positions, substeps); offset.needsUpdate = true; },
      dispose: () => { geometry.dispose(); material.dispose(); },
    };
  }

  const buffer = instancedArray(positions, "vec3");
  geometry.setAttribute("offset", buffer.value);
  const compute = Fn(() => {
    const particle = buffer.element(instanceIndex);
    const p = particle.toVar();
    Loop(substeps, () => {
      const derivative = vec3(
        p.y.sub(p.x).mul(10),
        p.x.mul(p.z.negate().add(28)).sub(p.y),
        p.x.mul(p.y).sub(p.z.mul(8 / 3)),
      ).toVar();
      p.addAssign(derivative.mul(STEP));
    });
    particle.assign(p);
  })().compute(count);
  const material = new MeshBasicNodeMaterial({
    transparent: true, blending: AdditiveBlending, depthWrite: false,
    side: DoubleSide, forceSinglePass: true, toneMapped: false, opacity: 0.32,
  });
  material.positionNode = positionLocal.add(buffer.toAttribute());
  material.colorNode = vec3(0.08, 0.65, 1);
  const mesh = new Mesh(geometry, material);
  mesh.position.z = -25;
  mesh.frustumCulled = false;
  return {
    mesh, compute, update: () => {},
    dispose: () => { geometry.dispose(); material.dispose(); compute.dispose(); },
  };
}
