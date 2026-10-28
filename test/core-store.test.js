"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const projectStore = require("../js/core/project-store");

test("project store owns project state, generation lifecycle, and request identity", () => {
  const input = { projectName: "Kos Pintar" };
  const document = { charter: { project_title: "Kos Pintar" } };

  projectStore.setLastAcceptedInput(null);
  projectStore.setDocument(null);
  projectStore.setGenerationMode("template");
  projectStore.setGenerationStatus("idle");
  projectStore.setCostEdited(false);
  projectStore.setPendingRequestIdentity(0);

  const requestId = projectStore.beginAIGeneration(input);
  assert.equal(projectStore.getLastAcceptedInput(), input);
  assert.equal(projectStore.getGenerationStatus(), "generating");
  assert.equal(projectStore.isCurrentRequest(requestId), true);

  projectStore.setDocument(document);
  projectStore.setGenerationMode("ai");
  projectStore.setCostEdited(true);
  assert.equal(projectStore.getDocument(), document);
  assert.equal(projectStore.getGenerationMode(), "ai");
  assert.equal(projectStore.getCostEdited(), true);

  projectStore.invalidatePendingGeneration();
  assert.equal(projectStore.isCurrentRequest(requestId), false);
  assert.throws(() => projectStore.setGenerationMode("unknown"), /Unsupported generation mode/);
});

test("project store tracks active module and mobile navigation without document mutation", () => {
  const document = { charter: { project_title: "Unchanged" } };
  projectStore.setDocument(document);
  projectStore.setActiveUiModule("cost");
  projectStore.setMobileNavigationOpen(true);

  assert.equal(projectStore.getActiveUiModule(), "cost");
  assert.equal(projectStore.isMobileNavigationOpen(), true);
  assert.equal(projectStore.getDocument(), document);

  projectStore.setMobileNavigationOpen(false);
  projectStore.setActiveUiModule("workspace");
});

test("project store publishes document changes for derived workspace views", () => {
  const changes = [];
  const unsubscribe = projectStore.subscribe((change) => changes.push(change.type));
  const document = { cost_summary: { grand_total: 125 } };
  projectStore.setDocument(document);
  projectStore.notifyDocumentUpdated();
  unsubscribe();
  projectStore.setDocument(null);

  assert.deepEqual(changes, ["document", "document-updated"]);
});

test("project store restores and closes projects without leaving dirty or pending state", () => {
  const pendingRequest = projectStore.beginAIGeneration({ projectName: "Pending" });
  projectStore.restoreProject({
    id: "saved-project",
    input: { projectName: "Restored" },
    document: { charter: { project_title: "Restored" } },
    generationMode: "template",
    costEdited: true,
    activeModule: "gantt",
  });

  assert.equal(projectStore.isCurrentRequest(pendingRequest), false);
  assert.equal(projectStore.getProjectId(), "saved-project");
  assert.equal(projectStore.getLastAcceptedInput().projectName, "Restored");
  assert.equal(projectStore.getDocument().charter.project_title, "Restored");
  assert.equal(projectStore.getGenerationStatus(), "ready");
  assert.equal(projectStore.getCostEdited(), true);
  assert.equal(projectStore.getActiveUiModule(), "gantt");
  assert.equal(projectStore.isProjectDirty(), false);

  projectStore.notifyDocumentUpdated();
  assert.equal(projectStore.isProjectDirty(), true);
  projectStore.closeProject();
  assert.equal(projectStore.getProjectId(), null);
  assert.equal(projectStore.getDocument(), null);
  assert.equal(projectStore.getLastAcceptedInput(), null);
  assert.equal(projectStore.getActiveUiModule(), "projects");
  assert.equal(projectStore.isProjectDirty(), false);
});
