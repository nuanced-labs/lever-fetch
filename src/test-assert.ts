import type { RunResult } from "./types.js";
import type { TestStep } from "./test-types.js";
import { accessPath, formatValue } from "./test-accessor.js";

function sortedStringify(value: unknown): string {
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(sortedStringify).join(",")}]`;
  const sorted = Object.keys(value as Record<string, unknown>).sort();
  const entries = sorted.map(
    (k) => `${JSON.stringify(k)}:${sortedStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${entries.join(",")}}`;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  return sortedStringify(a) === sortedStringify(b);
}

export function evaluateAssertions(result: RunResult, assert: TestStep["assert"]): string[] {
  if (!assert) return [];

  const failures: string[] = [];

  if (assert.status !== undefined && result.status !== assert.status) {
    failures.push(`expected status ${assert.status}, got ${result.status}`);
  }

  if (assert.body) {
    for (const [path, expected] of Object.entries(assert.body)) {
      const actual = accessPath(result.body, path);
      if (!deepEqual(actual, expected)) {
        failures.push(`expected ${path} = ${formatValue(expected)}, got ${formatValue(actual)}`);
      }
    }
  }

  return failures;
}

export function extractVariables(
  result: RunResult,
  extract: Record<string, string> | undefined,
): Record<string, string> {
  if (!extract) return {};

  const vars: Record<string, string> = {};
  for (const [varName, path] of Object.entries(extract)) {
    const value = accessPath(result, path);
    if (value === undefined) {
      throw new Error(`extraction failed: "${path}" resolved to undefined`);
    }
    vars[varName] = formatValue(value);
  }

  return vars;
}
