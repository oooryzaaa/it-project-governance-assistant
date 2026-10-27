"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const workspaceUiSource = fs.readFileSync(
  path.join(__dirname, "..", "js", "features", "workspace-ui.js"),
  "utf8",
);

function renderOverview(documentData, acceptedInput) {
  const overview = { innerHTML: "" };
  const overviewBudget = { innerHTML: "" };
  const budgetStatus = { innerHTML: "<div>Within the entered budget</div>" };
  const store = {
    getDocument: () => documentData,
    getLastAcceptedInput: () => acceptedInput,
  };
  const context = vm.createContext({
    GovPlanProjectStore: store,
    document: {
      getElementById(id) {
        if (id === "overview-content") return overview;
        if (id === "overview-budget-health") return overviewBudget;
        return id === "budget-status" ? budgetStatus : null;
      },
    },
  });
  vm.runInContext(workspaceUiSource, context, { filename: "workspace-ui-test.js" });
  context.GovPlanWorkspaceUI.renderOverview();
  return { html: overview.innerHTML, budgetHtml: overviewBudget.innerHTML };
}

test("Overview presents generated project data, current cost and module links", () => {
  const { html, budgetHtml } = renderOverview({
    charter: {
      project_title: "Kos Pintar",
      start_date: "2026-09-28",
      finish_date: "2027-01-04",
      deliverables: ["Rooms", "Booking"],
    },
    risk_register: [{ id: "R1" }, { id: "R2" }],
    cost_summary: { grand_total: 123_456_789 },
    _governance: { percentage: 68 },
  }, { projectName: "Kos Pintar", duration: 14, startDate: "2026-09-28" });

  for (const value of [
    "Kos Pintar",
    "14 weeks",
    "2 deliverables",
    "2",
    "Rp 123.456.789",
    "68%",
    'data-workspace-link="gantt"',
    'data-workspace-link="governance"',
    'data-export-section="cost"',
  ]) assert.ok(html.includes(value), `Overview should include ${value}`);
  assert.match(html, /28 Sep(?:tember)? 2026/);
  assert.match(html, /4 Jan(?:uary|uari)? 2027/);
  assert.match(html, /Indicative planning score/);
  assert.match(budgetHtml, /Within the entered budget/);
  assert.doesNotMatch(html, /active projects|team efficiency|AI confidence|percent progress/i);
});

test("Overview escapes project names and omits governance scores that are not computed", () => {
  const { html } = renderOverview({
    charter: {
      project_title: '<img src=x onerror="alert(1)">',
      deliverables: [],
    },
    risk_register: [],
    cost_summary: { grand_total: 10 },
  }, { projectName: "unused", duration: 8 });

  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(!html.includes('<img src=x onerror="alert(1)">'));
  assert.ok(!html.includes("Indicative planning score"));
  assert.ok(!html.includes("undefined%"));
});
