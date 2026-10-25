"use strict";

(function (root, factory) {
  const feature = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanExportUI = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const { $ } = root.GovPlanUtils;
  const projectStore = root.GovPlanProjectStore;
function exportCSV(section) {
  const currentDoc = projectStore.getDocument();
  if (!currentDoc) return;

  let rows = [];
  let filename = "export.csv";

  if (section === "charter") {
    filename = "project_charter.csv";
    const c = currentDoc.charter;
    rows = [
      ["Bagian", "Konten"],
      // identity / header fields (Phase 2A)
      ["Nama Proyek",      c.project_title  || ""],
      ["Tanggal Mulai",    c.start_date     || ""],
      ["Proyeksi Selesai (eksklusif)", c.finish_date    || ""],
      ["Anggaran",         c.budget_info    || ""],
      ["Project Manager",  c.pm_name        || ""],
      ["Metodologi",       c.methodology    || ""],
      // core charter content
      ["Tujuan", c.objective],
      ...(c.project_context ? [["Konteks Proyek", c.project_context]] : []),
      ...c.in_scope.map((s) => ["Dalam Lingkup", s]),
      ...c.out_of_scope.map((s) => ["Luar Lingkup", s]),
      ...c.deliverables.map((s) => ["Deliverable Utama", s]),
      ...((c.success_criteria || []).map((s) => ["Kriteria Keberhasilan", s])),
      ...c.stakeholders.map((s) => ["Stakeholder", s]),
      ...c.milestones.map((s) => ["Milestone", s]),
    ];
  } else if (section === "wbs") {
    filename = "wbs.csv";
    rows = [["ID", "Nama", "Level", "Deliverable", "Kriteria Penyelesaian"]];
    rows.push(...currentDoc.wbs.map((w) => [w.id, w.name, w.level, w.deliverable, w.completion_criteria]));
  } else if (section === "risk") {
    filename = "risk_register.csv";
    rows = [["ID", "Deskripsi", "Probabilitas", "Dampak", "Mitigasi"]];
    rows.push(...currentDoc.risk_register.map((r) => [r.id, r.description, r.probability, r.impact, r.mitigation]));
  } else if (section === "cost") {
    filename = "estimasi_biaya.csv";
    rows = [["Kategori", "Jam (Hours)", "Tarif (IDR/jam)", "Biaya Tenaga Kerja (IDR)", "Biaya Non-Tenaga Kerja (IDR)", "Total Baris (IDR)"]];
    rows.push(...currentDoc.cost_estimate.map((c) => [
      c.category,
      c.hours,
      c.rate,
      c.subtotal,
      c.non_labor ?? 0,
      c.row_total ?? c.subtotal,
    ]));
    // Summary rows — read from currentDoc.cost_summary (kept in sync by updateCostSummary)
    const cs = currentDoc.cost_summary || {};
    rows.push(["Subtotal", "", "", "", "", cs.cost_subtotal ?? ""]);
    rows.push([`Cadangan Risiko (${cs.contingency_pct ?? 10}%)`, "", "", "", "", cs.contingency_reserve ?? ""]);
    rows.push(["Total Estimasi Akhir", "", "", "", "", cs.grand_total ?? ""]);
  } else if (section === "governance") {
    filename = "governance_review.csv";
    rows = [["Kode COBIT", "Nama Objective", "Alasan Pemetaan"]];
    if (currentDoc._governance) {
      rows.push(...currentDoc._governance.mappings.map((m) => [m.code, m.name, m.reason]));
    }
  } else if (section === "gantt") {
    filename = "gantt_schedule.csv";
    rows = [[
      "WBS ID",
      "Parent WBS ID",
      "Task",
      "Level",
      "Start Date (inclusive)",
      "Finish Date (exclusive)",
      "Duration (weeks)",
      "Predecessor",
      "Dependency Type",
      "Lag/Lead (weeks)",
      "Schedule Basis",
    ]];
    rows.push(["Convention", "", "Start Date is inclusive; Finish Date is exclusive at start + requested duration. System estimates are not approved project baselines.", "", "", "", "", "", "", "", ""]);
    for (const task of currentDoc._gantt?.tasks || []) {
      const predecessorNames = (task.dependencies || []).map((dependency) => {
        const predecessor = currentDoc._gantt.tasks.find((candidate) => candidate.id === dependency.predecessorId);
        return predecessor ? `${dependency.predecessorId} ${predecessor.name}` : dependency.predecessorId;
      }).join("; ");
      rows.push([
        task.isBuffer ? "BUFFER" : task.wbsId || task.id,
        task.parentId || "",
        task.name,
        task.level || "",
        task.startDateStr || `Week ${task.startWeek}`,
        task.endDateStr || `Week ${task.endWeek}`,
        task.durationWeeks,
        predecessorNames || "",
        task.dependencyType || "",
        task.lagWeeks ?? 0,
        task.scheduleBasis || task.assumption || "",
      ]);
    }
  }

  const csvContent = rows
    .map((row) =>
      row.map((cell) => {
        let value = String(cell ?? "");
        if (typeof cell === "string" && /^[\t\r\n ]*[=+\-@]/.test(cell)) value = `'${value}`;
        return `"${value.replace(/"/g, '""')}"`;
      }).join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Render helpers ──────────────────────────────────────────────────────────

  function bindExportControls(exporter = exportCSV) {
    for (const [id, section] of [
      ["export-charter", "charter"],
      ["export-wbs", "wbs"],
      ["export-risk", "risk"],
      ["export-cost", "cost"],
      ["export-governance", "governance"],
      ["export-gantt", "gantt"],
    ]) {
      $(id)?.addEventListener("click", () => exporter(section));
    }
    $("overview-content")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-export-section]");
      if (button) exporter(button.dataset.exportSection);
    });
  }

  return Object.freeze({
    exportCSV,
    bindExportControls
  });
});
