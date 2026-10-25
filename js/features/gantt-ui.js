"use strict";

(function (root, factory) {
  const feature = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanGanttUI = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const { $, escHtml } = root.GovPlanUtils;
function renderGantt(ganttData, input) {
  const container = $("gantt-content");
  if (!container) return;

  if (!ganttData || !Array.isArray(ganttData.tasks)) {
    container.innerHTML = '<p class="text-amber-800 italic text-sm py-4" role="status">Jadwal parsial: data Gantt tidak valid.</p>';
    return;
  }

  const { tasks, projectEndWeek, hasCalendarDates, originDate } = ganttData;

  if (!tasks || tasks.length === 0) {
    const reason = (ganttData.errors || []).join(" ");
    container.innerHTML = `<p class="text-slate-400 italic text-sm py-4">${escHtml(reason || "Gantt tidak tersedia untuk dokumen ini.")}</p>`;
    return;
  }

  // ── Layout constants ─────────────────────────────────────────────────────
  const LABEL_W    = 320;   // px — WBS ID and task label column
  const ROW_H      = 34;    // px — row height
  const BAR_H      = 20;    // px — bar height within row
  const HEADER_H   = 38;    // px — time axis header height
  const useMonthTicks = projectEndWeek > 12;
  const CHART_W    = Math.min(1600, Math.max(900, projectEndWeek * 42));
  const SVG_W      = LABEL_W + CHART_W;
  const SVG_H      = HEADER_H + tasks.length * ROW_H + 20; // +20 bottom pad

  const totalW = projectEndWeek;

  // Week → px
  const xOf = (week) => LABEL_W + (week / totalW) * CHART_W;

  // Colour palette per structural role
  const barColor = (t, idx) => {
    if (t.isBuffer)                                       return "#94a3b8"; // slate-400 — buffer
    if (t.isMilestone)                                    return "#7c3aed"; // purple
    const name = t.name.toLowerCase();
    if (name.includes("inisiasi") || name.includes("perencanaan")) return "#1e40af"; // blue
    if (name.includes("pengujian") || name.includes("qa"))         return "#dc2626"; // red
    if (name.includes("penutupan") || name.includes("closing"))    return "#475569"; // slate
    // Pengembangan — cycle through teal shades
    const devColors = ["#0d9488", "#0891b2", "#047857", "#0369a1", "#065f46"];
    return devColors[idx % devColors.length];
  };

  // Projects over 12 weeks use calendar-month ticks; shorter projects use weeks.
  const ticks = [];
  if (useMonthTicks && hasCalendarDates && originDate) {
    ticks.push(0);
    const monthCursor = new Date(Date.UTC(originDate.getUTCFullYear(), originDate.getUTCMonth() + 1, 1));
    while ((monthCursor - originDate) / (7 * 24 * 60 * 60 * 1000) < totalW) {
      ticks.push((monthCursor - originDate) / (7 * 24 * 60 * 60 * 1000));
      monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
    }
    if (ticks.length > 1 && totalW - ticks[ticks.length - 1] < 0.75) ticks.pop();
    ticks.push(totalW);
  } else {
    const tickInterval = useMonthTicks ? 4 : 1;
    for (let week = 0; week <= totalW; week += tickInterval) ticks.push(week);
    if (ticks[ticks.length - 1] < totalW) ticks.push(totalW);
  }

  // ── Generate tick labels ──────────────────────────────────────────────────
  const tickLabel = (w) => {
    if (useMonthTicks && hasCalendarDates && originDate) {
      const d = new Date(originDate);
      d.setUTCDate(d.getUTCDate() + Math.round(w * 7));
      return d.toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: "UTC" });
    }
    if (hasCalendarDates && originDate) {
      const d = new Date(originDate);
      d.setUTCDate(d.getUTCDate() + Math.round(w * 7));
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
    }
    return useMonthTicks ? `Bulan ${Math.floor(w / 4) + 1}` : `Minggu ${w}`;
  };

  // ── Build SVG rows ────────────────────────────────────────────────────────
  const rowsSVG = tasks.map((t, idx) => {
    const y       = HEADER_H + idx * ROW_H;
    const barX    = xOf(t.startWeek);
    const barW    = Math.max(4, xOf(t.endWeek) - xOf(t.startWeek));
    const rowBarH = t.isSummary ? 24 : t.level === 1 ? BAR_H : 16;
    const rowBarY = y + (ROW_H - rowBarH) / 2;
    const midY    = y + ROW_H / 2;
    const color   = barColor(t, idx);

    // Background alternating stripe
    const stripe = idx % 2 === 0
      ? `<rect x="0" y="${y}" width="${SVG_W}" height="${ROW_H}" fill="#f8fafc"/>`
      : `<rect x="0" y="${y}" width="${SVG_W}" height="${ROW_H}" fill="#ffffff"/>`;

    // Label (truncated at LABEL_W - 12 px)
    const indent = Math.max(0, Number(t.level) - 1) * 12;
    const labelId = `<text x="8" y="${midY + 4.5}" font-family="ui-monospace,monospace"
        font-size="10" fill="#64748b">${escHtml(t.isBuffer ? "—" : t.wbsId || t.id)}</text>`;
    const label = `<text x="${58 + indent}" y="${midY + 4.5}" font-family="Inter,system-ui,sans-serif"
        font-size="11" fill="#334155" class="gantt-label">${escHtml(t.name.length > 27 ? t.name.slice(0, 25) + "…" : t.name)}</text>`;
    const parentAttr = t.parentId ? escHtml(t.parentId) : "";
    const hidden = "";
    const barClass = t.isSummary ? "gantt-summary-bar" : "gantt-task-bar";

    let barEl;
    if (t.isBuffer) {
      // Schedule Buffer: hatched grey bar to distinguish from work
      barEl = `
        <rect class="${barClass}" x="${barX}" y="${rowBarY}" width="${barW}" height="${rowBarH}"
          rx="4" ry="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 2"/>
        <text x="${barX + barW + 5}" y="${midY + 4}" font-family="Inter,system-ui,sans-serif"
          font-size="10" fill="#94a3b8" font-style="italic">${t.durationWeeks}w float</text>`;
    } else if (t.isMilestone) {
      // Closing phase: draw the activity bar + a milestone diamond pinned at project end (endWeek = totalWeeks)
      const DS = 9; // diamond half-size
      const diamondX = Math.min(xOf(t.endWeek), LABEL_W + CHART_W - DS - 2);
      barEl = `
        <rect class="${barClass}" x="${barX}" y="${rowBarY}" width="${barW}" height="${rowBarH}"
          rx="4" ry="4" fill="${color}" opacity="0.55"/>
        <polygon points="${diamondX},${midY - DS} ${diamondX + DS},${midY} ${diamondX},${midY + DS} ${diamondX - DS},${midY}"
          fill="${color}" opacity="0.95"/>
        <text x="${diamondX + DS + 4}" y="${midY + 4}" font-family="Inter,system-ui,sans-serif"
          font-size="10" fill="${color}" font-weight="600">Milestone</text>`;
    } else {
      // Standard work bar
      barEl = `
        <rect class="${barClass}" x="${barX}" y="${rowBarY}" width="${barW}" height="${rowBarH}"
          rx="4" ry="4" fill="${color}" opacity="0.88"/>
        <text x="${barX + barW + 5}" y="${midY + 4}" font-family="Inter,system-ui,sans-serif"
          font-size="10" fill="#64748b">${t.durationWeeks}w</text>`;
    }

    // Vertical separator after label column
    const sep = `<line x1="${LABEL_W}" y1="${y}" x2="${LABEL_W}" y2="${y + ROW_H}" stroke="#e2e8f0" stroke-width="1"/>`;

    return `<g data-gantt-task-id="${escHtml(t.id)}" data-gantt-parent-id="${parentAttr}" data-gantt-level="${escHtml(t.level)}"${hidden}>${stripe}${labelId}${label}${sep}${barEl}</g>`;
  }).join("\n");

  const rowIndex = new Map(tasks.map((task, index) => [task.id, index]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dependenciesSVG = tasks.flatMap((task) =>
    (task.dependencies || []).map((dependency) => {
      const predecessorIndex = rowIndex.get(dependency.predecessorId);
      const taskIndex = rowIndex.get(task.id);
      const predecessor = taskById.get(dependency.predecessorId);
      if (predecessorIndex === undefined || taskIndex === undefined || !predecessor) return "";
      const sourceWeek = dependency.type === "FS" ? predecessor.endWeek : predecessor.startWeek;
      const x1 = xOf(sourceWeek + dependency.lagWeeks);
      const y1 = HEADER_H + predecessorIndex * ROW_H + ROW_H / 2;
      const x2 = xOf(task.startWeek);
      const y2 = HEADER_H + taskIndex * ROW_H + ROW_H / 2;
      return `<g data-gantt-dependency-task-id="${escHtml(task.id)}" data-gantt-dependency-predecessor-id="${escHtml(dependency.predecessorId)}">
        <path d="M ${x1} ${y1} H ${Math.max(x1 + 4, x2 - 5)} V ${y2} H ${x2 - 2}"
          fill="none" stroke="#64748b" stroke-width="1.2" stroke-dasharray="${dependency.type === "SS" ? "3 2" : "none"}"
          marker-end="url(#gantt-arrow)"><title>${escHtml(dependency.type)} ${escHtml(dependency.predecessorId)} → ${escHtml(task.id)}; lag/lead ${dependency.lagWeeks} minggu</title></path>
      </g>`;
    })
  ).join("\n");

  // ── Time axis ─────────────────────────────────────────────────────────────
  const ticksSVG = ticks.map((w) => {
    const x = xOf(w);
    const lbl = tickLabel(w);
    return `
      <line x1="${x}" y1="${HEADER_H - 6}" x2="${x}" y2="${SVG_H - 20}" stroke="#e2e8f0" stroke-width="1"/>
      <text x="${x}" y="${HEADER_H - 10}" text-anchor="middle" font-family="Inter,system-ui,sans-serif"
        font-size="10" fill="#94a3b8">${lbl}</text>`;
  }).join("\n");

  // Axis baseline
  const axisLine = `<line x1="${LABEL_W}" y1="${HEADER_H}" x2="${SVG_W}" y2="${HEADER_H}" stroke="#cbd5e1" stroke-width="1.5"/>`;
  const labelHeaders = `
    <text x="8" y="24" font-family="Inter,system-ui,sans-serif" font-size="10" font-weight="700" fill="#64748b">WBS ID</text>
    <text x="58" y="24" font-family="Inter,system-ui,sans-serif" font-size="10" font-weight="700" fill="#64748b">TUGAS / AKTIVITAS</text>`;

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendSVG = `
    <rect class="gantt-summary-bar" x="${LABEL_W + 8}" y="6" width="16" height="10" rx="2" fill="#0d9488"/>
    <text x="${LABEL_W + 29}" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#64748b">Fase / ringkasan</text>
    <rect class="gantt-task-bar" x="${LABEL_W + 130}" y="6" width="16" height="10" rx="2" fill="#0d9488"/>
    <text x="${LABEL_W + 151}" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#64748b">Aktivitas / work package</text>
    <polygon points="${LABEL_W + 300},11 ${LABEL_W + 309},6 ${LABEL_W + 318},11 ${LABEL_W + 309},16"
      fill="#7c3aed" opacity="0.9"/>
    <text x="${LABEL_W + 324}" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#64748b">Milestone</text>
    <rect x="${LABEL_W + 405}" y="6" width="14" height="10" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 2"/>
    <text x="${LABEL_W + 424}" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#94a3b8" font-style="italic">Buffer</text>
    <line x1="${LABEL_W + 510}" y1="11" x2="${LABEL_W + 534}" y2="11" stroke="#64748b" stroke-width="1.2"/>
    <text x="${LABEL_W + 539}" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#64748b">FS</text>
    <line x1="${LABEL_W + 569}" y1="11" x2="${LABEL_W + 593}" y2="11" stroke="#64748b" stroke-width="1.2" stroke-dasharray="3 2"/>
    <text x="${LABEL_W + 598}" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#64748b">SS</text>`;

  // ── Compose SVG ───────────────────────────────────────────────────────────
  const svgContent = `
    <defs>
      <marker id="gantt-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 z" fill="#64748b"/>
      </marker>
    </defs>
    ${legendSVG}
    ${labelHeaders}
    ${ticksSVG}
    ${axisLine}
    ${rowsSVG}
    ${dependenciesSVG}
    <line x1="${LABEL_W}" y1="0" x2="${LABEL_W}" y2="${SVG_H}" stroke="#e2e8f0" stroke-width="1"/>`;

  const disclaimer = hasCalendarDates
    ? `Jadwal di atas adalah <strong>estimasi sistem, belum disetujui</strong>. Start Date inklusif; Finish Date eksklusif (tanggal mulai + durasi).`
    : `Tanggal mulai proyek belum ditentukan. Jadwal menggunakan <strong>minggu relatif</strong> tanpa membuat tanggal kalender. Estimasi sistem belum disetujui.`;
  const scheduleWarnings = (ganttData.errors || []).length
    ? `<div class="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="status">
        <strong>Jadwal parsial:</strong> ${ganttData.errors.map(escHtml).join(" ")}
      </div>`
    : "";

  // ── Detail table HTML ──────────────────────────────────────────────────────
  const detailRows = tasks.map((t) => {
    const startLabel = t.startDateStr || `Minggu ${t.startWeek}`;
    const endLabel   = t.endDateStr   || `Minggu ${t.endWeek}`;
    const children = tasks.filter((child) => child.parentId === t.id);
    const toggle = children.length
      ? `<button type="button" data-gantt-toggle="${escHtml(t.id)}" aria-expanded="true"
          aria-label="Ciutkan turunan WBS ${escHtml(t.id)}" title="Ciutkan atau perluas turunan WBS"
          class="gantt-toggle mr-1 text-indigo-600 hover:text-indigo-900">−</button>`
      : "";
    const predecessorLabel = (t.dependencies || []).map((dependency) => {
      const predecessor = taskById.get(dependency.predecessorId);
      return predecessor ? `${dependency.predecessorId} ${predecessor.name}` : dependency.predecessorId;
    }).join("; ");
    const dependencyLabel = (t.dependencies || []).map((dependency) => dependency.type).join("; ");
    const lagLabel = (t.dependencies || []).map((dependency) =>
      `${dependency.lagWeeks > 0 ? "+" : ""}${dependency.lagWeeks}`
    ).join("; ");
    const rowType = t.isBuffer
      ? "Buffer (non-kerja)"
      : `${t.type || "WBS"} (Level ${t.level})`;
    const rowClass = t.isBuffer ? "border-b border-slate-100 bg-slate-50 opacity-70" : "border-b border-slate-100";
    const hidden = "";
    const summaryClass = t.isSummary ? " gantt-summary-row" : "";
    return `<tr class="${rowClass}${summaryClass}" data-gantt-row-id="${escHtml(t.id)}" data-gantt-parent-id="${escHtml(t.parentId || "")}" data-gantt-level="${escHtml(t.level)}"${hidden}>
      <td class="px-3 py-2 font-mono text-xs text-slate-500">${escHtml(t.isBuffer ? "—" : t.wbsId || t.id)}</td>
      <td class="px-3 py-2 text-sm ${t.isBuffer ? "text-slate-400 italic" : "text-slate-700 font-medium"}" style="padding-left:${12 + Math.max(0, Number(t.level) - 1) * 18}px">${toggle}${escHtml(t.name)}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${escHtml(rowType)}</td>
      <td class="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">${escHtml(startLabel)}</td>
      <td class="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">${escHtml(endLabel)}</td>
      <td class="px-3 py-2 text-xs text-slate-500 text-center">${t.durationWeeks} minggu</td>
      <td class="px-3 py-2 text-xs text-slate-600">${escHtml(predecessorLabel || "—")}</td>
      <td class="px-3 py-2 text-xs text-slate-600 text-center">${escHtml(dependencyLabel || "—")}</td>
      <td class="px-3 py-2 text-xs text-slate-600 text-center">${escHtml(lagLabel || "0")}</td>
      <td class="px-3 py-2 text-xs text-slate-400 italic">${escHtml(t.scheduleBasis || t.assumption || "Estimasi sistem.")}</td>
    </tr>`;
  }).join("");

  container.innerHTML = `
    ${scheduleWarnings}
    <!-- Disclaimer -->
    <div class="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
      <svg class="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span>${disclaimer}</span>
    </div>

    <!-- Gantt SVG (scrollable) -->
    <div class="gantt-scroll-wrap">
      <svg id="gantt-svg" xmlns="http://www.w3.org/2000/svg"
        width="${SVG_W}" height="${SVG_H}"
        viewBox="0 0 ${SVG_W} ${SVG_H}"
        role="img" aria-label="Gantt Chart Proyek"
        class="gantt-svg">
        <title>Gantt Chart — Jadwal Proyek</title>
        ${svgContent}
      </svg>
    </div>

    <!-- Detail table -->
    <div class="mt-5">
      <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Rincian Jadwal WBS</p>
      <div class="table-wrap rounded-xl border border-slate-200 overflow-hidden">
        <table class="data-table gantt-detail-table w-full text-sm border-collapse">
          <thead>
            <tr class="bg-indigo-600 text-white text-left text-xs font-semibold uppercase tracking-wide">
              <th class="px-3 py-2.5">WBS ID</th>
              <th class="px-3 py-2.5">Task</th>
              <th class="px-3 py-2.5">Type / Level</th>
              <th class="px-3 py-2.5 whitespace-nowrap">Start Date (inclusive)</th>
              <th class="px-3 py-2.5 whitespace-nowrap">Finish Date (exclusive)</th>
              <th class="px-3 py-2.5 text-center">Duration</th>
              <th class="px-3 py-2.5">Predecessor</th>
              <th class="px-3 py-2.5">Dependency Type</th>
              <th class="px-3 py-2.5">Lag/Lead (weeks)</th>
              <th class="px-3 py-2.5">Schedule Basis</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
    </div>`;

  const expandableIds = new Set(tasks
    .filter((task) => tasks.some((candidate) => candidate.parentId === task.id))
    .map((task) => task.id));
  const expandedIds = new Set(expandableIds);
  const visibleTask = (task) => {
    let parentId = task.parentId;
    while (parentId) {
      if (!expandedIds.has(parentId)) return false;
      parentId = taskById.get(parentId)?.parentId;
    }
    return true;
  };
  const updateHierarchyVisibility = () => {
    for (const task of tasks) {
      const visible = visibleTask(task);
      const chartRow = container.querySelector(`[data-gantt-task-id="${CSS.escape(task.id)}"]`);
      const tableRow = container.querySelector(`[data-gantt-row-id="${CSS.escape(task.id)}"]`);
      if (chartRow) chartRow.style.display = visible ? "" : "none";
      if (tableRow) tableRow.style.display = visible ? "table-row" : "none";
    }
    for (const edge of container.querySelectorAll("[data-gantt-dependency-task-id]")) {
      const task = taskById.get(edge.dataset.ganttDependencyTaskId);
      const predecessor = taskById.get(edge.dataset.ganttDependencyPredecessorId);
      const visible = Boolean(task && predecessor && visibleTask(task) && visibleTask(predecessor));
      edge.style.display = visible ? "" : "none";
    }
    for (const button of container.querySelectorAll("[data-gantt-toggle]")) {
      const expanded = expandedIds.has(button.dataset.ganttToggle);
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute(
        "aria-label",
        `${expanded ? "Ciutkan" : "Perluas"} turunan WBS ${button.dataset.ganttToggle}`,
      );
      button.textContent = expanded ? "−" : "+";
    }
  };
  container.querySelectorAll("[data-gantt-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.ganttToggle;
      if (expandedIds.has(taskId)) expandedIds.delete(taskId);
      else expandedIds.add(taskId);
      updateHierarchyVisibility();
    });
  });
}

// ── Render dokumen ──────────────────────────────────────────────────────────

  return Object.freeze({
    renderGantt
  });
});
