# lever-fetch

CLI API testing tool. Define endpoints as typed TypeScript objects, run them against multiple environments with JWT auth. Like Postman, but on the command line — and your tests live in your repo.

## Install

```bash
npm install lever-fetch
```

## Quick Start

```bash
# Scaffold endpoints/ and envs/ in your project
npx lever-fetch init

# List all available endpoints
npx lever-fetch list

# Run a single endpoint
npx lever-fetch run example.healthCheck --env local

# Run all endpoints in a file
npx lever-fetch run example --env local

# Run everything
npx lever-fetch run --env local
```

## How It Works

lever-fetch reads endpoint definitions and environment configs from your project's working directory. You define them as typed TypeScript files, commit them to your repo, and run them with the CLI.

```
your-project/
├── endpoints/          # Your API endpoint definitions
│   ├── auth.ts
│   ├── files.ts
│   └── chat.ts
├── envs/               # Environment configs (local, staging, prod)
│   ├── local.ts
│   ├── staging.ts
│   └── prod.ts
├── .env                # Secrets (gitignored, auto-loaded)
├── .env.example        # Checked-in template
└── package.json
```

## Defining Endpoints

Create files in `endpoints/` that export typed `Endpoint` objects.

```ts
// endpoints/auth.ts
import type { Endpoint } from "lever-fetch";

export const me: Endpoint = {
  method: "GET",
  path: "/auth/me",
  description: "Get current authenticated user",
};

export const adminUsers: Endpoint = {
  method: "GET",
  path: "/admin/users",
  description: "List admin users",
};
```

Endpoints with request bodies:

```ts
// endpoints/files.ts
import type { Endpoint } from "lever-fetch";

export const createFolder: Endpoint = {
  method: "POST",
  path: "/files/folders",
  body: { name: "Test Folder", parentId: null },
};
```

Each named export becomes a runnable target: `lever-fetch run files.createFolder`.

### Path Variables

Use `{varName}` placeholders in endpoint paths. Values are resolved from `env.vars` at runtime.

```ts
// endpoints/search.ts
import type { Endpoint } from "lever-fetch";

export const fullText: Endpoint = {
  method: "GET",
  path: "/accounts/{accountId}/workspaces/{workspaceId}/search?q=hello",
  description: "Full-text content search",
};

export const downloadUrl: Endpoint = {
  method: "GET",
  path: "/accounts/{accountId}/workspaces/{workspaceId}/files/{fileId}/download-url",
  description: "Get signed download URL",
};
```

Endpoints stay fully declarative — no imports, no `process.env`, no runtime code.

### Endpoint Fields

| Field         | Required | Description                          |
|---------------|----------|--------------------------------------|
| `method`      | yes      | HTTP method (GET, POST, PUT, etc.)   |
| `path`        | yes      | URL path (supports `{var}` placeholders) |
| `body`        | no       | Request body (serialized as JSON)    |
| `headers`     | no       | Additional headers for this endpoint |
| `description` | no       | Shown in `list` output               |

## Defining Environments

Create files in `envs/` that default-export an `Env` object.

```ts
// envs/local.ts
import type { Env } from "lever-fetch";

export default {
  baseUrl: "http://localhost:5001",
  token: process.env.ZK_LOCAL_TOKEN ?? "",
  vars: {
    accountId: "01KMTHSGX7Q4693AZJADFX4CJP",
    workspaceId: "faf788f0-27a9-46d1-9a68-5ad0802fb9d0",
    fileId: "95523b69-1544-478a-a8ca-7cf008c860b1",
  },
} satisfies Env;
```

```ts
// envs/staging.ts
import type { Env } from "lever-fetch";

export default {
  baseUrl: "https://api-staging.example.com",
  token: process.env.API_STAGING_TOKEN ?? "",
} satisfies Env;
```

Use with `--env staging`. The token can come from a `.env` file or be overridden inline with `--token`.

### Env Fields

| Field     | Required | Description                                    |
|-----------|----------|------------------------------------------------|
| `baseUrl` | yes      | Base URL prepended to all endpoint paths       |
| `token`   | yes      | JWT token for the Authorization header         |
| `headers` | no       | Default headers applied to all requests        |
| `vars`    | no       | Variables for `{placeholder}` path interpolation |

## Secrets and .env

lever-fetch automatically loads a `.env` file from the working directory at startup. Put secrets there and reference them via `process.env` in your env files.

```
# .env (gitignored)
ZK_LOCAL_TOKEN=eyJ...
API_STAGING_TOKEN=eyJ...
```

Run `lever-fetch init` to scaffold a `.env.example` template.

## CLI Reference

```
lever-fetch init                Scaffold starter endpoints/ and envs/
lever-fetch run <target>        Run endpoint(s)
lever-fetch list                List available endpoints

Targets:
  auth.me                       Single endpoint (file.export)
  auth                          All endpoints in a file
  (omit)                        All endpoints across all files

Options:
  --env, -e <name>              Environment to use (default: local)
  --token, -t <token>           Override the auth token
  --help, -h                    Show help
```

## Output

Each request prints a colored result line:

```
[PASS] auth.me  200 45ms
{ "id": "user_123", "email": "..." }

[FAIL] files.create  401 12ms
{ "error": "Unauthorized" }
```

When running multiple endpoints, a summary is printed:

```
--- 5 run, 4 passed, 1 failed ---
```

## Types

lever-fetch exports its types for use in your endpoint and env definitions:

```ts
import type { Endpoint, Env, HttpMethod } from "lever-fetch";
```
