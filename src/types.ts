export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface Env {
  baseUrl: string;
  token: string;
  headers?: Record<string, string>;
}

export interface Endpoint {
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  description?: string;
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
