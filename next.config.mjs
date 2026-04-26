// ============================================================
// Retina — Next.js Configuration
// ============================================================
// Bootstraps secrets from Vault (or .env fallback) at startup
// and injects them into process.env for the app.
// ============================================================

import { createVaultClient } from "./src/utils/vault-client.js";

// ── Bootstrap secrets at build/dev time ────────────────────────
const vault = createVaultClient({
  fallbackEnvFile: "../vault/.env",
});

const secrets = await vault.fetch();

// Inject into process.env so secrets.js can read them
Object.assign(process.env, secrets);

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["retina.clankerbox.com"],
  turbopack: {},

  // Expose resolved values to both server and client bundles.
  // Only non-sensitive config values are exposed here —
  // production URLs are hardcoded in config.js anyway.
  env: {
    RETINA_PORT: secrets.RETINA_PORT || "3333",
    PRISM_URL: secrets.PRISM_URL || "http://localhost:7777",
    PRISM_WS_URL: secrets.PRISM_WS_URL || "ws://localhost:7777",
    TOOLS_API_URL: secrets.TOOLS_API_URL || "http://localhost:5590",
    MINIO_PUBLIC_URL: secrets.MINIO_PUBLIC_URL || "",
  },
};

export default nextConfig;
