import type { NextConfig } from "next";

const basePath = "/music-theory-charts";

const nextConfig: NextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Dev only: bare localhost:3000 would 404 under the basePath.
  async redirects() {
    if (process.env.NODE_ENV !== "development") return [];
    return [{ source: "/", destination: basePath, basePath: false, permanent: false }];
  },
};

export default nextConfig;
