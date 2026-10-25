"use strict";

(function (root, factory) {
  const feature = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanCostUI = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const { $, escHtml } = root.GovPlanUtils;
  const projectStore = root.GovPlanProjectStore;
  const { calculateCostRow, calculateCostSummary, parseBudgetIDR } = root.GovPlanCostFeature;
function renderCostEstimate(costs, summary) {
  const tbody = $("cost-tbody");
  if (!tbody) return;

  const contingencyInput = $("contingency-pct-input");
  const summaryPct = summary?.contingency_pct;
  const initialPct = Number(summaryPct);
  if (contingencyInput) {
    contingencyInput.value = summaryPct !== null && summaryPct !== undefined &&
      Number.isFinite(initialPct) && initialPct >= 0 && initialPct <= 100
      ? String(initialPct)
      : "10";
  }

  const fmt = (n) => Math.max(0, Number(n) || 0).toLocaleString("id-ID");

  tbody.innerHTML = costs
    .map(
      (c, i) => `<tr class="border-b border-slate-100 transition-colors" data-cost-idx="${i}">
        <td class="px-4 py-3 text-sm font-medium text-slate-700">${escHtml(c.category)}</td>
        <td class="px-4 py-3 text-center">
          <input type="number"
            class="cost-hours w-20 border border-slate-300 rounded-lg px-2 py-1 text-right text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none transition"
            value="${Math.max(0, c.hours || 0)}" min="0" data-idx="${i}" aria-label="Jam untuk ${escHtml(c.category)}">
        </td>
        <td class="px-4 py-3 text-center">
          <input type="number"
            class="cost-rate w-28 border border-slate-300 rounded-lg px-2 py-1 text-right text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none transition"
            value="${Math.max(0, c.rate || 0)}" min="0" data-idx="${i}" aria-label="Tarif untuk ${escHtml(c.category)}">
        </td>
        <td class="px-4 py-3 text-center">
          <input type="number"
            class="cost-nonlabor w-28 border border-slate-300 rounded-lg px-2 py-1 text-right text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none transition"
            value="${Math.max(0, c.non_labor || 0)}" min="0" data-idx="${i}" aria-label="Biaya non-tenaga kerja untuk ${escHtml(c.category)}">
        </td>
        <td class="px-4 py-3 text-right font-semibold text-emerald-700 cost-row-total" id="cost-sub-${i}">Rp ${fmt(c.row_total)}</td>
      </tr>`
    )
    .join("");

  updateCostSummary();

  // Event listeners untuk semua kolom yang dapat diedit
  tbody.querySelectorAll(".cost-hours, .cost-rate, .cost-nonlabor").forEach((input) => {
    input.addEventListener("input", onCostEdit);
  });
}

/**
 * onCostEdit(e)
 * Handles edits to hours, rate, or non-labor inputs.
 * Recalculates: subtotal (labor) = hours × rate; row_total = subtotal + non_labor.
 * S1.A-4: Sets costEdited = true so re-generation triggers a confirmation.
 */
function onCostEdit(e) {
  const idx = parseInt(e.target.dataset.idx, 10);
  const currentDoc = projectStore.getDocument();
  if (!currentDoc || isNaN(idx)) return;

  const row = root.document.querySelector(`[data-cost-idx="${idx}"]`);
  if (!row) return;

  const calculation = calculateCostRow(
    parseFloat(row.querySelector(".cost-hours")?.value) || 0,
    parseFloat(row.querySelector(".cost-rate")?.value) || 0,
    parseFloat(row.querySelector(".cost-nonlabor")?.value) || 0
  );

  // Keep existing subtotal field = labor cost (backward-compatible with AI schema)
  currentDoc.cost_estimate[idx].hours     = calculation.hours;
  currentDoc.cost_estimate[idx].rate      = calculation.rate;
  currentDoc.cost_estimate[idx].subtotal  = calculation.labor;
  currentDoc.cost_estimate[idx].non_labor = calculation.nonLabor;
  currentDoc.cost_estimate[idx].row_total = calculation.rowTotal;

  const rowTotalCell = $(`cost-sub-${idx}`);
  if (rowTotalCell) rowTotalCell.textContent = `Rp ${calculation.rowTotal.toLocaleString("id-ID")}`;

  // S1.A-4: Mark cost table as edited.
  projectStore.setCostEdited(true);

  updateCostSummary();
}

// ── Budget health helpers ────────────────────────────────────────────────────

/**
 * renderBudgetStatus(grandTotal, budgetText)
 * S1.D-15–20: Compare current grand total (incl. contingency) to the parsed
 * project budget and update the #budget-status element.
 *
 * Creates the element dynamically if not already present in the cost section.
 */
function renderBudgetStatus(grandTotal, budgetText) {
  // Ensure the status element exists
  let statusEl = $("budget-status");
  if (!statusEl) {
    const costSection = $("section-cost");
    if (!costSection) return;
    // Insert before the footnote paragraph inside the cost section
    const footnote = costSection.querySelector("p.text-xs.text-slate-400.mt-2");
    statusEl = document.createElement("div");
    statusEl.id = "budget-status";
    statusEl.className = "mt-3";
    if (footnote) {
      footnote.parentNode.insertBefore(statusEl, footnote);
    } else {
      costSection.querySelector(".px-6.py-5").appendChild(statusEl);
    }
  }

  const parsed = parseBudgetIDR(budgetText || "");

  if (parsed.value === null) {
    // S1.D-18: unparseable budget
    statusEl.innerHTML = `
      <div class="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
        <svg class="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span><strong>Budget tidak dapat dibandingkan</strong> — format anggaran tidak dikenali (<em>${escHtml(budgetText)}</em>).</span>
      </div>`;
    return;
  }

  const budget = parsed.value; // S1.D-17: use upper bound for ranges
  const diff   = grandTotal - budget;
  const pct    = budget > 0 ? Math.round((Math.abs(diff) / budget) * 100) : 0;

  let html;
  if (diff > 0) {
    // S1.D-20: over budget
    html = `
      <div class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
        <svg class="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <span>
          <strong>Melebihi anggaran</strong> sebesar <strong>Rp ${diff.toLocaleString("id-ID")}</strong> (+${pct}%).
          ${parsed.isRange ? `<em class="text-red-500">(Asumsi: dibandingkan batas atas anggaran Rp ${budget.toLocaleString("id-ID")})</em>` : ""}
        </span>
      </div>`;
  } else if (Math.abs(diff) / Math.max(budget, 1) <= 0.05) {
    // S1.D-20: within budget (within ±5%)
    html = `
      <div class="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <svg class="w-4 h-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
        </svg>
        <span>
          <strong>Dalam batas anggaran</strong> (selisih ${pct}%).
          ${parsed.isRange ? `<em class="text-amber-600">(Asumsi: dibandingkan batas atas anggaran Rp ${budget.toLocaleString("id-ID")})</em>` : ""}
        </span>
      </div>`;
  } else {
    // S1.D-20: under budget
    html = `
      <div class="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
        <svg class="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>
          <strong>Di bawah anggaran</strong> — estimasi lebih rendah Rp ${Math.abs(diff).toLocaleString("id-ID")} (${pct}%) dari anggaran.
          ${parsed.isRange ? `<em class="text-emerald-600">(Asumsi: dibandingkan batas atas anggaran Rp ${budget.toLocaleString("id-ID")})</em>` : ""}
        </span>
      </div>`;
  }
  statusEl.innerHTML = html;
}

/**
 * updateCostSummary()
 * Recomputes and renders:
 *   cost_subtotal        = sum of all row_totals
 *   contingency_reserve  = cost_subtotal × contingency_pct / 100
 *   grand_total          = cost_subtotal + contingency_reserve
 *
 * S1.D-19: Also immediately updates budget status after any cost change.
 * Also keeps #cost-total updated for any legacy references (it now shows grand_total).
 */
function updateCostSummary() {
  const currentDoc = projectStore.getDocument();
  if (!currentDoc) return;
  const currentInput = projectStore.getLastAcceptedInput();
  const items = currentDoc.cost_estimate || [];

  // Read the editable contingency percentage for the pure cost-summary calculation.
  const pctInput = $("contingency-pct-input");
  const summary = calculateCostSummary(items, pctInput?.value);

  // Persist into doc so CSV export reads current values
  if (!currentDoc.cost_summary) currentDoc.cost_summary = {};
  Object.assign(currentDoc.cost_summary, summary);

  // Update display cells
  const subtotalEl   = $("cost-subtotal-display");
  const reserveEl    = $("cost-reserve-display");
  const grandTotalEl = $("cost-total"); // existing ID — now shows grand total

  if (subtotalEl)   subtotalEl.textContent  = `Rp ${summary.cost_subtotal.toLocaleString("id-ID")}`;
  if (reserveEl)    reserveEl.textContent   = `Rp ${summary.contingency_reserve.toLocaleString("id-ID")}`;
  if (grandTotalEl) grandTotalEl.textContent = `Rp ${summary.grand_total.toLocaleString("id-ID")}`;

  // S1.D-19: Update budget health status immediately
  renderBudgetStatus(summary.grand_total, currentInput?.budgetRange || "");
  projectStore.notifyDocumentUpdated();
}

// Keep a thin backward-compatible alias so any future caller of the old name still works
function updateCostTotal() { updateCostSummary(); }

  function bindCostEvents() {
    $("contingency-pct-input")?.addEventListener("input", () => {
      projectStore.setCostEdited(true);
      updateCostSummary();
    });
  }

  return Object.freeze({
    renderCostEstimate,
    onCostEdit,
    renderBudgetStatus,
    updateCostSummary,
    updateCostTotal,
    bindCostEvents
  });
});
