import fs from "node:fs";
import path from "node:path";
import {
  COLLECTION_SEPARATOR,
  ENDPOINTS_DIR_NAME,
  FILE_EXTENSION,
} from "./types.js";

const ENDPOINTS_DIR = path.resolve(process.cwd(), ENDPOINTS_DIR_NAME);
const FILE_EXT_PATTERN = new RegExp(`\\${FILE_EXTENSION}$`);

export interface EndpointFile {
  /** Display/reference path: "auth" or "zookeeper/auth" */
  ref: string;
  /** Absolute filesystem path to the .ts file */
  fsPath: string;
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
        if (child.endsWith(FILE_EXTENSION)) {
          const childPath = path.join(fullPath, child);
          const ref = `${entry.name}${COLLECTION_SEPARATOR}${stripExtension(child)}`;
          files.push({ ref, fsPath: childPath });
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
    return { kind: "collectionEndpoint", ref: `${collection}${COLLECTION_SEPARATOR}${file}`, endpoint };
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
