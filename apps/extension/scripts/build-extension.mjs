import { build } from "esbuild";

await build({
  entryPoints: ["src/background.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "dist/background.js",
  sourcemap: true,
});

await build({
  entryPoints: ["src/content.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "dist/content.js",
  sourcemap: true,
});

await build({
  entryPoints: ["src/popup/popup.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "dist/popup/popup.js",
  sourcemap: true,
});
