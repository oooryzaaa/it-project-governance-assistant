"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

function createElement(overrides = {}) {
  return {
    value: "",
    textContent: "",
    innerHTML: "",
    download: "",
    clicked: false,
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    click() {
      this.clicked = true;
    },
    ...overrides,
  };
}

function createAppHarness() {
  const elements = new Map();
  const rows = new Map();
  let exportedBlob = null;
  let lastCreatedElement = null;
  let confirmResponse = true;
  let fetchHandler = async () => {
    throw new Error("Unexpected fetch call in app test");
  };

  const document = {
    addEventListener() {},
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(selector) {
      const rowMatch = selector.match(/^\[data-cost-idx="(\d+)"\]$/);
      return rowMatch ? rows.get(Number(rowMatch[1])) || null : null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tagName) {
      lastCreatedElement = createElement({ tagName });
      return lastCreatedElement;
    },
  };

  const context = vm.createContext({
    document,
    window: { confirm: () => confirmResponse, print() {} },
    console,
    fetch(...args) {
      return fetchHandler(...args);
    },
    URL: {
      createObjectURL(blob) {
        exportedBlob = blob;
        return "blob:test";
      },
      revokeObjectURL() {},
    },
    Blob,
  });

  const utilsSource = fs.readFileSync(path.join(root, "js/core/utils.js"), "utf8");
  const storeSource = fs.readFileSync(path.join(root, "js/core/project-store.js"), "utf8");
  const cobitSource = fs.readFileSync(path.join(root, "cobit-data.js"), "utf8");
  const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const testAccess = `
    globalThis.__appTest = {
      projectStore,
      generateTemplate,
      buildDeliverableWBS,
      buildDeliverableMilestones,
      buildContextualRisks,
      runGovernanceReview,
      buildCobitMappings,
      computeScore,
      buildGanttSchedule,
      validateGanttDependencies,
      scheduleGanttTasks,
      syncCharterMilestonesToGantt,
      renderGantt,
      renderDocument,
      parseBudgetIDR,
      normaliseAICharter,
      normaliseAIWBS,
      getFormData,
      onGenerateTemplate,
      onGenerateAI,
      confirmCostEditOverwrite,
      parseProjectDate,
      projectDateAtWeek,
      formatProjectDate,
      exportCSV,
      onCostEdit,
      updateCostSummary,
      escHtml,
      get state() {
        return {
          currentMode,
          currentDoc,
          currentInput,
          costEdited,
          generationRequestId,
          generationStatus: projectStore.getGenerationStatus(),
          activeUiModule: projectStore.getActiveUiModule(),
          mobileNavigationOpen: projectStore.isMobileNavigationOpen(),
        };
      },
      setState(values) {
        if ("currentMode" in values) currentMode = values.currentMode;
        if ("currentDoc" in values) currentDoc = values.currentDoc;
        if ("currentInput" in values) currentInput = values.currentInput;
        if ("costEdited" in values) costEdited = values.costEdited;
        if ("generationRequestId" in values) generationRequestId = values.generationRequestId;
      },
    };
  `;

  vm.runInContext(`${utilsSource}\n${storeSource}\n${cobitSource}\n${appSource}\n${testAccess}`, context, {
    filename: "app-test-context.js",
  });

  return {
    api: context.__appTest,
    document,
    elements,
    rows,
    get exportedBlob() {
      return exportedBlob;
    },
    get lastCreatedElement() {
      return lastCreatedElement;
    },
    setConfirmResponse(value) {
      confirmResponse = value;
    },
    setFetchHandler(handler) {
      fetchHandler = handler;
    },
    setElement(id, element = createElement()) {
      elements.set(id, element);
      return element;
    },
    setRow(index, row) {
      rows.set(index, row);
      return row;
    },
  };
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createAppHarness, createElement, toPlain };
