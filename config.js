// ============================================================
// Retina — Runtime Configuration
// ============================================================
// All values are resolved from the Vault via secrets.js.
// No environment branching needed — the Vault serves the correct
// URLs for each deployment context.
// ============================================================

import {
  RETINA_CLIENT_PORT as SECRETS_PORT,
  PRISM_SERVICE_URL,
  PRISM_WS_URL,
  TOOLS_SERVICE_URL,
  MINIO_PUBLIC_URL,
} from "./secrets.js";

export const PORT = SECRETS_PORT || 3333;

// Environment-aware project name — isolates data between dev and prod
export const IS_PRODUCTION =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith(".dev");

export const IS_LOCALHOST = !IS_PRODUCTION;

export const PROJECT_NAME = IS_PRODUCTION ? "retina-web" : "retina";

export { PRISM_SERVICE_URL, PRISM_WS_URL, TOOLS_SERVICE_URL };

// MinIO file storage (direct bucket URL)
export const MINIO_URL = MINIO_PUBLIC_URL;
