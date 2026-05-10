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
          case "pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/scale":
            targetProperty = "map/repeat";
            break;
          case "pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/offset":
            targetProperty = "map/offset";
            break;
          case "emissiveTexture/extensions/KHR_texture_transform/scale":
            targetProperty = "emissiveMap/repeat";
            break;
          case "emissiveTexture/extensions/KHR_texture_transform/offset":
            targetProperty = "emissiveMap/offset";
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

        path = pathStart + targetProperty;
        break;
      }

      case ANIMATION_TARGET_TYPE.node: {
        const pathIndexNode = ("/nodes/" + targetId.toString() + "/").length;
        const pathStartNode = path.substring(0, pathIndexNode);
        targetProperty = path.substring(pathIndexNode);

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

    const animationDef = json.animations[animationIndex];
    const animationName = animationDef.name
      ? animationDef.name
      : "animation_" + animationIndex;

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

      let nodeDependency: Promise<unknown> | null | undefined =
        this.loadAnimationTargetFromChannelWithAnimationPointer(channel);
      if (!nodeDependency)
        nodeDependency = this.loadAnimationTargetFromChannel(channel);

      pendingNodes.push(nodeDependency);
      pendingInputAccessors.push(
        parser.getDependency("accessor", input) as Promise<GLTFAccessor>,
      );
      pendingOutputAccessors.push(
        parser.getDependency("accessor", output) as Promise<GLTFAccessor>,
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
    ]).then((dependencies) => {
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

        if (node === undefined) continue;

        if ((node as Object3D).updateMatrix) {
          node.updateMatrix();
          node.matrixAutoUpdate = true;
        }

        let createdTracks: KeyframeTrack[] | null =
          this.createAnimationTracksWithAnimationPointer(
            node,
            inputAccessor,
            outputAccessor,
            sampler,
            target,
          );
        if (!createdTracks)
          createdTracks = parser._createAnimationTracks(
            node,
            inputAccessor,
            outputAccessor,
            sampler,
            target,
          );

        if (createdTracks) {
          for (let k = 0; k < createdTracks.length; k++) {
            tracks.push(createdTracks[k]);
          }
        }
      }

      return new AnimationClip(animationName, undefined, tracks);
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
        // strip leading "." then take first segment
        const firstSeg = subPath.substring(1).split(".")[0];

        if (firstSeg === "map") {
          const tex = (found.entry.material as unknown as { map?: Texture })
            .map;
          if (tex) res = tex;
        } else if (firstSeg === "emissiveMap") {
          const tex = (
            found.entry.material as unknown as { emissiveMap?: Texture }
          ).emissiveMap;
          if (tex) res = tex;
        }
        // Other texture slots (normalMap, metalnessMap, ...) only support
        // transforms via .map in three.js, so we don't descend for them.
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
