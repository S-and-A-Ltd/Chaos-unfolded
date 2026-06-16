import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["unpdf", "mammoth"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
