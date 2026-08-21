import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  experimental: {
    // proxy.ts (added for anonymous session scoping) makes Next.js buffer
    // request bodies before they reach the route handler, capped at 10MB by
    // default — below /api/analyze's existing 15MB PDF limit, which would
    // otherwise get silently truncated before the app's own size check ever
    // runs. Sized above 15MB for multipart form-data's boundary/header
    // overhead on top of the raw file bytes.
    proxyClientMaxBodySize: "16mb",
  },
};

export default nextConfig;
