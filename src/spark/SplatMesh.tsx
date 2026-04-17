// src/components/spark/SplatMesh.tsx
import { extend } from "@react-three/fiber";
import { SplatMesh as SplatMeshImpl } from "@sparkjsdev/spark";

extend({ SplatMesh: SplatMeshImpl });

declare module "@react-three/fiber" {
  interface ThreeElements {
    splatMesh: any;
  }
}

export { SplatMeshImpl };
