"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAppHarness, createElement, toPlain } = require("./helpers/app-harness");

const app = createAppHarness();
const { api } = app;

const kosPintarInput = {
  projectName: "Kos Pintar",
  objective: "Membangun sistem pengelolaan kos pintar untuk 30 kamar.",
  duration: 14,
  teamSize: 5,
  category: "web",
  budgetRange: "Rp100.000.000",
  startDate: "2026-09-28",
  pmName: "Budi",
  methodology: "Agile / Scrum",
  keyDeliverables: [
    "Manajemen kamar",
    "Reservasi online",
    "Pembayaran digital",
    "Dashboard pemilik",
    "Laporan okupansi",
  ].join("\n"),
  successCriteria: "UAT disetujui",
  projectContext: "Pengelolaan 30 kamar kos",
};

function getPhaseTasks(schedule) {
  return schedule.tasks.filter((task) => Number(task.level) === 1 && !task.isBuffer);
}

test("Template output keeps the document schema and derived cost values", () => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));

  assert.deepEqual(Object.keys(doc).sort(), [
    "assumptions",
    "charter",
    "cost_estimate",
    "cost_summary",
    "risk_register",
    "wbs",
  ]);
  assert.equal(doc.charter.project_title, "Kos Pintar");
  assert.equal(doc.charter.finish_date, "4 Januari 2027");
  assert.equal(doc.charter.deliverables.length, 5);
  assert.ok(doc.wbs.length > 0);
  assert.ok(doc.risk_register.length >= 6);
  assert.ok(doc.cost_estimate.length > 0);
  assert.ok(doc.assumptions.length > 0);
  assert.ok(doc.cost_estimate.every((row) => row.subtotal === row.hours * row.rate));
  assert.equal(
    doc.cost_summary.cost_subtotal,
    doc.cost_estimate.reduce((sum, row) => sum + row.row_total, 0)
  );
  assert.equal(
    doc.cost_summary.grand_total,
    doc.cost_summary.cost_subtotal + doc.cost_summary.contingency_reserve
  );
});

test("deliverable-driven WBS includes all supplied deliverables and three levels", () => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));
  const phases = doc.wbs.filter((row) => row.level === 1);

  assert.equal(phases.length, 8);
  assert.deepEqual(
    phases.slice(1, 6).map((phase) => phase.name),
    [
      "Pengembangan: Manajemen kamar",
      "Pengembangan: Reservasi online",
      "Pengembangan: Pembayaran digital",
      "Pengembangan: Dashboard pemilik",
      "Pengembangan: Laporan okupansi",
    ]
  );
  assert.deepEqual(new Set(doc.wbs.map((row) => row.level)), new Set([1, 2, 3]));
  assert.ok(doc.wbs.some((row) => row.level === 2));
  assert.ok(doc.wbs.some((row) => row.level === 3));
});

test("legacy WBS path remains active without user deliverables", () => {
  const input = { ...kosPintarInput, keyDeliverables: "" };
  const doc = toPlain(api.generateTemplate(input));
  const schedule = toPlain(api.buildGanttSchedule(doc.wbs, input));

  assert.equal(doc.charter.deliverables.length, 5);
  assert.deepEqual(
    doc.wbs.filter((row) => row.level === 1).map((row) => row.name),
    [
      "Inisiasi & Perencanaan",
      "Analisis Kebutuhan",
      "Desain UI/UX",
      "Pengembangan Frontend",
      "Pengembangan Backend",
      "Pengujian",
      "Deployment & Penutupan",
    ]
  );
  assert.ok(doc.assumptions.some((item) => item.includes("template standar")));
  assert.equal(schedule.valid, true);
  assert.ok(schedule.tasks.filter((task) => !task.isBuffer).every((task) =>
    doc.wbs.some((row) => row.id === task.wbsId)
  ));
  assert.ok(schedule.tasks.some((task) => task.level === 3));
});

test("web library and cloud migration preserve requested project horizons", () => {
  const webInput = {
    ...kosPintarInput,
    projectName: "Web Library",
    duration: 8,
    startDate: "",
    keyDeliverables: "",
  };
  const cloudInput = {
    ...webInput,
    projectName: "Cloud Migration",
    duration: 20,
    category: "infrastructure",
    projectContext: "Migrasi workload dan data ke cloud",
  };
  const webDoc = toPlain(api.generateTemplate(webInput));
  const cloudDoc = toPlain(api.generateTemplate(cloudInput));
  const webSchedule = toPlain(api.buildGanttSchedule(webDoc.wbs, webInput));
  const cloudSchedule = toPlain(api.buildGanttSchedule(cloudDoc.wbs, cloudInput));

  assert.equal(Math.max(...webSchedule.tasks.map((task) => task.endWeek)), 8);
  assert.equal(Math.max(...cloudSchedule.tasks.map((task) => task.endWeek)), 20);
  assert.equal(webSchedule.hasCalendarDates, false);
  assert.equal(cloudSchedule.hasCalendarDates, false);
});

test("empty start date and deliverables use relative milestones without calendar dates", () => {
  const input = {
    ...kosPintarInput,
    startDate: "",
    keyDeliverables: "",
  };
  const doc = toPlain(api.generateTemplate(input));
  const schedule = toPlain(api.buildGanttSchedule(doc.wbs, input));

  assert.equal(schedule.hasCalendarDates, false);
  assert.ok(doc.charter.milestones.every((milestone) => milestone.startsWith("Minggu ")));
  api.syncCharterMilestonesToGantt(doc, schedule);
  assert.ok(doc.charter.milestones.every((milestone) => milestone.startsWith("Minggu ")));
  assert.ok(schedule.tasks.every((task) => task.startDate === null && task.endDate === null));
});

test("Gantt preserves Charter milestone dates and project completion for Kos Pintar", () => {
  const doc = api.generateTemplate(kosPintarInput);
  const schedule = api.buildGanttSchedule(doc.wbs, kosPintarInput);
  api.syncCharterMilestonesToGantt(doc, schedule);
  const plainDoc = toPlain(doc);
  const plainSchedule = toPlain(schedule);
  const closing = getPhaseTasks(plainSchedule).at(-1);

  assert.equal(closing.endWeek, 14);
  assert.equal(closing.endDateStr, "4 Jan 2027");
  assert.equal(plainDoc.charter.milestones.at(-1), "4 Januari 2027: Penutupan Proyek selesai");
  assert.ok(plainDoc.charter.milestones.every((milestone, index) => {
    const task = getPhaseTasks(plainSchedule)[index];
    return milestone === `${new Date(task.endDate).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })}: ${task.name} selesai`;
  }));
});

test("Gantt buffer is an explicit interval before closing and tasks remain in horizon", () => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));
  const schedule = toPlain(api.buildGanttSchedule(doc.wbs, kosPintarInput));
  const bufferIndex = schedule.tasks.findIndex((task) => task.isBuffer);
  const buffer = schedule.tasks[bufferIndex];
  const closing = schedule.tasks[bufferIndex + 1];

  assert.ok(buffer);
  assert.equal(buffer.name, "Schedule Buffer (Cadangan Waktu)");
  assert.equal(buffer.endWeek, closing.startWeek);
  assert.equal(buffer.durationWeeks, Number((buffer.endWeek - buffer.startWeek).toFixed(1)));
  assert.equal(closing.endWeek, 14);
  assert.ok(schedule.tasks.every((task) =>
    task.startWeek >= 0 &&
    task.endWeek <= 14 &&
    task.durationWeeks >= 0 &&
    task.endWeek >= task.startWeek
  ));
});

test("Gantt handles missing, malformed, and single-level WBS data without fabricated phases", () => {
  const missing = toPlain(api.buildGanttSchedule(null, { duration: 8 }));
  const malformed = toPlain(api.normaliseAIWBS([{ id: "1", name: "No level" }]));
  const empty = toPlain(api.buildGanttSchedule(malformed.wbs, { duration: 8 }));
  const single = toPlain(api.buildGanttSchedule([{ id: "1", level: 1, name: "Only phase" }], { duration: 8 }));

  assert.equal(missing.tasks.length, 0);
  assert.equal(malformed.usable, false);
  assert.equal(empty.tasks.length, 0);
  assert.equal(single.tasks.length, 1);
  assert.equal(single.tasks[0].isMilestone, true);
  assert.equal(single.tasks[0].endWeek, 8);
});

test("detailed Gantt tasks link to WBS, roll up child dates, and satisfy FS/SS dependencies", () => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));
  const schedule = toPlain(api.buildGanttSchedule(doc.wbs, kosPintarInput));
  const byId = new Map(schedule.tasks.map((task) => [task.id, task]));
  const wbsIds = new Set(doc.wbs.map((row) => row.id));

  assert.equal(schedule.valid, true);
  assert.equal(schedule.dateConvention, "Start Date is inclusive; Finish Date is exclusive (start + duration).");
  assert.ok(schedule.tasks.filter((task) => !task.isBuffer).every((task) => wbsIds.has(task.wbsId)));
  assert.ok(schedule.tasks.some((task) => task.level === 2));
  assert.ok(schedule.tasks.some((task) => task.level === 3));
  const taskWithoutEstimateLabel = schedule.tasks.find((task) =>
    !task.isBuffer && !/estimasi sistem/i.test(task.scheduleBasis || task.assumption)
  );
  assert.equal(taskWithoutEstimateLabel, undefined,
    taskWithoutEstimateLabel && `${taskWithoutEstimateLabel.id}: ${taskWithoutEstimateLabel.scheduleBasis}`);
  for (const task of schedule.tasks) {
    for (const dependency of task.dependencies || []) {
      const predecessor = byId.get(dependency.predecessorId);
      assert.ok(predecessor, `${task.id} predecessor exists`);
      const bound = dependency.type === "FS"
        ? predecessor.endWeek + dependency.lagWeeks
        : predecessor.startWeek + dependency.lagWeeks;
      assert.ok(task.startWeek >= bound - 1e-8, `${task.id} satisfies ${dependency.type}`);
    }
    if (task.parentId) {
      const parent = byId.get(task.parentId);
      assert.ok(parent);
      assert.ok(task.startWeek >= parent.startWeek - 1e-8);
      assert.ok(task.endWeek <= parent.endWeek + 1e-8);
    }
  }
  for (const phase of schedule.tasks.filter((task) => task.level === 1)) {
    const children = schedule.tasks.filter((task) => task.parentId === phase.id);
    if (children.length) {
      assert.equal(phase.startWeek, Math.min(...children.map((task) => task.startWeek)));
      assert.equal(phase.endWeek, Math.max(...children.map((task) => task.endWeek)));
    }
  }
  assert.ok(schedule.tasks.some((task) => task.dependencies?.some((dependency) => dependency.type === "SS")));
});

test("dependency scheduler rejects missing references, cycles, and horizon overflow", () => {
  const knownWbsIds = new Set(["1", "2"]);
  const invalidReference = api.validateGanttDependencies([
    { id: "1", wbsId: "1", startWeek: 0, endWeek: 1, durationWeeks: 1, dependencies: [] },
    { id: "2", wbsId: "2", startWeek: 1, endWeek: 2, durationWeeks: 1, dependencies: [{ predecessorId: "missing", type: "FS", lagWeeks: 0 }] },
  ], 2, knownWbsIds);
  assert.equal(invalidReference.valid, false);
  assert.match(invalidReference.errors.join(" "), /tidak ditemukan/);

  const cycle = api.validateGanttDependencies([
    { id: "1", wbsId: "1", startWeek: 0, endWeek: 1, durationWeeks: 1, dependencies: [{ predecessorId: "2", type: "FS", lagWeeks: 0 }] },
    { id: "2", wbsId: "2", startWeek: 0, endWeek: 1, durationWeeks: 1, dependencies: [{ predecessorId: "1", type: "SS", lagWeeks: 0 }] },
  ], 2, knownWbsIds);
  assert.equal(cycle.valid, false);
  assert.match(cycle.errors.join(" "), /siklus/);

  const unsupportedType = api.validateGanttDependencies([
    { id: "1", wbsId: "1", startWeek: 0, endWeek: 1, durationWeeks: 1, dependencies: [] },
    { id: "2", wbsId: "2", startWeek: 1, endWeek: 2, durationWeeks: 1, dependencies: [{ predecessorId: "1", type: "FF", lagWeeks: 0 }] },
  ], 2, knownWbsIds);
  assert.equal(unsupportedType.valid, false);
  assert.match(unsupportedType.errors.join(" "), /tidak didukung/);

  const negativeDuration = api.validateGanttDependencies([
    { id: "1", wbsId: "1", startWeek: 1, endWeek: 0, durationWeeks: -1, dependencies: [] },
  ], 2, knownWbsIds);
  assert.equal(negativeDuration.valid, false);
  assert.match(negativeDuration.errors.join(" "), /Durasi tugas/);

  const overflow = api.scheduleGanttTasks([
    { id: "1", wbsId: "1", startWeek: 0, endWeek: 1, durationWeeks: 1, dependencies: [] },
    { id: "2", wbsId: "2", startWeek: 0, endWeek: 2, durationWeeks: 2, dependencies: [{ predecessorId: "1", type: "FS", lagWeeks: 0 }] },
  ], 2, knownWbsIds);
  assert.equal(overflow.valid, false);
  assert.match(overflow.errors.join(" "), /horizon/);
});

test("short horizon and long deliverable list remain bounded and deterministic", () => {
  const input = {
    ...kosPintarInput,
    duration: 1,
    keyDeliverables: Array.from({ length: 18 }, (_, index) => `Deliverable ${index + 1}`).join("\n"),
  };
  const doc = toPlain(api.generateTemplate(input));
  const schedule = toPlain(api.buildGanttSchedule(doc.wbs, input));
  const repeated = toPlain(api.buildGanttSchedule(doc.wbs, input));

  assert.equal(schedule.valid, true);
  assert.equal(schedule.tasks.length, repeated.tasks.length);
  assert.deepEqual(schedule.tasks.map((task) => [task.id, task.startWeek, task.endWeek]),
    repeated.tasks.map((task) => [task.id, task.startWeek, task.endWeek]));
  assert.ok(schedule.tasks.every((task) =>
    task.startWeek >= 0 && task.endWeek <= 1 && task.durationWeeks >= 0
  ));
});

test("contextual risk generation retains family deduplication", () => {
  const input = {
    ...kosPintarInput,
    keyDeliverables: "Web application and online payment",
  };
  const doc = toPlain(api.generateTemplate(input));
  const risks = doc.risk_register;

  assert.ok(risks.length >= 6);
  assert.equal(new Set(risks.map((risk) => risk.id)).size, risks.length);
  assert.equal(
    risks.filter((risk) => /Celah keamanan.*aplikasi web/i.test(risk.description)).length,
    1
  );
  assert.ok(risks.some((risk) => /pembayaran|transaksi/i.test(risk.description)));
  assert.ok(risks.every((risk) => risk.description && risk.mitigation));
});

test("no-deliverable risk fallback keeps the category risk list", () => {
  const input = { ...kosPintarInput, keyDeliverables: "" };
  const doc = toPlain(api.generateTemplate(input));

  assert.equal(doc.risk_register.length, 6);
  assert.ok(doc.risk_register.some((risk) => /SQL Injection/.test(risk.description)));
  assert.ok(doc.risk_register.some((risk) => /UU PDP/.test(risk.description)));
});

test("COBIT ranking is deterministic, relevant, and limited to five objectives", () => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));
  const first = toPlain(api.runGovernanceReview(doc, kosPintarInput));
  const second = toPlain(api.runGovernanceReview(doc, kosPintarInput));

  assert.deepEqual(first.mappings, second.mappings);
  assert.equal(first.mappings.length, 5);
  assert.ok(first.mappings.some((mapping) => mapping.code === "BAI03"));
  assert.ok(first.mappings.every((mapping) => mapping.unknown === false));
  assert.equal(first.kpis.length, 5);
});

test("COBIT score returns five bounded criteria and a consistent percentage", () => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));
  const score = toPlain(api.computeScore(doc, kosPintarInput));

  assert.equal(score.criteria.length, 5);
  assert.equal(score.maxTotal, 10);
  assert.equal(score.total, score.criteria.reduce((sum, criterion) => sum + criterion.score, 0));
  assert.ok(score.criteria.every((criterion) => criterion.score >= 0 && criterion.score <= criterion.max));
  assert.equal(score.percentage, Math.round((score.total / score.maxTotal) * 100));
});

test("AI charter normalization fills missing fields and finish date without network access", () => {
  const charter = toPlain(api.normaliseAICharter(
    { finish_date: null, deliverables: null, milestones: null },
    kosPintarInput
  ));

  assert.equal(charter.finish_date, "4 Januari 2027");
  assert.deepEqual(charter.deliverables, []);
  assert.deepEqual(charter.milestones, []);
  assert.equal(charter.project_title, "Kos Pintar");
  assert.equal(charter.objective, kosPintarInput.objective);
});

test("AI WBS normalization handles omitted level fields and malformed values", () => {
  const normalized = toPlain(api.normaliseAIWBS([
    { id: "1", name: "Valid phase", level: 1 },
    { id: "2", name: "Missing level" },
    null,
  ]));

  assert.equal(normalized.usable, true);
  assert.deepEqual(normalized.wbs.map((row) => row.name), ["Valid phase"]);
  assert.equal(normalized.wbs[0].deliverable, "");
  assert.equal(api.normaliseAIWBS(null).usable, false);
});

test("form validation rejects invalid duration, team size, and missing required fields", () => {
  const values = {
    "project-name": "Kos Pintar",
    objective: "Membangun sistem pengelolaan kos.",
    duration: "14",
    "team-size": "5",
    category: "web",
    "budget-range": "Rp100.000.000",
  };
  for (const [id, value] of Object.entries(values)) {
    app.setElement(id, createElement({ value }));
  }

  for (const duration of ["", "0", "-1", "2.5", "NaN", "521"]) {
    app.setElement("duration", createElement({ value: duration }));
    assert.equal(api.getFormData(), null, `duration ${duration}`);
  }
  app.setElement("duration", createElement({ value: "14" }));

  for (const teamSize of ["", "0", "-1", "2.5", "NaN", "501"]) {
    app.setElement("team-size", createElement({ value: teamSize }));
    assert.equal(api.getFormData(), null, `team size ${teamSize}`);
  }

  for (const id of ["project-name", "objective", "category", "budget-range"]) {
    app.setElement(id, createElement({ value: "" }));
    assert.equal(api.getFormData(), null, `required field ${id}`);
    app.setElement(id, createElement({ value: values[id] }));
  }
});

test("cancelled template regeneration preserves the current document and cost edits", async () => {
  const doc = {
    charter: { project_title: "Existing project" },
    cost_estimate: [{ row_total: 123 }],
  };
  api.setState({ currentDoc: doc, costEdited: true });
  app.setConfirmResponse(false);

  await api.onGenerateTemplate();

  assert.equal(api.state.currentDoc, doc);
  assert.equal(api.state.currentDoc.cost_estimate[0].row_total, 123);
  assert.equal(api.state.costEdited, true);
});

test("Template generation updates the canonical store and calendar utilities preserve behavior", async () => {
  const formValues = {
    "project-name": kosPintarInput.projectName,
    objective: kosPintarInput.objective,
    duration: String(kosPintarInput.duration),
    "team-size": String(kosPintarInput.teamSize),
    category: kosPintarInput.category,
    "budget-range": kosPintarInput.budgetRange,
    "start-date": kosPintarInput.startDate,
    "pm-name": kosPintarInput.pmName,
    methodology: kosPintarInput.methodology,
    "key-deliverables": kosPintarInput.keyDeliverables,
    "success-criteria": kosPintarInput.successCriteria,
    "project-context": kosPintarInput.projectContext,
  };
  for (const [id, value] of Object.entries(formValues)) {
    app.setElement(id, createElement({ value }));
  }
  api.setState({ currentDoc: null, currentInput: null, costEdited: false, generationRequestId: 0 });

  await api.onGenerateTemplate();

  assert.equal(api.state.currentDoc.charter.project_title, "Kos Pintar");
  assert.equal(api.state.currentInput.projectName, "Kos Pintar");
  assert.equal(api.state.currentMode, "template");
  assert.equal(api.state.generationStatus, "ready");
  assert.equal(api.formatProjectDate(api.projectDateAtWeek("2026-09-28", 14)), "4 Januari 2027");
  assert.equal(api.projectDateAtWeek("2026-02-30", 1), null);
});

test("stale AI response after Template regeneration cannot replace canonical state", async () => {
  let resolveFetch;
  app.setFetchHandler(() => new Promise((resolve) => {
    resolveFetch = resolve;
  }));
  const aiRequest = api.onGenerateAI();
  assert.equal(api.state.generationStatus, "generating");

  await api.onGenerateTemplate();
  const acceptedDocument = api.state.currentDoc;
  assert.equal(api.state.currentMode, "template");
  assert.equal(api.state.generationStatus, "ready");

  resolveFetch({
    ok: true,
    async json() {
      return {
        fallback: false,
        data: {
          charter: { project_title: "Stale AI response" },
          wbs: [],
          risk_register: [],
          cost_estimate: [],
          assumptions: [],
        },
      };
    },
  });
  await aiRequest;

  assert.equal(api.state.currentDoc, acceptedDocument);
  assert.equal(api.state.currentDoc.charter.project_title, "Kos Pintar");
  assert.equal(api.state.currentMode, "template");
  assert.equal(api.state.generationStatus, "ready");
});

test("budget parsing covers Rp, Indonesian notation, ranges, and ambiguous text", () => {
  const cases = [
    ["Rp100.000.000", 100_000_000, false],
    ["100 juta", 100_000_000, false],
    ["Rp80–100 juta", 100_000_000, true],
    ["80 juta - 100 juta", 100_000_000, true],
    ["Rp 1,5 juta", 1_500_000, false],
    ["ambiguous budget", null, false],
  ];

  for (const [value, expected, isRange] of cases) {
    const parsed = toPlain(api.parseBudgetIDR(value));
    assert.equal(parsed.value, expected, value);
    assert.equal(parsed.isRange, isRange, value);
  }
});

test("editable cost rows and contingency update canonical totals and budget status", () => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));
  doc.cost_estimate = [doc.cost_estimate[0]];
  const row = {
    querySelector(selector) {
      return fields.get(selector);
    },
  };
  const fields = new Map([
    [".cost-hours", createElement({ value: "2" })],
    [".cost-rate", createElement({ value: "1000" })],
    [".cost-nonlabor", createElement({ value: "500" })],
  ]);
  const contingency = app.setElement("contingency-pct-input", createElement({ value: "20" }));
  app.setElement("cost-sub-0");
  app.setElement("cost-subtotal-display");
  app.setElement("cost-reserve-display");
  app.setElement("cost-total");
  app.setElement("budget-status");
  app.setRow(0, row);
  api.setState({ currentDoc: doc, currentInput: kosPintarInput, costEdited: false });

  api.onCostEdit({ target: { dataset: { idx: "0" } } });
  assert.equal(api.projectStore.getDocument(), doc);
  assert.equal(doc.cost_estimate[0].subtotal, 2_000);
  assert.equal(doc.cost_estimate[0].row_total, 2_500);
  assert.equal(doc.cost_summary.grand_total, 3_000);
  assert.equal(api.state.costEdited, true);
  assert.match(app.elements.get("budget-status").innerHTML, /Di bawah anggaran/);

  contingency.value = "0";
  api.updateCostSummary();
  assert.equal(doc.cost_summary.contingency_pct, 0);
  assert.equal(doc.cost_summary.grand_total, doc.cost_summary.cost_subtotal);
});

test("CSV export serializes canonical data without requiring rendered output sections", async (t) => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));
  doc.cost_estimate[0] = {
    ...doc.cost_estimate[0],
    hours: 2,
    rate: 1_000,
    subtotal: 2_000,
    non_labor: 500,
    row_total: 2_500,
  };
  doc.cost_summary = {
    contingency_pct: 20,
    cost_subtotal: 2_500,
    contingency_reserve: 500,
    grand_total: 3_000,
  };
  doc._governance = toPlain(api.runGovernanceReview(doc, kosPintarInput));
  doc._gantt = toPlain(api.buildGanttSchedule(doc.wbs, kosPintarInput));
  api.setState({ currentDoc: doc });

  const expectedFiles = {
    charter: "project_charter.csv",
    wbs: "wbs.csv",
    risk: "risk_register.csv",
    cost: "estimasi_biaya.csv",
    governance: "governance_review.csv",
    gantt: "gantt_schedule.csv",
  };

  for (const [section, filename] of Object.entries(expectedFiles)) {
    await t.test(`${section} CSV exports from state`, async () => {
      api.exportCSV(section);
      assert.ok(app.exportedBlob);
      assert.equal(app.lastCreatedElement.download, filename);
      const csv = Buffer.from(await app.exportedBlob.arrayBuffer()).toString("utf8");
      assert.ok(csv.startsWith("\uFEFF"));
      assert.ok(csv.length > 20);
      if (section === "cost") {
        assert.match(csv, /"2","1000","2000","500","2500"/);
        assert.match(csv, /"Total Estimasi Akhir","","","","","3000"/);
      }
      if (section === "charter") assert.match(csv, /"Nama Proyek","Kos Pintar"/);
      if (section === "gantt") {
        assert.match(csv, /"Finish Date \(exclusive\)"/);
        assert.match(csv, /"Dependency Type"/);
        assert.match(csv, /"BUFFER","Schedule Buffer/);
        assert.match(csv, /belum disetujui/);
      }
    });
  }
});

test("Gantt renderer includes dependency details, collapsible hierarchy, and exclusive finish labeling", () => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));
  const schedule = api.buildGanttSchedule(doc.wbs, kosPintarInput);
  const container = app.setElement("gantt-content");

  api.renderGantt(schedule, kosPintarInput);

  assert.match(container.innerHTML, /data-gantt-toggle/);
  assert.match(container.innerHTML, /Finish Date \(exclusive\)/);
  assert.match(container.innerHTML, /Dependency Type/);
  assert.match(container.innerHTML, /data-gantt-dependency-task-id/);
  assert.match(container.innerHTML, /marker-end="url\(#gantt-arrow\)"/);
});

test("Gantt reports skipped malformed WBS rows while rendering the valid partial schedule", () => {
  const doc = toPlain(api.generateTemplate(kosPintarInput));
  const malformedWbs = [{ id: "orphan-child", name: "Orphan child", level: 3 }, ...doc.wbs];
  const schedule = api.buildGanttSchedule(malformedWbs, kosPintarInput);
  const container = app.setElement("gantt-content");

  api.renderGantt(schedule, kosPintarInput);

  assert.equal(schedule.valid, false);
  assert.ok(schedule.tasks.length > 0);
  assert.match(schedule.errors.join(" "), /orphan-child.*tidak dijadwalkan/);
  assert.match(container.innerHTML, /Jadwal parsial/);
  assert.match(container.innerHTML, /orphan-child/);
});

test("HTML escaping remains available to render user-provided text safely", () => {
  assert.equal(
    api.escHtml('<img src="x" onerror="alert(1)">'),
    "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;"
  );
});
