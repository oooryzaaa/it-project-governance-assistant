"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const persistence = require("../js/core/project-persistence");

const input = {
  projectName: "Kos Pintar",
  objective: "Create a reservation system",
  duration: 14,
  teamSize: 5,
  category: "education",
  budgetRange: "Rp100.000.000",
  startDate: "2026-09-28",
  pmName: "Project Manager",
  methodology: "Agile / Scrum",
  keyDeliverables: "Room booking\nManagement dashboard",
  successCriteria: "Bookings can be managed",
  projectContext: "Student housing",
};

function createValidRecord() {
  const document = {
    charter: {
      project_title: input.projectName,
      finish_date: "2027-01-04",
      deliverables: ["Rooms", "Booking"],
      in_scope: ["Room management"],
      out_of_scope: [],
      success_criteria: [],
      stakeholders: [],
      milestones: [],
    },
    wbs: [{ id: "1.1", name: "Room management", level: 2, deliverable: "Rooms", completion_criteria: "Ready" }],
    risk_register: [{
      id: "R1",
      description: "Schedule delay",
      probability: "medium",
      impact: "high",
      mitigation: "Track dependencies",
    }],
    cost_estimate: [{
      category: "Project Manager",
      hours: 321,
      rate: 456_789,
      subtotal: 146_629_269,
      non_labor: 123_456,
      row_total: 146_752_725,
    }],
    cost_summary: {
      contingency_pct: 17,
      cost_subtotal: 146_752_725,
      contingency_reserve: 24_947_963,
      grand_total: 171_700_688,
    },
    assumptions: ["The project team is available."],
  };
  document._gantt = { originDate: new Date("2026-09-28T00:00:00.000Z") };
  document._governance = { percentage: 80 };
  return persistence.createProjectRecord({
    id: "project-one",
    name: input.projectName,
    input,
    document,
    generationMode: "template",
    costEdited: true,
    activeModule: "cost",
  });
}

test("project backups preserve editable canonical documents and omit derived views", () => {
  const record = createValidRecord();
  const exported = persistence.exportBackup(record);
  const restored = persistence.parseBackup(exported);

  assert.equal(restored.schemaVersion, 1);
  assert.equal(restored.name, "Kos Pintar");
  assert.equal(restored.input.startDate, "2026-09-28");
  assert.equal(restored.document.cost_estimate[0].hours, 321);
  assert.equal(restored.document.cost_summary.contingency_pct, 17);
  assert.equal(restored.costEdited, true);
  assert.equal(restored.activeModule, "cost");
  assert.equal(Object.hasOwn(restored.document, "_gantt"), false);
  assert.equal(Object.hasOwn(restored.document, "_governance"), false);
  assert.doesNotMatch(exported, /AIza|GEMINI_API_KEY|apiKey|_gantt|_governance/);
});

test("JSON backups enforce format, version, size, and serializable project schemas", () => {
  const record = createValidRecord();
  const parsed = JSON.parse(persistence.exportBackup(record));

  assert.throws(() => persistence.parseBackup("{"), /valid JSON/);
  assert.throws(() => persistence.parseBackup(" ".repeat(persistence.MAX_BACKUP_BYTES + 1)), /5 MB/);
  assert.throws(() => persistence.validateProjectRecord({ ...parsed, schemaVersion: 999 }), /Unsupported project backup version/);
  assert.throws(() => persistence.validateProjectRecord({ ...parsed, generationMode: "pending" }), /generation mode/);
  assert.throws(() => persistence.validateProjectRecord({
    ...parsed,
    input: { ...parsed.input, duration: 14.5 },
  }), /duration/);
  assert.throws(() => persistence.validateProjectRecord({
    ...parsed,
    document: { ...parsed.document, wbs: [{ id: "1", level: 4 }] },
  }), /WBS levels/);
  assert.throws(() => persistence.validateProjectRecord({
    ...parsed,
    document: { ...parsed.document, risk_register: [{ probability: '<img src=x onerror=alert(1)>', impact: "high" }] },
  }), /Risk probability/);
});

test("backup rejects unsafe prototype and credential-shaped properties", () => {
  const record = createValidRecord();
  const prototypePayload = JSON.parse(persistence.exportBackup(record));
  Object.defineProperty(prototypePayload.document, "__proto__", {
    value: { polluted: true },
    enumerable: true,
  });
  assert.throws(() => persistence.validateProjectRecord(prototypePayload), /forbidden property/);

  const secretPayload = JSON.parse(persistence.exportBackup(record));
  secretPayload.document.credentials = { geminiApiKey: "not-a-real-key" };
  assert.throws(() => persistence.validateProjectRecord(secretPayload), /forbidden property/);

  const envPayload = JSON.parse(persistence.exportBackup(record));
  envPayload.document[".env"] = "GEMINI_API_KEY=not-a-real-key";
  assert.throws(() => persistence.validateProjectRecord(envPayload), /forbidden property/);

  const tokenPayload = JSON.parse(persistence.exportBackup(record));
  tokenPayload.document.accessToken = "not-a-real-token";
  assert.throws(() => persistence.validateProjectRecord(tokenPayload), /forbidden property/);
});

test("backup generation rejects unsupported fields and non-serializable documents", () => {
  const record = createValidRecord();
  assert.throws(() => persistence.createProjectRecord({
    ...record,
    input: { ...input, apiKey: "not-a-real-key" },
  }), /Unsupported project input field/);

  const cyclic = { ...record.document };
  cyclic.extra = cyclic;
  assert.throws(() => persistence.createProjectRecord({
    ...record,
    document: cyclic,
  }), /circular references/);

  const overflow = JSON.parse(persistence.exportBackup(record));
  overflow.document.cost_estimate[0].row_total = 1.7e308;
  assert.throws(() => persistence.validateProjectRecord(overflow), /numeric range/);
});

test("local repository reports unavailable IndexedDB explicitly", async () => {
  const repository = persistence.createRepository(null);
  await assert.rejects(repository.list(), /IndexedDB is unavailable/);
});

test("saved-project list escapes imported names and categories", () => {
  const record = createValidRecord();
  record.name = '<img src=x onerror="alert(1)">';
  record.input.category = '<svg onload="alert(1)">';
  const container = { innerHTML: "" };
  const context = vm.createContext({
    GovPlanProjectStore: {},
    GovPlanProjectPersistence: persistence,
    GovPlanUtils: { $: (id) => id === "projects-list" ? container : null },
    document: { getElementById: (id) => id === "projects-list" ? container : null },
  });
  const source = fs.readFileSync(
    path.join(__dirname, "..", "js", "features", "projects-ui.js"),
    "utf8",
  );
  vm.runInContext(source, context);
  context.GovPlanProjectsUI.renderProjectList([record]);

  assert.ok(container.innerHTML.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(container.innerHTML.includes("&lt;svg onload=&quot;alert(1)&quot;&gt;"));
  assert.ok(!container.innerHTML.includes('<img src=x onerror="alert(1)">'));
  assert.ok(!container.innerHTML.includes('<svg onload="alert(1)">'));
});
