"use strict";

(function (root, factory) {
  const feature = factory(root.GovPlanUtils);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanGanttFeature = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (utils) {
  const { parseProjectDate, projectDateAtWeek, formatProjectDate } = utils;
/**
 * buildGanttSchedule(wbs, input)
 *
 * Derives a Gantt schedule from the WBS L1 phases and the Charter date/duration.
 *
 * Algorithm:
 *  1. Extract L1 phases from the WBS array (level === 1 items).
 *  2. Assign deterministic weights:
 *     - Inisiasi:    12% of total duration (always first slot)
 *     - Penutupan:   10% of total duration (always last slot)
 *     - Pengujian:   15% of total duration (always second-to-last)
 *     - Pengembangan phases: remaining 63% split equally across dev phases
 *  3. Sequence tasks with overlap rules:
 *     - Dev phases overlap by 15% (next starts when current is 85% done).
 *     - Testing starts strictly after last dev phase finishes (no overlap).
 *     - Penutupan starts strictly after testing finishes.
 *  4. All durations are in fractional weeks (rounded to 1 decimal for display).
 *  5. All dates clamped so no task exceeds projectEnd.
 *  6. When startDate is absent, use week offsets (no invented calendar dates).
 *
 * @param {object[]} wbs    WBS array (same schema as currentDoc.wbs)
 * @param {object}   input  Form input { startDate, duration, ... }
 * @returns {object}  { tasks, startDate, projectEndWeek, hasCalendarDates }
 *
 * Each task: { id, name, isMilestone, startWeek, endWeek, durationWeeks,
 *              startDate?, endDate?, assumption }
 */
function buildPhaseSchedule(wbs, input) {
  const requestedWeeks = Number(input?.duration);
  const totalWeeks = Number.isInteger(requestedWeeks) && requestedWeeks >= 1 && requestedWeeks <= 520
    ? requestedWeeks
    : 1;
  const originDate = parseProjectDate(input?.startDate);
  const hasCalendarDates = !!originDate;

  // ── Extract L1 phases in order ───────────────────────────────────────────
  const l1Phases = (Array.isArray(wbs) ? wbs : [])
    .filter((w) => w && Number(w.level) === 1 && typeof w.name === "string" && w.name.trim())
    .map((w) => w.name.trim());

  if (l1Phases.length === 0) return { tasks: [], startDate: null, projectEndWeek: totalWeeks, hasCalendarDates };

  // ── Identify structural roles ────────────────────────────────────────────
  // Inisiasi is always first, Penutupan is always last, Pengujian is second-to-last.
  // Everything between them is Pengembangan.
  const initiationIdx = 0;
  const closingIdx    = l1Phases.length - 1;
  const testingIdx    = l1Phases.length - 2;
  const devIndices    = [];
  for (let i = 1; i < l1Phases.length - 2; i++) devIndices.push(i);
  // Fallback: if only 1 or 2 phases exist, treat all as dev
  const hasTestingPhase  = l1Phases.length >= 3;
  const hasClosingPhase  = l1Phases.length >= 2;

  // ── Compute durations (in weeks) per phase ───────────────────────────────
  const W_INIT    = 0.12;
  const W_TEST    = hasTestingPhase  ? 0.15 : 0;
  const W_CLOSE   = hasClosingPhase  ? 0.10 : 0;
  const W_DEV_TOT = Math.max(0, 1 - W_INIT - W_TEST - W_CLOSE);
  const devCount  = devIndices.length || 1;
  const W_DEV_EACH = W_DEV_TOT / devCount;

  // Map phase index → duration in weeks
  const phaseDurationWeeks = l1Phases.map((_, idx) => {
    if (idx === initiationIdx)                         return Math.max(0.1, Math.round(W_INIT * totalWeeks * 10) / 10);
    if (hasTestingPhase  && idx === testingIdx)        return Math.max(0.1, Math.round(W_TEST * totalWeeks * 10) / 10);
    if (hasClosingPhase  && idx === closingIdx)        return Math.max(0.1, Math.round(W_CLOSE * totalWeeks * 10) / 10);
    return Math.max(0.1, Math.round(W_DEV_EACH * totalWeeks * 10) / 10);
  });

  // ── Schedule phases (with 15% dev-to-dev overlap) ────────────────────────
  // OVERLAP_FACTOR: next dev phase starts when current is this fraction done.
  const OVERLAP_FACTOR = 0.85;

  const startWeeks  = new Array(l1Phases.length).fill(0);
  const endWeeks    = new Array(l1Phases.length).fill(0);

  // Inisiasi starts at week 0
  startWeeks[initiationIdx] = 0;
  endWeeks[initiationIdx]   = phaseDurationWeeks[initiationIdx];

  if (l1Phases.length === 1) {
    // Single phase — fits the full duration
    endWeeks[0] = totalWeeks;
  } else if (devIndices.length === 0) {
    // Only init + optional testing + closing
    let cursor = endWeeks[initiationIdx];
    for (let i = 1; i < l1Phases.length; i++) {
      startWeeks[i] = cursor;
      endWeeks[i]   = Math.min(totalWeeks, cursor + phaseDurationWeeks[i]);
      cursor = endWeeks[i];
    }
  } else {
    // Normal multi-phase schedule
    // Dev phases: first dev starts after init; subsequent devs overlap at OVERLAP_FACTOR
    let devCursor = endWeeks[initiationIdx];
    devIndices.forEach((idx, di) => {
      startWeeks[idx] = devCursor;
      endWeeks[idx]   = Math.min(totalWeeks, startWeeks[idx] + phaseDurationWeeks[idx]);
      // Next dev starts after OVERLAP_FACTOR of this dev's duration
      devCursor = startWeeks[idx] + phaseDurationWeeks[idx] * OVERLAP_FACTOR;
    });

    // Identify actual end of last dev phase for testing start
    const lastDevEnd = endWeeks[devIndices[devIndices.length - 1]];

    if (hasTestingPhase) {
      startWeeks[testingIdx] = lastDevEnd;
      endWeeks[testingIdx]   = Math.min(totalWeeks, lastDevEnd + phaseDurationWeeks[testingIdx]);
    }
    if (hasClosingPhase) {
      const testEnd = hasTestingPhase ? endWeeks[testingIdx] : lastDevEnd;
      startWeeks[closingIdx] = testEnd;
      endWeeks[closingIdx]   = Math.min(totalWeeks, testEnd + phaseDurationWeeks[closingIdx]);
    }
  }

  // ── Pin the closing milestone exactly to the planned project end ──────────
  // Rounding of individual phase durations can leave a gap of up to ~1 week
  // between the last activity and the project end. The closing task/milestone
  // is pinned to totalWeeks so the Gantt end matches the Charter finish date.
  // The gap (if any) is surfaced as an explicit "Schedule Buffer" row.
  let bufferWeeks = 0;
  if (hasClosingPhase) {
    const lastWorkEnd = endWeeks[closingIdx]; // before pinning
    bufferWeeks = Math.round((totalWeeks - lastWorkEnd) * 10) / 10;
    // Move the closing phase to end exactly at totalWeeks
    if (bufferWeeks > 0) {
      startWeeks[closingIdx] = Math.round((startWeeks[closingIdx] + bufferWeeks) * 10) / 10;
      endWeeks[closingIdx]   = totalWeeks;
    }
  }

  // ── Convert weeks to calendar dates if startDate provided ────────────────
  const weekToDate = (weeks) => {
    if (!originDate) return null;
    return projectDateAtWeek(input.startDate, weeks);
  };

  const fmtDate = (d) =>
    d ? formatProjectDate(d, "short") : null;

  // ── Build task objects ────────────────────────────────────────────────────
  const tasks = l1Phases.map((name, idx) => {
    const rawStart = Math.round(startWeeks[idx] * 10) / 10;
    const rawEnd = Math.round(endWeeks[idx] * 10) / 10;
    const sw = Math.min(totalWeeks, Math.max(0, rawStart));
    const ew = Math.min(totalWeeks, Math.max(sw, rawEnd));
    const dur = Math.round((ew - sw) * 10) / 10;

    // Closing phase (last index) is the project milestone marker.
    const isMilestone = (idx === closingIdx && (hasClosingPhase || l1Phases.length === 1));

    // Scheduling assumption label
    let assumption;
    if (l1Phases.length === 1)
      assumption = "Fase WBS tunggal; milestone penyelesaian berada pada akhir durasi proyek";
    else if (idx === initiationIdx)
      assumption = `Estimasi: ${Math.round(W_INIT * 100)}% durasi total`;
    else if (hasTestingPhase && idx === testingIdx)
      assumption = `Estimasi: ${Math.round(W_TEST * 100)}% durasi total; dimulai setelah semua pengembangan selesai`;
    else if (hasClosingPhase && idx === closingIdx)
      assumption = `Estimasi: ${Math.round(W_CLOSE * 100)}% durasi total; milestone selesai tepat pada akhir durasi proyek`;
    else {
      const overlapNote = devIndices.indexOf(idx) > 0 ? `; overlap 15% dengan fase sebelumnya` : `; dimulai setelah inisiasi`;
      assumption = `Estimasi: ${Math.round(W_DEV_EACH * 100)}% durasi total per deliverable${overlapNote}`;
    }

    const sd = weekToDate(sw);
    const ed = weekToDate(ew);

    return {
      id:            String(idx + 1),
      name,
      isMilestone,
      startWeek:     sw,
      endWeek:       ew,
      durationWeeks: dur,
      startDate:     sd,
      endDate:       ed,
      startDateStr:  fmtDate(sd),
      endDateStr:    fmtDate(ed),
      assumption,
    };
  });

  // ── Inject Schedule Buffer row if the gap is meaningful (≥ 0.5 weeks) ───
  // The buffer sits between the last work activity and the closing phase.
  // It is NOT a work task — it represents planned contingency/float time.
  if (hasClosingPhase && bufferWeeks >= 0.5) {
    const bufStartWeek = Math.round((startWeeks[closingIdx] - bufferWeeks) * 10) / 10;
    const bufEndWeek   = startWeeks[closingIdx];
    const bufSD = weekToDate(bufStartWeek);
    const bufED = weekToDate(bufEndWeek);
    // Insert immediately before the closing task (second-to-last position)
    tasks.splice(tasks.length - 1, 0, {
      id:            `${tasks.length}b`,
      name:          "Schedule Buffer (Cadangan Waktu)",
      isMilestone:   false,
      isBuffer:      true,          // renderer uses this to style differently
      startWeek:     bufStartWeek,
      endWeek:       bufEndWeek,
      durationWeeks: bufferWeeks,
      startDate:     bufSD,
      endDate:       bufED,
      startDateStr:  fmtDate(bufSD),
      endDateStr:    fmtDate(bufED),
      assumption:    `Cadangan waktu estimasi (float); bukan aktivitas kerja. Muncul karena pembulatan alokasi durasi fase.`,
    });
  }

  // ── Final validation guard ───────────────────────────────────────────────
  // Ensure no task has negative duration or exceeds project horizon.
  tasks.forEach((t) => {
    if (t.endWeek > totalWeeks) t.endWeek = totalWeeks;
    if (t.startWeek > totalWeeks) t.startWeek = totalWeeks;
    t.startWeek = Math.max(0, t.startWeek);
    t.endWeek = Math.max(t.startWeek, t.endWeek);
    t.durationWeeks = Math.round((t.endWeek - t.startWeek) * 10) / 10;
  });

  return { tasks, projectEndWeek: totalWeeks, hasCalendarDates, originDate };
}

function validateGanttDependencies(tasks, projectEndWeek, knownWbsIds) {
  const errors = [];
  const byId = new Map();
  const hasWbsIds = knownWbsIds instanceof Set;
  if (!Number.isFinite(projectEndWeek) || projectEndWeek < 1) {
    errors.push("Horizon proyek harus minimal satu minggu.");
    return { valid: false, errors };
  }

  for (const task of tasks) {
    if (!task || typeof task.id !== "string" || !task.id) {
      errors.push("Setiap tugas harus memiliki ID.");
      continue;
    }
    if (byId.has(task.id)) errors.push(`ID tugas duplikat: ${task.id}.`);
    byId.set(task.id, task);
    if (!task.isBuffer && hasWbsIds && !knownWbsIds.has(task.wbsId)) {
      errors.push(`ID WBS tugas ${task.id} tidak ditemukan.`);
    }
    if (!Number.isFinite(task.durationWeeks) || task.durationWeeks < 0) {
      errors.push(`Durasi tugas ${task.id} tidak valid.`);
    }
    if (!Number.isFinite(task.startWeek) || task.startWeek < 0 ||
        !Number.isFinite(task.endWeek) || task.endWeek < task.startWeek ||
        task.endWeek > projectEndWeek + 1e-8) {
      errors.push(`Batas jadwal tugas ${task.id} tidak valid.`);
    }
    if (Number.isFinite(task.startWeek) && Number.isFinite(task.endWeek) &&
        Number.isFinite(task.durationWeeks) &&
        Math.abs(task.endWeek - task.startWeek - task.durationWeeks) > 1e-6) {
      errors.push(`Durasi tugas ${task.id} tidak sesuai dengan batas jadwal.`);
    }
    if (task.dependencies !== undefined && !Array.isArray(task.dependencies)) {
      errors.push(`Dependency tugas ${task.id} harus berupa array.`);
    }
  }

  for (const task of tasks) {
    if (!Array.isArray(task.dependencies)) continue;
    for (const dependency of task.dependencies || []) {
      if (!dependency || typeof dependency !== "object") {
        errors.push(`Dependency tugas ${task.id} tidak valid.`);
        continue;
      }
      if (!byId.has(dependency.predecessorId)) {
        errors.push(`Predecessor ${dependency.predecessorId} pada tugas ${task.id} tidak ditemukan.`);
        continue;
      }
      if (dependency.predecessorId === task.id) {
        errors.push(`Tugas ${task.id} tidak dapat menjadi predecessor dirinya sendiri.`);
      }
      if (!["FS", "SS"].includes(dependency.type)) {
        errors.push(`Tipe dependency ${dependency.type} pada tugas ${task.id} tidak didukung.`);
      }
      if (!Number.isFinite(dependency.lagWeeks)) {
        errors.push(`Lag/lead pada tugas ${task.id} tidak valid.`);
      }
    }
  }

  if (errors.length) return { valid: false, errors };

  const inDegree = new Map(tasks.map((task) => [task.id, 0]));
  const successors = new Map(tasks.map((task) => [task.id, []]));
  for (const task of tasks) {
    for (const dependency of task.dependencies || []) {
      inDegree.set(task.id, inDegree.get(task.id) + 1);
      successors.get(dependency.predecessorId).push(task.id);
    }
  }

  const ready = tasks.filter((task) => inDegree.get(task.id) === 0).map((task) => task.id);
  let visited = 0;
  while (ready.length) {
    const id = ready.shift();
    visited += 1;
    for (const successorId of successors.get(id)) {
      inDegree.set(successorId, inDegree.get(successorId) - 1);
      if (inDegree.get(successorId) === 0) ready.push(successorId);
    }
  }
  if (visited !== tasks.length) errors.push("Dependency mengandung siklus.");
  return { valid: errors.length === 0, errors };
}

function scheduleGanttTasks(tasks, projectEndWeek, knownWbsIds) {
  const validation = validateGanttDependencies(tasks, projectEndWeek, knownWbsIds);
  if (!validation.valid) return { valid: false, errors: validation.errors, tasks: [] };

  const byId = new Map(tasks.map((task) => [task.id, { ...task }]));
  const scheduled = new Set();
  const result = [];
  while (scheduled.size < tasks.length) {
    let progressed = false;
    for (const source of tasks) {
      if (scheduled.has(source.id)) continue;
      const task = byId.get(source.id);
      if ((task.dependencies || []).some((dependency) => !scheduled.has(dependency.predecessorId))) continue;

      let startWeek = task.startWeek;
      for (const dependency of task.dependencies || []) {
        const predecessor = byId.get(dependency.predecessorId);
        const constraint = dependency.type === "FS"
          ? predecessor.endWeek + dependency.lagWeeks
          : predecessor.startWeek + dependency.lagWeeks;
        startWeek = Math.max(startWeek, constraint);
      }
      task.startWeek = Math.round(startWeek * 10000) / 10000;
      task.endWeek = Math.round((task.startWeek + task.durationWeeks) * 10000) / 10000;
      if (task.startWeek < -1e-8 || task.endWeek > projectEndWeek + 1e-8) {
        return {
          valid: false,
          errors: [`Dependency mendorong tugas ${task.id} keluar dari horizon proyek.`],
          tasks: [],
        };
      }
      scheduled.add(task.id);
      result.push(task);
      progressed = true;
    }
    if (!progressed) return { valid: false, errors: ["Dependency mengandung siklus."], tasks: [] };
  }

  for (const task of result) {
    for (const dependency of task.dependencies || []) {
      const predecessor = byId.get(dependency.predecessorId);
      const requiredWeek = dependency.type === "FS"
        ? predecessor.endWeek + dependency.lagWeeks
        : predecessor.startWeek + dependency.lagWeeks;
      if (task.startWeek + 1e-8 < requiredWeek) {
        return { valid: false, errors: [`Dependency ${dependency.type} tidak terpenuhi pada tugas ${task.id}.`], tasks: [] };
      }
    }
  }
  return { valid: true, errors: [], tasks: result };
}

function buildGanttSchedule(wbs, input) {
  const rows = Array.isArray(wbs) ? wbs : [];
  const validRows = [];
  const knownWbsIds = new Set();
  const issues = [];
  for (const row of rows) {
    if (!row || ![1, 2, 3].includes(Number(row.level)) ||
        typeof row.id !== "string" || !row.id.trim() ||
        typeof row.name !== "string" || !row.name.trim()) {
      const rowId = row && typeof row.id === "string" ? row.id.trim() : "";
      issues.push(`Baris WBS${rowId ? ` ${rowId}` : ""} tidak valid dan tidak dijadwalkan.`);
      continue;
    }
    const id = row.id.trim();
    if (knownWbsIds.has(id)) {
      issues.push(`ID WBS duplikat diabaikan: ${id}.`);
      continue;
    }
    knownWbsIds.add(id);
    validRows.push({ ...row, id, level: Number(row.level), name: row.name.trim(), children: [] });
  }

  const roots = [];
  const stack = [];
  for (const row of validRows) {
    if (row.level === 1) {
      roots.push(row);
      stack[0] = row;
      stack.length = 1;
      continue;
    }
    const parent = stack[row.level - 2];
    if (!parent || parent.level !== row.level - 1) {
      issues.push(`Hierarki WBS tidak valid; item ${row.id} tidak dijadwalkan.`);
      stack.length = row.level - 1;
      continue;
    }
    row.parentWbsId = parent.id;
    parent.children.push(row);
    stack[row.level - 1] = row;
    stack.length = row.level;
  }

  const phaseSchedule = buildPhaseSchedule(validRows, input);
  if (!phaseSchedule.tasks.length) {
    return {
      ...phaseSchedule,
      valid: false,
      errors: [...issues, "Tidak ada fase WBS yang dapat dijadwalkan."],
    };
  }

  const phaseRows = roots.slice(0, phaseSchedule.tasks.filter((task) => !task.isBuffer).length);
  const phaseTasks = phaseSchedule.tasks.filter((task) => !task.isBuffer);
  const phaseTaskByWbsId = new Map();
  const tasks = [];
  phaseRows.forEach((row, index) => {
    const phase = phaseTasks[index];
    if (!phase) return;
    const task = {
      ...phase,
      id: row.id,
      wbsId: row.id,
      level: 1,
      parentId: null,
      type: phase.isMilestone ? "Milestone" : "Phase",
      dependencies: [],
      scheduleBasis: "Estimasi sistem; durasi fase dan overlap diturunkan dari total durasi proyek.",
    };
    phaseTaskByWbsId.set(row.id, task);
    tasks.push(task);
  });

  const bufferSource = phaseSchedule.tasks.find((task) => task.isBuffer);
  let bufferTask = null;
  if (bufferSource) {
    bufferTask = {
      ...bufferSource,
      id: "schedule-buffer",
      wbsId: null,
      parentId: null,
      level: 0,
      dependencies: [],
      scheduleBasis: "Cadangan waktu sistem; interval non-kerja, bukan item WBS.",
    };
  }

  const devIndices = [];
  for (let index = 1; index < phaseTasks.length - 2; index += 1) devIndices.push(index);
  const hasTestingPhase = phaseTasks.length >= 3;
  const hasClosingPhase = phaseTasks.length >= 2;
  const phaseDependency = new Map();
  if (devIndices.length > 0) {
    const initiation = phaseRows[0]?.id;
    phaseDependency.set(phaseRows[devIndices[0]]?.id, { predecessorId: initiation, type: "FS", lagWeeks: 0 });
    for (let index = 1; index < devIndices.length; index += 1) {
      const previousIdx = devIndices[index - 1];
      const currentIdx = devIndices[index];
      const lagWeeks = Math.round((phaseTasks[currentIdx].startWeek - phaseTasks[previousIdx].startWeek) * 10000) / 10000;
      phaseDependency.set(phaseRows[currentIdx]?.id, {
        predecessorId: phaseRows[previousIdx]?.id,
        type: "SS",
        lagWeeks,
      });
    }
    if (hasTestingPhase) {
      const lastDevIdx = devIndices[devIndices.length - 1];
      phaseDependency.set(phaseRows[phaseTasks.length - 2]?.id, {
        predecessorId: phaseRows[lastDevIdx]?.id,
        type: "FS",
        lagWeeks: 0,
      });
    }
  } else {
    for (let index = 1; index < phaseRows.length; index += 1) {
      phaseDependency.set(phaseRows[index].id, {
        predecessorId: phaseRows[index - 1].id,
        type: "FS",
        lagWeeks: 0,
      });
    }
  }

  const closingRow = hasClosingPhase ? phaseRows[phaseRows.length - 1] : null;
  const testingRow = hasTestingPhase ? phaseRows[phaseRows.length - 2] : null;
  if (closingRow) {
    phaseDependency.set(closingRow.id, {
      predecessorId: bufferTask?.id || testingRow?.id || phaseRows[phaseRows.length - 2]?.id,
      type: "FS",
      lagWeeks: 0,
    });
  }
  for (const [phaseId, dependency] of phaseDependency) {
    const phase = phaseTaskByWbsId.get(phaseId);
    if (phase && dependency.predecessorId) phase.dependencies = [dependency];
  }
  if (bufferTask) {
    bufferTask.dependencies = testingRow
      ? [{ predecessorId: testingRow.id, type: "FS", lagWeeks: 0 }]
      : [];
  }

  const flattened = [];
  const addChildren = (parentRow, parentTask) => {
    if (!parentRow.children.length) return;
    const leafRows = [];
    const allRows = [];
    const collectLeaves = (node) => {
      allRows.push(node);
      if (!node.children.length) leafRows.push(node);
      else node.children.forEach(collectLeaves);
    };
    parentRow.children.forEach(collectLeaves);
    let cursor = parentTask.startWeek;
    const leafTimes = new Map();
    let previousLeaf = null;
    leafRows.forEach((row, index) => {
      const end = index === leafRows.length - 1
        ? parentTask.endWeek
        : parentTask.startWeek + parentTask.durationWeeks * (index + 1) / leafRows.length;
      const task = {
        id: row.id,
        wbsId: row.id,
        name: row.name,
        level: row.level,
        parentId: row.parentWbsId,
        type: row.level === 2 ? "Activity" : "Work Package",
        isMilestone: false,
        isBuffer: false,
        startWeek: cursor,
        endWeek: end,
        durationWeeks: Math.max(0, end - cursor),
        dependencies: previousLeaf
          ? [{ predecessorId: previousLeaf.id, type: "FS", lagWeeks: 0 }]
          : parentTask.dependencies.map((dependency) => ({ ...dependency })),
        assumption: "Durasi dan urutan merupakan estimasi sistem; belum disetujui sebagai baseline proyek.",
        scheduleBasis: "Estimasi sistem; pembagian merata dalam fase dan hubungan Finish-to-Start.",
      };
      leafTimes.set(row.id, task);
      previousLeaf = task;
      cursor = end;
    });

    const byRowId = new Map(leafTimes);
    for (const row of allRows.slice().reverse()) {
      if (leafTimes.has(row.id)) continue;
      const children = row.children.map((child) => byRowId.get(child.id)).filter(Boolean);
      if (!children.length) continue;
      byRowId.set(row.id, {
        id: row.id,
        wbsId: row.id,
        name: row.name,
        level: row.level,
        parentId: row.parentWbsId,
        type: "Activity",
        isMilestone: false,
        isBuffer: false,
        startWeek: Math.min(...children.map((child) => child.startWeek)),
        endWeek: Math.max(...children.map((child) => child.endWeek)),
        durationWeeks: Math.max(...children.map((child) => child.endWeek)) - Math.min(...children.map((child) => child.startWeek)),
        dependencies: [],
        assumption: "Tanggal dan durasi diturunkan dari batas WBS anak.",
        scheduleBasis: "Roll-up dari item anak; estimasi sistem, belum disetujui.",
      });
    }
    const appendTree = (row) => {
      const task = byRowId.get(row.id);
      if (task) flattened.push(task);
      row.children.forEach(appendTree);
    };
    parentRow.children.forEach(appendTree);
    parentTask.scheduleBasis = "Roll-up WBS dengan asumsi estimasi sistem; belum disetujui.";
  };
  for (const row of phaseRows) {
    const phase = phaseTaskByWbsId.get(row.id);
    if (!phase) continue;
    flattened.push(phase);
    addChildren(row, phase);
  }
  if (bufferTask) {
    const closingIndex = flattened.findIndex((task) => task.wbsId === closingRow?.id);
    flattened.splice(closingIndex < 0 ? flattened.length : closingIndex, 0, bufferTask);
  }

  const scheduled = scheduleGanttTasks(flattened, phaseSchedule.projectEndWeek, knownWbsIds);
  if (!scheduled.valid) {
    return {
      ...phaseSchedule,
      tasks: [],
      valid: false,
      errors: scheduled.errors,
      assumptions: ["Jadwal tidak dapat dibuat karena dependency tidak valid."],
    };
  }

  const byId = new Map(scheduled.tasks.map((task) => [task.id, task]));
  for (const row of validRows.slice().reverse()) {
    const task = byId.get(row.id);
    if (!task || !row.children.length) continue;
    const children = row.children.map((child) => byId.get(child.id)).filter(Boolean);
    if (!children.length) continue;
    task.startWeek = Math.min(...children.map((child) => child.startWeek));
    task.endWeek = Math.max(...children.map((child) => child.endWeek));
    task.durationWeeks = task.endWeek - task.startWeek;
  }

  const dateAtWeek = (week) => phaseSchedule.originDate
    ? projectDateAtWeek(input.startDate, week)
    : null;
  const fmtDate = (date) => date ? formatProjectDate(date, "short") : null;
  for (const task of scheduled.tasks) {
    task.startWeek = Math.round(task.startWeek * 10000) / 10000;
    task.endWeek = Math.round(task.endWeek * 10000) / 10000;
    task.durationWeeks = Math.round((task.endWeek - task.startWeek) * 10000) / 10000;
    task.startDate = dateAtWeek(task.startWeek);
    task.endDate = dateAtWeek(task.endWeek);
    task.startDateStr = fmtDate(task.startDate);
    task.endDateStr = fmtDate(task.endDate);
    task.predecessorIds = (task.dependencies || []).map((dependency) => dependency.predecessorId);
    task.dependencyType = task.dependencies?.[0]?.type || "";
    task.lagWeeks = task.dependencies?.[0]?.lagWeeks ?? 0;
  }

  const finalValidation = validateGanttDependencies(scheduled.tasks, phaseSchedule.projectEndWeek, knownWbsIds);
  return {
    ...phaseSchedule,
    tasks: scheduled.tasks,
    valid: finalValidation.valid && issues.length === 0,
    errors: [...issues, ...finalValidation.errors],
    dateConvention: "Start Date is inclusive; Finish Date is exclusive (start + duration).",
    assumptions: [
      "Phase durations and 15% development overlap follow the existing deterministic system estimate.",
      "Activities/work packages are evenly divided within their parent phase and sequenced Finish-to-Start.",
      "The completion boundary equals the requested project duration; finish dates are exclusive.",
    ],
  };
}

/**
 * syncCharterMilestonesToGantt(doc, input, ganttData)
 * S1.C-9, S1.C-10, S1.C-12: Replace charter milestone strings with the
 * Gantt-derived schedule so Charter and Gantt show identical dates.
 *
 * Rules:
 *  - Uses the Gantt task list (L1 phases only, excluding the buffer row).
 *  - Uses calendar dates when available; otherwise uses relative week offsets.
 *  - Preserves the existing milestone string format:
 *      "4 Januari 2027: Penutupan Proyek selesai"
 *  - If Gantt has no tasks (empty WBS), milestone strings are left unchanged.
 *  - Does NOT invent calendar dates when startDate is absent (S1.C-13).
 */
function syncCharterMilestonesToGantt(doc, ganttData) {
  if (!ganttData) return;
  if (!ganttData.tasks || ganttData.tasks.length === 0) return;
  if (!doc.charter) return;

  // Work tasks only — exclude the synthetic buffer row (isBuffer === true)
  const workTasks = ganttData.tasks.filter((t) => !t.isBuffer && Number(t.level) === 1);

  if (workTasks.length === 0) return;

  const milestones = workTasks.map((t) => {
    if (ganttData.hasCalendarDates) {
      const dateStr = formatProjectDate(t.endDate);
      return dateStr ? `${dateStr}: ${t.name} selesai` : null;
    }
    const week = Number(t.endWeek.toFixed(1)).toLocaleString("id-ID");
    return `Minggu ${week}: ${t.name} selesai`;
  }).filter(Boolean);

  if (milestones.length > 0) {
    doc.charter.milestones = milestones;
  }
}

  return Object.freeze({
    buildPhaseSchedule,
    validateGanttDependencies,
    scheduleGanttTasks,
    buildGanttSchedule,
    syncCharterMilestonesToGantt,
  });
});
