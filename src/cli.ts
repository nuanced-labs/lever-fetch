import path from "node:path";
import { parseArgs } from "node:util";
import { printSummary } from "./client.js";
import { loadEnv } from "./config.js";
import { scaffold } from "./init.js";
import { runLoadTest } from "./load.js";
import { formatReport } from "./load-stats.js";
import { DEFAULT_USERS, MAX_USERS, DEFAULT_DURATION_S, MAX_DURATION_S, DEFAULT_RAMP_UP_S } from "./load-types.js";
import { resolveTarget } from "./resolver.js";
import { listEndpoints, resolveEndpoint, runAll, runCollection, runFile, runSingle } from "./runner.js";
import { discoverTestSuites, loadTestSuite, runTestSuite } from "./test-runner.js";
import { printSuiteResult } from "./test-reporter.js";
import { COLLECTION_SEPARATOR, DEFAULT_ENV, ENV_FILE_NAME, parseDuration } from "./types.js";
import type { Env } from "./types.js";

const USAGE = `
lever-fetch — CLI API testing tool

Usage:
  lever-fetch init              Scaffold endpoints/ and envs/ in current directory
  lever-fetch run <target>      Run endpoint(s)
  lever-fetch load <target>     Ramp-up load test a single endpoint
  lever-fetch test [target]     Run integration test suite(s)
  lever-fetch list              List available endpoints

Targets:
  my-api/users.list             Single endpoint in collection
  my-api/users                  All endpoints in collection file
  my-api                        All endpoints in collection
  users.list                    Single endpoint (flat)
  users                         All endpoints in file (flat)
  (omit)                        All endpoints

Options:
  --env, -e <name>              Environment (default: local)
  --token, -t <token>           Override auth token
  --help, -h                    Show this help

Load Options:
  --users, -u <n>               Max concurrent users (default: ${DEFAULT_USERS}, max: ${MAX_USERS})
  --duration, -d <time>         Total duration e.g. 30s, 2m (default: ${DEFAULT_DURATION_S}s, max: ${MAX_DURATION_S}s)
  --ramp-up, -r <time>          Ramp-up period e.g. 10s (default: ${DEFAULT_RAMP_UP_S}s)
`;

function printUsage(): void {
  console.log(USAGE.trim());
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), ENV_FILE_NAME));
  } catch {
    // No .env file — secrets come from the shell environment
  }

  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      env: { type: "string", short: "e", default: DEFAULT_ENV },
      token: { type: "string", short: "t" },
      help: { type: "boolean", short: "h", default: false },
      users: { type: "string", short: "u" },
      duration: { type: "string", short: "d" },
      "ramp-up": { type: "string", short: "r" },
    },
  });

  if (values.help || positionals.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = positionals[0];

  if (command === "init") {
    scaffold();
    return;
  }

  if (command === "list") {
    await listEndpoints();
    return;
  }

  async function prepareEnv(): Promise<Env> {
    const env = await loadEnv(values.env!);
    if (values.token) {
      env.token = values.token;
    }
    return env;
  }

  if (command === "run") {
    const env = await prepareEnv();
    const parsed = resolveTarget(positionals[1]);

    switch (parsed.kind) {
      case "all": {
        const results = await runAll(env);
        printSummary(results);
        break;
      }
      case "collection": {
        const results = await runCollection(env, parsed.collection);
        printSummary(results);
        break;
      }
      case "file":
      case "collectionFile": {
        const results = await runFile(env, parsed.ref);
        printSummary(results);
        break;
      }
      case "endpoint":
      case "collectionEndpoint": {
        await runSingle(env, parsed.ref, parsed.endpoint);
        break;
      }
    }
    return;
  }

  if (command === "load") {
    const target = positionals[1];
    if (!target) {
      throw new Error("load requires a single endpoint target (e.g., my-api/users.list)");
    }

    const parsed = resolveTarget(target);
    if (parsed.kind !== "endpoint" && parsed.kind !== "collectionEndpoint") {
      throw new Error("load only supports single endpoint targets (e.g., my-api/users.list)");
    }

    const env = await prepareEnv();
    const resolved = await resolveEndpoint(env, parsed.ref, parsed.endpoint);

    const users = values.users ? parseInt(values.users, 10) : DEFAULT_USERS;
    if (!Number.isInteger(users) || users < 1 || users > MAX_USERS) {
      throw new Error(`Invalid --users "${values.users}". Must be an integer between 1 and ${MAX_USERS}`);
    }

    const durationS = values.duration ? parseDuration(values.duration) : DEFAULT_DURATION_S;
    if (durationS > MAX_DURATION_S) {
      throw new Error(`Invalid --duration. Maximum is ${MAX_DURATION_S}s (5 minutes)`);
    }

    const rampUpS = values["ramp-up"] ? parseDuration(values["ramp-up"]) : DEFAULT_RAMP_UP_S;
    if (rampUpS > durationS) {
      throw new Error(`Invalid --ramp-up. Cannot exceed --duration (${durationS}s)`);
    }

    const options = { users, durationS, rampUpS };

    const report = await runLoadTest(resolved.env, resolved.name, resolved.endpoint, options);
    console.log(formatReport(report));
    return;
  }

  if (command === "test") {
    const env = await prepareEnv();
    const target = positionals[1];
    const collection = target?.includes(COLLECTION_SEPARATOR) ? target.split(COLLECTION_SEPARATOR)[0] : target;
    const suiteName = target?.includes(COLLECTION_SEPARATOR) ? target.split(COLLECTION_SEPARATOR)[1] : undefined;

    const suites = discoverTestSuites(collection);
    const filtered = suiteName ? suites.filter((s) => s.ref === target) : suites;

    if (filtered.length === 0) {
      throw new Error(`No test suites found${target ? ` for "${target}"` : ""}`);
    }

    let allPassed = true;
    for (const file of filtered) {
      const suite = await loadTestSuite(file);
      const result = await runTestSuite(env, file.ref, suite);
      printSuiteResult(result);
      if (!result.passed) allPassed = false;
    }

    if (!allPassed) process.exit(1);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
