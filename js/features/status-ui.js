"use strict";

(function (root, factory) {
  const feature = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanStatusUI = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const { $, escHtml } = root.GovPlanUtils;
function renderBadge(mode) {
  const badge = $("mode-badge");
  if (!badge) return;
  // Inner dot + text — preserve the span dot inside the badge
  const dotColor = mode === "ai" ? "bg-emerald-500" : "bg-blue-500";
  const label    = mode === "ai" ? "Mode: AI" : "Mode: Template";
  const cls      = mode === "ai" ? "badge-ai" : "badge-template";
  badge.className = `${cls} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold`;
  badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dotColor} inline-block"></span>${label}`;
}

function renderFallbackNotice(reason) {
  const notice = $("fallback-notice");
  if (!notice) return;
  // The notice div uses flex layout; write into the <span class="font-medium"> child
  const span = notice.querySelector("span");
  const msg = `Mode template (AI tidak tersedia) — ${reason}`;
  if (span) {
    span.textContent = msg;
  } else {
    notice.textContent = msg;
  }
  notice.classList.remove("hidden");
  // Ensure flex display is restored (Tailwind hidden overrides display)
  notice.style.display = "flex";
}

function clearFallbackNotice() {
  const notice = $("fallback-notice");
  if (notice) {
    notice.classList.add("hidden");
    notice.style.display = "";
  }
}

function setLoading(loading) {
  const btn = $("btn-ai");
  const spinner = $("spinner");
  if (btn) btn.disabled = loading;
  if (spinner) spinner.classList.toggle("hidden", !loading);
}

function setCostEditingDisabled(disabled) {
  document.querySelectorAll("#cost-tbody input, #contingency-pct-input").forEach((input) => {
    input.disabled = disabled;
  });
}

function clearAIGenerationState() {
  $("ai-loading-banner")?.remove();
  ["section-charter", "section-wbs", "section-risk", "section-cost", "section-assumptions", "section-gantt", "section-governance"].forEach((id) => {
    const section = $(id);
    if (section) section.style.opacity = "";
  });
  setCostEditingDisabled(false);
  setLoading(false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 5 — WBS-based Gantt Chart
// ═══════════════════════════════════════════════════════════════════════════

/**
 * renderGantt(ganttData)
 *
 * Renders an SVG-based horizontal Gantt chart into #gantt-content.
 * Features:
 *  - Phase/task labels on the left
 *  - Horizontal bars proportional to duration
 *  - Time axis with tick marks (weeks or dates)
 *  - Milestones shown as diamonds
 *  - Horizontal scroll on narrow screens
 *  - Print-safe (no clip, forced page-break)
 *
 * @param {object} ganttData  Return value of buildGanttSchedule()
 * @param {object} input      Form input (for disclaimer text)
 */

function showWBSFallbackNotice(reason) {
  const ganttContent = $("gantt-content");
  if (ganttContent) {
    ganttContent.innerHTML = `
      <div class="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <svg class="w-5 h-5 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <div>
          <p class="font-semibold">Gantt tidak dapat ditampilkan</p>
          <p class="text-xs mt-0.5">${escHtml(reason)}</p>
        </div>
      </div>`;
  }
}

function showFormErrors(errors) {
  const el = $("form-errors");
  if (!el) return;
  // The new design has a <div> sibling next to the SVG icon inside form-errors
  const inner = el.querySelector("div") || el;
  inner.innerHTML = `<ul class="space-y-0.5">${errors.map((e) => `<li>${escHtml(e)}</li>`).join("")}</ul>`;
  el.classList.remove("hidden");
  el.style.display = "flex";
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearFormErrors() {
  const el = $("form-errors");
  if (el) {
    const inner = el.querySelector("div") || el;
    inner.innerHTML = "";
    el.classList.add("hidden");
    el.style.display = "";
  }
}

/**
 * confirmCostEditOverwrite(modeName)
 * S1.A-4: If the user has edited cost values, ask for confirmation before
 * re-generation would overwrite them.  Returns true to proceed, false to cancel.
 *
 * Uses window.confirm() which is synchronous and universally available.
 * No DOM mutation on cancel — the existing document is preserved as-is.
 *
 * @param {string} modeName  e.g. "Template" or "AI"
 * @returns {boolean}
 */

  return Object.freeze({
    renderBadge,
    renderFallbackNotice,
    clearFallbackNotice,
    setLoading,
    setCostEditingDisabled,
    clearAIGenerationState,
    showWBSFallbackNotice,
    showFormErrors,
    clearFormErrors
  });
});
