// ============================================================
// Retina — Runtime Configuration
// ============================================================
// Imports defaults from secrets.js and overrides with production
// values when served from *.com
// ============================================================

import {
  RETINA_PORT as SECRETS_PORT,
  PRISM_URL as DEFAULT_PRISM_URL,
  PRISM_WS_URL as DEFAULT_PRISM_WS_URL,
  TOOLS_API_URL as DEFAULT_TOOLS_API_URL,
  MINIO_PUBLIC_URL as DEFAULT_MINIO_URL,
} from "./secrets.js";

export const PORT = SECRETS_PORT || 3333;

export const IS_PRODUCTION =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith(".com");

export const IS_LOCALHOST = !IS_PRODUCTION;

// Environment-aware project name — isolates data between dev and prod
export const PROJECT_NAME = IS_PRODUCTION ? "retina-web" : "retina";

export const PRISM_URL = IS_PRODUCTION
  ? "https://prism.clankerbox.com"
  : DEFAULT_PRISM_URL;

export const PRISM_WS_URL = IS_PRODUCTION
  ? "wss://prism.clankerbox.com"
  : DEFAULT_PRISM_WS_URL;

// Sun Tools API (unified)
export const TOOLS_API_URL = IS_PRODUCTION
  ? "https://tools.clankerbox.com"
  : DEFAULT_TOOLS_API_URL;

// MinIO file storage (direct bucket URL)
export const MINIO_URL = IS_PRODUCTION
  ? "https://minio.clankerbox.com/prism"
  : DEFAULT_MINIO_URL;
