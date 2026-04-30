import { ModelViewerElement } from "@google/model-viewer";
import { DetailedHTMLProps, HTMLAttributes } from "react";

// Model-viewer specific properties. This gives us all the standard
// props like className, style, children, etc., plus the component-specific ones.
type ModelViewerProps = DetailedHTMLProps<
  HTMLAttributes<ModelViewerElement>,
  ModelViewerElement
> & {
  src?: string;
  alt?: string;
  poster?: string;
  loading?: "eager" | "lazy" | "auto";
  reveal?: "auto" | "interaction" | "manual";
  ar?: boolean;
  "ar-modes"?: string;
  "ar-scale"?: "auto" | "fixed";
  "camera-controls"?: boolean;
  "auto-rotate"?: boolean;
  "auto-rotate-delay"?: string; // number as string
  "shadow-intensity"?: string; // number as string
  "environment-image"?: string;
  "animation-name"?: string;
  autoplay?: boolean;
  "camera-orbit"?: string;
  // Add other model-viewer specific props here as needed
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps;
    }
  }
}
