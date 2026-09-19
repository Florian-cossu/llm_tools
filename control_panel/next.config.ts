import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@llm-tools/data"],
  // Lets the dev server (HMR/RSC assets) be reached from a phone on the LAN
  // via the machine's local IP, not just localhost. Update if your LAN IP
  // changes. Not needed in production builds.
  allowedDevOrigins: ["192.168.1.31"],
};

export default nextConfig;
