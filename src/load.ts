import { executeEndpoint } from "./client.js";
import { CLEAR_LINE } from "./types.js";
import type { Endpoint, Env } from "./types.js";
import type { LoadOptions, LoadReport, Sample } from "./load-types.js";
import { TICK_INTERVAL_MS, PROGRESS_INTERVAL_MS, MAX_SAMPLES } from "./load-types.js";
import { computeReport, formatProgress } from "./load-stats.js";

function computeTargetUsers(elapsedMs: number, rampUpMs: number, maxUsers: number): number {
  if (rampUpMs <= 0) return maxUsers;
  const ratio = Math.min(1, elapsedMs / rampUpMs);
  return Math.max(1, Math.ceil(maxUsers * ratio));
}

async function worker(
  env: Env,
  name: string,
  endpoint: Endpoint,
  samples: Sample[],
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted && samples.length < MAX_SAMPLES) {
    const start = performance.now();
    try {
      const result = await executeEndpoint(env, name, endpoint);
      if (signal.aborted) break;
      samples.push({
        status: result.status,
        ok: result.ok,
        durationMs: result.durationMs,
        timestampMs: performance.now(),
      });
    } catch {
      if (!signal.aborted) {
        samples.push({
          status: 0,
          ok: false,
          durationMs: Math.round(performance.now() - start),
          timestampMs: performance.now(),
        });
      }
    }
  }
}

export async function runLoadTest(
  env: Env,
  name: string,
  endpoint: Endpoint,
  options: LoadOptions,
): Promise<LoadReport> {
  const samples: Sample[] = [];
  const controller = new AbortController();
  const workerPromises: Promise<void>[] = [];
  const startTime = performance.now();
  const durationMs = options.durationS * 1000;
  const rampUpMs = options.rampUpS * 1000;
  let activeUsers = 0;

  const spawnWorkers = (target: number): void => {
    while (activeUsers < target) {
      workerPromises.push(worker(env, name, endpoint, samples, controller.signal));
      activeUsers++;
    }
  };

  const tickInterval = setInterval(() => {
    const elapsedMs = performance.now() - startTime;
    if (elapsedMs >= durationMs) return;
    const target = computeTargetUsers(elapsedMs, rampUpMs, options.users);
    spawnWorkers(target);
  }, TICK_INTERVAL_MS);

  const progressInterval = setInterval(() => {
    const elapsedS = (performance.now() - startTime) / 1000;
    const line = formatProgress(activeUsers, samples.length, elapsedS);
    process.stderr.write(`\r${line}`);
  }, PROGRESS_INTERVAL_MS);

  // Spawn initial worker immediately
  spawnWorkers(1);

  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));

  controller.abort();
  clearInterval(tickInterval);
  clearInterval(progressInterval);

  await Promise.allSettled(workerPromises);

  // Clear progress line
  process.stderr.write(CLEAR_LINE);

  const elapsedS = (performance.now() - startTime) / 1000;
  return computeReport(samples, elapsedS);
}
