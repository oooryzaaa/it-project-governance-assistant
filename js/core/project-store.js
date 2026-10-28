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
    projectId: null,
    projectDirty: false,
    projectRevision: 0,
    activeUiModule: "overview",
    mobileNavigationOpen: false,
    listeners: new Set(),
  };

  function notify(change) {
    for (const listener of state.listeners) listener(change);
  }

  function markProjectDirty() {
    state.projectDirty = true;
    state.projectRevision += 1;
  }

  return Object.freeze({
    getLastAcceptedInput() {
      return state.lastAcceptedInput;
    },
    setLastAcceptedInput(input) {
      state.lastAcceptedInput = input;
      if (input) markProjectDirty();
      notify({ type: "input", input });
    },
    getDocument() {
      return state.document;
    },
    setDocument(document) {
      state.document = document;
      if (document) markProjectDirty();
      notify({ type: "document", document });
    },
    notifyDocumentUpdated() {
      markProjectDirty();
      notify({ type: "document-updated", document: state.document });
    },
    getProjectId() {
      return state.projectId;
    },
    setProjectId(id) {
      if (id !== null && (typeof id !== "string" || !id.trim())) {
        throw new TypeError("Project ID must be a non-empty string or null");
      }
      state.projectId = id;
      notify({ type: "project-identity", projectId: id });
    },
    isProjectDirty() {
      return state.projectDirty;
    },
    getProjectRevision() {
      return state.projectRevision;
    },
    setProjectDirty(dirty) {
      if (dirty && !state.projectDirty) state.projectRevision += 1;
      state.projectDirty = Boolean(dirty);
      notify({ type: "project-dirty", dirty: state.projectDirty });
    },
    restoreProject(project) {
      if (!project || typeof project !== "object") {
        throw new TypeError("Project restore data must be an object");
      }
      if (project.generationMode !== "template" && project.generationMode !== "ai") {
        throw new TypeError("Project restore mode is unsupported");
      }
      if (!project.input || typeof project.input !== "object" ||
          !project.document || typeof project.document !== "object") {
        throw new TypeError("Project restore data is incomplete");
      }
      if (project.id !== null && (typeof project.id !== "string" || !project.id.trim())) {
        throw new TypeError("Project restore ID is invalid");
      }
      if (project.activeModule !== undefined &&
          (typeof project.activeModule !== "string" || !project.activeModule.trim())) {
        throw new TypeError("Project restore module is invalid");
      }
      state.pendingRequestIdentity += 1;
      state.projectRevision += 1;
      state.lastAcceptedInput = project.input;
      state.document = project.document;
      state.generationMode = project.generationMode;
      state.generationStatus = "ready";
      state.costEdited = Boolean(project.costEdited);
      state.projectId = project.id;
      state.projectDirty = false;
      state.activeUiModule = project.activeModule || "overview";
      notify({ type: "project-restored", project });
    },
    closeProject() {
      state.pendingRequestIdentity += 1;
      state.projectRevision += 1;
      state.lastAcceptedInput = null;
      state.document = null;
      state.generationMode = "template";
      state.generationStatus = "idle";
      state.costEdited = false;
      state.projectId = null;
      state.projectDirty = false;
      state.activeUiModule = "projects";
      notify({ type: "project-closed" });
    },
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("Project store listener must be a function");
      }
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
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
      markProjectDirty();
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
      if (state.costEdited) markProjectDirty();
    },
    getActiveUiModule() {
      return state.activeUiModule;
    },
    setActiveUiModule(moduleId) {
      if (typeof moduleId !== "string" || !moduleId.trim()) {
        throw new TypeError("Active UI module must be a non-empty string");
      }
      state.activeUiModule = moduleId;
      notify({ type: "active-module", moduleId });
    },
    isMobileNavigationOpen() {
      return state.mobileNavigationOpen;
    },
    setMobileNavigationOpen(open) {
      state.mobileNavigationOpen = Boolean(open);
      notify({ type: "mobile-navigation", open: state.mobileNavigationOpen });
    },
  });
});
