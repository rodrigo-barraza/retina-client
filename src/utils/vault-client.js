// ============================================================
// Vault Client — Secret Bootstrap Utility
// ============================================================
// Fetches secrets from the Vault service at startup and
// exports them as named constants for ESM import.
//
// Falls back to reading the master .env file directly if
// Vault is unreachable (manual mode).
//
// Usage (in any service's secrets.js):
//
//   import { createVaultClient } from "./src/utils/vault-client.js";
//
//   const vault = createVaultClient({ fallbackEnvFile: "../vault/.env" });
//   const secrets = await vault.fetch();
//
//   export const OPENAI_API_KEY = secrets.OPENAI_API_KEY || "";
//   export const MONGO_URI = secrets.MONGO_URI || "";
//
// Configuration:
//   The client reads VAULT_URL and VAULT_TOKEN from process.env,
//   or you can pass them directly.
// ============================================================

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Default Configuration ──────────────────────────────────────
const DEFAULT_VAULT_URL = "http://192.168.86.2:5599";
const FETCH_TIMEOUT_MS = 3_000;

/**
 * Parse a .env file into a key-value object.
 * Supports quoted values, comments, and blank lines.
 */
function parseEnvFile(filePath) {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    console.warn(`⚠️  Env file not found: ${absolutePath}`);
    return {};
  }

  const content = readFileSync(absolutePath, "utf-8");
  const parsed = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

/**
 * Create a Vault client instance.
 *
 * @param {object} options
 * @param {string} [options.vaultUrl]         - Vault service URL (default: http://localhost:5599)
 * @param {string} [options.vaultToken]       - Bearer token for Vault auth
 * @param {string} [options.fallbackEnvFile]  - Path to .env file for offline/manual fallback
 * @param {string[]} [options.keys]           - Specific keys to request (omit for all)
 * @param {string} [options.prefix]           - Filter by key prefix
 * @param {string} [options.exclude]          - Exclude keys matching these prefixes (comma-separated)
 */
export function createVaultClient(options = {}) {
  const {
    vaultUrl = process.env.VAULT_URL || DEFAULT_VAULT_URL,
    vaultToken = process.env.VAULT_TOKEN || "",
    fallbackEnvFile,
    keys,
    prefix,
    exclude,
  } = options;

  return {
    /**
     * Fetch secrets from Vault, falling back to the .env file.
     * Returns a plain object of { KEY: "value" } pairs.
     */
    async fetch() {
      // ── Try Vault first ────────────────────────────────────
      if (vaultToken) {
        try {
          const params = new URLSearchParams();
          if (keys?.length) params.set("keys", keys.join(","));
          if (prefix) params.set("prefix", prefix);
          if (exclude) params.set("exclude", exclude);

          const queryString = params.toString();
          const url = `${vaultUrl}/secrets${queryString ? "?" + queryString : ""}`;

          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${vaultToken}` },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status} — ${res.statusText}`);
          }

          const secrets = await res.json();
          console.warn(`🔐 Vault → loaded ${Object.keys(secrets).length} secrets`);
          return secrets;
        } catch (err) {
          console.warn(`⚠️  Vault unreachable (${err.message})`);
        }
      } else {
        console.warn("⚠️  No VAULT_TOKEN set — skipping Vault");
      }

      // ── Fallback: read .env file directly ──────────────────
      if (fallbackEnvFile) {
        console.warn("📄 Falling back to .env file");
        const parsed = parseEnvFile(fallbackEnvFile);
        console.warn(`📄 Loaded ${Object.keys(parsed).length} vars from ${fallbackEnvFile}`);
        return parsed;
      }

      console.warn("⚠️  No fallback .env configured — returning empty secrets");
      return {};
    },
  };
}
