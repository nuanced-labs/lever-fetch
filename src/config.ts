import { pathToFileURL } from "node:url";
import path from "node:path";
import { ENVS_DIR_NAME, ERROR_ENV_NOT_FOUND, ERROR_ENV_RESOLVE_FAILED, FILE_EXTENSION } from "./types.js";
import type { Env } from "./types.js";

const ENVS_DIR = path.resolve(process.cwd(), ENVS_DIR_NAME);

export async function loadEnv(name: string): Promise<Env> {
  const filePath = path.join(ENVS_DIR, `${name}${FILE_EXTENSION}`);
  const fileUrl = pathToFileURL(filePath).href;

  let mod: Record<string, unknown>;
  try {
    mod = await import(fileUrl);
  } catch {
    throw new Error(ERROR_ENV_NOT_FOUND(name, filePath));
  }

  const exported = mod.default;
  if (typeof exported === "function") {
    try {
      return await exported() as Env;
    } catch (error) {
      throw new Error(ERROR_ENV_RESOLVE_FAILED(name, (error as Error).message));
    }
  }

  return exported as Env;
}
