import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the API route to run longer for agentic tool-use loops
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
