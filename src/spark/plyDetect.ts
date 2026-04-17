// src/utils/plyDetect.ts

export type PlyType = "gaussian-splat" | "mesh" | "pointcloud" | "unknown";

export interface PlyInfo {
  type: PlyType;
  format: "ascii" | "binary_little_endian" | "binary_big_endian" | "unknown";
  vertexCount: number;
  faceCount: number;
  hasColor: boolean;
  hasNormal: boolean;
  properties: string[];
}

/**
 * Đọc header của PLY file (phần text ở đầu)
 * PLY header luôn kết thúc bằng "end_header\n"
 */
async function readPlyHeader(
  source: string | File | ArrayBuffer,
): Promise<string> {
  let bytes: Uint8Array;

  if (typeof source === "string") {
    // URL - chỉ fetch 16KB đầu (đủ cho header)
    const response = await fetch(source, {
      headers: { Range: "bytes=0-16384" },
    });
    bytes = new Uint8Array(await response.arrayBuffer());
  } else if (source instanceof File) {
    const slice = source.slice(0, 16384);
    bytes = new Uint8Array(await slice.arrayBuffer());
  } else {
    bytes = new Uint8Array(source.slice(0, 16384));
  }

  // Decode ASCII để đọc header
  const text = new TextDecoder("ascii").decode(bytes);
  const endIdx = text.indexOf("end_header");
  if (endIdx === -1) {
    throw new Error("Invalid PLY: không tìm thấy end_header");
  }
  return text.substring(0, endIdx + "end_header".length);
}

/**
 * Parse header string thành PlyInfo
 */
function parseHeader(header: string): PlyInfo {
  const lines = header.split(/\r?\n/);

  if (lines[0] !== "ply") {
    throw new Error("Không phải file PLY");
  }

  const info: PlyInfo = {
    type: "unknown",
    format: "unknown",
    vertexCount: 0,
    faceCount: 0,
    hasColor: false,
    hasNormal: false,
    properties: [],
  };

  let currentElement: "vertex" | "face" | null = null;
  const vertexProps: string[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);

    if (parts[0] === "format") {
      info.format = parts[1] as PlyInfo["format"];
    } else if (parts[0] === "element") {
      if (parts[1] === "vertex") {
        currentElement = "vertex";
        info.vertexCount = parseInt(parts[2], 10);
      } else if (parts[1] === "face") {
        currentElement = "face";
        info.faceCount = parseInt(parts[2], 10);
      } else {
        currentElement = null;
      }
    } else if (parts[0] === "property" && currentElement === "vertex") {
      // property <type> <name>  hoặc  property list <cnt_type> <item_type> <name>
      const propName = parts[parts.length - 1];
      vertexProps.push(propName);
    }
  }

  info.properties = vertexProps;

  // Detect color
  info.hasColor = ["red", "green", "blue"].every((c) =>
    vertexProps.includes(c),
  );

  // Detect normal
  info.hasNormal = ["nx", "ny", "nz"].every((n) => vertexProps.includes(n));

  // Detect Gaussian Splat: có f_dc_* hoặc scale_* + rot_* + opacity
  const hasSplatDC = vertexProps.some((p) => /^f_dc_\d+$/.test(p));
  const hasSplatScale = vertexProps.some((p) => /^scale_\d+$/.test(p));
  const hasSplatRot = vertexProps.some((p) => /^rot_\d+$/.test(p));
  const hasOpacity = vertexProps.includes("opacity");

  if ((hasSplatDC || hasSplatScale) && hasSplatRot && hasOpacity) {
    info.type = "gaussian-splat";
  } else if (info.faceCount > 0) {
    info.type = "mesh";
  } else if (info.vertexCount > 0) {
    info.type = "pointcloud";
  }

  return info;
}

/**
 * Detect loại PLY từ URL hoặc File
 */
export async function detectPlyType(source: string | File): Promise<PlyInfo> {
  // Nếu là các format splat khác (không phải PLY), skip header parsing
  if (typeof source === "string") {
    const ext = source.split("?")[0].split(".").pop()?.toLowerCase();
    if (ext && ["spz", "splat", "ksplat", "sog"].includes(ext)) {
      return {
        type: "gaussian-splat",
        format: "unknown",
        vertexCount: 0,
        faceCount: 0,
        hasColor: false,
        hasNormal: false,
        properties: [],
      };
    }
  } else if (source instanceof File) {
    const ext = source.name.split(".").pop()?.toLowerCase();
    if (ext && ["spz", "splat", "ksplat", "sog"].includes(ext)) {
      return {
        type: "gaussian-splat",
        format: "unknown",
        vertexCount: 0,
        faceCount: 0,
        hasColor: false,
        hasNormal: false,
        properties: [],
      };
    }
  }

  const header = await readPlyHeader(source);
  return parseHeader(header);
}
