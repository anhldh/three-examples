import type { GLTFParser } from "three/addons/loaders/GLTFLoader.js";

const EXT_NAME = "EXT_structural_metadata";

type MetadataExtension = { schemaUri?: string; schema?: unknown };

const schemaCache = new Map<string, Promise<unknown>>();

class IonSchemaPlugin {
  name = "ION_INLINE_SCHEMA";
  parser: GLTFParser;
  getToken: () => Promise<string>;

  constructor(parser: GLTFParser, getToken: () => Promise<string>) {
    this.parser = parser;
    this.getToken = getToken;
  }

  async beforeRoot() {
    const extensions = this.parser.json.extensions as
      | Record<string, MetadataExtension>
      | undefined;
    const extension = extensions?.[EXT_NAME];
    if (!extension?.schemaUri) return;

    const url = new URL(
      extension.schemaUri,
      this.parser.options.path,
    ).toString();

    let schema = schemaCache.get(url);
    if (!schema) {
      schema = this.getToken().then(async (token) => {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`schema ${url}: ${res.status}`);
        return res.json();
      });
      schemaCache.set(url, schema);
    }

    extension.schema = await schema;
    delete extension.schemaUri;
  }
}

export function createIonSchemaPlugin(assetId: string, apiToken: string) {
  let token: Promise<string> | null = null;

  const getToken = () => {
    token ??= fetch(
      `https://api.cesium.com/v1/assets/${assetId}/endpoint?access_token=${apiToken}`,
    )
      .then((res) => res.json())
      .then((json) => json.accessToken as string);
    return token;
  };

  return (parser: GLTFParser) => new IonSchemaPlugin(parser, getToken);
}
