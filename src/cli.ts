import path from "node:path";
import { parseArgs } from "node:util";
import { printSummary } from "./client.js";
import { loadEnv } from "./config.js";
import { scaffold } from "./init.js";
import { resolveTarget } from "./resolver.js";
import { listEndpoints, runAll, runCollection, runFile, runSingle } from "./runner.js";
import { DEFAULT_ENV, ENV_FILE_NAME } from "./types.js";

const USAGE = `
lever-fetch — CLI API testing tool

Usage:
  lever-fetch init              Scaffold endpoints/ and envs/ in current directory
  lever-fetch run <target>      Run endpoint(s)
  lever-fetch list              List available endpoints

Targets:
  zookeeper/auth.me             Single endpoint in collection
  zookeeper/auth                All endpoints in collection file
  zookeeper                     All endpoints in collection
  auth.me                       Single endpoint (flat)
  auth                          All endpoints in file (flat)
  (omit)                        All endpoints

Options:
  --env, -e <name>              Environment (default: local)
  --token, -t <token>           Override auth token
  --help, -h                    Show this help
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

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
