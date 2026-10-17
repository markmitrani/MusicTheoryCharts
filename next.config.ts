import type { NextConfig } from "next";

const basePath = "/music-theory-charts";

const nextConfig: NextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
