import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "mammoth"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
