import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    clean: true,
    outDir: "dist",
  },
  {
    entry: { types: "src/public-types.ts", "test-types": "src/public-test-types.ts" },
    format: ["esm"],
    dts: { only: true },
    outDir: "dist",
  },
]);
