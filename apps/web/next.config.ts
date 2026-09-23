import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@patched/shared"],
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
