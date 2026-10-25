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
 *   tags  – Keywords describing the scope of this objective, used by the
 *           relevance ranker in app.js to match objectives to project context.
 *           Derived from the objective name and domain; not official ISACA text.
 * ---------------------------------------------------------------------------
 */

const COBIT_OBJECTIVES = [
  // EDM – Evaluate, Direct and Monitor
  {
    code: "EDM01", name: "Ensured Governance Framework Setting and Maintenance", goal: "",
    tags: ["governance", "framework", "policy", "oversight", "structure", "management"],
  },
  {
    code: "EDM02", name: "Ensured Benefits Delivery", goal: "",
    tags: ["benefit", "value", "delivery", "outcome", "business", "objective", "return"],
  },
  {
    code: "EDM03", name: "Ensured Risk Optimization", goal: "",
    tags: ["risk", "optimization", "tolerance", "appetite", "oversight", "control"],
  },
  {
    code: "EDM04", name: "Ensured Resource Optimization", goal: "",
    tags: ["resource", "budget", "capacity", "people", "infrastructure", "optimization", "allocation"],
  },
  {
    code: "EDM05", name: "Ensured Stakeholder Engagement", goal: "",
    tags: ["stakeholder", "engagement", "communication", "reporting", "transparency", "sponsor"],
  },

  // APO – Align, Plan and Organize
  {
    code: "APO01", name: "Managed I&T Management Framework", goal: "",
    tags: ["management", "framework", "policy", "standard", "governance", "it", "process"],
  },
  {
    code: "APO02", name: "Managed Strategy", goal: "",
    tags: ["strategy", "planning", "alignment", "roadmap", "digital", "business", "transformation"],
  },
  {
    code: "APO03", name: "Managed Enterprise Architecture", goal: "",
    tags: ["architecture", "enterprise", "design", "integration", "system", "platform", "infrastructure"],
  },
  {
    code: "APO04", name: "Managed Innovation", goal: "",
    tags: ["innovation", "technology", "emerging", "digital", "iot", "ai", "machine learning", "cloud", "new"],
  },
  {
    code: "APO05", name: "Managed Portfolio", goal: "",
    tags: ["portfolio", "program", "project", "investment", "prioritization", "selection"],
  },
  {
    code: "APO06", name: "Managed Budget and Costs", goal: "",
    tags: ["budget", "cost", "financial", "expense", "estimate", "spend", "procurement"],
  },
  {
    code: "APO07", name: "Managed Human Resources", goal: "",
    tags: ["human", "resource", "staff", "team", "skills", "training", "people", "hr", "workforce"],
  },
  {
    code: "APO08", name: "Managed Relationships", goal: "",
    tags: ["relationship", "stakeholder", "customer", "partner", "collaboration", "user", "satisfaction"],
  },
  {
    code: "APO09", name: "Managed Service Agreements", goal: "",
    tags: ["service", "agreement", "sla", "contract", "level", "provider", "outsource"],
  },
  {
    code: "APO10", name: "Managed Vendors", goal: "",
    tags: ["vendor", "supplier", "third party", "outsource", "procurement", "contract", "service"],
  },
  {
    code: "APO11", name: "Managed Quality", goal: "",
    tags: ["quality", "testing", "qa", "standard", "assurance", "uat", "review", "acceptance"],
  },
  {
    code: "APO12", name: "Managed Risk", goal: "",
    tags: ["risk", "register", "mitigation", "assessment", "threat", "vulnerability", "control", "impact"],
  },
  {
    code: "APO13", name: "Managed Security", goal: "",
    tags: ["security", "cybersecurity", "access", "privacy", "authentication", "encryption", "protection", "cyber"],
  },
  {
    code: "APO14", name: "Managed Data", goal: "",
    tags: ["data", "database", "analytics", "privacy", "governance", "quality", "ai", "ml", "dataset", "etl", "storage"],
  },

  // BAI – Build, Acquire and Implement
  {
    code: "BAI01", name: "Managed Programs", goal: "",
    tags: ["program", "portfolio", "initiative", "benefit", "governance", "strategic"],
  },
  {
    code: "BAI02", name: "Managed Requirements Definition", goal: "",
    tags: ["requirement", "specification", "analysis", "scope", "user", "functional", "need", "definition"],
  },
  {
    code: "BAI03", name: "Managed Solutions Identification and Build", goal: "",
    tags: ["development", "build", "solution", "software", "application", "web", "mobile", "implementation", "coding"],
  },
  {
    code: "BAI04", name: "Managed Availability and Capacity", goal: "",
    tags: ["availability", "capacity", "performance", "uptime", "reliability", "scalability", "infrastructure", "server", "cloud"],
  },
  {
    code: "BAI05", name: "Managed Organizational Change", goal: "",
    tags: ["change", "organizational", "adoption", "transition", "training", "people", "culture", "readiness"],
  },
  {
    code: "BAI06", name: "Managed IT Changes", goal: "",
    tags: ["change", "release", "version", "update", "patch", "deployment", "control", "approval"],
  },
  {
    code: "BAI07", name: "Managed IT Change Acceptance and Transitioning", goal: "",
    tags: ["transition", "migration", "cutover", "go-live", "acceptance", "handover", "deployment", "cloud"],
  },
  {
    code: "BAI08", name: "Managed Knowledge", goal: "",
    tags: ["knowledge", "documentation", "training", "manual", "wiki", "transfer", "learning"],
  },
  {
    code: "BAI09", name: "Managed Assets", goal: "",
    tags: ["asset", "hardware", "license", "inventory", "device", "equipment", "iot", "sensor"],
  },
  {
    code: "BAI10", name: "Managed Configuration", goal: "",
    tags: ["configuration", "infrastructure", "server", "network", "environment", "deployment", "devops", "setup"],
  },
  {
    code: "BAI11", name: "Managed Projects", goal: "",
    tags: ["project", "management", "schedule", "milestone", "deliverable", "budget", "scope", "planning"],
  },

  // DSS – Deliver, Service and Support
  {
    code: "DSS01", name: "Managed Operations", goal: "",
    tags: ["operation", "monitoring", "system", "infrastructure", "server", "maintenance", "production", "uptime"],
  },
  {
    code: "DSS02", name: "Managed Service Requests and Incidents", goal: "",
    tags: ["incident", "service", "request", "helpdesk", "support", "response", "ticket", "user"],
  },
  {
    code: "DSS03", name: "Managed Problems", goal: "",
    tags: ["problem", "root cause", "analysis", "bug", "defect", "resolution", "stability"],
  },
  {
    code: "DSS04", name: "Managed Continuity", goal: "",
    tags: ["continuity", "disaster", "recovery", "backup", "resilience", "availability", "business continuity", "dr"],
  },
  {
    code: "DSS05", name: "Managed Security Services", goal: "",
    tags: ["security", "access", "authentication", "firewall", "network", "encryption", "data protection", "privacy", "compliance", "cyber"],
  },
  {
    code: "DSS06", name: "Managed Business Process Controls", goal: "",
    tags: ["process", "control", "business", "workflow", "transaction", "integrity", "automation"],
  },

  // MEA – Monitor, Evaluate and Assess
  {
    code: "MEA01", name: "Managed Performance and Conformance Monitoring", goal: "",
    tags: ["performance", "monitoring", "kpi", "metric", "conformance", "dashboard", "reporting", "measure"],
  },
  {
    code: "MEA02", name: "Managed System of Internal Control", goal: "",
    tags: ["internal", "control", "audit", "assurance", "compliance", "policy", "regulation"],
  },
  {
    code: "MEA03", name: "Managed Compliance with External Requirements", goal: "",
    tags: ["compliance", "regulation", "law", "gdpr", "iso", "pdp", "external", "legal", "requirement", "standard"],
  },
  {
    code: "MEA04", name: "Managed Assurance", goal: "",
    tags: ["assurance", "audit", "review", "assessment", "independent", "quality", "verification"],
  },
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