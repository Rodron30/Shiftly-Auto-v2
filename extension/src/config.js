// src/config.js
//
// EDIT THIS before publishing/loading the extension for real: point it at
// your deployed web app. Also update manifest.json's `host_permissions`
// to match this same origin (the browser only sends cookies to origins
// listed there).
export const WEB_APP_URL = "http://localhost:3000";

// Excludes I, O, Q per the VIN standard (Blueprint §7: 17-character VIN).
const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/g;

export function findVinsInText(text) {
  if (!text) return [];
  const matches = text.toUpperCase().match(VIN_PATTERN) || [];
  return Array.from(new Set(matches));
}

export function isValidVin(vin) {
  return typeof vin === "string" && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}


