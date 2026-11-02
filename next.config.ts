import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => ({
  output: "standalone",
  ...(phase === PHASE_DEVELOPMENT_SERVER ? { allowedDevOrigins: ["127.0.0.1"] } : {}),
  // Next inlines this non-secret phase value into the server bundle. Runtime
  // NODE_ENV or environment variables cannot turn a production build on.
  env: {
    YGH_LOCAL_DEV_BUILD_ALLOWED: phase === PHASE_DEVELOPMENT_SERVER ? "true" : "false",
  },
});

export default nextConfig;
