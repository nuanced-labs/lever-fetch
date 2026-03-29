# lever-fetch

API testing from the command line. Define endpoints as TypeScript, commit them to your repo, run them against any environment.

```bash
npm install lever-fetch
```

```bash
npx lever-fetch init
npx lever-fetch run my-service/auth.me --env local
```

## Why

API collections shouldn't live in a desktop app. They should be versioned, reviewed, and shared like the rest of your code. lever-fetch stores endpoints as typed TypeScript files in your repo. No accounts, no sync, no GUI.

## Project Structure

```
your-project/
├── endpoints/
│   └── my-service/
│       ├── vars.ts                # Shared test fixtures
│       ├── auth.ts                # Endpoint definitions
│       ├── files.ts
│       └── tests/
│           └── workspace-flow.ts  # Integration test suites
├── envs/
│   ├── local.ts                   # Base URL + token per environment
│   └── staging.ts
├── .env                           # Secrets (gitignored)
└── package.json
```

## Endpoints

Each named export is a runnable target.

```ts
// endpoints/my-service/auth.ts
import type { Endpoint } from "lever-fetch";

export const me: Endpoint = {
  method: "GET",
  path: "/auth/me",
  description: "Current authenticated user",
};

export const createFolder: Endpoint = {
  method: "POST",
  path: "/files/folders",
  body: { name: "Test Folder", parentId: null },
};
```

```bash
npx lever-fetch run my-service/auth.me
npx lever-fetch run my-service/auth       # all endpoints in file
npx lever-fetch run my-service            # all endpoints in collection
npx lever-fetch run                       # everything
```

### Dynamic Bodies

Return an object from a function when you need fresh values per request.

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

### Runtime Input

For values you can't hardcode — OTP codes, confirmation tokens, anything that changes every time.

```ts
export const verifyOtp: Endpoint = {
  method: "POST",
  path: "/auth/verify",
  body: { phone: "+1234567890" },
  input: { code: "Enter OTP code" },
};
```

lever-fetch pauses, asks for the value, and merges it into the body before sending.

```
$ lever-fetch run my-service/auth.verifyOtp --env local
  → Enter OTP code: 123456

[PASS] my-service/auth.verifyOtp 200 342ms
```

Requires an interactive terminal. In CI, use env vars with a dynamic body instead.

### Endpoint Fields

| Field         | Required | Description                              |
|---------------|----------|------------------------------------------|
| `method`      | yes      | HTTP method                              |
| `path`        | yes      | URL path, supports `{var}` placeholders  |
| `body`        | no       | Object or `() => object`                 |
| `headers`     | no       | Additional headers                       |
| `description` | no       | Shown in `lever-fetch list`              |
| `input`       | no       | Body field name → prompt message         |

## Variables

Shared test fixtures go in `vars.ts` inside the collection. These get committed.

```ts
// endpoints/my-service/vars.ts
export default {
  accountId: "01KMTHSGX7Q4693AZJADFX4CJP",
  workspaceId: "faf788f0-27a9-46d1-9a68-5ad0802fb9d0",
} as Record<string, string>;
```

Reference them with `{varName}` in endpoint paths:

```ts
export const search: Endpoint = {
  method: "GET",
  path: "/accounts/{accountId}/workspaces/{workspaceId}/search?q=hello",
};
```

Environment-level `vars` override collection defaults.

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

| Field     | Required | Description                          |
|-----------|----------|--------------------------------------|
| `baseUrl` | yes      | Prepended to all endpoint paths      |
| `token`   | yes      | Sent as `Authorization: Bearer`      |
| `headers` | no       | Default headers for all requests     |
| `vars`    | no       | Override collection variables        |

Secrets go in `.env` (gitignored) and are auto-loaded at startup. Run `lever-fetch init` to scaffold a `.env.example` template.

## Integration Tests

Chain requests together. Extract values from one response and use them in the next.

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
      assert: { status: 200, body: { "length": 1 } },
    },
  ],
} satisfies TestSuite;
```

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

Extracted variables are injected into `{varName}` placeholders for subsequent steps. If a step fails, the rest are skipped.

| Field      | Required | Description                                              |
|------------|----------|----------------------------------------------------------|
| `name`     | yes      | Step label                                               |
| `endpoint` | yes      | Target (e.g., `my-service/auth.me`)                      |
| `assert`   | no       | `{ status?, body? }` — expected values                   |
| `extract`  | no       | Variable name → dot-path (e.g., `body.id`)               |
| `input`    | no       | Body field → prompt message (overrides endpoint-level)   |

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

| Option           | Default | Max   | Description              |
|------------------|---------|-------|--------------------------|
| `--users, -u`    | 10      | 1,000 | Peak concurrent users    |
| `--duration, -d` | 30s     | 300s  | Total test duration      |
| `--ramp-up, -r`  | 5s      | —     | Linear ramp-up period    |

## CLI Reference

```
lever-fetch init                Scaffold a starter project
lever-fetch run <target>        Run endpoint(s)
lever-fetch test [target]       Run integration test suite(s)
lever-fetch load <target>       Load test a single endpoint
lever-fetch list                List all endpoints

Targets:
  my-service/auth.me            Single endpoint
  my-service/auth               All endpoints in a file
  my-service                    Entire collection
  (omit)                        Everything

Options:
  --env, -e <name>              Environment (default: local)
  --token, -t <token>           Override auth token
  --help, -h                    Show help
```

## Types

```ts
import type { Endpoint, Env, InputFields } from "lever-fetch";
import type { TestSuite, TestStep } from "lever-fetch/test";
```

## License

MIT
