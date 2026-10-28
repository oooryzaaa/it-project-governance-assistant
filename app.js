/**
 * app.js
 * ---------------------------------------------------------------------------
 * Frontend logic untuk IT Project Governance Assistant.
 * Vanilla JavaScript – tanpa framework.
 *
 * Fitur:
 *  - TEMPLATE MODE  : generate dokumen dari template per kategori (offline)
 *  - AI MODE        : kirim ke POST /api/generate, fallback ke template bila gagal
 *  - GOVERNANCE REVIEW: pemetaan COBIT 2019, KPI, skor kesesuaian indikatif
 *  - EXPORT         : CSV per seksi + print-friendly view (PDF)
 * ---------------------------------------------------------------------------
 */

"use strict";

// ── Canonical application state and shared utilities ────────────────────────
const projectStore = globalThis.GovPlanProjectStore;
const { $, formatProjectDate } = globalThis.GovPlanUtils;
const { generateTemplate } = globalThis.GovPlanTemplateFeature;
const { runGovernanceReview } = globalThis.GovPlanCobitFeature;
const { buildGanttSchedule, syncCharterMilestonesToGantt } = globalThis.GovPlanGanttFeature;
const { normaliseAIResponse } = globalThis.GovPlanAINormalizationFeature;
const { renderCharter, renderWBS, renderRiskRegister } = globalThis.GovPlanDocumentRenderers;
const { renderGantt } = globalThis.GovPlanGanttUI;
const { renderCostEstimate, renderBudgetStatus, bindCostEvents } = globalThis.GovPlanCostUI;
const { renderAssumptions } = globalThis.GovPlanAssumptionsUI;
const { renderGovernance } = globalThis.GovPlanGovernanceUI;
const {
  renderBadge,
  renderFallbackNotice,
  clearFallbackNotice,
  setLoading,
  setCostEditingDisabled,
  clearAIGenerationState,
  showWBSFallbackNotice,
  showFormErrors,
  clearFormErrors,
} = globalThis.GovPlanStatusUI;
const { bindExportControls } = globalThis.GovPlanExportUI;

// Temporary compatibility aliases keep legacy consumers on the single store.
for (const [name, getter, setter] of [
  ["currentMode", () => projectStore.getGenerationMode(), (value) => projectStore.setGenerationMode(value)],
  ["currentDoc", () => projectStore.getDocument(), (value) => projectStore.setDocument(value)],
  ["currentInput", () => projectStore.getLastAcceptedInput(), (value) => projectStore.setLastAcceptedInput(value)],
  ["costEdited", () => projectStore.getCostEdited(), (value) => projectStore.setCostEdited(value)],
  ["generationRequestId", () => projectStore.getPendingRequestIdentity(), (value) => projectStore.setPendingRequestIdentity(value)],
]) {
  Object.defineProperty(globalThis, name, { configurable: true, get: getter, set: setter });
}

// ── Template data per kategori ──────────────────────────────────────────────

// ── CSV Export ──────────────────────────────────────────────────────────────

function showSection(id) {
  const section = $(id);
  if (section) section.classList.remove("hidden");
}

function hideSection(id) {
  const section = $(id);
  if (section) section.classList.add("hidden");
}

function renderDocument(doc, input) {
  // S1.E-22: Guard against malformed AI data reaching critical paths
  if (!doc.charter)       doc.charter       = {};
  if (!Array.isArray(doc.wbs))           doc.wbs           = [];
  if (!Array.isArray(doc.risk_register)) doc.risk_register = [];
  if (!Array.isArray(doc.cost_estimate)) doc.cost_estimate = [];
  if (!doc.cost_summary)  doc.cost_summary  = {};
  if (!Array.isArray(doc.assumptions))   doc.assumptions   = [];

  // S1.C-9/10/11/12: Compute Gantt schedule FIRST (single authoritative schedule).
  // Then sync Charter milestone dates FROM the Gantt before rendering Charter.
  const ganttData = buildGanttSchedule(doc.wbs, input);
  doc._gantt = ganttData;

  if (ganttData.hasCalendarDates && ganttData.tasks.length > 0) {
    const closingTask = ganttData.tasks.filter((task) => !task.isBuffer).slice(-1)[0];
    if (closingTask?.endDate) doc.charter.finish_date = formatProjectDate(closingTask.endDate);
  }

  // Charter milestone dates/weeks are derived from the same schedule as Gantt.
  syncCharterMilestonesToGantt(doc, ganttData);

  renderCharter(doc.charter, input);
  renderWBS(doc.wbs);
  renderRiskRegister(doc.risk_register);
  renderCostEstimate(doc.cost_estimate, doc.cost_summary, doc);
  renderAssumptions(doc.assumptions);

  // Render Gantt using the already-computed ganttData (S1.C-11: no re-computation)
  renderGantt(ganttData, input);

  // Governance
  const objectives = typeof COBIT_OBJECTIVES !== "undefined" ? COBIT_OBJECTIVES : [];
  const governance = runGovernanceReview(doc, input, objectives);
  doc._governance = governance;
  renderGovernance(governance);

  // Keep every document rendered and mounted, but display the Overview after a new generation.
  globalThis.GovPlanWorkspaceUI?.navigate("overview");
  showSection("export-bar");

  // S1.D-15/19: Show initial budget status after first render
  const cs = doc.cost_summary;
  const grandTotal = cs?.grand_total ?? 0;
  // Remove stale budget-status from previous doc
  const oldStatus = $("budget-status");
  if (oldStatus) oldStatus.remove();
  renderBudgetStatus(grandTotal, input?.budgetRange || "");
}

function getFormData() {
  // S1.A-3: Read raw strings so we can detect non-integer input before parsing.
  const durationRaw  = ($("duration")?.value  || "").trim();
  const teamSizeRaw  = ($("team-size")?.value || "").trim();

  // Reject values that are not whole-number strings (e.g. "3.5", "1.0e2", "abc").
  const isWholeNumber = (s) => /^\d+$/.test(s);

  const durationParsed  = isWholeNumber(durationRaw)  ? parseInt(durationRaw,  10) : NaN;
  const teamSizeParsed  = isWholeNumber(teamSizeRaw)   ? parseInt(teamSizeRaw,  10) : NaN;

  const data = {
    // required fields (unchanged)
    projectName:  ($("project-name")?.value || "").trim(),
    objective:    ($("objective")?.value || "").trim(),
    duration:     durationParsed,
    teamSize:     teamSizeParsed,
    category:     $("category")?.value || "",
    budgetRange:  ($("budget-range")?.value || "").trim(),
    // optional Phase 2A fields — silently empty when not filled
    startDate:       ($("start-date")?.value        || "").trim(),
    pmName:          ($("pm-name")?.value           || "").trim(),
    methodology:     ($("methodology")?.value       || "").trim(),
    keyDeliverables: ($("key-deliverables")?.value  || "").trim(),
    successCriteria: ($("success-criteria")?.value  || "").trim(),
    projectContext:  ($("project-context")?.value   || "").trim(),
  };

  const errors = [];
  if (!data.projectName) errors.push("Nama proyek wajib diisi.");
  if (!data.objective) errors.push("Tujuan proyek wajib diisi.");

  // S1.A-3: duration validation — must be integer 1–520
  if (!isWholeNumber(durationRaw)) {
    errors.push("Durasi harus bilangan bulat (mis. 14). Nilai desimal atau teks tidak diterima.");
  } else if (durationParsed < 1) {
    errors.push("Durasi harus ≥ 1 minggu.");
  } else if (durationParsed > 520) {
    errors.push("Durasi tidak boleh melebihi 520 minggu (10 tahun).");
  }

  // S1.A-3: teamSize validation — must be integer 1–500
  if (!isWholeNumber(teamSizeRaw)) {
    errors.push("Ukuran tim harus bilangan bulat (mis. 5). Nilai desimal atau teks tidak diterima.");
  } else if (teamSizeParsed < 1) {
    errors.push("Ukuran tim harus ≥ 1 orang.");
  } else if (teamSizeParsed > 500) {
    errors.push("Ukuran tim tidak boleh melebihi 500 orang.");
  }

  if (!data.category) errors.push("Pilih kategori proyek.");
  if (!data.budgetRange) errors.push("Kisaran anggaran wajib diisi.");

  if (errors.length > 0) {
    showFormErrors(errors);
    return null;
  }
  clearFormErrors();
  return data;
}

function confirmCostEditOverwrite(modeName) {
  if (!projectStore.getCostEdited() && !projectStore.isProjectDirty()) return true;
  return window.confirm(
    `Proyek ini memiliki perubahan yang belum disimpan${projectStore.getCostEdited() ? ", termasuk edit Estimasi Biaya" : ""}.\n\nGenerate ulang dengan ${modeName} akan mengganti dokumen proyek saat ini.\n\nLanjutkan dan ganti proyek?`
  );
}

/** Klik tombol "Generate Template" */
async function onGenerateTemplate() {
  // S1.A-4: Guard cost edits before re-generation
  if (!confirmCostEditOverwrite("Template")) return;

  const input = getFormData();
  if (!input) return;

  projectStore.invalidatePendingGeneration();
  clearAIGenerationState();
  projectStore.setGenerationStatus("generating");
  currentMode = "template";
  currentInput = input;
  renderBadge("template");
  clearFallbackNotice();

  const doc = generateTemplate(input);
  currentDoc = doc;
  // S1.A-4: Reset edit tracking after successful re-generation
  costEdited = false;
  renderDocument(doc, input);
  projectStore.setGenerationStatus("ready");

  $("output-section")?.scrollIntoView({ behavior: "smooth" });
}

// ── AI output normalisation helpers ─────────────────────────────────────────

/**
 * showWBSFallbackNotice(reason)
 * S1.B-7: Show a human-readable notice inside the Gantt section when
 * AI WBS is unusable.  This prevents silent corruption or crashes.
 */
async function onGenerateAI() {
  // S1.A-4: Guard cost edits before re-generation
  if (!confirmCostEditOverwrite("AI")) return;

  const input = getFormData();
  if (!input) return;

  const requestId = projectStore.beginAIGeneration(input);

  // S1.B-5: Mark existing output as stale while loading.
  // Dim old sections so they cannot be mistaken for the new result.
  const outputSection = $("output-section");
  let loadingBanner = null;
  if (outputSection && currentDoc) {
    loadingBanner = document.createElement("div");
    loadingBanner.id = "ai-loading-banner";
    loadingBanner.className = "flex items-center gap-3 p-4 mb-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800";
    loadingBanner.innerHTML = `
      <svg class="w-5 h-5 animate-spin shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span></span>`;
    loadingBanner.querySelector("span").textContent =
      `Memproses "${input.projectName}" dengan AI. Dokumen di bawah adalah hasil sebelumnya, bukan hasil permintaan ini.`;
    outputSection.prepend(loadingBanner);
    ["section-charter","section-wbs","section-risk","section-cost","section-assumptions","section-gantt","section-governance"].forEach(id => {
      const s = $(id);
      if (s) s.style.opacity = "0.3";
    });
  }

  setLoading(true);
  setCostEditingDisabled(true);
  clearFallbackNotice();

  try {
    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const result = await resp.json();

    if (!projectStore.isCurrentRequest(requestId)) return;

    if (result.fallback) {
      // Server mengembalikan sinyal fallback
      throw new Error(result.reason || "AI tidak tersedia");
    }

    const normalizedResponse = normaliseAIResponse(result.data, input);
    const aiData = normalizedResponse.data;
    const wbsUnusableReason = normalizedResponse.wbsUnusableReason;

    currentMode = "ai";
    currentDoc  = aiData;
    // S1.A-4: Reset edit tracking after successful re-generation
    costEdited = false;
    // S1.B-6: Explicit badge — this is real Gemini output, not a fallback
    renderBadge("ai");
    renderDocument(aiData, input);
    projectStore.setGenerationStatus("ready");

    // S1.B-7: Show explanation in Gantt area if WBS was unusable
    if (wbsUnusableReason) {
      showWBSFallbackNotice(wbsUnusableReason);
    }

  } catch (err) {
    if (!projectStore.isCurrentRequest(requestId)) return;

    // S1.B-5: Restore old sections on failure so user can still read previous doc
    ["section-charter","section-wbs","section-risk","section-cost","section-assumptions","section-gantt","section-governance"].forEach(id => {
      const s = $(id);
      if (s) s.style.opacity = "";
    });

    // S1.B-6: Explicit fallback labeling — not presented as successful AI output
    console.warn("[AI Fallback]", err.message);
    renderFallbackNotice(err.message);
    currentMode = "template";
    renderBadge("template");
    const doc = generateTemplate(input);
    currentDoc = doc;
    // S1.A-4: Reset edit tracking on fallback too (new doc generated)
    costEdited = false;
    renderDocument(doc, input);
    projectStore.setGenerationStatus("ready");

  } finally {
    if (projectStore.isCurrentRequest(requestId)) {
      // S1.B-5: Always remove the loading banner and restore opacity
      if (loadingBanner) loadingBanner.remove();
      clearAIGenerationState();
      $("output-section")?.scrollIntoView({ behavior: "smooth" });
    }
  }
}

/** Cetak tampilan ramah-print */
function onPrint() {
  window.print();
}

function restoreSavedProject(record) {
  projectStore.restoreProject(record);
  clearFallbackNotice();
  clearAIGenerationState();
  setCostEditingDisabled(false);
  const formValues = {
    "project-name": record.input.projectName,
    objective: record.input.objective,
    duration: record.input.duration,
    "team-size": record.input.teamSize,
    category: record.input.category,
    "budget-range": record.input.budgetRange,
    "start-date": record.input.startDate,
    "pm-name": record.input.pmName,
    methodology: record.input.methodology,
    "key-deliverables": record.input.keyDeliverables,
    "success-criteria": record.input.successCriteria,
    "project-context": record.input.projectContext,
  };
  for (const [id, value] of Object.entries(formValues)) {
    const field = $(id);
    if (field) field.value = value ?? "";
  }
  renderBadge(record.generationMode);
  renderDocument(record.document, record.input);
  globalThis.GovPlanWorkspaceUI?.navigate(record.activeModule || "overview");
  projectStore.setProjectDirty(false);
}

function refreshSavedProjectDocument(document, input) {
  const projectNameField = $("project-name");
  if (projectNameField) projectNameField.value = input.projectName || "";
  const activeModule = projectStore.getActiveUiModule();
  renderDocument(document, input);
  globalThis.GovPlanWorkspaceUI?.navigate(activeModule);
}

function closeCurrentProject() {
  projectStore.closeProject();
  $("project-form")?.reset();
  clearFallbackNotice();
  clearAIGenerationState();
  setCostEditingDisabled(false);
  renderBadge("template");
  $("budget-status")?.remove();
  for (const id of [
    "charter-content", "wbs-tbody", "risk-tbody", "cost-tbody",
    "assumptions-content", "gantt-content", "cobit-mappings", "kpi-list", "score-content",
  ]) {
    const element = $(id);
    if (element) element.replaceChildren();
  }
  $("export-bar")?.classList.add("hidden");
  globalThis.GovPlanWorkspaceUI?.navigate("projects");
}

globalThis.GovPlanApp = Object.freeze({
  restoreSavedProject: restoreSavedProject,
  refreshSavedProjectDocument,
  closeCurrentProject,
});

// ── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  globalThis.GovPlanWorkspaceUI?.init();
  globalThis.GovPlanProjectsUI?.init({
    restoreProject: restoreSavedProject,
    refreshDocument: refreshSavedProjectDocument,
    closeProject: closeCurrentProject,
  });

  // Badge awal
  renderBadge("template");

  // Tombol generate
  $("btn-template")?.addEventListener("click", onGenerateTemplate);
  $("btn-ai")?.addEventListener("click", onGenerateAI);
  $("btn-print")?.addEventListener("click", onPrint);

  bindCostEvents();
  bindExportControls();
});
