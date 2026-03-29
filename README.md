# lever-fetch

API testing from the command line. Define endpoints as TypeScript, commit them to your repo, run them against any environment.

```bash
npm install lever-fetch
```

```bash
npx lever-fetch init
npx lever-fetch list
npx lever-fetch run example/httpbin.healthCheck
```

## Why

API collections shouldn't live in a desktop app. They should be versioned, reviewed, and shared like the rest of your code. lever-fetch stores endpoints as typed TypeScript files in your repo. No accounts, no sync, no GUI.

## Project Structure

```
your-project/
├── endpoints/
│   └── my-api/
│       ├── vars.ts                # Shared test fixtures
│       ├── users.ts               # Endpoint definitions
│       ├── posts.ts
│       └── tests/
│           └── user-flow.ts       # Integration test suites
├── envs/
│   ├── local.ts                   # Base URL + token per environment
│   └── staging.ts
├── .env                           # Secrets (gitignored)
└── package.json
```

## Endpoints

Each named export is a runnable target.

```ts
// endpoints/my-api/users.ts
import type { Endpoint } from "lever-fetch";

export const list: Endpoint = {
  method: "GET",
  path: "/users",
  description: "List all users",
};

export const create: Endpoint = {
  method: "POST",
  path: "/users",
  body: { name: "Jane Doe", email: "jane@example.com" },
};
```

```bash
npx lever-fetch run my-api/users.list
npx lever-fetch run my-api/users      # all endpoints in file
npx lever-fetch run my-api            # all endpoints in collection
npx lever-fetch run                   # everything
```

### Dynamic Bodies

Return an object from a function when you need fresh values per request.

```ts
export const createPost: Endpoint = {
  method: "POST",
  path: "/posts",
  body: () => ({
    title: "New post",
    createdAt: new Date().toISOString(),
  }),
};
```

### Runtime Input

For values you can't hardcode — OTP codes, confirmation tokens, anything that changes every time.

```ts
export const verify: Endpoint = {
  method: "POST",
  path: "/auth/verify",
  body: { email: "jane@example.com" },
  input: { code: "Enter OTP code" },
};
```

lever-fetch pauses, asks for the value, and merges it into the body before sending.

```
$ lever-fetch run my-api/auth.verify --env local
  → Enter OTP code: 123456

[PASS] my-api/auth.verify 200 342ms
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
// endpoints/my-api/vars.ts
export default {
  orgId: "org_01H8MZXK",
  teamId: "team_9F3A2B",
} as Record<string, string>;
```

Reference them with `{varName}` in endpoint paths:

```ts
export const members: Endpoint = {
  method: "GET",
  path: "/orgs/{orgId}/teams/{teamId}/members",
};
```

Environment-level `vars` override collection defaults.

## Environments

```ts
// envs/local.ts
import type { Env } from "lever-fetch";

export default {
  baseUrl: "http://localhost:3000",
  token: process.env.API_LOCAL_TOKEN ?? "",
} satisfies Env;
```

```ts
// envs/staging.ts
import type { Env } from "lever-fetch";

export default {
  baseUrl: "https://api-staging.example.com",
  token: process.env.API_STAGING_TOKEN ?? "",
  vars: { orgId: "org_STAGING_01" },
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
// endpoints/my-api/tests/user-flow.ts
import type { TestSuite } from "lever-fetch/test";

export default {
  description: "Create a user, then verify they appear in the list",
  steps: [
    {
      name: "create user",
      endpoint: "my-api/users.create",
      assert: { status: 201 },
      extract: { userId: "body.id" },
    },
    {
      name: "list users",
      endpoint: "my-api/users.list",
      assert: { status: 200 },
    },
  ],
} satisfies TestSuite;
```

```bash
npx lever-fetch test my-api/user-flow --env local
```

```
[PASS] create user — 201 15ms
  userId = usr_8f3a2b...
[PASS] list users — 200 11ms

--- my-api/user-flow: 2 passed (26ms) ---
```

Extracted variables are injected into `{varName}` placeholders for subsequent steps. If a step fails, the rest are skipped.

| Field      | Required | Description                                              |
|------------|----------|----------------------------------------------------------|
| `name`     | yes      | Step label                                               |
| `endpoint` | yes      | Target (e.g., `my-api/users.list`)                      |
| `assert`   | no       | `{ status?, body? }` — expected values                   |
| `extract`  | no       | Variable name → dot-path (e.g., `body.id`)               |
| `input`    | no       | Body field → prompt message (overrides endpoint-level)   |

## Load Testing

Ramp up concurrent users to find breaking points.

```bash
npx lever-fetch load my-api/users.list --users 100 --duration 30s --ramp-up 10s
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
  my-api/users.list             Single endpoint
  my-api/users                  All endpoints in a file
  my-api                        Entire collection
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
