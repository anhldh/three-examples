import {
  AnimationClip,
  ColorKeyframeTrack,
  InterpolateDiscrete,
  InterpolateLinear,
  type InterpolationModes,
  KeyframeTrack,
  NumberKeyframeTrack,
  Object3D,
  PropertyBinding,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
  SkinnedMesh,
  BooleanKeyframeTrack,
  Material,
  Texture,
} from "three";
import type { GLTFParser } from "three/examples/jsm/loaders/GLTFLoader.js";

// ---------- Types ----------

export interface AnimationPointerResolver {
  resolvePath(path: string): string | null;
}

interface GLTFAnimationChannel {
  sampler: number;
  target: GLTFAnimationTarget;
}

interface GLTFAnimationTarget {
  node?: number;
  id?: number;
  path: string;
  extensions?: {
    [KHR_ANIMATION_POINTER]?: { pointer: string };
    [key: string]: unknown;
  };
}

interface GLTFAnimationSampler {
  input: number;
  output: number;
  interpolation?: keyof typeof INTERPOLATION;
}

interface GLTFAnimationDef {
  name?: string;
  channels: GLTFAnimationChannel[];
  samplers: GLTFAnimationSampler[];
  parameters?: Record<number, number>;
}

interface GLTFAccessor {
  array: ArrayLike<number> & { length: number };
  itemSize: number;
}

interface ExtendedGLTFParser extends GLTFParser {
  json: { animations: GLTFAnimationDef[]; [key: string]: unknown };
  _getArrayFromAccessor(
    accessor: GLTFAccessor,
  ): Float32Array | Uint8Array | number[];
  _createCubicSplineTrackInterpolant(track: KeyframeTrack): void;
  _createAnimationTracks(
    node: Object3D,
    inputAccessor: GLTFAccessor,
    outputAccessor: GLTFAccessor,
    sampler: GLTFAnimationSampler,
    target: GLTFAnimationTarget,
  ): KeyframeTrack[] | null;
}

type AnimationTargetType = "node" | "material" | "camera" | "light";

// ---------- Constants ----------
const GLTF_TEXTURE_SLOT_MAP: Array<[string, string]> = [
  ["pbrMetallicRoughness/baseColorTexture", "map"],
  ["pbrMetallicRoughness/metallicRoughnessTexture", "metalnessMap"],
  ["normalTexture", "normalMap"],
  ["occlusionTexture", "aoMap"],
  ["emissiveTexture", "emissiveMap"],
  ["extensions/KHR_materials_clearcoat/clearcoatTexture", "clearcoatMap"],
  [
    "extensions/KHR_materials_clearcoat/clearcoatRoughnessTexture",
    "clearcoatRoughnessMap",
  ],
  [
    "extensions/KHR_materials_clearcoat/clearcoatNormalTexture",
    "clearcoatNormalMap",
  ],
  ["extensions/KHR_materials_sheen/sheenColorTexture", "sheenColorMap"],
  ["extensions/KHR_materials_sheen/sheenRoughnessTexture", "sheenRoughnessMap"],
  [
    "extensions/KHR_materials_transmission/transmissionTexture",
    "transmissionMap",
  ],
  ["extensions/KHR_materials_volume/thicknessTexture", "thicknessMap"],
  ["extensions/KHR_materials_specular/specularTexture", "specularIntensityMap"],
  [
    "extensions/KHR_materials_specular/specularColorTexture",
    "specularColorMap",
  ],
  ["extensions/KHR_materials_iridescence/iridescenceTexture", "iridescenceMap"],
  [
    "extensions/KHR_materials_iridescence/iridescenceThicknessTexture",
    "iridescenceThicknessMap",
  ],
  ["extensions/KHR_materials_anisotropy/anisotropyTexture", "anisotropyMap"],
];

const KHR_TRANSFORM_PROP_MAP: Record<string, string> = {
  offset: "offset",
  scale: "repeat",
  rotation: "rotation",
};

/**
 * "normalTexture/extensions/KHR_texture_transform/offset" → "normalMap/offset"
 * Trả về null nếu không phải texture transform path.
 */
function mapTextureTransform(targetProperty: string): string | null {
  const marker = "/extensions/KHR_texture_transform/";
  const idx = targetProperty.indexOf(marker);
  if (idx === -1) return null;

  const gltfTexPath = targetProperty.substring(0, idx);
  const xformProp = targetProperty.substring(idx + marker.length);

  const threeProp = KHR_TRANSFORM_PROP_MAP[xformProp];
  if (!threeProp) return null;

  for (const [prefix, slot] of GLTF_TEXTURE_SLOT_MAP) {
    if (gltfTexPath === prefix) return slot + "/" + threeProp;
  }
  return null;
}

// Tất cả texture slot mà findNode cần descend vào
const TEXTURE_SLOTS: ReadonlyArray<string> = [
  "map",
  "normalMap",
  "aoMap",
  "emissiveMap",
  "metalnessMap",
  "roughnessMap",
  "clearcoatMap",
  "clearcoatRoughnessMap",
  "clearcoatNormalMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "transmissionMap",
  "thicknessMap",
  "specularIntensityMap",
  "specularColorMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "anisotropyMap",
];

const ANIMATION_TARGET_TYPE: Record<AnimationTargetType, AnimationTargetType> =
  {
    node: "node",
    material: "material",
    camera: "camera",
    light: "light",
  };

const KHR_ANIMATION_POINTER = "KHR_animation_pointer";

const INTERPOLATION = {
  CUBICSPLINE: undefined as InterpolationModes | undefined,
  LINEAR: InterpolateLinear,
  STEP: InterpolateDiscrete,
} as const;

const _animationPointerDebug = false;

// ---------- Material cache (perf optimization) ----------

interface MaterialCacheEntry {
  material: Material;
  // pre-computed match keys (name first, fallback uuid)
  name: string;
  uuid: string;
}

// Cache materials per root scene to avoid traversing on every findNode call.
// WeakMap auto-cleans when scene is unmounted/GC'd.
const materialCacheByRoot = new WeakMap<Object3D, MaterialCacheEntry[]>();

function getMaterialCache(root: Object3D): MaterialCacheEntry[] {
  let cache = materialCacheByRoot.get(root);
  if (!cache) {
    cache = [];
    const seen = new Set<string>();
    root.traverse((x) => {
      const mat = (x as unknown as { material?: Material | Material[] })
        .material;
      if (!mat) return;
      const arr = Array.isArray(mat) ? mat : [mat];
      for (const m of arr) {
        if (seen.has(m.uuid)) continue;
        seen.add(m.uuid);
        cache!.push({
          material: m,
          name: m.name || "",
          uuid: m.uuid,
        });
      }
    });
    // Sort by name length desc so longest-prefix-match wins naturally on first hit
    cache.sort((a, b) => b.name.length - a.name.length);
    materialCacheByRoot.set(root, cache);
  }
  return cache;
}

/**
 * Find a material whose name (or uuid) matches as a prefix of `rest`,
 * where `rest` looks like "MaterialName.001.map.offset" or "MyMat.color".
 *
 * Material names can contain dots (Blender's .001 suffix), so naive split('.') is wrong.
 * We try longest match first.
 */
function findMaterialByPrefix(
  cache: MaterialCacheEntry[],
  rest: string,
): { entry: MaterialCacheEntry; subPath: string } | null {
  // Try name match first (longest first due to sort), then uuid match
  for (const entry of cache) {
    if (entry.name) {
      if (rest === entry.name) return { entry, subPath: "" };
      if (rest.startsWith(entry.name + ".")) {
        return { entry, subPath: rest.substring(entry.name.length) };
      }
    }
  }
  for (const entry of cache) {
    if (rest === entry.uuid) return { entry, subPath: "" };
    if (rest.startsWith(entry.uuid + ".")) {
      return { entry, subPath: rest.substring(entry.uuid.length) };
    }
  }
  return null;
}

// ---------- Extension ----------

export class GLTFAnimationPointerExtension {
  name: string;
  parser: ExtendedGLTFParser;
  animationPointerResolver: AnimationPointerResolver | null;

  constructor(parser: GLTFParser) {
    this.name = KHR_ANIMATION_POINTER;
    this.parser = parser as ExtendedGLTFParser;
    this.animationPointerResolver = null;
  }

  setAnimationPointerResolver(
    animationPointerResolver: AnimationPointerResolver | null,
  ): this {
    this.animationPointerResolver = animationPointerResolver;
    return this;
  }

  loadAnimationTargetFromChannel(
    animationChannel: GLTFAnimationChannel,
  ): Promise<Object3D> {
    const target = animationChannel.target;
    const name =
      target.node !== undefined ? target.node : (target.id as number);
    return this.parser.getDependency("node", name) as Promise<Object3D>;
  }

  loadAnimationTargetFromChannelWithAnimationPointer(
    animationChannel: GLTFAnimationChannel,
  ): Promise<Object3D | unknown> | null | undefined {
    _ensurePropertyBindingPatch();

    const target = animationChannel.target;
    const useExtension =
      !!target.extensions &&
      !!target.extensions[KHR_ANIMATION_POINTER] &&
      !!target.path &&
      target.path === "pointer";
    if (!useExtension) return null;

    let targetProperty: string | undefined = undefined;
    let type: AnimationTargetType = ANIMATION_TARGET_TYPE.node;
    let targetId: number | null | undefined = undefined;

    const ext = target.extensions![KHR_ANIMATION_POINTER]!;
    let path = ext.pointer;
    if (_animationPointerDebug) console.log("Original path: " + path, target);

    if (!path) {
      console.warn("Invalid path", ext, target);
      return;
    }

    if (path.startsWith("/materials/")) type = ANIMATION_TARGET_TYPE.material;
    else if (path.startsWith("/extensions/KHR_lights_punctual/lights/"))
      type = ANIMATION_TARGET_TYPE.light;
    else if (path.startsWith("/cameras/")) type = ANIMATION_TARGET_TYPE.camera;
    else if (path.startsWith("/nodes/")) type = ANIMATION_TARGET_TYPE.node;
    else {
      // Unrecognized pointer target (e.g. /scenes/, /skins/, /textures/,
      // or other extensions we don't support). Skip silently.
      if (_animationPointerDebug)
        console.warn(
          KHR_ANIMATION_POINTER + ": unsupported pointer target",
          path,
        );
      return;
    }

    targetId = this._tryResolveTargetId(path, type);
    if (targetId === null || Number.isNaN(targetId)) {
      console.warn("Failed resolving animation node id: " + targetId, path);
      return;
    }

    switch (type) {
      case ANIMATION_TARGET_TYPE.material: {
        const pathIndex = ("/materials/" + targetId.toString() + "/").length;
        const pathStart = path.substring(0, pathIndex);
        targetProperty = path.substring(pathIndex);

        switch (targetProperty) {
          case "pbrMetallicRoughness/baseColorFactor":
            targetProperty = "color";
            break;
          case "pbrMetallicRoughness/roughnessFactor":
            targetProperty = "roughness";
            break;
          case "pbrMetallicRoughness/metallicFactor":
            targetProperty = "metalness";
            break;
          case "emissiveFactor":
            targetProperty = "emissive";
            break;
          case "alphaCutoff":
            targetProperty = "alphaTest";
            break;
          case "occlusionTexture/strength":
            targetProperty = "aoMapIntensity";
            break;
          case "normalTexture/scale":
            targetProperty = "normalScale";
            break;
          case "extensions/KHR_materials_emissive_strength/emissiveStrength":
            targetProperty = "emissiveIntensity";
            break;
          case "extensions/KHR_materials_transmission/transmissionFactor":
            targetProperty = "transmission";
            break;
          case "extensions/KHR_materials_ior/ior":
            targetProperty = "ior";
            break;
          case "extensions/KHR_materials_volume/thicknessFactor":
            targetProperty = "thickness";
            break;
          case "extensions/KHR_materials_volume/attenuationColor":
            targetProperty = "attenuationColor";
            break;
          case "extensions/KHR_materials_volume/attenuationDistance":
            targetProperty = "attenuationDistance";
            break;
          case "extensions/KHR_materials_iridescence/iridescenceFactor":
            targetProperty = "iridescence";
            break;
          case "extensions/KHR_materials_iridescence/iridescenceIor":
            targetProperty = "iridescenceIOR";
            break;
          case "extensions/KHR_materials_iridescence/iridescenceThicknessMinimum":
            targetProperty = "iridescenceThicknessRange[0]";
            break;
          case "extensions/KHR_materials_iridescence/iridescenceThicknessMaximum":
            targetProperty = "iridescenceThicknessRange[1]";
            break;
          case "extensions/KHR_materials_clearcoat/clearcoatFactor":
            targetProperty = "clearcoat";
            break;
          case "extensions/KHR_materials_clearcoat/clearcoatRoughnessFactor":
            targetProperty = "clearcoatRoughness";
            break;
          case "extensions/KHR_materials_sheen/sheenColorFactor":
            targetProperty = "sheenColor";
            break;
          case "extensions/KHR_materials_sheen/sheenRoughnessFactor":
            targetProperty = "sheenRoughness";
            break;
          case "extensions/KHR_materials_specular/specularFactor":
            targetProperty = "specularIntensity";
            break;
          case "extensions/KHR_materials_specular/specularColorFactor":
            targetProperty = "specularColor";
            break;
        }

        const mapped = mapTextureTransform(targetProperty);
        if (mapped) targetProperty = mapped;

        path = pathStart + targetProperty;
        break;
      }

      case ANIMATION_TARGET_TYPE.node: {
        const pathIndexNode = ("/nodes/" + targetId.toString() + "/").length;
        const pathStartNode = path.substring(0, pathIndexNode);
        targetProperty = path.substring(pathIndexNode);

        if (targetProperty.startsWith("weights/")) {
          // `/nodes/{}/weights/{}` - control individual morph weights
          const weightIndex = targetProperty.substring("weights/".length);
          targetProperty = "morphTargetInfluences[" + weightIndex + "]";
        } else {
          switch (targetProperty) {
            case "translation":
              targetProperty = "position";
              break;
            case "rotation":
              targetProperty = "quaternion";
              break;
            case "scale":
              targetProperty = "scale";
              break;
            case "weights":
              targetProperty = "morphTargetInfluences";
              break;
            case "extensions/KHR_node_visibility/visible":
              targetProperty = "visible";
              break;
          }
        }

        path = pathStartNode + targetProperty;
        break;
      }

      case ANIMATION_TARGET_TYPE.light: {
        const pathIndexLight = (
          "/extensions/KHR_lights_punctual/lights/" +
          targetId.toString() +
          "/"
        ).length;
        targetProperty = path.substring(pathIndexLight);

        switch (targetProperty) {
          case "color":
          case "intensity":
            break;
          case "spot/innerConeAngle":
            targetProperty = "penumbra";
            break;
          case "spot/outerConeAngle":
            targetProperty = "angle";
            break;
          case "range":
            targetProperty = "distance";
            break;
        }

        path = "/lights/" + targetId.toString() + "/" + targetProperty;
        break;
      }

      case ANIMATION_TARGET_TYPE.camera: {
        const pathIndexCamera = ("/cameras/" + targetId.toString() + "/")
          .length;
        const pathStartCamera = path.substring(0, pathIndexCamera);
        targetProperty = path.substring(pathIndexCamera);

        switch (targetProperty) {
          case "perspective/yfov":
            targetProperty = "fov";
            break;
          case "perspective/znear":
          case "orthographic/znear":
            targetProperty = "near";
            break;
          case "perspective/zfar":
          case "orthographic/zfar":
            targetProperty = "far";
            break;
          case "perspective/aspect":
            targetProperty = "aspect";
            break;
          case "orthographic/xmag":
          case "orthographic/ymag":
            targetProperty = "zoom";
            break;
        }

        path = pathStartCamera + targetProperty;
        break;
      }
    }

    if (this.animationPointerResolver?.resolvePath) {
      const resolved = this.animationPointerResolver.resolvePath(path);
      if (resolved !== null) path = resolved;
    }

    // Guard: if targetProperty was not mapped to a known Three.js property,
    // skip this channel rather than producing a broken track.
    if (
      targetProperty === undefined ||
      path.includes("undefined") ||
      path.endsWith("/") // unmapped path ends with the trailing slash
    ) {
      if (_animationPointerDebug)
        console.warn(
          KHR_ANIMATION_POINTER + ": property not mapped",
          ext.pointer,
          "→",
          path,
        );
      return;
    }

    target.extensions![KHR_ANIMATION_POINTER]!.pointer = path;

    if (targetId === null || targetId === undefined || Number.isNaN(targetId)) {
      console.warn("Failed resolving animation node id: " + targetId, target);
      return;
    }

    let depPromise: Promise<unknown> | undefined;
    if (type === ANIMATION_TARGET_TYPE.node)
      depPromise = this.parser.getDependency("node", targetId);
    else if (type === ANIMATION_TARGET_TYPE.material)
      depPromise = this.parser.getDependency("material", targetId);
    else if (type === ANIMATION_TARGET_TYPE.light)
      depPromise = this.parser.getDependency("light", targetId);
    else if (type === ANIMATION_TARGET_TYPE.camera)
      depPromise = this.parser.getDependency("camera", targetId);
    else console.error("Unhandled type", type);

    return depPromise;
  }

  createAnimationTracksWithAnimationPointer(
    node: Object3D,
    inputAccessor: GLTFAccessor,
    outputAccessor: GLTFAccessor,
    sampler: GLTFAnimationSampler,
    target: GLTFAnimationTarget,
  ): KeyframeTrack[] | null {
    const useExtension =
      !!target.extensions &&
      !!target.extensions[KHR_ANIMATION_POINTER] &&
      !!target.path &&
      target.path === "pointer";
    if (!useExtension) return null;

    let animationPointerPropertyPath =
      target.extensions![KHR_ANIMATION_POINTER]!.pointer;
    if (!animationPointerPropertyPath) return null;

    const tracks: KeyframeTrack[] = [];

    animationPointerPropertyPath = animationPointerPropertyPath.replace(
      /\//g,
      ".",
    );
    const parts = animationPointerPropertyPath.split(".");
    const hasName = node.name !== undefined && node.name !== null;
    const nodeTargetName = hasName ? node.name : node.uuid;
    parts[2] = nodeTargetName;

    const parser = this.parser;

    if (parts[3] === "morphTargetInfluences") {
      if (node.type === "Group") {
        if (_animationPointerDebug)
          console.log(
            "Detected multi-material skinnedMesh export",
            animationPointerPropertyPath,
            node,
          );

        for (const ch of node.children) {
          if (ch instanceof SkinnedMesh && ch.morphTargetInfluences) {
            parts[3] = ch.name;
            parts[4] = "morphTargetInfluences";
            __createTrack();
          }
        }
        return tracks;
      }
    }

    __createTrack();

    function isBooleanTarget(node: Object3D, trackPath: string): boolean {
      try {
        const sections = trackPath.split(".").filter(Boolean);
        const last = sections[sections.length - 1];
        const propName = last.replace(/\[.*\]$/, "");
        if (!(propName in (node as unknown as Record<string, unknown>)))
          return false;
        const val = (node as unknown as Record<string, unknown>)[propName];
        return typeof val === "boolean";
      } catch {
        return false;
      }
    }

    function __createTrack(): void {
      animationPointerPropertyPath = parts.join(".");

      type KeyframeTrackCtor = new (
        name: string,
        times: ArrayLike<number>,
        values: ArrayLike<number> | ArrayLike<boolean>,
        interpolation?: InterpolationModes,
      ) => KeyframeTrack;

      let TypedKeyframeTrack: KeyframeTrackCtor | undefined;
      let convertToBoolean = false;

      switch (outputAccessor.itemSize) {
        case 1: {
          const arrayType = Object.prototype.toString.call(
            outputAccessor.array,
          );
          const isUInt8 = arrayType === "[object Uint8Array]";

          const looksLikeBool =
            isUInt8 && isBooleanTarget(node, animationPointerPropertyPath);
          if (looksLikeBool) {
            TypedKeyframeTrack =
              BooleanKeyframeTrack as unknown as KeyframeTrackCtor;
            convertToBoolean = true;
          } else {
            TypedKeyframeTrack =
              NumberKeyframeTrack as unknown as KeyframeTrackCtor;
          }
          break;
        }
        case 2:
        case 3:
          TypedKeyframeTrack =
            VectorKeyframeTrack as unknown as KeyframeTrackCtor;
          break;
        case 4:
          if (animationPointerPropertyPath.endsWith(".quaternion"))
            TypedKeyframeTrack =
              QuaternionKeyframeTrack as unknown as KeyframeTrackCtor;
          else
            TypedKeyframeTrack =
              ColorKeyframeTrack as unknown as KeyframeTrackCtor;
          break;
      }

      if (!TypedKeyframeTrack) {
        console.warn("Unsupported output accessor format", outputAccessor);
        return;
      }

      // For boolean tracks, force discrete interpolation regardless of sampler hint.
      const interpolation = convertToBoolean
        ? InterpolateDiscrete
        : sampler.interpolation !== undefined
          ? INTERPOLATION[sampler.interpolation]
          : InterpolateLinear;

      let outputArray: ArrayLike<number> | ArrayLike<boolean> =
        parser._getArrayFromAccessor(outputAccessor);

      if (animationPointerPropertyPath.endsWith(".fov")) {
        outputArray = Array.from(
          outputArray as ArrayLike<number>,
          (value) => (value / Math.PI) * 180,
        );
      }

      if (convertToBoolean) {
        outputArray = Array.from(
          outputArray as ArrayLike<number>,
          (v) => v > 0,
        );
      }

      const track = new TypedKeyframeTrack(
        animationPointerPropertyPath,
        inputAccessor.array,
        outputArray,
        interpolation,
      );

      if ((sampler.interpolation as string) === "CUBICSPLINE") {
        parser._createCubicSplineTrackInterpolant(track);
      }

      tracks.push(track);

      if (
        animationPointerPropertyPath &&
        outputAccessor.itemSize === 4 &&
        animationPointerPropertyPath.startsWith(".materials.") &&
        animationPointerPropertyPath.endsWith(".color")
      ) {
        const source = outputArray as ArrayLike<number>;
        const opacityArray = new Float32Array(source.length / 4);
        for (let j = 0, jl = source.length / 4; j < jl; j += 1) {
          opacityArray[j] = source[j * 4 + 3];
        }

        const opacityTrack = new TypedKeyframeTrack(
          animationPointerPropertyPath.replace(".color", ".opacity"),
          inputAccessor.array,
          opacityArray,
          interpolation,
        );

        // FIX: was applying to `track` instead of `opacityTrack`
        if ((sampler.interpolation as string) === "CUBICSPLINE") {
          parser._createCubicSplineTrackInterpolant(opacityTrack);
        }

        tracks.push(opacityTrack);
      }
    }

    return tracks;
  }

  _tryResolveTargetId(path: string, type: AnimationTargetType): number {
    let name = "";
    if (type === "node") name = path.substring("/nodes/".length);
    else if (type === "material") name = path.substring("/materials/".length);
    else if (type === "light")
      name = path.substring("/extensions/KHR_lights_punctual/lights/".length);
    else if (type === "camera") name = path.substring("/cameras/".length);

    name = name.substring(0, name.indexOf("/"));
    return Number.parseInt(name, 10);
  }

  loadAnimation(animationIndex: number): Promise<AnimationClip> {
    const json = this.parser.json;
    const parser = this.parser;

    if (!json.animations || !json.animations[animationIndex]) {
      console.warn(
        KHR_ANIMATION_POINTER + ": loadAnimation called for missing animation",
        animationIndex,
      );
      return Promise.resolve(
        new AnimationClip("animation_" + animationIndex, undefined, []),
      );
    }

    const animationDef = json.animations[animationIndex];

    // Fast path: if this animation has no KHR_animation_pointer channels,
    // delegate entirely to Three.js's built-in animation loader by returning
    // a sentinel that signals "extension does not handle this animation".
    // We do this by checking channels here BEFORE doing any custom work.
    const hasPointerChannel = animationDef.channels.some(
      (ch) =>
        !!ch.target?.extensions &&
        !!ch.target.extensions[KHR_ANIMATION_POINTER] &&
        ch.target.path === "pointer",
    );

    if (!hasPointerChannel) {
      // No pointer channels — let GLTFLoader handle this animation natively.
      // We need to call the parser's original animation loader. Three.js doesn't
      // expose it cleanly, but we can use _invokeAll to skip our extension.
      // Simplest: directly use the internal _loadAnimation if available, else
      // re-implement minimal logic that won't crash.
      const originalLoad = (
        parser as unknown as {
          _loadAnimation?: (i: number) => Promise<AnimationClip>;
        }
      )._loadAnimation;
      if (typeof originalLoad === "function") {
        // Bọc cả native loader: nếu nó throw/reject (vd node/material index lệch
        // sau khi qua pipeline) thì fallback sang bản tự viết có guard, và nếu
        // bản đó cũng lỗi thì trả clip rỗng — không bao giờ làm hỏng parse.
        try {
          return Promise.resolve(
            originalLoad.call(parser, animationIndex),
          ).catch((err) => {
            console.warn(
              KHR_ANIMATION_POINTER +
                ": native loadAnimation lỗi, fallback (animation có thể bị bỏ qua)",
              animationIndex,
              err,
            );
            return this._loadAnimationWithoutPointer(animationIndex).catch(() =>
              this._emptyClip(animationIndex),
            );
          });
        } catch (err) {
          console.warn(
            KHR_ANIMATION_POINTER +
              ": native loadAnimation throw sync, fallback",
            animationIndex,
            err,
          );
          return this._loadAnimationWithoutPointer(animationIndex).catch(() =>
            this._emptyClip(animationIndex),
          );
        }
      }
      // No internal hook available — use parser.loadAnimation but guard against
      // recursion by temporarily blocking our extension. Since we control this,
      // we just build using _createAnimationTracks directly.
      return this._loadAnimationWithoutPointer(animationIndex).catch(() =>
        this._emptyClip(animationIndex),
      );
    }

    const animationName = animationDef.name
      ? animationDef.name
      : "animation_" + animationIndex;

    if (_animationPointerDebug)
      console.log(
        KHR_ANIMATION_POINTER + ": loadAnimation",
        animationIndex,
        animationName,
        animationDef,
      );

    const pendingNodes: Array<Promise<unknown> | null | undefined> = [];
    const pendingInputAccessors: Array<Promise<GLTFAccessor>> = [];
    const pendingOutputAccessors: Array<Promise<GLTFAccessor>> = [];
    const pendingSamplers: GLTFAnimationSampler[] = [];
    const pendingTargets: GLTFAnimationTarget[] = [];

    for (let i = 0, il = animationDef.channels.length; i < il; i++) {
      const channel = animationDef.channels[i];
      const sampler = animationDef.samplers[channel.sampler];
      const target = channel.target;
      const input =
        animationDef.parameters !== undefined
          ? animationDef.parameters[sampler.input]
          : sampler.input;
      const output =
        animationDef.parameters !== undefined
          ? animationDef.parameters[sampler.output]
          : sampler.output;

      // Detect whether this channel uses KHR_animation_pointer.
      // - If yes and our extension can't handle it → push undefined (skip channel)
      //   without falling back to loadAnimationTargetFromChannel, since pointer
      //   channels typically have target.path = "pointer" and no target.node,
      //   which would make the fallback crash with `getDependency("node", undefined)`.
      // - If no (regular animation channel) → use the standard fallback.
      const isPointerChannel =
        !!target.extensions &&
        !!target.extensions[KHR_ANIMATION_POINTER] &&
        target.path === "pointer";

      let nodeDependency: Promise<unknown> | null | undefined;
      try {
        nodeDependency =
          this.loadAnimationTargetFromChannelWithAnimationPointer(channel);
        if (!nodeDependency && !isPointerChannel) {
          nodeDependency = this.loadAnimationTargetFromChannel(channel);
        }
      } catch (err) {
        // Lỗi đồng bộ khi resolve target (vd resolver) → bỏ qua channel này
        console.warn(
          KHR_ANIMATION_POINTER + ": resolve target lỗi, bỏ qua channel",
          target,
          err,
        );
        nodeDependency = undefined;
      }

      // Nếu dependency reject (vd material/node index không tồn tại sau pipeline)
      // → nuốt lỗi và trả null để channel bị skip, KHÔNG làm reject cả animation.
      const safeNode =
        nodeDependency == null
          ? nodeDependency
          : Promise.resolve(nodeDependency).catch((err) => {
              console.warn(
                KHR_ANIMATION_POINTER +
                  ": dependency target lỗi, bỏ qua channel",
                target,
                err,
              );
              return null;
            });

      pendingNodes.push(safeNode);
      pendingInputAccessors.push(
        (
          parser.getDependency("accessor", input) as Promise<GLTFAccessor>
        ).catch(() => undefined as unknown as GLTFAccessor),
      );
      pendingOutputAccessors.push(
        (
          parser.getDependency("accessor", output) as Promise<GLTFAccessor>
        ).catch(() => undefined as unknown as GLTFAccessor),
      );
      pendingSamplers.push(sampler);
      pendingTargets.push(target);
    }

    return Promise.all([
      Promise.all(pendingNodes),
      Promise.all(pendingInputAccessors),
      Promise.all(pendingOutputAccessors),
      Promise.all(pendingSamplers),
      Promise.all(pendingTargets),
    ])
      .then((dependencies) => {
        const nodes = dependencies[0] as Array<Object3D | undefined>;
        const inputAccessors = dependencies[1];
        const outputAccessors = dependencies[2];
        const samplers = dependencies[3];
        const targets = dependencies[4];

        const tracks: KeyframeTrack[] = [];

        for (let i = 0, il = nodes.length; i < il; i++) {
          const node = nodes[i];
          const inputAccessor = inputAccessors[i];
          const outputAccessor = outputAccessors[i];
          const sampler = samplers[i];
          const target = targets[i];

          if (node === undefined || node === null) continue;
          if (!inputAccessor || !outputAccessor) continue;

          if ((node as Object3D).updateMatrix) {
            node.updateMatrix();
            node.matrixAutoUpdate = true;
          }

          // Determine if this is a pointer channel — if so, we must NOT fall back
          // to Three.js's stock _createAnimationTracks, because it expects a node-
          // shaped target and a path like "translation"/"rotation"/etc, neither of
          // which apply to pointer channels.
          const isPointerChannel =
            !!target?.extensions &&
            !!target.extensions[KHR_ANIMATION_POINTER] &&
            target.path === "pointer";

          let createdTracks: KeyframeTrack[] | null = null;
          try {
            createdTracks = this.createAnimationTracksWithAnimationPointer(
              node,
              inputAccessor,
              outputAccessor,
              sampler,
              target,
            );
          } catch (err) {
            console.warn(
              KHR_ANIMATION_POINTER +
                ": failed to create pointer track, skipping channel",
              err,
              target,
            );
            createdTracks = null;
          }

          if (!createdTracks && !isPointerChannel) {
            try {
              createdTracks = parser._createAnimationTracks(
                node,
                inputAccessor,
                outputAccessor,
                sampler,
                target,
              );
            } catch (err) {
              console.warn(
                KHR_ANIMATION_POINTER +
                  ": fallback track creation failed, skipping channel",
                err,
                target,
              );
              createdTracks = null;
            }
          }

          if (createdTracks) {
            for (let k = 0; k < createdTracks.length; k++) {
              tracks.push(createdTracks[k]);
            }
          }
        }

        return new AnimationClip(animationName, undefined, tracks);
      })
      .catch((err) => {
        // Lưới an toàn cuối: bất cứ lỗi nào còn sót lại → trả clip rỗng,
        // model vẫn load bình thường (chỉ mất animation này).
        console.warn(
          KHR_ANIMATION_POINTER +
            ": loadAnimation thất bại hoàn toàn, trả clip rỗng",
          animationIndex,
          err,
        );
        return this._emptyClip(animationIndex);
      });
  }

  /** Tạo một AnimationClip rỗng (dùng khi một animation lỗi và cần bỏ qua). */
  private _emptyClip(animationIndex: number): AnimationClip {
    return new AnimationClip("animation_" + animationIndex, undefined, []);
  }

  /**
   * Fallback loader for animations that contain no KHR_animation_pointer channels.
   * Replicates Three.js GLTFLoader's animation loading logic without any pointer-
   * specific handling, so that animations from files that don't use this extension
   * still work even though we've taken over loadAnimation.
   */
  private _loadAnimationWithoutPointer(
    animationIndex: number,
  ): Promise<AnimationClip> {
    const parser = this.parser;
    const json = parser.json;
    const animationDef = json.animations[animationIndex];
    const animationName = animationDef.name
      ? animationDef.name
      : "animation_" + animationIndex;

    const pendingNodes: Array<Promise<Object3D | undefined>> = [];
    const pendingInputAccessors: Array<Promise<GLTFAccessor>> = [];
    const pendingOutputAccessors: Array<Promise<GLTFAccessor>> = [];
    const pendingSamplers: GLTFAnimationSampler[] = [];
    const pendingTargets: GLTFAnimationTarget[] = [];

    for (let i = 0, il = animationDef.channels.length; i < il; i++) {
      const channel = animationDef.channels[i];
      const sampler = animationDef.samplers[channel.sampler];
      const target = channel.target;
      const input =
        animationDef.parameters !== undefined
          ? animationDef.parameters[sampler.input]
          : sampler.input;
      const output =
        animationDef.parameters !== undefined
          ? animationDef.parameters[sampler.output]
          : sampler.output;

      if (target.node === undefined) continue; // skip channels with no target
      // Bỏ qua nếu node index trỏ ra ngoài range (đã bị prune/đổi thứ tự)
      if (
        !Array.isArray(json.nodes) ||
        (json.nodes as unknown[])[target.node] === undefined
      ) {
        console.warn(
          KHR_ANIMATION_POINTER +
            ": node[" +
            target.node +
            "] không tồn tại, bỏ qua channel",
        );
        continue;
      }

      pendingNodes.push(
        (
          parser.getDependency("node", target.node) as Promise<
            Object3D | undefined
          >
        ).catch(() => undefined),
      );
      pendingInputAccessors.push(
        (
          parser.getDependency("accessor", input) as Promise<GLTFAccessor>
        ).catch(() => undefined as unknown as GLTFAccessor),
      );
      pendingOutputAccessors.push(
        (
          parser.getDependency("accessor", output) as Promise<GLTFAccessor>
        ).catch(() => undefined as unknown as GLTFAccessor),
      );
      pendingSamplers.push(sampler);
      pendingTargets.push(target);
    }

    return Promise.all([
      Promise.all(pendingNodes),
      Promise.all(pendingInputAccessors),
      Promise.all(pendingOutputAccessors),
      Promise.all(pendingSamplers),
      Promise.all(pendingTargets),
    ])
      .then((deps) => {
        const nodes = deps[0];
        const inputAccessors = deps[1];
        const outputAccessors = deps[2];
        const samplers = deps[3];
        const targets = deps[4];

        const tracks: KeyframeTrack[] = [];

        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (!node) continue;
          if (!inputAccessors[i] || !outputAccessors[i]) continue;

          if (node.updateMatrix) {
            node.updateMatrix();
            node.matrixAutoUpdate = true;
          }

          try {
            const createdTracks = parser._createAnimationTracks(
              node,
              inputAccessors[i],
              outputAccessors[i],
              samplers[i],
              targets[i],
            );
            if (createdTracks) {
              for (const t of createdTracks) tracks.push(t);
            }
          } catch (err) {
            console.warn(
              KHR_ANIMATION_POINTER +
                ": failed to create track for non-pointer channel",
              err,
              targets[i],
            );
          }
        }

        return new AnimationClip(animationName, undefined, tracks);
      })
      .catch((err) => {
        console.warn(
          KHR_ANIMATION_POINTER +
            ": _loadAnimationWithoutPointer thất bại, trả clip rỗng",
          animationIndex,
          err,
        );
        return this._emptyClip(animationIndex);
      });
  }
}

// ---------- PropertyBinding monkey-patch ----------

let _havePatchedPropertyBindings = false;

type FindNodeFn = (root: Object3D, nodeName: string) => Object3D | null;

let findNodeFn: FindNodeFn | null = null;

function _ensurePropertyBindingPatch(): void {
  if (_havePatchedPropertyBindings) return;
  _havePatchedPropertyBindings = true;

  const findNode: FindNodeFn = (findNodeFn ||= (
    PropertyBinding as unknown as { findNode: FindNodeFn }
  ).findNode);

  (PropertyBinding as unknown as { findNode: FindNodeFn }).findNode = function (
    node: Object3D,
    path: string,
  ): Object3D | null {
    if (!path) return findNode(node, path);

    // ── Material binding ─────────────────────────────────────────────
    // path format: ".materials.<materialName>.<subProp...>"
    // Material names can contain dots (Blender's .001 suffix), so we cannot
    // split by '.' naively. We use a longest-prefix match against a cached
    // material list per scene.
    if (path.startsWith(".materials.")) {
      const rest = path.substring(".materials.".length);
      const cache = getMaterialCache(node);
      const found = findMaterialByPrefix(cache, rest);

      if (!found) {
        if (_animationPointerDebug)
          console.warn(
            KHR_ANIMATION_POINTER + ": material not found",
            path,
            rest,
          );
        return null;
      }

      let res: Object3D | Material | Texture | null = found.entry.material;
      const subPath = found.subPath; // e.g. ".map.offset" or ".color" or ""

      // If the sub-path targets a texture slot (.map / .emissiveMap),
      // descend into the texture so PropertyBinding can resolve .offset / .repeat.
      // We check the FIRST segment after the leading dot.
      if (subPath.length > 0) {
        const firstSeg = subPath.substring(1).split(".")[0];

        if (TEXTURE_SLOTS.includes(firstSeg)) {
          const tex = (
            found.entry.material as unknown as Record<
              string,
              Texture | undefined
            >
          )[firstSeg];
          if (tex) res = tex;
        }
      }

      if (_animationPointerDebug)
        console.log("FIND material", path, "→", res, "subPath:", subPath);

      return res as unknown as Object3D;
    }

    // ── Node / light / camera binding ────────────────────────────────
    if (
      path.startsWith(".nodes.") ||
      path.startsWith(".lights.") ||
      path.startsWith(".cameras.")
    ) {
      const sections = path.split(".");
      let currentTarget: Object3D | undefined = undefined;

      for (let i = 1; i < sections.length; i++) {
        const val = sections[i];
        const isUUID = val.length === 36;
        if (isUUID) {
          currentTarget = node.getObjectByProperty("uuid", val) as
            | Object3D
            | undefined;
        } else if (
          currentTarget &&
          (currentTarget as unknown as Record<string, unknown>)[val]
        ) {
          const index = Number.parseInt(val, 10);
          let key: string | number = val;
          if (index >= 0) key = index;
          currentTarget = (
            currentTarget as unknown as Record<string | number, Object3D>
          )[key];
        } else {
          const foundNode = node.getObjectByName(val);
          if (foundNode) currentTarget = foundNode;
        }
      }

      if (!currentTarget) {
        const originalFindResult = findNode(node, sections[2]);
        if (!originalFindResult)
          console.warn(
            KHR_ANIMATION_POINTER + ": Property binding not found",
            path,
            node,
            node.name,
            sections,
          );
        return originalFindResult;
      }

      return currentTarget;
    }

    return findNode(node, path);
  };
}
