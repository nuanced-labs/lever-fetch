import type { RunResult } from "./types.js";

export const TESTS_DIR_NAME = "tests";

export interface TestStep {
  name: string;
  endpoint: string;
  assert?: {
    status?: number;
    body?: Record<string, unknown>;
  };
  extract?: Record<string, string>;
}

export interface TestSuite {
  description?: string;
  steps: TestStep[];
}

export interface StepResult {
  step: TestStep;
  passed: boolean;
  skipped: boolean;
  runResult: RunResult | null;
  failures: string[];
  extracted: Record<string, string>;
  durationMs: number;
}

export interface SuiteResult {
  suite: string;
  description: string;
  steps: StepResult[];
  passed: boolean;
  durationMs: number;
}

export interface TestSuiteFile {
  ref: string;
  fsPath: string;
  collection: string;
}
