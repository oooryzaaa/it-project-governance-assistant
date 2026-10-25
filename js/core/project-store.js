"use strict";

(function (root, factory) {
  const store = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = store;
  } else {
    root.GovPlanProjectStore = store;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const state = {
    lastAcceptedInput: null,
    document: null,
    generationMode: "template",
    generationStatus: "idle",
    pendingRequestIdentity: 0,
    costEdited: false,
    activeUiModule: "workspace",
    mobileNavigationOpen: false,
  };

  return Object.freeze({
    getLastAcceptedInput() {
      return state.lastAcceptedInput;
    },
    setLastAcceptedInput(input) {
      state.lastAcceptedInput = input;
    },
    getDocument() {
      return state.document;
    },
    setDocument(document) {
      state.document = document;
    },
    getGenerationMode() {
      return state.generationMode;
    },
    setGenerationMode(mode) {
      if (mode !== "template" && mode !== "ai") {
        throw new TypeError(`Unsupported generation mode: ${mode}`);
      }
      state.generationMode = mode;
    },
    getGenerationStatus() {
      return state.generationStatus;
    },
    setGenerationStatus(status) {
      if (!["idle", "generating", "ready"].includes(status)) {
        throw new TypeError(`Unsupported generation status: ${status}`);
      }
      state.generationStatus = status;
    },
    getPendingRequestIdentity() {
      return state.pendingRequestIdentity;
    },
    setPendingRequestIdentity(identity) {
      if (!Number.isSafeInteger(identity) || identity < 0) {
        throw new TypeError("Request identity must be a non-negative safe integer");
      }
      state.pendingRequestIdentity = identity;
    },
    beginAIGeneration(input) {
      state.lastAcceptedInput = input;
      state.pendingRequestIdentity += 1;
      state.generationStatus = "generating";
      return state.pendingRequestIdentity;
    },
    invalidatePendingGeneration() {
      state.pendingRequestIdentity += 1;
      return state.pendingRequestIdentity;
    },
    isCurrentRequest(identity) {
      return identity === state.pendingRequestIdentity;
    },
    getCostEdited() {
      return state.costEdited;
    },
    setCostEdited(edited) {
      state.costEdited = Boolean(edited);
    },
    getActiveUiModule() {
      return state.activeUiModule;
    },
    setActiveUiModule(moduleId) {
      if (typeof moduleId !== "string" || !moduleId.trim()) {
        throw new TypeError("Active UI module must be a non-empty string");
      }
      state.activeUiModule = moduleId;
    },
    isMobileNavigationOpen() {
      return state.mobileNavigationOpen;
    },
    setMobileNavigationOpen(open) {
      state.mobileNavigationOpen = Boolean(open);
    },
  });
});
