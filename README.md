# lever-fetch

Type-safe CLI tool for API testing, load testing, and integration testing. Define endpoints as TypeScript objects, organize them into collections, and run them against multiple environments with JWT auth. Your API tests live in your repo.

## Features

- **Endpoint runner** — execute API calls with colored pass/fail output
- **Collections** — organize endpoints into groups with shared variables
- **Integration tests** — chain requests, extract response values, assert on status and body
- **Load testing** — ramp-up concurrency with p50/p95/p99 latency reporting
- **Type-safe** — full TypeScript types for endpoints, environments, and test suites
- **Environment switching** — swap base URLs and tokens per environment
- **Variable interpolation** — `{varName}` placeholders in paths resolved at runtime

## Install

```bash
npm install lever-fetch
```

## Quick Start

```bash
npx lever-fetch init
npx lever-fetch list
npx lever-fetch run my-service/auth.me --env local
```

## Project Structure

```
your-project/
├── endpoints/
│   ├── my-service/
│   │   ├── vars.ts              # Shared variables (committed)
│   │   ├── auth.ts              # Endpoint definitions
│   │   ├── files.ts
│   │   └── tests/
│   │       └── workspace-flow.ts  # Integration test suites
│   └── example/
│       └── httpbin.ts
├── envs/
│   ├── local.ts                 # Base URL + token
│   └── staging.ts
├── .env                         # Secrets (gitignored)
├── .env.example                 # Template (committed)
└── package.json
```

## Defining Endpoints

Export typed `Endpoint` objects from files inside a collection.

```ts
// endpoints/my-service/auth.ts
import type { Endpoint } from "lever-fetch";

export const me: Endpoint = {
  method: "GET",
  path: "/auth/me",
  description: "Get current authenticated user",
};

export const createFolder: Endpoint = {
  method: "POST",
  path: "/files/folders",
  body: { name: "Test Folder", parentId: null },
};
```

Each named export becomes a runnable target: `lever-fetch run my-service/auth.me`.

### Dynamic Bodies

Use a function to generate values at execution time:

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

### Endpoint Fields

| Field         | Required | Description                              |
|---------------|----------|------------------------------------------|
| `method`      | yes      | HTTP method (GET, POST, PUT, etc.)       |
| `path`        | yes      | URL path (supports `{var}` placeholders) |
| `body`        | no       | Request body — object or `() => object`  |
| `headers`     | no       | Additional headers for this endpoint     |
| `description` | no       | Shown in `list` output                   |

## Variables

Define shared variables in `vars.ts` inside your collection. These are committed and shared by all endpoints in the collection.

```ts
// endpoints/my-service/vars.ts
export default {
  accountId: "01KMTHSGX7Q4693AZJADFX4CJP",
  workspaceId: "faf788f0-27a9-46d1-9a68-5ad0802fb9d0",
} as Record<string, string>;
```

Use `{varName}` placeholders in endpoint paths:

```ts
export const fullText: Endpoint = {
  method: "GET",
  path: "/accounts/{accountId}/workspaces/{workspaceId}/search?q=hello",
};
```

Collection `vars.ts` provides defaults. Environment `vars` override per environment.

## Environments

```ts
// envs/local.ts
import type { Env } from "lever-fetch";

export default {
  baseUrl: "http://localhost:5001",
  token: process.env.ZK_LOCAL_TOKEN ?? "",
} satisfies Env;
```

```ts
// envs/staging.ts
import type { Env } from "lever-fetch";

export default {
  baseUrl: "https://api-staging.example.com",
  token: process.env.API_STAGING_TOKEN ?? "",
  vars: { accountId: "staging-account-id" },
} satisfies Env;
```

| Field     | Required | Description                                   |
|-----------|----------|-----------------------------------------------|
| `baseUrl` | yes      | Base URL prepended to all endpoint paths      |
| `token`   | yes      | JWT token for the Authorization header        |
| `headers` | no       | Default headers applied to all requests       |
| `vars`    | no       | Override collection variables per environment |

## Secrets

lever-fetch auto-loads `.env` from the working directory. Put secrets there and reference them via `process.env` in your env files.

```
# .env (gitignored)
ZK_LOCAL_TOKEN=eyJ...
API_STAGING_TOKEN=eyJ...
```

Run `lever-fetch init` to scaffold a `.env.example` template.

## Integration Tests

Define test suites as ordered sequences of endpoint calls with assertions and response chaining.

```ts
// endpoints/my-service/tests/workspace-flow.ts
import type { TestSuite } from "lever-fetch/test";

export default {
  description: "Create workspace, upload file, verify listing",
  steps: [
    {
      name: "create workspace",
      endpoint: "my-service/setup.createWorkspace",
      assert: { status: 201 },
      extract: { workspaceId: "body.id" },
    },
    {
      name: "get upload url",
      endpoint: "my-service/setup.uploadUrl",
      assert: { status: 200 },
      extract: { fileId: "body.fileId" },
    },
    {
      name: "list files",
      endpoint: "my-service/files.list",
      assert: {
        status: 200,
        body: { "length": 1 },
      },
    },
  ],
} satisfies TestSuite;
```

**How chaining works**: `extract` pulls values from responses into variables. Subsequent steps use `{workspaceId}` in endpoint paths automatically.

**Assertions**: Check status codes and response body fields using dot-notation paths (e.g., `"results[0].name"`).

**Stop on failure**: If a step fails, remaining steps are skipped.

```bash
npx lever-fetch test my-service/workspace-flow --env local
```

```
[PASS] create workspace — 201 15ms
  workspaceId = faf788f0-...
[PASS] get upload url — 200 20ms
  fileId = 95523b69-...
[PASS] list files — 200 11ms

--- my-service/workspace-flow: 3 passed (46ms) ---
```

### Test Step Fields

| Field      | Required | Description                                         |
|------------|----------|-----------------------------------------------------|
| `name`     | yes      | Step label shown in output                          |
| `endpoint` | yes      | Endpoint reference (e.g., `my-service/auth.me`)     |
| `assert`   | no       | `{ status?, body? }` — expected values              |
| `extract`  | no       | Map of variable name to dot-path (e.g., `body.id`)  |

## Load Testing

Ramp up concurrent users to find breaking points.

```bash
npx lever-fetch load my-service/auth.me --env local --users 100 --duration 30s --ramp-up 10s
```

```
────────────────────────────────────────────────
  Load Test Results
────────────────────────────────────────────────
  Total requests:  9,364
  Throughput:      1,865.7 req/s
  Error rate:      0.0%

  Latency (ms):
    p50    4
    p95    7
    p99    10
    max    724

  Status codes:
    200    9,364
────────────────────────────────────────────────
```

| Option              | Default | Max   | Description                   |
|---------------------|---------|-------|-------------------------------|
| `--users, -u`       | 10      | 1,000 | Max concurrent users          |
| `--duration, -d`    | 30s     | 300s  | Total test duration           |
| `--ramp-up, -r`     | 5s      | —     | Linear ramp-up period         |

## CLI Reference

```
lever-fetch init                Scaffold starter project
lever-fetch run <target>        Run endpoint(s)
lever-fetch test [target]       Run integration test suite(s)
lever-fetch load <target>       Ramp-up load test a single endpoint
lever-fetch list                List available endpoints

Run Targets:
  my-service/auth.me            Single endpoint in collection
  my-service/auth               All endpoints in collection file
  my-service                    All endpoints in collection
  (omit)                        All endpoints

Test Targets:
  my-service/workspace-flow     Single suite in collection
  my-service                    All suites in collection
  (omit)                        All suites

Options:
  --env, -e <name>              Environment (default: local)
  --token, -t <token>           Override auth token
  --help, -h                    Show help
```

## Types

```ts
import type { Endpoint, Env, HttpMethod } from "lever-fetch";
import type { TestSuite, TestStep } from "lever-fetch/test";
```

## License

MIT
