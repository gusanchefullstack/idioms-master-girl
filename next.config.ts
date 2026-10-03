import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite is a Node builtin; listed here in case the bundler tries to resolve it (research R6).
  serverExternalPackages: [],
  poweredByHeader: false,
};

export default nextConfig;
