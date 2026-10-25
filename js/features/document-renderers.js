"use strict";

(function (root, factory) {
  const feature = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanDocumentRenderers = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const { $, escHtml } = root.GovPlanUtils;
function renderCharter(charter, input) {
  const c = $("charter-content");
  if (!c) return;

  // ── Shared helpers ───────────────────────────────────────────────────────
  const listHTML = (items, iconColor) => {
    if (!items || items.length === 0) return `<p class="text-sm text-slate-400 italic">Belum ditentukan</p>`;
    const color = iconColor || "text-blue-500";
    return `<ul class="space-y-1.5">${items.map((i) => `
      <li class="flex items-start gap-2 text-slate-700 text-sm">
        <svg class="w-4 h-4 ${color} shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>${escHtml(i)}</span>
      </li>`).join("")}</ul>`;
  };

  const sectionLabel = (text, color) =>
    `<p class="text-xs font-semibold uppercase tracking-widest ${color || "text-slate-500"} mb-2">${escHtml(text)}</p>`;

  const infoRow = (label, value) => {
    const display = value ? escHtml(value) : `<span class="text-slate-400 italic">Belum ditentukan</span>`;
    return `<div class="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 text-sm border-b border-slate-100 py-2 last:border-0">
      <span class="font-semibold text-slate-600 shrink-0 w-full sm:w-44">${escHtml(label)}</span>
      <span class="text-slate-700">${display}</span>
    </div>`;
  };

  // ── Section: Header / Identity ───────────────────────────────────────────
  const headerSection = `
    <div class="mb-5 p-4 bg-slate-800 text-white rounded-xl">
      <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Project Charter</p>
      <h3 class="text-base font-bold leading-tight">${escHtml(charter.project_title || input.projectName)}</h3>
    </div>
    <div class="mb-5 p-4 bg-white border border-slate-200 rounded-xl">
      ${sectionLabel("Informasi Proyek", "text-slate-500")}
      <div class="divide-y divide-slate-100">
        ${infoRow("Nama Proyek",     charter.project_title || input.projectName)}
        ${infoRow("Tanggal Mulai",   charter.start_date)}
        ${infoRow("Proyeksi Selesai (eksklusif)",charter.finish_date)}
        ${infoRow("Anggaran",        charter.budget_info || input.budgetRange)}
        ${infoRow("Project Manager", charter.pm_name)}
        ${infoRow("Metodologi",      charter.methodology)}
      </div>
    </div>`;

  // ── Section: Objective & Context ─────────────────────────────────────────
  const objectiveSection = `
    <div class="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
      ${sectionLabel("Tujuan & Latar Belakang Proyek", "text-blue-600")}
      <p class="text-slate-800 text-sm leading-relaxed">${escHtml(charter.objective)}</p>
      ${charter.project_context ? `<p class="text-slate-600 text-sm leading-relaxed mt-2 pt-2 border-t border-blue-100">${escHtml(charter.project_context)}</p>` : ""}
    </div>`;

  // ── Section: Scope ────────────────────────────────────────────────────────
  const scopeSection = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <div class="p-4 bg-white border border-slate-200 rounded-xl">
        ${sectionLabel("Dalam Lingkup", "text-emerald-600")}
        ${listHTML(charter.in_scope, "text-emerald-500")}
      </div>
      <div class="p-4 bg-white border border-slate-200 rounded-xl">
        ${sectionLabel("Luar Lingkup", "text-slate-400")}
        ${listHTML(charter.out_of_scope, "text-slate-400")}
      </div>
    </div>`;

  // ── Section: Deliverables & Success Criteria ──────────────────────────────
  const successCriteriaHTML = charter.success_criteria && charter.success_criteria.length > 0
    ? listHTML(charter.success_criteria, "text-teal-500")
    : `<p class="text-sm text-slate-400 italic">Belum ditentukan — akan disepakati bersama stakeholder</p>`;

  const deliverableSection = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <div class="p-4 bg-white border border-slate-200 rounded-xl">
        ${sectionLabel("Deliverable Utama", "text-blue-600")}
        ${listHTML(charter.deliverables, "text-blue-400")}
      </div>
      <div class="p-4 bg-teal-50 border border-teal-100 rounded-xl">
        ${sectionLabel("Kriteria Keberhasilan", "text-teal-700")}
        ${successCriteriaHTML}
      </div>
    </div>`;

  // ── Section: Stakeholders ─────────────────────────────────────────────────
  const stakeholderSection = `
    <div class="mb-5 p-4 bg-white border border-slate-200 rounded-xl">
      ${sectionLabel("Peran & Tanggung Jawab Stakeholder", "text-purple-600")}
      ${listHTML(charter.stakeholders, "text-purple-400")}
    </div>`;

  // ── Section: Milestones ───────────────────────────────────────────────────
  const milestoneSection = `
    <div class="mb-5 p-4 bg-white border border-slate-200 rounded-xl">
      ${sectionLabel("Milestone", "text-amber-600")}
      ${listHTML(charter.milestones, "text-amber-400")}
    </div>`;

  // ── Section: Approach ─────────────────────────────────────────────────────
  const methodLabel = charter.methodology || "Belum ditentukan";
  const methodDesc  = {
    "Waterfall":          "Proyek dilaksanakan secara sekuensial: setiap fase diselesaikan sebelum fase berikutnya dimulai. Perubahan lingkup dikelola melalui proses perubahan formal.",
    "Agile / Scrum":      "Proyek dilaksanakan secara iteratif dalam sprint. Deliverable dirilis secara bertahap; kebutuhan dapat disesuaikan setiap sprint.",
    "Hybrid (Waterfall + Agile)": "Perencanaan dan arsitektur mengikuti pendekatan Waterfall; eksekusi dan pengujian dilakukan secara iteratif (Agile).",
    "Other":              "Pendekatan pengembangan disesuaikan dengan kebutuhan proyek dan tim.",
  };
  const approachDetail = methodDesc[charter.methodology] || "Pendekatan pengembangan akan ditentukan pada fase inisiasi proyek.";

  const approachSection = `
    <div class="mb-5 p-4 bg-white border border-slate-200 rounded-xl">
      ${sectionLabel("Pendekatan Proyek", "text-indigo-600")}
      <p class="text-sm font-semibold text-slate-700 mb-1">${escHtml(methodLabel)}</p>
      <p class="text-sm text-slate-600 leading-relaxed">${escHtml(approachDetail)}</p>
    </div>`;

  // ── Section: Sign-off (always shown as draft placeholder) ────────────────
  const signoffSection = `
    <div class="mt-5 p-4 border-2 border-dashed border-slate-200 rounded-xl">
      ${sectionLabel("Persetujuan / Sign-off (Draft)", "text-slate-400")}
      <p class="text-xs text-slate-400 italic mb-3">Bagian ini diisi dan ditandatangani setelah charter disetujui semua pihak.</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${["Project Manager", "Product Owner / Sponsor", "Tim QA"].map((role) => `
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p class="text-xs font-semibold text-slate-500 mb-6">${escHtml(role)}</p>
            <div class="border-t border-slate-300 pt-1">
              <p class="text-xs text-slate-400">Tanda tangan &amp; tanggal</p>
            </div>
          </div>`).join("")}
      </div>
    </div>`;

  c.innerHTML =
    headerSection +
    objectiveSection +
    scopeSection +
    deliverableSection +
    stakeholderSection +
    milestoneSection +
    approachSection +
    signoffSection;
}

function renderWBS(wbs) {
  const tbody = $("wbs-tbody");
  if (!tbody) return;
  tbody.innerHTML = wbs
    .map((w) => {
      // Visual hierarchy by level
      const indent     = w.level === 2 ? "pl-6" : w.level === 3 ? "pl-10" : "";
      const rowBase    = "border-b border-slate-100 transition-colors";
      const levelStyle = w.level === 1
        ? `${rowBase} bg-blue-50/60 font-semibold`
        : w.level === 2
        ? `${rowBase} bg-white`
        : `${rowBase} bg-white text-slate-500 text-xs`;

      // Level badge
      const levelBadge = w.level === 1
        ? `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white text-[10px] font-bold">L1</span>`
        : w.level === 2
        ? `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-300 text-slate-700 text-[10px] font-bold">L2</span>`
        : `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-200 text-slate-500 text-[10px]">L3</span>`;

      return `<tr class="${levelStyle}">
        <td class="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">${escHtml(w.id)}</td>
        <td class="px-4 py-2.5 ${indent}">${escHtml(w.name)}</td>
        <td class="px-4 py-2.5 text-center">${levelBadge}</td>
        <td class="px-4 py-2.5 text-slate-600">${escHtml(w.deliverable)}</td>
        <td class="px-4 py-2.5 text-slate-600">${escHtml(w.completion_criteria)}</td>
      </tr>`;
    })
    .join("");
}

function renderRiskRegister(risks) {
  const tbody = $("risk-tbody");
  if (!tbody) return;

  const levelBadge = (lvl) => {
    const styles = {
      low:    "bg-emerald-100 text-emerald-800 border border-emerald-200",
      medium: "bg-amber-100 text-amber-800 border border-amber-200",
      high:   "bg-red-100 text-red-800 border border-red-200",
    };
    const label = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
    const dot   = { low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-red-500" };
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${styles[lvl] || "bg-slate-100 text-slate-700"}">
      <span class="w-1.5 h-1.5 rounded-full ${dot[lvl] || "bg-slate-400"} inline-block"></span>
      ${label[lvl] || lvl}
    </span>`;
  };

  tbody.innerHTML = risks
    .map(
      (r) => `<tr class="border-b border-slate-100 transition-colors">
        <td class="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">${escHtml(r.id)}</td>
        <td class="px-4 py-3 text-sm">${escHtml(r.description)}</td>
        <td class="px-4 py-3 text-center whitespace-nowrap">${levelBadge(r.probability)}</td>
        <td class="px-4 py-3 text-center whitespace-nowrap">${levelBadge(r.impact)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${escHtml(r.mitigation)}</td>
      </tr>`
    )
    .join("");
}

/**
 * renderCostEstimate(costs, summary)
 * Render the cost estimate table rows and wire up all editable inputs.
 * Each data row has: Kategori | Jam | Tarif | Non-Labor | Total Baris
 * The tfoot shows: Subtotal | Cadangan (editable %) | Total Estimasi Akhir
 *
 * @param {Array}  costs    Array of cost_estimate items from currentDoc
 * @param {object} summary  { contingency_pct, cost_subtotal, contingency_reserve, grand_total }
 */

  return Object.freeze({
    renderCharter,
    renderWBS,
    renderRiskRegister
  });
});
