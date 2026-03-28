import { AUTH_SCHEME, CONTENT_TYPE_JSON, VAR_PATTERN, resolveBody } from "./types.js";
import type { Endpoint, Env, RunResult } from "./types.js";

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
} as const;

function statusColor(status: number): string {
  if (status < 300) return COLORS.green;
  if (status < 400) return COLORS.yellow;
  return COLORS.red;
}

function resolvePath(
  rawPath: string,
  vars: Record<string, string> | undefined,
): string {
  if (!vars) return rawPath;
  return rawPath.replace(VAR_PATTERN, (match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`Missing variable "{${key}}" in env.vars`);
    }
    return encodeURIComponent(value);
  });
}

export async function executeEndpoint(
  env: Env,
  name: string,
  endpoint: Endpoint,
): Promise<RunResult> {
  const url = `${env.baseUrl}${resolvePath(endpoint.path, env.vars)}`;
  const headers: Record<string, string> = {
    "Content-Type": CONTENT_TYPE_JSON,
    Authorization: `${AUTH_SCHEME} ${env.token}`,
    ...env.headers,
    ...endpoint.headers,
  };

  const init: RequestInit = {
    method: endpoint.method,
    headers,
  };

  const resolvedBody = resolveBody(endpoint.body);
  if (resolvedBody !== undefined) {
    init.body = JSON.stringify(resolvedBody);
  }

  const start = performance.now();
  const response = await fetch(url, init);
  const durationMs = Math.round(performance.now() - start);

  let body: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes(CONTENT_TYPE_JSON)) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return { endpoint: name, status: response.status, ok: response.ok, durationMs, body };
}

export function printResult(result: RunResult): void {
  const color = statusColor(result.status);
  const label = result.ok ? "PASS" : "FAIL";

  console.log(
    `\n${color}[${label}]${COLORS.reset} ${result.endpoint} ` +
      `${COLORS.dim}${result.status} ${result.durationMs}ms${COLORS.reset}`,
  );

  if (result.body !== undefined) {
    const formatted =
      typeof result.body === "string"
        ? result.body
        : JSON.stringify(result.body, null, 2);
    console.log(formatted);
  }
}

export function printSummary(results: RunResult[]): void {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n--- ${results.length} run, ${passed} passed, ${failed} failed ---`);
}
