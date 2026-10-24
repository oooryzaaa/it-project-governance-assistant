/**
 * cobit-data.js
 * ---------------------------------------------------------------------------
 * COBIT 2019 Governance & Management Objectives used by the Governance Review
 * feature of IT Project Governance Assistant.
 *
 * TODO: Fill in the real COBIT 2019 objective entries before going to
 *       production. Each entry must follow the schema below exactly.
 *       The governance engine only accepts codes that exist in this file;
 *       any code returned by the LLM that is NOT listed here will be flagged
 *       visibly in the UI instead of being displayed as valid.
 *
 * Schema per entry:
 *   code  – Official COBIT 2019 objective code, e.g. "EDM01"
 *   name  – Full objective name as published by ISACA
 *   goal  – One sentence describing what the objective aims to achieve
 *
 * Example (replace with real data):
 * { code: "EDM01", name: "Ensured Governance Framework Setting and Maintenance",
 *   goal: "Analyse and articulate the requirements for the governance of enterprise IT." }
 * ---------------------------------------------------------------------------
 */

// ⚠️  TODO: Replace the empty array below with real COBIT 2019 objectives.
//           Do NOT invent codes or names — use only official ISACA content.
const COBIT_OBJECTIVES = [
  // ADD ENTRIES HERE — example structure (uncomment and fill):
  // {
  //   code: "EDM01",
  //   name: "Ensured Governance Framework Setting and Maintenance",
  //   goal: "Analyse and articulate the requirements for the governance of enterprise IT and put in place and maintain effective enabling structures, principles, processes and practices."
  // },
  // {
  //   code: "APO01",
  //   name: "Managed I&T Management Framework",
  //   goal: "Clarify and maintain the mission and vision of the enterprise I&T function."
  // },
];

/**
 * Look up a COBIT objective by its code.
 * @param {string} code – e.g. "EDM01"
 * @returns {object|null} The objective entry, or null if not found.
 */
function getCobitObjective(code) {
  return COBIT_OBJECTIVES.find((o) => o.code === code) || null;
}

/**
 * Return all known COBIT objective codes as a Set for fast validation.
 * @returns {Set<string>}
 */
function getKnownCobitCodes() {
  return new Set(COBIT_OBJECTIVES.map((o) => o.code));
}

// Export for use in server.js (Node/CommonJS) and app.js (browser global)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { COBIT_OBJECTIVES, getCobitObjective, getKnownCobitCodes };
}
