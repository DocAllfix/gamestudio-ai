import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@supabase/supabase-js"],
  // lib/** uses ESM .js import suffixes for Node/tsx compatibility.
  // Turbopack resolves .js → .ts via resolveExtensions.
  turbopack: {
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
};

export default nextConfig;
