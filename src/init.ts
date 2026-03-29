import fs from "node:fs";
import path from "node:path";
import {
  ENDPOINTS_DIR_NAME,
  ENVS_DIR_NAME,
  ENV_EXAMPLE_FILE_NAME,
  ENV_FILE_NAME,
  GITIGNORE_FILE_NAME,
} from "./types.js";

const ENDPOINT_TEMPLATE = `import type { Endpoint } from "lever-fetch";

export const healthCheck: Endpoint = {
  method: "GET",
  path: "/health",
  description: "Service health check",
};

export const me: Endpoint = {
  method: "GET",
  path: "/auth/me",
  description: "Get current authenticated user",
};
`;

const ENV_TEMPLATE = `import type { Env } from "lever-fetch";

export default {
  baseUrl: "http://localhost:5000",
  token: process.env.API_LOCAL_TOKEN ?? "",
} satisfies Env;
`;

const ENV_EXAMPLE_TEMPLATE = `# lever-fetch — secrets loaded automatically from .env
# Copy this file to .env and fill in real values
# API_LOCAL_TOKEN=eyJ...
`;

function writeIfMissing(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    console.log(`  skip  ${path.relative(process.cwd(), filePath)} (exists)`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`  create  ${path.relative(process.cwd(), filePath)}`);
}

function ensureGitignore(cwd: string): void {
  const gitignorePath = path.join(cwd, GITIGNORE_FILE_NAME);
  const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf-8") : "";

  if (!existing.split("\n").some((line) => line.trim() === ENV_FILE_NAME)) {
    fs.appendFileSync(gitignorePath, `\n${ENV_FILE_NAME}\n`);
    console.log(`  update  ${GITIGNORE_FILE_NAME} (added ${ENV_FILE_NAME})`);
  }
}

export function scaffold(): void {
  const cwd = process.cwd();
  console.log("Scaffolding lever-fetch project...\n");
  writeIfMissing(path.join(cwd, ENDPOINTS_DIR_NAME, "example", "httpbin.ts"), ENDPOINT_TEMPLATE);
  writeIfMissing(path.join(cwd, ENVS_DIR_NAME, "local.ts"), ENV_TEMPLATE);
  writeIfMissing(path.join(cwd, ENV_EXAMPLE_FILE_NAME), ENV_EXAMPLE_TEMPLATE);
  ensureGitignore(cwd);
  console.log("\nDone. Define your endpoints and run: lever-fetch run example/httpbin.healthCheck");
}
