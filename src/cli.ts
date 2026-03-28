import path from "node:path";
import { parseArgs } from "node:util";
import { printSummary } from "./client.js";
import { loadEnv } from "./config.js";
import { scaffold } from "./init.js";
import { listEndpoints, runAll, runFile, runSingle } from "./runner.js";
import { DEFAULT_ENV, ENV_FILE_NAME } from "./types.js";

const USAGE = `
lever-fetch — CLI API testing tool

Usage:
  lever-fetch init              Scaffold endpoints/ and envs/ in current directory
  lever-fetch run <target>      Run endpoint(s)
  lever-fetch list              List available endpoints

Targets:
  auth.me                      Single endpoint
  auth                         All endpoints in file
  (omit)                       All endpoints

Options:
  --env, -e <name>             Environment (default: local)
  --token, -t <token>          Override auth token
  --help, -h                   Show this help
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

  if (command === "run") {
    const env = await loadEnv(values.env!);
    if (values.token) {
      env.token = values.token;
    }

    const target = positionals[1];

    if (!target) {
      const results = await runAll(env);
      printSummary(results);
    } else if (target.includes(".")) {
      await runSingle(env, target);
    } else {
      const results = await runFile(env, target);
      printSummary(results);
    }
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
