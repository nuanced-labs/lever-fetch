import { pathToFileURL } from "node:url";
import { COLLECTION_SEPARATOR } from "./types.js";
import type { Endpoint, Env, RunResult } from "./types.js";
import { executeEndpoint, printResult } from "./client.js";
import { discoverEndpoints, loadCollectionVars } from "./resolver.js";
import type { EndpointFile } from "./resolver.js";

async function loadEndpointModule(
  file: EndpointFile,
): Promise<Record<string, Endpoint>> {
  const fileUrl = pathToFileURL(file.fsPath).href;
  const mod = (await import(fileUrl)) as Record<string, unknown>;

  const endpoints: Record<string, Endpoint> = {};
  for (const [key, value] of Object.entries(mod)) {
    if (isEndpoint(value)) {
      endpoints[key] = value;
    }
  }
  return endpoints;
}

function isEndpoint(value: unknown): value is Endpoint {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.method === "string" && typeof obj.path === "string";
}

const varsCache = new Map<string, Record<string, string>>();

async function mergeVars(env: Env, file: EndpointFile): Promise<Env> {
  if (!file.collection) return env;

  if (!varsCache.has(file.collection)) {
    varsCache.set(file.collection, await loadCollectionVars(file.collection));
  }

  const collectionVars = varsCache.get(file.collection)!;
  return {
    ...env,
    vars: { ...collectionVars, ...env.vars },
  };
}

function findFile(ref: string): EndpointFile {
  const files = discoverEndpoints();
  const match = files.find((f) => f.ref === ref);
  if (!match) {
    const available = files.map((f) => f.ref).join(", ");
    throw new Error(`File "${ref}" not found. Available: ${available}`);
  }
  return match;
}

export async function resolveEndpoint(
  env: Env,
  ref: string,
  endpointName: string,
): Promise<{ env: Env; name: string; endpoint: Endpoint }> {
  const file = findFile(ref);
  const endpoints = await loadEndpointModule(file);
  const endpoint = endpoints[endpointName];

  if (!endpoint) {
    const available = Object.keys(endpoints).join(", ");
    throw new Error(`Endpoint "${endpointName}" not found in ${ref}. Available: ${available}`);
  }

  const merged = await mergeVars(env, file);
  const name = `${ref}.${endpointName}`;
  return { env: merged, name, endpoint };
}

export async function runSingle(
  env: Env,
  ref: string,
  endpointName: string,
): Promise<RunResult> {
  const resolved = await resolveEndpoint(env, ref, endpointName);
  const result = await executeEndpoint(resolved.env, resolved.name, resolved.endpoint);
  printResult(result);
  return result;
}

export async function runFile(
  env: Env,
  ref: string,
): Promise<RunResult[]> {
  const file = findFile(ref);
  const merged = await mergeVars(env, file);
  const endpoints = await loadEndpointModule(file);
  const results: RunResult[] = [];

  for (const [name, endpoint] of Object.entries(endpoints)) {
    const label = `${ref}.${name}`;
    const result = await executeEndpoint(merged, label, endpoint);
    printResult(result);
    results.push(result);
  }
  return results;
}

export async function runCollection(
  env: Env,
  collection: string,
): Promise<RunResult[]> {
  const files = discoverEndpoints();
  const prefix = `${collection}${COLLECTION_SEPARATOR}`;
  const matches = files.filter((f) => f.ref.startsWith(prefix));

  if (matches.length === 0) {
    const collections = [...new Set(
      files.filter((f) => f.ref.includes(COLLECTION_SEPARATOR))
        .map((f) => f.ref.split(COLLECTION_SEPARATOR)[0]),
    )];
    throw new Error(`Collection "${collection}" not found. Available: ${collections.join(", ")}`);
  }

  const results: RunResult[] = [];
  for (const file of matches) {
    const fileResults = await runFile(env, file.ref);
    results.push(...fileResults);
  }
  return results;
}

export async function runAll(env: Env): Promise<RunResult[]> {
  const files = discoverEndpoints();
  const results: RunResult[] = [];
  for (const file of files) {
    const fileResults = await runFile(env, file.ref);
    results.push(...fileResults);
  }
  return results;
}

export async function listEndpoints(): Promise<void> {
  const files = discoverEndpoints();
  for (const file of files) {
    const endpoints = await loadEndpointModule(file);
    for (const [name, ep] of Object.entries(endpoints)) {
      const desc = ep.description ? ` — ${ep.description}` : "";
      console.log(`  ${file.ref}.${name}  ${ep.method} ${ep.path}${desc}`);
    }
  }
}
