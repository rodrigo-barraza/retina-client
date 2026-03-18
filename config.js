// ============================================================
// Retina — Secrets & Environment Configuration
// ============================================================
// Store your connection details and secrets here.
// This file is gitignored — never commit real secrets.
//
// To get started:
//   1. Copy secrets.example.js to secrets.js
//   2. Fill in the real values below.
// ============================================================

// Prism API Gateway
const IS_LOCAL =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export const PRISM_URL = IS_LOCAL
  ? "http://localhost:7777"
  : "https://prism.clankerbox.com";

export const PRISM_WS_URL = IS_LOCAL
  ? "ws://localhost:7777"
  : "wss://prism.clankerbox.com";

export const PRISM_SECRET = "banana";

// Admin Auth (Iris Dashboard)
export const ADMIN_SECRET = "iris-admin";
