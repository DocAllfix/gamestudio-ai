import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@supabase/supabase-js", "e2b", "@aws-sdk/client-s3"],

  // lib/** imports sibling modules with an ESM ".js" suffix on .ts sources
  // (Node/tsx convention, see CLAUDE.md). Next must map a literal "./foo.js"
  // back to "./foo.ts". webpack does this with resolve.extensionAlias; Turbopack
  // with resolveAlias on the extensions.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },

  // NOTE: build/dev use --webpack (see package.json). Turbopack does not support
  // resolve.extensionAlias the same way, and lib/** relies on the .js→.ts
  // extension alias to import the real reasoning/runtime graph from the app.
};

export default nextConfig;
