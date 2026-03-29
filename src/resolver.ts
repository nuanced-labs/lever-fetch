import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  COLLECTION_SEPARATOR,
  ENDPOINTS_DIR_NAME,
  FILE_EXTENSION,
  VARS_FILE_NAME,
} from "./types.js";

export const ENDPOINTS_DIR = path.resolve(process.cwd(), ENDPOINTS_DIR_NAME);
export const FILE_EXT_PATTERN = new RegExp(`\\${FILE_EXTENSION}$`);

export interface EndpointFile {
  /** Display/reference path: "users" or "my-api/users" */
  ref: string;
  /** Absolute filesystem path to the .ts file */
  fsPath: string;
  /** Collection name, if the file is inside a collection directory */
  collection?: string;
}

export type ParsedTarget =
  | { kind: "all" }
  | { kind: "collection"; collection: string }
  | { kind: "file"; ref: string }
  | { kind: "collectionFile"; ref: string }
  | { kind: "endpoint"; ref: string; endpoint: string }
  | { kind: "collectionEndpoint"; ref: string; endpoint: string };

function stripExtension(filename: string): string {
  return filename.replace(FILE_EXT_PATTERN, "");
}

function isDirectory(fullPath: string): boolean {
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
}

export function discoverEndpoints(): EndpointFile[] {
  const entries = fs.readdirSync(ENDPOINTS_DIR, { withFileTypes: true });
  const files: EndpointFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(ENDPOINTS_DIR, entry.name);

    if (entry.isFile() && entry.name.endsWith(FILE_EXTENSION)) {
      files.push({ ref: stripExtension(entry.name), fsPath: fullPath });
    }

    if (entry.isDirectory()) {
      const children = fs.readdirSync(fullPath);
      for (const child of children) {
        if (child.endsWith(FILE_EXTENSION) && stripExtension(child) !== VARS_FILE_NAME) {
          const childPath = path.join(fullPath, child);
          const ref = `${entry.name}${COLLECTION_SEPARATOR}${stripExtension(child)}`;
          files.push({ ref, fsPath: childPath, collection: entry.name });
        }
      }
    }
  }

  return files;
}

export function resolveTarget(target: string | undefined): ParsedTarget {
  if (!target) return { kind: "all" };

  const hasSlash = target.includes(COLLECTION_SEPARATOR);
  const hasDot = target.includes(".");

  if (hasSlash && hasDot) {
    const slashIdx = target.indexOf(COLLECTION_SEPARATOR);
    const remainder = target.slice(slashIdx + 1);
    const dotIdx = remainder.indexOf(".");
    const collection = target.slice(0, slashIdx);
    const file = remainder.slice(0, dotIdx);
    const endpoint = remainder.slice(dotIdx + 1);
    return {
      kind: "collectionEndpoint",
      ref: `${collection}${COLLECTION_SEPARATOR}${file}`,
      endpoint,
    };
  }

  if (hasSlash) {
    return { kind: "collectionFile", ref: target };
  }

  if (hasDot) {
    const dotIdx = target.indexOf(".");
    const file = target.slice(0, dotIdx);
    const endpoint = target.slice(dotIdx + 1);
    return { kind: "endpoint", ref: file, endpoint };
  }

  // Bare name: check if it's a collection directory or a flat file
  const dirPath = path.join(ENDPOINTS_DIR, target);
  if (isDirectory(dirPath)) {
    return { kind: "collection", collection: target };
  }

  return { kind: "file", ref: target };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

export async function loadCollectionVars(collection: string): Promise<Record<string, string>> {
  const varsPath = path.join(ENDPOINTS_DIR, collection, `${VARS_FILE_NAME}${FILE_EXTENSION}`);
  if (!fs.existsSync(varsPath)) return {};

  const fileUrl = pathToFileURL(varsPath).href;
  const mod = await import(fileUrl);
  const vars = mod.default;

  if (!isStringRecord(vars)) {
    throw new Error(`vars.ts in "${collection}" must default-export a Record<string, string>`);
  }

  return vars;
}
