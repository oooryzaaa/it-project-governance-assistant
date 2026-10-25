"use strict";

(function (root, factory) {
  const feature = factory(root.GovPlanUtils, root.GovPlanCostFeature);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanAINormalizationFeature = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (utils, costFeature) {
  const { projectDateAtWeek, formatProjectDate } = utils;
/**
 * normaliseAICharter(charter, input)
 * S1.A-1: Compute finish_date from startDate + duration*7 if AI omitted it.
 * S1.A-2: Guard null/missing deliverables and milestones arrays.
 * S1.B-6: Backfill all Phase 2A identity fields from user input.
 */
function normaliseAICharter(charter, input) {
  if (!charter || typeof charter !== "object") charter = {};

  charter.project_title   = charter.project_title   || input.projectName;
  charter.budget_info     = charter.budget_info     || input.budgetRange;
  charter.pm_name         = charter.pm_name         || input.pmName        || "";
  charter.methodology     = charter.methodology     || input.methodology   || "";
  charter.start_date      = charter.start_date      || input.startDate     || "";
  charter.project_context = charter.project_context || input.projectContext || "";

  // S1.A-1: Compute finish_date when AI did not return it — identical formula
  // to Template Mode: start + duration * 7 days.
  if (typeof charter.finish_date !== "string" || !charter.finish_date.trim()) {
    if (input.startDate) {
      charter.finish_date = formatProjectDate(projectDateAtWeek(input.startDate, input.duration));
    } else {
      charter.finish_date = "";
    }
  }

  // S1.A-2: Guard missing arrays to prevent null-reference crashes in
  // renderCharter() and computeScore()
  if (!Array.isArray(charter.deliverables)) charter.deliverables = [];
  if (!Array.isArray(charter.milestones))   charter.milestones   = [];
  if (!Array.isArray(charter.in_scope))     charter.in_scope     = [];
  if (!Array.isArray(charter.out_of_scope)) charter.out_of_scope = [];
  if (!Array.isArray(charter.stakeholders)) charter.stakeholders = [];

  if (!charter.success_criteria) {
    const lines = (input.successCriteria || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    charter.success_criteria = lines;
  }

  // Ensure objective is always a string
  if (typeof charter.objective !== "string") {
    charter.objective = input.objective || "";
  }

  return charter;
}

/**
 * normaliseAIWBS(wbs)
 * S1.B-7: Validate minimum WBS fields required by buildGanttSchedule.
 * Drops rows that don't have at minimum a valid level (1/2/3) and a name.
 * Returns a normalised array, or an empty array with a flag if unusable.
 *
 * @param {any} wbs  The wbs field from AI output.
 * @returns {{ wbs: object[], usable: boolean, reason: string }}
 */
function normaliseAIWBS(wbs) {
  if (!Array.isArray(wbs) || wbs.length === 0) {
    return { wbs: [], usable: false, reason: "AI tidak mengembalikan WBS." };
  }

  const cleaned = wbs
    .filter((row) => {
      if (typeof row !== "object" || row === null) return false;
      const lvl = Number(row.level);
      if (![1, 2, 3].includes(lvl)) return false;
      if (!row.name || typeof row.name !== "string" || !row.name.trim()) return false;
      return true;
    })
    .map((row) => ({
      id:                   String(row.id  ?? ""),
      name:                 String(row.name).trim(),
      level:                Number(row.level),
      deliverable:          String(row.deliverable          ?? "").trim(),
      completion_criteria:  String(row.completion_criteria  ?? "").trim(),
    }));

  // Must have at least one L1 phase for Gantt to work
  const hasL1 = cleaned.some((r) => r.level === 1);
  if (!hasL1) {
    return {
      wbs: cleaned,
      usable: false,
      reason: "WBS dari AI tidak memiliki fase Level 1. Gantt tidak dapat ditampilkan dengan data ini.",
    };
  }

  return { wbs: cleaned, usable: true, reason: "" };
}

  function normaliseAIResponse(aiData, input) {
    aiData.charter = normaliseAICharter(aiData.charter || {}, input);
    const wbsResult = normaliseAIWBS(aiData.wbs);
    aiData.wbs = wbsResult.wbs;

    if (Array.isArray(aiData.cost_estimate)) {
      aiData.cost_estimate = aiData.cost_estimate.map((cost) => {
        const labor = Math.max(0, Number(cost.subtotal) || 0);
        const nonLabor = Math.max(0, Number(cost.non_labor) || 0);
        return { ...cost, subtotal: labor, non_labor: nonLabor, row_total: labor + nonLabor };
      });
    } else {
      aiData.cost_estimate = [];
    }

    if (!aiData.cost_summary) {
      aiData.cost_summary = costFeature.calculateCostSummary(aiData.cost_estimate, 10);
    }

    if (!Array.isArray(aiData.risk_register)) aiData.risk_register = [];
    if (!Array.isArray(aiData.assumptions)) aiData.assumptions = [];

    return { data: aiData, wbsUnusableReason: wbsResult.usable ? "" : wbsResult.reason };
  }

  return Object.freeze({ normaliseAICharter, normaliseAIWBS, normaliseAIResponse });
});
