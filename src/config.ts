import { pathToFileURL } from "node:url";
import path from "node:path";
import { ENVS_DIR_NAME, FILE_EXTENSION } from "./types.js";
import type { Env } from "./types.js";

const ENVS_DIR = path.resolve(process.cwd(), ENVS_DIR_NAME);

export async function loadEnv(name: string): Promise<Env> {
  const filePath = path.join(ENVS_DIR, `${name}${FILE_EXTENSION}`);
  const fileUrl = pathToFileURL(filePath).href;

  try {
    const mod = await import(fileUrl);
    return mod.default as Env;
  } catch {
    throw new Error(`Environment "${name}" not found at ${filePath}`);
  }
}
