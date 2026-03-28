import type { LoadReport, Sample } from "./load-types.js";
import { COLORS } from "./types.js";

const REPORT_DIVIDER = "─";
const REPORT_WIDTH = 48;
const REPORT_TITLE = "Load Test Results";

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * pct) - 1;
  return sorted[Math.max(0, idx)];
}

export function computeReport(samples: Sample[], elapsedS: number): LoadReport {
  const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const totalErrors = samples.filter((s) => !s.ok).length;

  const statusDistribution: Record<number, number> = {};
  for (const s of samples) {
    statusDistribution[s.status] = (statusDistribution[s.status] ?? 0) + 1;
  }

  return {
    totalRequests: samples.length,
    totalErrors,
    elapsedS,
    throughput: elapsedS > 0 ? samples.length / elapsedS : 0,
    errorRate: samples.length > 0 ? totalErrors / samples.length : 0,
    latencyP50: percentile(durations, 0.5),
    latencyP95: percentile(durations, 0.95),
    latencyP99: percentile(durations, 0.99),
    latencyMax: durations.at(-1) ?? 0,
    statusDistribution,
  };
}

export function formatReport(report: LoadReport): string {
  const divider = REPORT_DIVIDER.repeat(REPORT_WIDTH);
  const errorColor = report.errorRate > 0 ? COLORS.red : COLORS.green;

  const lines = [
    `\n${COLORS.bold}${divider}${COLORS.reset}`,
    `${COLORS.bold}  ${REPORT_TITLE}${COLORS.reset}`,
    `${divider}`,
    `  Total requests:  ${report.totalRequests.toLocaleString()}`,
    `  Throughput:      ${report.throughput.toFixed(1)} req/s`,
    `  Error rate:      ${errorColor}${(report.errorRate * 100).toFixed(1)}%${COLORS.reset}`,
    ``,
    `  Latency (ms):`,
    `    p50    ${report.latencyP50}`,
    `    p95    ${report.latencyP95}`,
    `    p99    ${report.latencyP99}`,
    `    max    ${report.latencyMax}`,
    ``,
    `  Status codes:`,
    ...Object.entries(report.statusDistribution)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([code, count]) => `    ${code}    ${count.toLocaleString()}`),
    divider,
  ];

  return lines.join("\n");
}

export function formatProgress(
  activeUsers: number,
  requestCount: number,
  elapsedS: number,
): string {
  const rps = elapsedS > 0 ? (requestCount / elapsedS).toFixed(1) : "0.0";
  return `  [${elapsedS.toFixed(1)}s] ${activeUsers} users | ${requestCount.toLocaleString()} reqs | ${rps} req/s`;
}
