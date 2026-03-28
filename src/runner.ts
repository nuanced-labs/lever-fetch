import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ENDPOINTS_DIR_NAME, FILE_EXTENSION } from "./types.js";
import type { Endpoint, Env, RunResult } from "./types.js";
import { executeEndpoint, printResult } from "./client.js";

const ENDPOINTS_DIR = path.resolve(process.cwd(), ENDPOINTS_DIR_NAME);

async function loadEndpointModule(
  file: string,
): Promise<Record<string, Endpoint>> {
  const filePath = path.join(ENDPOINTS_DIR, `${file}${FILE_EXTENSION}`);
  const fileUrl = pathToFileURL(filePath).href;
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

function listEndpointFiles(): string[] {
  return fs
    .readdirSync(ENDPOINTS_DIR)
    .filter((f) => f.endsWith(FILE_EXTENSION))
    .map((f) => f.replace(new RegExp(`\\${FILE_EXTENSION}$`), ""));
}

export async function runSingle(
  env: Env,
  target: string,
): Promise<RunResult> {
  const [file, name] = target.split(".");
  if (!file || !name) {
    throw new Error(`Invalid target "${target}". Use format: file.endpoint`);
  }

  const endpoints = await loadEndpointModule(file);
  const endpoint = endpoints[name];
  if (!endpoint) {
    throw new Error(
      `Endpoint "${name}" not found in ${file}. Available: ${Object.keys(endpoints).join(", ")}`,
    );
  }

  const result = await executeEndpoint(env, target, endpoint);
  printResult(result);
  return result;
}

export async function runFile(
  env: Env,
  file: string,
): Promise<RunResult[]> {
  const endpoints = await loadEndpointModule(file);
  const results: RunResult[] = [];

  for (const [name, endpoint] of Object.entries(endpoints)) {
    const label = `${file}.${name}`;
    const result = await executeEndpoint(env, label, endpoint);
    printResult(result);
    results.push(result);
  }
  return results;
}

export async function runAll(env: Env): Promise<RunResult[]> {
  const files = listEndpointFiles();
  const results: RunResult[] = [];
  for (const file of files) {
    const fileResults = await runFile(env, file);
    results.push(...fileResults);
  }
  return results;
}

export async function listEndpoints(): Promise<void> {
  const files = listEndpointFiles();
  for (const file of files) {
    const endpoints = await loadEndpointModule(file);
    for (const [name, ep] of Object.entries(endpoints)) {
      const desc = ep.description ? ` — ${ep.description}` : "";
      console.log(`  ${file}.${name}  ${ep.method} ${ep.path}${desc}`);
    }
  }
}
