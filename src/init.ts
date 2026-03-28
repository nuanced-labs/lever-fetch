import fs from "node:fs";
import path from "node:path";
import { ENDPOINTS_DIR_NAME, ENVS_DIR_NAME } from "./types.js";

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

function writeIfMissing(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    console.log(`  skip  ${path.relative(process.cwd(), filePath)} (exists)`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`  create  ${path.relative(process.cwd(), filePath)}`);
}

export function scaffold(): void {
  const cwd = process.cwd();
  console.log("Scaffolding lever-fetch project...\n");
  writeIfMissing(path.join(cwd, ENDPOINTS_DIR_NAME, "example.ts"), ENDPOINT_TEMPLATE);
  writeIfMissing(path.join(cwd, ENVS_DIR_NAME, "local.ts"), ENV_TEMPLATE);
  console.log("\nDone. Define your endpoints and run: lever-fetch run example.healthCheck");
}
