/**
 * cobit-data.js
 * ---------------------------------------------------------------------------
 * COBIT 2019 Governance & Management Objectives used by the Governance Review
 * feature of IT Project Governance Assistant.
 *
 * Source: COBIT 2019 Design Guide (ISACA). Codes and names refer to
 * COBIT 2019 © ISACA.
 *
 * The governance engine only accepts codes that exist in this file;
 * any code returned by the LLM that is NOT listed here will be flagged
 * visibly in the UI instead of being displayed as valid.
 *
 * Schema per entry:
 *   code  – Official COBIT 2019 objective code, e.g. "EDM01"
 *   name  – Objective name as published by ISACA
 *   goal  – One sentence describing what the objective aims to achieve.
 *           Intentionally left empty: the one-sentence purposes are not in
 *           the Design Guide. Fill from the ISACA "Framework: Governance and
 *           Management Objectives" publication. Do NOT write them from memory.
 * ---------------------------------------------------------------------------
 */

const COBIT_OBJECTIVES = [
  // EDM – Evaluate, Direct and Monitor
  { code: "EDM01", name: "Ensured Governance Framework Setting and Maintenance", goal: "" },
  { code: "EDM02", name: "Ensured Benefits Delivery", goal: "" },
  { code: "EDM03", name: "Ensured Risk Optimization", goal: "" },
  { code: "EDM04", name: "Ensured Resource Optimization", goal: "" },
  { code: "EDM05", name: "Ensured Stakeholder Engagement", goal: "" },

  // APO – Align, Plan and Organize
  { code: "APO01", name: "Managed I&T Management Framework", goal: "" },
  { code: "APO02", name: "Managed Strategy", goal: "" },
  { code: "APO03", name: "Managed Enterprise Architecture", goal: "" },
  { code: "APO04", name: "Managed Innovation", goal: "" },
  { code: "APO05", name: "Managed Portfolio", goal: "" },
  { code: "APO06", name: "Managed Budget and Costs", goal: "" },
  { code: "APO07", name: "Managed Human Resources", goal: "" },
  { code: "APO08", name: "Managed Relationships", goal: "" },
  { code: "APO09", name: "Managed Service Agreements", goal: "" },
  { code: "APO10", name: "Managed Vendors", goal: "" },
  { code: "APO11", name: "Managed Quality", goal: "" },
  { code: "APO12", name: "Managed Risk", goal: "" },
  { code: "APO13", name: "Managed Security", goal: "" },
  { code: "APO14", name: "Managed Data", goal: "" },

  // BAI – Build, Acquire and Implement
  { code: "BAI01", name: "Managed Programs", goal: "" },
  { code: "BAI02", name: "Managed Requirements Definition", goal: "" },
  { code: "BAI03", name: "Managed Solutions Identification and Build", goal: "" },
  { code: "BAI04", name: "Managed Availability and Capacity", goal: "" },
  { code: "BAI05", name: "Managed Organizational Change", goal: "" },
  { code: "BAI06", name: "Managed IT Changes", goal: "" },
  { code: "BAI07", name: "Managed IT Change Acceptance and Transitioning", goal: "" },
  { code: "BAI08", name: "Managed Knowledge", goal: "" },
  { code: "BAI09", name: "Managed Assets", goal: "" },
  { code: "BAI10", name: "Managed Configuration", goal: "" },
  { code: "BAI11", name: "Managed Projects", goal: "" },

  // DSS – Deliver, Service and Support
  { code: "DSS01", name: "Managed Operations", goal: "" },
  { code: "DSS02", name: "Managed Service Requests and Incidents", goal: "" },
  { code: "DSS03", name: "Managed Problems", goal: "" },
  { code: "DSS04", name: "Managed Continuity", goal: "" },
  { code: "DSS05", name: "Managed Security Services", goal: "" },
  { code: "DSS06", name: "Managed Business Process Controls", goal: "" },

  // MEA – Monitor, Evaluate and Assess
  { code: "MEA01", name: "Managed Performance and Conformance Monitoring", goal: "" },
  { code: "MEA02", name: "Managed System of Internal Control", goal: "" },
  { code: "MEA03", name: "Managed Compliance with External Requirements", goal: "" },
  { code: "MEA04", name: "Managed Assurance", goal: "" },
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