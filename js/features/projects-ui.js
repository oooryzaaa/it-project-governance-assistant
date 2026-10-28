"use strict";

(function (root, factory) {
  const feature = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanProjectsUI = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const store = root.GovPlanProjectStore;
  const persistence = root.GovPlanProjectPersistence;
  const { $ } = root.GovPlanUtils;
  let repository = null;
  let storageAvailable = false;
  let restoreProject = null;
  let refreshDocument = null;
  let closeProject = null;
  let initialized = false;

  function askProjectName(title, initialValue) {
    const dialog = $("project-name-dialog");
    const form = $("project-name-form");
    const input = $("project-name-dialog-input");
    const titleElement = $("project-name-dialog-title");
    const errorElement = $("project-name-dialog-error");
    if (!dialog?.showModal || !form || !input || !titleElement || !errorElement) {
      return Promise.reject(new Error("Project name dialog is not available in this browser."));
    }
    return new Promise((resolve) => {
      let result = null;
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        form.removeEventListener("submit", onSubmit);
        $("project-name-cancel")?.removeEventListener("click", onCancel);
        dialog.removeEventListener("cancel", onCancel);
        dialog.removeEventListener("close", finish);
        resolve(result);
      };
      const onCancel = (event) => {
        event?.preventDefault();
        result = null;
        if (dialog.open) dialog.close("cancel");
        finish();
      };
      const onSubmit = (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name || name.length > 200) {
          errorElement.textContent = "Enter a project name of 1 to 200 characters.";
          input.focus();
          return;
        }
        result = name;
        dialog.close("save");
        finish();
      };
      titleElement.textContent = title;
      input.value = initialValue || "";
      errorElement.textContent = "";
      form.addEventListener("submit", onSubmit);
      $("project-name-cancel")?.addEventListener("click", onCancel);
      dialog.addEventListener("cancel", onCancel);
      dialog.addEventListener("close", finish);
      dialog.showModal();
      input.focus();
      input.select();
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function status(message, isError = false) {
    const element = $("projects-status");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("text-red-700", isError);
    element.classList.toggle("text-slate-500", !isError);
    element.setAttribute("role", isError ? "alert" : "status");
  }

  function updateSaveControls() {
    const hasProject = Boolean(store.getDocument() && store.getLastAcceptedInput());
    for (const id of [
      "project-save", "project-save-as", "project-export-current", "project-close-current",
    ]) {
      const button = $(id);
      if (button) {
        const requiresStorage = id === "project-save" || id === "project-save-as";
        button.disabled = !hasProject || (requiresStorage && !storageAvailable);
      }
    }
    const closeButton = $("project-close-current");
    if (closeButton) closeButton.disabled = !hasProject;
    const state = $("project-save-state");
    if (state) {
      state.textContent = !hasProject ? "No project open" :
        store.isProjectDirty() ? "Unsaved changes" : "All changes saved";
    }
  }

  function formatSavedDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Unknown date"
      : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function renderProjectList(projects) {
    const container = $("projects-list");
    if (!container) return;
    if (!projects.length) {
      container.innerHTML = '<p class="projects-empty">No saved projects yet. Generate a project, then choose Save Project.</p>';
      return;
    }
    container.innerHTML = projects.map((project) => `
      <article class="saved-project-card" data-saved-project="${escapeHtml(project.id)}">
        <div class="saved-project-details">
          <h3>${escapeHtml(project.name)}</h3>
          <p>${escapeHtml(project.input.category)} <span aria-hidden="true">·</span> Last saved ${escapeHtml(formatSavedDate(project.updatedAt))}</p>
        </div>
        <div class="saved-project-actions" aria-label="Actions for ${escapeHtml(project.name)}">
          ${[
            ["open", "Open"],
            ["rename", "Rename"],
            ["duplicate", "Duplicate"],
            ["export", "Export JSON"],
            ["delete", "Delete"],
          ].map(([action, label]) => `<button type="button" class="projects-action" data-project-action="${action}" data-project-id="${escapeHtml(project.id)}">${label}</button>`).join("")}
        </div>
      </article>
    `).join("");
  }

  async function refreshProjectList() {
    if (!repository || !storageAvailable) {
      renderProjectList([]);
      return;
    }
    try {
      const projects = (await repository.list()).map((project) => persistence.validateProjectRecord(project));
      storageAvailable = true;
      renderProjectList(projects);
      updateSaveControls();
    } catch (error) {
      storageAvailable = false;
      status(`Local browser storage is unavailable: ${error.message} Export or import JSON to keep working.`, true);
      renderProjectList([]);
      updateSaveControls();
    }
  }

  function currentSnapshot(id, name, createdAt) {
    const input = store.getLastAcceptedInput();
    const document = store.getDocument();
    if (!input || !document) throw new Error("Generate or open a project before saving.");
    return persistence.createProjectRecord({
      id,
      name,
      input,
      document,
      generationMode: store.getGenerationMode(),
      costEdited: store.getCostEdited(),
      activeModule: store.getActiveUiModule(),
      createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  function updateActiveProjectName(name) {
    const input = JSON.parse(JSON.stringify(store.getLastAcceptedInput()));
    const document = JSON.parse(JSON.stringify(store.getDocument()));
    input.projectName = name;
    document.charter.project_title = name;
    store.setLastAcceptedInput(input);
    store.setDocument(document);
    refreshDocument(document, input);
  }

  async function persistRecord(record, successMessage, activate = true, stateToken = {
    revision: store.getProjectRevision(),
    projectId: store.getProjectId(),
  }) {
    if (!repository || !storageAvailable) {
      status("Local browser storage is unavailable. Use Export JSON to keep a backup.", true);
      return false;
    }
    await repository.put(record);
    const stateUnchanged = store.getProjectRevision() === stateToken.revision &&
      store.getProjectId() === stateToken.projectId;
    if (activate && stateUnchanged) {
      store.setProjectId(record.id);
      store.setProjectDirty(false);
    }
    status(activate && !stateUnchanged
      ? "Saved a snapshot; newer project changes remain unsaved."
      : successMessage);
    await refreshProjectList();
    return true;
  }

  async function saveCurrent(asNew = false) {
    try {
      if (!repository || !storageAvailable) {
        throw new Error("Local browser storage is unavailable. Export JSON to keep a backup.");
      }
      const initialState = {
        revision: store.getProjectRevision(),
        projectId: store.getProjectId(),
      };
      const existingId = !asNew ? store.getProjectId() : null;
      const existing = existingId ? await repository.get(existingId) : null;
      if (store.getProjectRevision() !== initialState.revision ||
          store.getProjectId() !== initialState.projectId) {
        throw new Error("The active project changed while saving. Please retry Save.");
      }
      const defaultName = store.getDocument()?.charter?.project_title ||
        store.getLastAcceptedInput()?.projectName || "";
      let name = defaultName;
      if (asNew || !existingId) {
        name = await askProjectName(asNew ? "Save a copy" : "Save project", defaultName);
        if (name === null) return;
      }
      if (store.getProjectRevision() !== initialState.revision ||
          store.getProjectId() !== initialState.projectId) {
        throw new Error("The active project changed while saving. Please retry Save.");
      }
      if (!name.trim()) throw new Error("Project name cannot be empty.");
      if ((!existingId || asNew) && name.trim() !== defaultName) {
        updateActiveProjectName(name.trim());
      }
      const record = currentSnapshot(
        asNew || !existingId ? persistence.createId(root.crypto) : existingId,
        name.trim(),
        existing?.createdAt,
      );
      const stateToken = {
        revision: store.getProjectRevision(),
        projectId: store.getProjectId(),
      };
      await persistRecord(
        record,
        asNew || !existingId ? "Project saved." : "Project changes saved.",
        true,
        stateToken,
      );
    } catch (error) {
      status(error.message, true);
      root.alert?.(error.message);
    }
  }

  function downloadBackup(record) {
    const contents = persistence.exportBackup(record);
    const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
    const url = root.URL.createObjectURL(blob);
    const link = root.document.createElement("a");
    const safeName = record.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "project";
    link.href = url;
    link.download = `${safeName}.planova.json`;
    root.document.body.appendChild(link);
    link.click();
    link.remove();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
    status("Project JSON backup exported.");
  }

  async function exportCurrent() {
    try {
      const existingId = store.getProjectId();
      const existing = existingId && repository ? await repository.get(existingId) : null;
      const fallbackName = store.getDocument()?.charter?.project_title ||
        store.getLastAcceptedInput()?.projectName || "";
      const record = currentSnapshot(
        existingId || persistence.createId(root.crypto),
        existing?.name || fallbackName,
        existing?.createdAt,
      );
      downloadBackup(record);
    } catch (error) {
      status(error.message, true);
      root.alert?.(error.message);
    }
  }

  async function openProject(id) {
    try {
      const record = persistence.validateProjectRecord(await repository.get(id));
      if (!record) throw new Error("The selected project no longer exists.");
      if (store.isProjectDirty() &&
          !root.confirm("This project has unsaved changes. Discard them and open the selected project?")) return;
      restoreProject(record);
      status(`Opened “${record.name}”.`);
      await refreshProjectList();
    } catch (error) {
      status(error.message, true);
      root.alert?.(error.message);
    }
  }

  async function renameProject(id) {
    try {
      const record = persistence.validateProjectRecord(await repository.get(id));
      if (!record) throw new Error("The selected project no longer exists.");
      const name = await askProjectName("Rename project", record.name);
      if (name === null) return;
      if (!name.trim() || name.trim().length > 200) {
        throw new Error("Project name must contain 1 to 200 characters.");
      }
      const isCurrent = store.getProjectId() === id && store.getDocument();
      const input = JSON.parse(JSON.stringify(isCurrent ? store.getLastAcceptedInput() : record.input));
      const document = JSON.parse(JSON.stringify(isCurrent ? store.getDocument() : record.document));
      input.projectName = name.trim();
      document.charter.project_title = name.trim();
      if (isCurrent) {
        updateActiveProjectName(name.trim());
      }
      const updated = persistence.createProjectRecord({
        id,
        name: name.trim(),
        input,
        document,
        generationMode: isCurrent ? store.getGenerationMode() : record.generationMode,
        costEdited: isCurrent ? store.getCostEdited() : record.costEdited,
        activeModule: isCurrent ? store.getActiveUiModule() : record.activeModule,
        createdAt: record.createdAt,
        updatedAt: new Date().toISOString(),
      });
      const stateToken = {
        revision: store.getProjectRevision(),
        projectId: store.getProjectId(),
      };
      await persistRecord(updated, "Project renamed.", Boolean(isCurrent), stateToken);
    } catch (error) {
      status(error.message, true);
      root.alert?.(error.message);
    }
  }

  async function duplicateProject(id) {
    try {
      const source = persistence.validateProjectRecord(await repository.get(id));
      if (!source) throw new Error("The selected project no longer exists.");
      const now = new Date().toISOString();
      const duplicate = persistence.validateProjectRecord({
        ...source,
        id: persistence.createId(root.crypto),
        name: `${source.name} (copy)`.slice(0, 200),
        createdAt: now,
        updatedAt: now,
      });
      await repository.put(duplicate);
      status("Project duplicated.");
      await refreshProjectList();
    } catch (error) {
      status(error.message, true);
      root.alert?.(error.message);
    }
  }

  async function deleteProject(id) {
    try {
      const record = persistence.validateProjectRecord(await repository.get(id));
      if (!record) throw new Error("The selected project no longer exists.");
      if (!root.confirm(`Delete “${record.name}” from this browser? This cannot be undone.`)) return;
      await repository.delete(id);
      if (store.getProjectId() === id) {
        store.setProjectId(null);
        store.setProjectDirty(true);
      }
      status("Project deleted from this browser.");
      await refreshProjectList();
    } catch (error) {
      status(error.message, true);
      root.alert?.(error.message);
    }
  }

  async function importBackup(file) {
    try {
      if (!file) return;
      if (file.size > persistence.MAX_BACKUP_BYTES) {
        throw new Error("Backup file is larger than the 5 MB limit.");
      }
      const imported = persistence.parseBackup(await file.text());
      const now = new Date().toISOString();
      const record = {
        ...imported,
        id: persistence.createId(root.crypto),
        updatedAt: now,
      };
      if (repository && storageAvailable) {
        await repository.put(record);
        const confirmedRevision = store.getProjectRevision();
        if (store.isProjectDirty() &&
            !root.confirm("This project has unsaved changes. Discard them and import the selected backup?")) {
          status("Backup imported into My Projects; the current project was left open.");
          await refreshProjectList();
          return;
        }
        if (store.isProjectDirty() && store.getProjectRevision() !== confirmedRevision &&
            !root.confirm("The current project changed while importing. Discard those changes and open the backup?")) {
          status("Backup imported into My Projects; the current project was left open.");
          await refreshProjectList();
          return;
        }
        restoreProject(record);
        status(`Imported “${record.name}” as a new local project.`);
        await refreshProjectList();
      } else {
        if (store.isProjectDirty() &&
            !root.confirm("This project has unsaved changes. Discard them and import the selected backup?")) return;
        record.id = null;
        restoreProject(record);
        store.setProjectDirty(true);
        status("Backup opened for this session only. IndexedDB is unavailable; export JSON to keep it.", true);
      }
    } catch (error) {
      status(error.message, true);
      root.alert?.(error.message);
    } finally {
      const input = $("project-import-file");
      if (input) input.value = "";
    }
  }

  async function onProjectAction(event) {
    const button = event.target.closest("[data-project-action]");
    if (!button) return;
    const { projectAction: action, projectId: id } = button.dataset;
    if (!repository || !storageAvailable) {
      status("IndexedDB is unavailable. Saved-project actions cannot be used.", true);
      return;
    }
    if (action === "open") await openProject(id);
    else if (action === "rename") await renameProject(id);
    else if (action === "duplicate") await duplicateProject(id);
    else if (action === "delete") await deleteProject(id);
    else if (action === "export") {
      try {
        downloadBackup(persistence.validateProjectRecord(await repository.get(id)));
      } catch (error) {
        status(error.message, true);
        root.alert?.(error.message);
      }
    }
  }

  function closeCurrentProject() {
    if (store.isProjectDirty() &&
        !root.confirm("This project has unsaved changes. Discard them and close the project?")) return;
    closeProject();
    status("Project closed. Saved copies remain in My Projects.");
  }

  function init(options) {
    if (initialized || !root.document) return;
    initialized = true;
    restoreProject = options.restoreProject;
    refreshDocument = options.refreshDocument;
    closeProject = options.closeProject;
    let indexedDbAvailable = false;
    try {
      indexedDbAvailable = Boolean(root.indexedDB);
      repository = persistence.createRepository(root.indexedDB);
    } catch (error) {
      status(error.message, true);
    }

    $("project-save")?.addEventListener("click", () => saveCurrent(false));
    $("project-save-as")?.addEventListener("click", () => saveCurrent(true));
    $("project-export-current")?.addEventListener("click", exportCurrent);
    $("project-close-current")?.addEventListener("click", closeCurrentProject);
    $("project-import-file")?.addEventListener("change", (event) => {
      importBackup(event.target.files?.[0]);
    });
    $("projects-list")?.addEventListener("click", onProjectAction);
    root.addEventListener("beforeunload", (event) => {
      if (!store.isProjectDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    });
    store.subscribe((change) => {
      if (change.type === "project-dirty" || change.type === "project-identity" ||
          change.type === "document" || change.type === "document-updated" ||
          change.type === "input" || change.type === "project-closed") updateSaveControls();
      if (change.type === "active-module" && change.moduleId === "projects") refreshProjectList();
    });
    updateSaveControls();
    if (!indexedDbAvailable) {
      status("IndexedDB is unavailable. Save Project is disabled; use JSON export/import for recovery.", true);
      repository = null;
    } else {
      status("Projects are stored in this browser profile only. Browser data clearing can remove them.");
      storageAvailable = true;
      refreshProjectList();
    }
  }

  return Object.freeze({
    init,
    renderProjectList,
    refreshProjectList,
    saveCurrent,
    exportCurrent,
    openProject,
    importBackup,
  });
});
