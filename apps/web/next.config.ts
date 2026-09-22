import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Browser requests stay on the web origin, so sessions are not tied to the
  // external API host. The NestJS API stays reachable privately by Next SSR.
  async rewrites() {
    const origin = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  },
};

export default nextConfig;
