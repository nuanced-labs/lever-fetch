export const DEFAULT_USERS = 10;
export const MAX_USERS = 1000;
export const DEFAULT_DURATION_S = 30;
export const MAX_DURATION_S = 300;
export const DEFAULT_RAMP_UP_S = 5;
export const MAX_SAMPLES = 500_000;
export const TICK_INTERVAL_MS = 200;
export const PROGRESS_INTERVAL_MS = 1000;

export interface LoadOptions {
  users: number;
  durationS: number;
  rampUpS: number;
}

/** Lightweight sample — omits response body to save memory at scale */
export interface Sample {
  status: number;
  ok: boolean;
  durationMs: number;
  timestampMs: number;
}

export interface LoadReport {
  totalRequests: number;
  totalErrors: number;
  elapsedS: number;
  throughput: number;
  errorRate: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  latencyMax: number;
  statusDistribution: Record<number, number>;
}
