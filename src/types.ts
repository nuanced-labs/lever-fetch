export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface Env {
  baseUrl: string;
  token: string;
  headers?: Record<string, string>;
  vars?: Record<string, string>;
}

export type EnvFactory = () => Promise<Env> | Env;

export type EndpointBody = Record<string, unknown> | (() => Record<string, unknown>);
export type InputFields = Record<string, string>;

export interface Endpoint {
  method: HttpMethod;
  path: string;
  body?: EndpointBody;
  headers?: Record<string, string>;
  description?: string;
  input?: InputFields;
}

export function resolveBody(body: EndpointBody | undefined): unknown {
  if (typeof body === "function") return body();
  return body;
}

export interface RunResult {
  endpoint: string;
  status: number;
  ok: boolean;
  durationMs: number;
  body: unknown;
}

export const ENDPOINTS_DIR_NAME = "endpoints";
export const ENVS_DIR_NAME = "envs";
export const FILE_EXTENSION = ".ts";
export const DEFAULT_ENV = "local";
export const CONTENT_TYPE_JSON = "application/json";
export const AUTH_SCHEME = "Bearer";
export const VAR_PATTERN = /\{(\w+)\}/g;
export const ENV_FILE_NAME = ".env";
export const ENV_EXAMPLE_FILE_NAME = ".env.example";
export const GITIGNORE_FILE_NAME = ".gitignore";
export const COLLECTION_SEPARATOR = "/";
export const VARS_FILE_NAME = "vars";
export const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
} as const;

export const CLEAR_LINE = "\r\x1b[K";
export const DURATION_PATTERN = /^(\d+)(s|m)$/;

export const ERROR_ENV_NOT_FOUND = (name: string, filePath: string) =>
  `Environment "${name}" not found at ${filePath}`;

export const ERROR_ENV_RESOLVE_FAILED = (name: string, message: string) =>
  `Failed to resolve environment "${name}": ${message}`;

export function parseDuration(input: string): number {
  const match = input.match(DURATION_PATTERN);
  if (!match) throw new Error(`Invalid duration "${input}". Use format: 30s or 2m`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  return unit === "m" ? value * 60 : value;
}
