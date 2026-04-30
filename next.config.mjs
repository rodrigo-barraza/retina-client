// ============================================================
// Retina — Next.js Configuration
// ============================================================
// Bootstraps secrets from Vault (or .env fallback) at startup
// and injects them into process.env for the app.
// ============================================================

import { createVaultClient } from "@rodrigo-barraza/utilities/node";

// ── Bootstrap secrets at build/dev time ────────────────────────
const vault = createVaultClient({
  localEnvFile: "./.env",
  fallbackEnvFile: "../vault-service/.env",
});

const secrets = await vault.fetch();

// Inject into process.env so secrets.js can read them
Object.assign(process.env, secrets);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["retina.rod.dev"],
  turbopack: {},
  transpilePackages: ["@rodrigo-barraza/components", "@rodrigo-barraza/utilities"],

  // Expose resolved values to both server and client bundles.
  // Only non-sensitive config values are exposed here.
  // config.js re-exports these directly — no hardcoded overrides.
  env: {
    RETINA_CLIENT_PORT: secrets.RETINA_CLIENT_PORT || "3333",
    PRISM_SERVICE_URL: secrets.PRISM_SERVICE_URL || "http://localhost:7777",
    PRISM_WS_URL: secrets.PRISM_WS_URL || "ws://localhost:7777",
    TOOLS_SERVICE_URL: secrets.TOOLS_SERVICE_URL || "http://localhost:5590",
    MINIO_PUBLIC_URL: secrets.MINIO_PUBLIC_URL || "",
  },
};

export default nextConfig;
