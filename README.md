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
npx lever-fetch run example/httpbin.healthCheck --env local

# Run all endpoints in a collection file
npx lever-fetch run example/httpbin --env local

# Run an entire collection
npx lever-fetch run example --env local

# Run everything
npx lever-fetch run --env local
```

## How It Works

lever-fetch reads endpoint definitions and environment configs from your project's working directory. You define them as typed TypeScript files, commit them to your repo, and run them with the CLI.

Endpoints are organized into **collections** — subdirectories inside `endpoints/` that group related files. Flat files alongside collections are also supported.

```
your-project/
├── endpoints/
│   ├── my-service/     # Collection
│   │   ├── vars.ts     # Collection variables (committed, shared)
│   │   ├── auth.ts
│   │   ├── files.ts
│   │   └── search.ts
│   └── example/
│       └── httpbin.ts
├── envs/               # Connection config (base URL + token)
│   ├── local.ts
│   ├── staging.ts
│   └── prod.ts
├── .env                # Secrets (gitignored, auto-loaded)
├── .env.example        # Checked-in template
└── package.json
```

## Defining Endpoints

Create files inside a collection directory in `endpoints/` that export typed `Endpoint` objects.

```ts
// endpoints/my-service/auth.ts
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
// endpoints/my-service/files.ts
import type { Endpoint } from "lever-fetch";

export const createFolder: Endpoint = {
  method: "POST",
  path: "/files/folders",
  body: { name: "Test Folder", parentId: null },
};
```

Each named export becomes a runnable target: `lever-fetch run my-service/files.createFolder`.

### Dynamic Bodies

Use a function to generate request bodies at execution time (e.g., timestamps, UUIDs):

```ts
export const indexDocument: Endpoint = {
  method: "PUT",
  path: "/documents",
  body: () => ({
    title: "test-doc",
    indexedAt: new Date().toISOString(),
  }),
};
```

Static objects still work for bodies that don't need dynamic values.

### Variables

Define shared variables in a `vars.ts` file inside your collection. These are committed to your repo and shared by all endpoints in the collection — like Postman collection variables.

```ts
// endpoints/my-service/vars.ts
export default {
  accountId: "01KMTHSGX7Q4693AZJADFX4CJP",
  workspaceId: "faf788f0-27a9-46d1-9a68-5ad0802fb9d0",
} as Record<string, string>;
```

Use `{varName}` placeholders in endpoint paths:

```ts
// endpoints/my-service/search.ts
import type { Endpoint } from "lever-fetch";

export const fullText: Endpoint = {
  method: "GET",
  path: "/accounts/{accountId}/workspaces/{workspaceId}/search?q=hello",
  description: "Full-text content search",
};
```

Variables are resolved at runtime: collection `vars.ts` provides defaults, env `vars` can override per environment. Endpoints stay fully declarative.

### Endpoint Fields

| Field         | Required | Description                          |
|---------------|----------|--------------------------------------|
| `method`      | yes      | HTTP method (GET, POST, PUT, etc.)   |
| `path`        | yes      | URL path (supports `{var}` placeholders) |
| `body`        | no       | Request body — object or `() => object` |
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
} satisfies Env;
```

```ts
// envs/staging.ts — override vars for staging
import type { Env } from "lever-fetch";

export default {
  baseUrl: "https://api-staging.example.com",
  token: process.env.API_STAGING_TOKEN ?? "",
  vars: {
    accountId: "staging-account-id",
  },
} satisfies Env;
```

Use with `--env staging`. The token can come from a `.env` file or be overridden inline with `--token`. Env `vars` override collection `vars.ts` defaults.

### Env Fields

| Field     | Required | Description                                    |
|-----------|----------|------------------------------------------------|
| `baseUrl` | yes      | Base URL prepended to all endpoint paths       |
| `token`   | yes      | JWT token for the Authorization header         |
| `headers` | no       | Default headers applied to all requests        |
| `vars`    | no       | Override collection variables per environment  |

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
  my-service/auth.me            Single endpoint in collection
  my-service/auth               All endpoints in collection file
  my-service                    All endpoints in collection
  auth.me                       Single endpoint (flat file)
  auth                          All endpoints in file (flat)
  (omit)                        All endpoints everywhere

Options:
  --env, -e <name>              Environment to use (default: local)
  --token, -t <token>           Override the auth token
  --help, -h                    Show help
```

## Output

Each request prints a colored result line:

```
[PASS] my-service/auth.me  200 45ms
{ "id": "user_123", "email": "..." }

[FAIL] my-service/files.create  401 12ms
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
