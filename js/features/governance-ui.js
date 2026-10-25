"use strict";

(function (root, factory) {
  const feature = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanGovernanceUI = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const { $, escHtml } = root.GovPlanUtils;
function renderGovernance(gov) {
  renderCobitMappings(gov.mappings);
  renderKPIs(gov.kpis);
  renderScore(gov.criteria, gov.total, gov.maxTotal, gov.percentage);
}

function renderCobitMappings(mappings) {
  const container = $("cobit-mappings");
  if (!container) return;

  container.innerHTML = mappings
    .map((m) => {
      const isUnknown = m.unknown;
      const unknownTag = isUnknown
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full font-bold border border-red-200">
             <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
             Kode tidak dikenal
           </span>`
        : "";
      const cardCls = isUnknown
        ? "p-4 border border-red-200 rounded-xl bg-red-50"
        : "p-4 border border-slate-200 rounded-xl bg-white hover:border-purple-200 transition-colors";

      return `<div class="${cardCls}">
        <div class="flex items-start justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono font-bold text-purple-700 text-xs bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">${escHtml(m.code)}</span>
            ${unknownTag}
          </div>
        </div>
        <p class="text-slate-700 text-sm font-semibold leading-snug mb-1">${escHtml(m.name)}</p>
        <p class="text-slate-500 text-xs leading-relaxed">${escHtml(m.reason)}</p>
      </div>`;
    })
    .join("");
}

function renderKPIs(kpis) {
  const container = $("kpi-list");
  if (!container) return;

  container.innerHTML = kpis
    .map(
      (k, i) => `<div class="flex items-start gap-3 p-3.5 bg-white border border-slate-200 rounded-xl hover:border-teal-200 transition-colors">
        <div class="w-6 h-6 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 text-xs font-bold">${i + 1}</div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-slate-800 text-sm">${escHtml(k.kpi)}</p>
          <p class="text-slate-500 text-xs mt-0.5 leading-relaxed">🎯 ${escHtml(k.target)}</p>
        </div>
        <div class="shrink-0">
          <span class="font-mono text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">${escHtml(k.objective)}</span>
        </div>
      </div>`
    )
    .join("");
}

function renderScore(criteria, total, maxTotal, percentage) {
  const container = $("score-content");
  if (!container) return;

  // Color scheme by score band
  const band = percentage >= 70 ? "green" : percentage >= 40 ? "yellow" : "red";
  const bandCfg = {
    green:  { text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", grad: "from-emerald-400 to-emerald-600", label: "Baik" },
    yellow: { text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   grad: "from-amber-400 to-amber-600",   label: "Perlu Perhatian" },
    red:    { text: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     grad: "from-red-400 to-red-600",       label: "Perlu Perbaikan" },
  };
  const cfg = bandCfg[band];

  // Arc progress (SVG circle) — r=36, circumference ≈ 226
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (percentage / 100) * circ;
  const scoreArc = `
    <svg class="w-24 h-24" viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="8"/>
      <circle cx="44" cy="44" r="${r}" fill="none"
        stroke="url(#scoreGrad)" stroke-width="8"
        stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}"
        stroke-dashoffset="${(circ / 4).toFixed(1)}"
        stroke-linecap="round"/>
      <defs>
        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" class="stop-color-start"/>
          <stop offset="100%" class="stop-color-end"/>
        </linearGradient>
      </defs>
    </svg>`;

  const scoreBgGrad = percentage >= 70 ? "#10b981" : percentage >= 40 ? "#f59e0b" : "#ef4444";

  const criteriaRows = criteria.map((c) => {
    const scoreColor = c.score === 2 ? "text-emerald-600" : c.score === 1 ? "text-amber-600" : "text-red-500";
    const barFill    = c.score === 2 ? "#10b981" : c.score === 1 ? "#f59e0b" : "#ef4444";
    const barPct     = Math.round((c.score / c.max) * 100);
    return `<div class="flex gap-3 items-start p-3.5 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition-colors">
      <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <span class="font-mono text-xs font-bold text-slate-600">${c.id}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-slate-700 text-sm font-semibold">${escHtml(c.label)}</p>
        <p class="text-slate-400 text-xs mt-0.5 leading-relaxed">${escHtml(c.reason)}</p>
      </div>
      <div class="shrink-0 text-right">
        <span class="text-base font-bold ${scoreColor}">${c.score}<span class="text-slate-300 text-xs">/${c.max}</span></span>
        <div class="w-16 bg-slate-200 rounded-full h-1.5 mt-1.5">
          <div class="h-1.5 rounded-full transition-all" style="width:${barPct}%;background:${barFill}"></div>
        </div>
      </div>
    </div>`;
  }).join("");

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl border ${cfg.border} ${cfg.bg} mb-5">
      <div class="relative shrink-0">
        <svg class="w-24 h-24" viewBox="0 0 88 88" aria-hidden="true">
          <circle cx="44" cy="44" r="36" fill="none" stroke="#e2e8f0" stroke-width="8"/>
          <circle cx="44" cy="44" r="36" fill="none"
            stroke="${scoreBgGrad}" stroke-width="8"
            stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}"
            stroke-dashoffset="${(circ / 4).toFixed(1)}"
            stroke-linecap="round"/>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-2xl font-extrabold ${cfg.text}">${percentage}%</span>
        </div>
      </div>
      <div>
        <p class="font-bold text-slate-800 text-base">${cfg.label}</p>
        <p class="text-slate-600 text-sm mt-0.5">Skor Kesesuaian Indikatif</p>
        <p class="text-slate-400 text-xs mt-1">${total} dari ${maxTotal} poin · ${criteria.length} kriteria</p>
      </div>
    </div>
    <div class="space-y-2">${criteriaRows}</div>
  `;
}

// ── Main controller ─────────────────────────────────────────────────────────

/**
 * getFormData()
 * Baca dan validasi data dari form.
 * S1.A-3: Enforces duration 1–520 and teamSize 1–500 as finite positive
 *          integers.  Decimals, zero, and out-of-range values are rejected
 *          with explicit error messages.
 * @returns {object|null} Data form atau null bila tidak valid
 */

  return Object.freeze({
    renderGovernance,
    renderCobitMappings,
    renderKPIs,
    renderScore
  });
});
