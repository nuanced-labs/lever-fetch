import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { executeEndpoint } from "./client.js";
import { ENDPOINTS_DIR, FILE_EXT_PATTERN } from "./resolver.js";
import { resolveEndpoint } from "./runner.js";
import { TESTS_DIR_NAME } from "./test-types.js";
import type { StepResult, SuiteResult, TestSuite, TestSuiteFile } from "./test-types.js";
import { evaluateAssertions, extractVariables } from "./test-assert.js";
import { printStepResult } from "./test-reporter.js";
import { COLLECTION_SEPARATOR, FILE_EXTENSION } from "./types.js";
import type { Env } from "./types.js";

export function discoverTestSuites(collection?: string): TestSuiteFile[] {
  const entries = fs.readdirSync(ENDPOINTS_DIR, { withFileTypes: true });
  const suites: TestSuiteFile[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (collection && entry.name !== collection) continue;

    const testsDir = path.join(ENDPOINTS_DIR, entry.name, TESTS_DIR_NAME);
    if (!fs.existsSync(testsDir)) continue;

    const files = fs.readdirSync(testsDir);
    for (const file of files) {
      if (!file.endsWith(FILE_EXTENSION)) continue;
      const suiteName = file.replace(FILE_EXT_PATTERN, "");
      suites.push({
        ref: `${entry.name}${COLLECTION_SEPARATOR}${suiteName}`,
        fsPath: path.join(testsDir, file),
        collection: entry.name,
      });
    }
  }

  return suites;
}

function isTestSuite(value: unknown): value is TestSuite {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.steps) && obj.steps.every(isTestStep);
}

function isTestStep(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.name === "string" && typeof obj.endpoint === "string";
}

export async function loadTestSuite(file: TestSuiteFile): Promise<TestSuite> {
  const fileUrl = pathToFileURL(file.fsPath).href;
  const mod = await import(fileUrl);
  const suite = mod.default;

  if (!isTestSuite(suite)) {
    throw new Error(
      `Invalid test suite in "${file.ref}". Must default-export { steps: TestStep[] }`,
    );
  }

  return suite;
}

function parseEndpointRef(endpoint: string): { ref: string; endpointName: string } {
  const dotIdx = endpoint.lastIndexOf(".");
  if (dotIdx === -1) {
    throw new Error(
      `Invalid endpoint reference "${endpoint}". Use format: collection/file.endpoint`,
    );
  }
  return { ref: endpoint.slice(0, dotIdx), endpointName: endpoint.slice(dotIdx + 1) };
}

export async function runTestSuite(
  env: Env,
  suiteRef: string,
  suite: TestSuite,
): Promise<SuiteResult> {
  const startTime = performance.now();
  const results: StepResult[] = [];
  const vars: Record<string, string> = { ...env.vars };
  let failed = false;

  for (const step of suite.steps) {
    if (failed) {
      results.push({
        step,
        passed: false,
        skipped: true,
        runResult: null,
        failures: [],
        extracted: {},
        durationMs: 0,
      });
      printStepResult(results.at(-1)!);
      continue;
    }

    const stepStart = performance.now();
    const stepEnv: Env = { ...env, vars: { ...vars } };
    const { ref, endpointName } = parseEndpointRef(step.endpoint);

    try {
      const resolved = await resolveEndpoint(stepEnv, ref, endpointName);
      const runResult = await executeEndpoint(
        resolved.env,
        resolved.name,
        resolved.endpoint,
        step.input,
      );
      const failures = evaluateAssertions(runResult, step.assert);
      const extracted = extractVariables(runResult, step.extract);

      Object.assign(vars, extracted);

      const passed = failures.length === 0;
      if (!passed) failed = true;

      results.push({
        step,
        passed,
        skipped: false,
        runResult,
        failures,
        extracted,
        durationMs: Math.round(performance.now() - stepStart),
      });
    } catch (err) {
      failed = true;
      results.push({
        step,
        passed: false,
        skipped: false,
        runResult: null,
        failures: [(err as Error).message],
        extracted: {},
        durationMs: Math.round(performance.now() - stepStart),
      });
    }

    printStepResult(results.at(-1)!);
  }

  return {
    suite: suiteRef,
    description: suite.description ?? "",
    steps: results,
    passed: results.every((r) => r.passed),
    durationMs: Math.round(performance.now() - startTime),
  };
}
