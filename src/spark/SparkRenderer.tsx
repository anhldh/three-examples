// src/components/spark/SparkRenderer.tsx
import { extend } from "@react-three/fiber";
import { SparkRenderer as SparkRendererImpl } from "@sparkjsdev/spark";

extend({ SparkRenderer: SparkRendererImpl });

declare module "@react-three/fiber" {
  interface ThreeElements {
    sparkRenderer: any;
  }
}

export { SparkRendererImpl };
