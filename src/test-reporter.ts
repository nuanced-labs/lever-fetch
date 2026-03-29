import { COLORS } from "./types.js";
import type { StepResult, SuiteResult } from "./test-types.js";

const LABEL_PASS = "PASS";
const LABEL_FAIL = "FAIL";
const LABEL_SKIP = "SKIP";

export function printStepResult(result: StepResult): void {
  if (result.skipped) {
    console.log(`\n${COLORS.dim}[${LABEL_SKIP}] ${result.step.name}${COLORS.reset}`);
    return;
  }

  const color = result.passed ? COLORS.green : COLORS.red;
  const label = result.passed ? LABEL_PASS : LABEL_FAIL;
  const status = result.runResult?.status ?? "";
  const timing = result.durationMs;

  console.log(
    `\n${color}[${label}]${COLORS.reset} ${result.step.name} ` +
      `${COLORS.dim}${status} ${timing}ms${COLORS.reset}`,
  );

  for (const failure of result.failures) {
    console.log(`  ${COLORS.red}${failure}${COLORS.reset}`);
  }

  for (const [key, value] of Object.entries(result.extracted)) {
    console.log(`  ${COLORS.dim}${key} = ${value}${COLORS.reset}`);
  }
}

export function printSuiteResult(result: SuiteResult): void {
  const passed = result.steps.filter((s) => s.passed).length;
  const failed = result.steps.filter((s) => !s.passed && !s.skipped).length;
  const skipped = result.steps.filter((s) => s.skipped).length;

  const parts = [`${passed} passed`];
  if (failed > 0) parts.push(`${failed} failed`);
  if (skipped > 0) parts.push(`${skipped} skipped`);

  const color = result.passed ? COLORS.green : COLORS.red;
  console.log(
    `\n${color}--- ${result.suite}: ${parts.join(", ")} (${result.durationMs}ms) ---${COLORS.reset}`,
  );
}
