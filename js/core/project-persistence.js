"use strict";

(function (root, factory) {
  const persistence = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = persistence;
  } else {
    root.GovPlanProjectPersistence = persistence;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FORMAT = "planova-project";
  const SCHEMA_VERSION = 1;
  const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
  const ACTIVE_MODULES = new Set([
    "overview", "charter", "wbs", "gantt", "risk", "cost", "assumptions", "governance",
  ]);
  const INPUT_FIELDS = [
    "projectName", "objective", "duration", "teamSize", "category", "budgetRange",
    "startDate", "pmName", "methodology", "keyDeliverables", "successCriteria", "projectContext",
  ];
  const RECORD_FIELDS = new Set([
    "format", "id", "schemaVersion", "name", "createdAt", "updatedAt", "input",
    "document", "generationMode", "costEdited", "activeModule",
  ]);
  const FORBIDDEN_KEY = /(?:api.?key|gemini|secret|credential|password|authorization|token|^\.env$)/i;
  const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function assertSafeTree(value, state = { depth: 0, nodes: 0 }, seen = new WeakSet()) {
    state.nodes += 1;
    if (state.nodes > 100000 || state.depth > 40) {
      throw new TypeError("Project data exceeds the supported structure limits.");
    }
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new TypeError("Project data contains a non-finite number.");
      return;
    }
    if (typeof value !== "object" || (!Array.isArray(value) && !isPlainObject(value))) {
      throw new TypeError("Project data contains a non-serializable value.");
    }
    if (seen.has(value)) throw new TypeError("Project data must not contain circular references.");
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        state.depth += 1;
        assertSafeTree(item, state, seen);
        state.depth -= 1;
      }
    } else {
      for (const key of Object.keys(value)) {
        if (UNSAFE_KEYS.has(key) || FORBIDDEN_KEY.test(key)) {
          throw new TypeError("Project data contains a forbidden property.");
        }
        state.depth += 1;
        assertSafeTree(value[key], state, seen);
        state.depth -= 1;
      }
    }
    seen.delete(value);
  }

  function cloneSerializable(value) {
    assertSafeTree(value);
    return JSON.parse(JSON.stringify(value));
  }

  function validateInput(input) {
    if (!isPlainObject(input)) throw new TypeError("Project input must be an object.");
    const allowed = new Set(INPUT_FIELDS);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key)) throw new TypeError(`Unsupported project input field: ${key}`);
    }
    for (const field of ["projectName", "objective", "category", "budgetRange"]) {
      if (typeof input[field] !== "string" || !input[field].trim()) {
        throw new TypeError(`Project input field "${field}" is required.`);
      }
    }
    if (!Number.isInteger(input.duration) || input.duration < 1 || input.duration > 520) {
      throw new TypeError("Project duration must be an integer from 1 to 520 weeks.");
    }
    if (!Number.isInteger(input.teamSize) || input.teamSize < 1 || input.teamSize > 500) {
      throw new TypeError("Team size must be an integer from 1 to 500.");
    }
    for (const field of INPUT_FIELDS) {
      if (field === "duration" || field === "teamSize") continue;
      if (input[field] !== undefined && typeof input[field] !== "string") {
        throw new TypeError(`Project input field "${field}" must be text.`);
      }
    }
    return cloneSerializable(input);
  }

  function validateDocument(document) {
    if (!isPlainObject(document) || !isPlainObject(document.charter)) {
      throw new TypeError("Project document must include a Charter object.");
    }
    if (!Array.isArray(document.wbs) || !Array.isArray(document.risk_register) ||
        !Array.isArray(document.cost_estimate) || !isPlainObject(document.cost_summary) ||
        !Array.isArray(document.assumptions)) {
      throw new TypeError("Project document is missing required generated sections.");
    }
    const textLists = ["in_scope", "out_of_scope", "deliverables", "success_criteria", "stakeholders", "milestones"];
    for (const field of textLists) {
      const value = document.charter[field];
      if (value !== undefined && value !== null &&
          (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) {
        throw new TypeError(`Charter field "${field}" must be a list of text values.`);
      }
    }
    for (const row of document.wbs) {
      if (!isPlainObject(row)) throw new TypeError("WBS rows must be objects.");
      if (row.level !== undefined && (!Number.isInteger(row.level) || row.level < 1 || row.level > 3)) {
        throw new TypeError("WBS levels must be integers from 1 to 3.");
      }
      for (const field of ["id", "name", "deliverable", "completion_criteria"]) {
        if (row[field] !== undefined && typeof row[field] !== "string") {
          throw new TypeError(`WBS field "${field}" must be text.`);
        }
      }
    }
    for (const risk of document.risk_register) {
      if (!isPlainObject(risk)) throw new TypeError("Risk rows must be objects.");
      for (const field of ["id", "description", "mitigation"]) {
        if (risk[field] !== undefined && typeof risk[field] !== "string") {
          throw new TypeError(`Risk field "${field}" must be text.`);
        }
      }
      for (const field of ["probability", "impact"]) {
        if (risk[field] !== undefined && !["low", "medium", "high"].includes(risk[field])) {
          throw new TypeError(`Risk ${field} must be low, medium, or high.`);
        }
      }
    }
    let calculatedSubtotal = 0;
    let editableSubtotal = 0;
    const rowTotals = [];
    for (const row of document.cost_estimate) {
      if (!isPlainObject(row) || typeof row.category !== "string") {
        throw new TypeError("Cost estimate rows must include a category.");
      }
      for (const field of ["hours", "rate", "subtotal", "non_labor", "row_total"]) {
        if (row[field] !== undefined &&
            (typeof row[field] !== "number" || !Number.isFinite(row[field]) || row[field] < 0)) {
          throw new TypeError(`Cost field "${field}" must be a non-negative number.`);
        }
      }
      const hours = row.hours ?? 0;
      const rate = row.rate ?? 0;
      const nonLabor = row.non_labor ?? 0;
      const editableTotal = hours * rate + nonLabor;
      if (!Number.isFinite(editableTotal)) {
        throw new TypeError("Editable cost values exceed the supported numeric range.");
      }
      editableSubtotal += editableTotal;
      if (!Number.isFinite(editableSubtotal)) {
        throw new TypeError("Editable cost totals exceed the supported numeric range.");
      }
      const rowTotal = row.row_total ?? 0;
      rowTotals.push(rowTotal);
      calculatedSubtotal += rowTotal;
      if (!Number.isFinite(calculatedSubtotal)) {
        throw new TypeError("Cost estimate totals exceed the supported numeric range.");
      }
    }
    for (const value of Object.values(document.cost_summary)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new TypeError("Cost summary values must be non-negative numbers.");
      }
    }
    const contingencyPct = document.cost_summary.contingency_pct ?? 10;
    if (contingencyPct > 100 ||
        !Number.isFinite(calculatedSubtotal * contingencyPct) ||
        !Number.isFinite(calculatedSubtotal + Math.round(calculatedSubtotal * contingencyPct / 100)) ||
        !Number.isFinite(editableSubtotal * contingencyPct) ||
        !Number.isFinite(editableSubtotal + Math.round(editableSubtotal * contingencyPct / 100)) ||
        rowTotals.some((rowTotal, index) => {
          const mixedTotal = calculatedSubtotal - rowTotal +
            (document.cost_estimate[index].hours ?? 0) * (document.cost_estimate[index].rate ?? 0) +
            (document.cost_estimate[index].non_labor ?? 0);
          return !Number.isFinite(mixedTotal) ||
            !Number.isFinite(mixedTotal * contingencyPct) ||
            !Number.isFinite(mixedTotal + Math.round(mixedTotal * contingencyPct / 100));
        })) {
      throw new TypeError("Calculated cost totals exceed the supported numeric range.");
    }
    if (document.assumptions.some((item) => typeof item !== "string")) {
      throw new TypeError("Project assumptions must be text values.");
    }
    const safeDocument = cloneSerializable(document);
    delete safeDocument._gantt;
    delete safeDocument._governance;
    return safeDocument;
  }

  function validateProjectRecord(record) {
    if (!isPlainObject(record)) throw new TypeError("Project backup must be a JSON object.");
    for (const key of Object.keys(record)) {
      if (!RECORD_FIELDS.has(key)) throw new TypeError(`Unsupported backup field: ${key}`);
    }
    if (record.format !== FORMAT) throw new TypeError("This file is not a Planova project backup.");
    if (record.schemaVersion !== SCHEMA_VERSION) {
      throw new TypeError(`Unsupported project backup version: ${record.schemaVersion}`);
    }
    if (typeof record.id !== "string" || !record.id.trim() || record.id.length > 200) {
      throw new TypeError("Project ID is invalid.");
    }
    if (typeof record.name !== "string" || !record.name.trim() || record.name.length > 200) {
      throw new TypeError("Project name must contain 1 to 200 characters.");
    }
    for (const field of ["createdAt", "updatedAt"]) {
      if (typeof record[field] !== "string" || !Number.isFinite(Date.parse(record[field]))) {
        throw new TypeError(`Project ${field} timestamp is invalid.`);
      }
    }
    if (record.generationMode !== "template" && record.generationMode !== "ai") {
      throw new TypeError("Project generation mode is invalid.");
    }
    if (typeof record.costEdited !== "boolean") throw new TypeError("Project cost edit flag is invalid.");
    if (record.activeModule !== undefined && !ACTIVE_MODULES.has(record.activeModule)) {
      throw new TypeError("Project active module is unsupported.");
    }
    const input = validateInput(record.input);
    const document = validateDocument(record.document);
    const normalized = {
      format: FORMAT,
      id: record.id,
      schemaVersion: SCHEMA_VERSION,
      name: record.name.trim(),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      input,
      document,
      generationMode: record.generationMode,
      costEdited: record.costEdited,
      activeModule: record.activeModule || "overview",
    };
    assertSafeTree(normalized);
    return normalized;
  }

  function byteLength(value) {
    return new TextEncoder().encode(value).length;
  }

  function parseBackup(text) {
    if (typeof text !== "string") throw new TypeError("Backup file must contain text.");
    if (byteLength(text) > MAX_BACKUP_BYTES) {
      throw new TypeError("Backup file is larger than the 5 MB limit.");
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new TypeError("Backup file is not valid JSON.");
    }
    return validateProjectRecord(parsed);
  }

  function exportBackup(record) {
    const validated = validateProjectRecord(record);
    const text = `${JSON.stringify(validated, null, 2)}\n`;
    if (byteLength(text) > MAX_BACKUP_BYTES) {
      throw new TypeError("Project backup is larger than the 5 MB limit.");
    }
    return text;
  }

  function createProjectRecord({
    id, name, input, document, generationMode, costEdited, activeModule, createdAt, updatedAt,
  }) {
    const now = new Date().toISOString();
    if (!isPlainObject(document)) throw new TypeError("Project document must be an object.");
    const sourceDocument = { ...document };
    delete sourceDocument._gantt;
    delete sourceDocument._governance;
    const safeDocument = cloneSerializable(sourceDocument);
    return validateProjectRecord({
      format: FORMAT,
      id,
      schemaVersion: SCHEMA_VERSION,
      name,
      createdAt: createdAt || now,
      updatedAt: updatedAt || now,
      input,
      document: safeDocument,
      generationMode,
      costEdited: Boolean(costEdited),
      activeModule: ACTIVE_MODULES.has(activeModule) ? activeModule : "overview",
    });
  }

  function createId(cryptoObject) {
    if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
      return cryptoObject.randomUUID();
    }
    const random = cryptoObject && typeof cryptoObject.getRandomValues === "function"
      ? [...cryptoObject.getRandomValues(new Uint32Array(4))].map((value) => value.toString(16)).join("")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    return `planova-${random}`;
  }

  function createRepository(indexedDB) {
    let databasePromise = null;

    function openDatabase() {
      if (!indexedDB || typeof indexedDB.open !== "function") {
        return Promise.reject(new Error("IndexedDB is unavailable in this browser context."));
      }
      if (databasePromise) return databasePromise;
      const promise = new Promise((resolve, reject) => {
        let request;
        try {
          request = indexedDB.open("planova-local-projects", 1);
        } catch (error) {
          reject(error);
          return;
        }
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("projects")) {
            database.createObjectStore("projects", { keyPath: "id" });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => {
            database.close();
            databasePromise = null;
          };
          resolve(database);
        };
        request.onerror = () => reject(request.error || new Error("Could not open local project storage."));
        request.onblocked = () => reject(new Error("Local project storage is blocked by another open tab."));
      });
      databasePromise = promise;
      promise.catch(() => {
        if (databasePromise === promise) databasePromise = null;
      });
      return promise;
    }

    async function transact(mode, createRequest) {
      const database = await openDatabase();
      return new Promise((resolve, reject) => {
        let result;
        let settled = false;
        const fail = (error) => {
          if (settled) return;
          settled = true;
          reject(error || new Error("Local project storage operation failed."));
        };
        let transaction;
        try {
          transaction = database.transaction("projects", mode);
          const request = createRequest(transaction.objectStore("projects"));
          request.onsuccess = () => { result = request.result; };
          request.onerror = () => fail(request.error);
          transaction.oncomplete = () => {
            if (settled) return;
            settled = true;
            resolve(result);
          };
          transaction.onerror = () => fail(transaction.error);
          transaction.onabort = () => fail(transaction.error);
        } catch (error) {
          fail(error);
        }
      });
    }

    return Object.freeze({
      list() {
        return transact("readonly", (store) => store.getAll())
          .then((projects) => projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      },
      get(id) {
        return transact("readonly", (store) => store.get(id));
      },
      put(record) {
        return transact("readwrite", (store) => store.put(validateProjectRecord(record)));
      },
      delete(id) {
        return transact("readwrite", (store) => store.delete(id));
      },
    });
  }

  return Object.freeze({
    FORMAT,
    SCHEMA_VERSION,
    MAX_BACKUP_BYTES,
    assertSafeTree,
    createId,
    createProjectRecord,
    createRepository,
    exportBackup,
    parseBackup,
    validateProjectRecord,
  });
});
