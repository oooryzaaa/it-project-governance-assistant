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
  const riskFeatureSource = fs.readFileSync(path.join(root, "js/features/risks.js"), "utf8");
  const templateFeatureSource = fs.readFileSync(path.join(root, "js/features/template.js"), "utf8");
  const cobitSource = fs.readFileSync(path.join(root, "cobit-data.js"), "utf8");
  const cobitFeatureSource = fs.readFileSync(path.join(root, "js/features/cobit.js"), "utf8");
  const ganttFeatureSource = fs.readFileSync(path.join(root, "js/features/gantt-schedule.js"), "utf8");
  const costFeatureSource = fs.readFileSync(path.join(root, "js/features/cost.js"), "utf8");
  const aiNormalizationSource = fs.readFileSync(path.join(root, "js/features/ai-normalization.js"), "utf8");
  const documentRenderersSource = fs.readFileSync(path.join(root, "js/features/document-renderers.js"), "utf8");
  const ganttUiSource = fs.readFileSync(path.join(root, "js/features/gantt-ui.js"), "utf8");
  const costUiSource = fs.readFileSync(path.join(root, "js/features/cost-ui.js"), "utf8");
  const assumptionsUiSource = fs.readFileSync(path.join(root, "js/features/assumptions-ui.js"), "utf8");
  const governanceUiSource = fs.readFileSync(path.join(root, "js/features/governance-ui.js"), "utf8");
  const statusUiSource = fs.readFileSync(path.join(root, "js/features/status-ui.js"), "utf8");
  const exportUiSource = fs.readFileSync(path.join(root, "js/features/export-ui.js"), "utf8");
  const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const testAccess = `
    globalThis.__appTest = {
      projectStore,
      generateTemplate: GovPlanTemplateFeature.generateTemplate,
      buildDeliverableWBS: GovPlanTemplateFeature.buildDeliverableWBS,
      buildDeliverableMilestones: GovPlanTemplateFeature.buildDeliverableMilestones,
      buildContextualRisks: GovPlanRiskFeature.buildContextualRisks,
      runGovernanceReview: (doc, input) => GovPlanCobitFeature.runGovernanceReview(doc, input, COBIT_OBJECTIVES),
      buildCobitMappings: GovPlanCobitFeature.buildCobitMappings,
      computeScore: (doc, input) => GovPlanCobitFeature.computeScore(doc, input, COBIT_OBJECTIVES),
      buildGanttSchedule: GovPlanGanttFeature.buildGanttSchedule,
      validateGanttDependencies: GovPlanGanttFeature.validateGanttDependencies,
      scheduleGanttTasks: GovPlanGanttFeature.scheduleGanttTasks,
      syncCharterMilestonesToGantt: GovPlanGanttFeature.syncCharterMilestonesToGantt,
      renderGantt: GovPlanGanttUI.renderGantt,
      renderDocument,
      parseBudgetIDR: GovPlanCostFeature.parseBudgetIDR,
      normaliseAICharter: GovPlanAINormalizationFeature.normaliseAICharter,
      normaliseAIWBS: GovPlanAINormalizationFeature.normaliseAIWBS,
      renderCharter: GovPlanDocumentRenderers.renderCharter,
      renderWBS: GovPlanDocumentRenderers.renderWBS,
      renderRiskRegister: GovPlanDocumentRenderers.renderRiskRegister,
      renderCostEstimate: GovPlanCostUI.renderCostEstimate,
      renderBudgetStatus: GovPlanCostUI.renderBudgetStatus,
      renderAssumptions: GovPlanAssumptionsUI.renderAssumptions,
      renderGovernance: GovPlanGovernanceUI.renderGovernance,
      renderCobitMappings: GovPlanGovernanceUI.renderCobitMappings,
      renderKPIs: GovPlanGovernanceUI.renderKPIs,
      renderScore: GovPlanGovernanceUI.renderScore,
      renderBadge: GovPlanStatusUI.renderBadge,
      renderFallbackNotice: GovPlanStatusUI.renderFallbackNotice,
      exportCSV: GovPlanExportUI.exportCSV,
      getFormData,
      onGenerateTemplate,
      onGenerateAI,
      confirmCostEditOverwrite,
      parseProjectDate: GovPlanUtils.parseProjectDate,
      projectDateAtWeek: GovPlanUtils.projectDateAtWeek,
      formatProjectDate: GovPlanUtils.formatProjectDate,
      onCostEdit: GovPlanCostUI.onCostEdit,
      updateCostSummary: GovPlanCostUI.updateCostSummary,
      escHtml: GovPlanUtils.escHtml,
      get state() {
        return {
          currentMode,
          currentDoc,
          currentInput,
          costEdited,
          projectDirty: projectStore.isProjectDirty(),
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
        if ("projectDirty" in values) projectStore.setProjectDirty(values.projectDirty);
        if ("generationRequestId" in values) generationRequestId = values.generationRequestId;
      },
    };
  `;

  vm.runInContext(`${utilsSource}\n${storeSource}\n${riskFeatureSource}\n${templateFeatureSource}\n${cobitSource}\n${cobitFeatureSource}\n${ganttFeatureSource}\n${costFeatureSource}\n${aiNormalizationSource}\n${documentRenderersSource}\n${ganttUiSource}\n${costUiSource}\n${assumptionsUiSource}\n${governanceUiSource}\n${statusUiSource}\n${exportUiSource}\n${appSource}\n${testAccess}`, context, {
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
