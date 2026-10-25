"use strict";

(function (root, factory) {
  const feature = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanAssumptionsUI = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const { $, escHtml } = root.GovPlanUtils;
function renderAssumptions(assumptions) {
  const container = $("assumptions-content");
  if (!container) return;
  container.innerHTML = `<ul class="space-y-2">
    ${assumptions.map((a) => `
      <li class="flex items-start gap-2.5 text-sm text-slate-700 p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
        <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>${escHtml(a)}</span>
      </li>`).join("")}
  </ul>`;
}

  return Object.freeze({
    renderAssumptions
  });
});
