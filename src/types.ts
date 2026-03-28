export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface Env {
  baseUrl: string;
  token: string;
  headers?: Record<string, string>;
  vars?: Record<string, string>;
}

export type EndpointBody = Record<string, unknown> | (() => Record<string, unknown>);

export interface Endpoint {
  method: HttpMethod;
  path: string;
  body?: EndpointBody;
  headers?: Record<string, string>;
  description?: string;
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
