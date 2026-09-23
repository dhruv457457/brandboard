import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Secrets live in the repo-root .env.local (shared with contracts and scripts). Next only reads env
// files from apps/web, so load the root file here. Real environment variables (e.g. on Vercel) win.
const rootEnv = join(__dirname, "..", "..", ".env.local");
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["@patched/shared", "@patched/indexer", "@patched/ai"],
  serverExternalPackages: ["postgres"],
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Inline the public values into the browser bundle.
  env: Object.fromEntries(
    Object.entries(process.env).filter(([k, v]) => k.startsWith("NEXT_PUBLIC_") && v !== undefined),
  ) as Record<string, string>,
};

export default nextConfig;
