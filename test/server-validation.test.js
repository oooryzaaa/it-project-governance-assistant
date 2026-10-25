"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const projectRequire = createRequire(path.join(root, "server.js"));

function createServerHarness() {
  const routes = new Map();
  const app = {
    use() {},
    post(route, handler) {
      routes.set(`POST ${route}`, handler);
    },
    get(route, handler) {
      routes.set(`GET ${route}`, handler);
    },
    listen() {},
  };
  const express = () => app;
  express.json = () => () => {};
  express.static = () => () => {};

  const context = vm.createContext({
    console: { log() {}, error() {} },
    process: { env: {} },
    __dirname: root,
    require(name) {
      if (name === "dotenv") return { config() {} };
      if (name === "express") return express;
      if (name === "path") return projectRequire("node:path");
      if (name === "@google/genai") return { GoogleGenAI: class {} };
      if (name === "./cobit-data") return projectRequire("./cobit-data");
      throw new Error(`Unexpected server test dependency: ${name}`);
    },
  });

  const source = fs.readFileSync(path.join(root, "server.js"), "utf8");
  const testAccess = `
    globalThis.__serverTest = { validateRequestBody, validateSchema, buildPrompt };
  `;
  vm.runInContext(`${source}\n${testAccess}`, context, { filename: "server-test-context.js" });

  return { api: context.__serverTest, routes };
}

const server = createServerHarness();
const { api } = server;

const validRequest = {
  projectName: "Kos Pintar",
  objective: "Membangun sistem pengelolaan kos.",
  duration: 14,
  teamSize: 5,
  category: "web",
  budgetRange: "Rp100.000.000",
};

test("server input validation accepts valid project boundaries and trims values", () => {
  const normalized = JSON.parse(JSON.stringify(api.validateRequestBody({
    ...validRequest,
    projectName: "  Kos Pintar  ",
    duration: "14",
    teamSize: "5",
  })));

  assert.equal(normalized.projectName, "Kos Pintar");
  assert.equal(normalized.duration, 14);
  assert.equal(normalized.teamSize, 5);
  assert.equal(api.validateRequestBody({ ...validRequest, duration: 1, teamSize: 1 }).duration, 1);
  assert.equal(api.validateRequestBody({ ...validRequest, duration: 520, teamSize: 500 }).duration, 520);
});

test("server input validation rejects non-integer and out-of-range duration/team values", () => {
  for (const duration of [0, -1, 2.5, 521, NaN, Infinity, true, null, "14x"]) {
    assert.throws(
      () => api.validateRequestBody({ ...validRequest, duration }),
      /Durasi harus/
    );
  }
  for (const teamSize of [0, -1, 2.5, 501, NaN, Infinity, true, null, "5x"]) {
    assert.throws(
      () => api.validateRequestBody({ ...validRequest, teamSize }),
      /Ukuran tim harus/
    );
  }
});

test("server input validation rejects missing required fields and invalid categories", () => {
  for (const field of ["projectName", "objective", "duration", "teamSize", "category", "budgetRange"]) {
    const body = { ...validRequest };
    delete body[field];
    assert.throws(() => api.validateRequestBody(body));
  }
  assert.throws(() => api.validateRequestBody({ ...validRequest, category: "unknown" }), /Kategori/);
});

test("AI response schema validator accepts current shape and rejects missing/malformed data", () => {
  const response = {
    charter: {
      objective: "Tujuan",
      in_scope: [],
      out_of_scope: [],
      stakeholders: [],
      deliverables: [],
      milestones: [],
    },
    wbs: [{
      id: "1",
      name: "Planning",
      level: 1,
      deliverable: "Plan",
      completion_criteria: "Approved",
    }],
    risk_register: Array.from({ length: 6 }, (_, index) => ({ id: `R${index + 1}` })),
    cost_estimate: [{ category: "Planning", hours: 1, rate: 1, subtotal: 1 }],
    assumptions: [],
  };

  assert.equal(api.validateSchema(response), undefined);
  assert.throws(() => api.validateSchema({ ...response, wbs: [] }), /wbs.*array tidak kosong/);
  assert.throws(() => api.validateSchema({ ...response, risk_register: [] }), /minimal 6/);
  assert.throws(() => {
    const malformed = { ...response, wbs: [{ ...response.wbs[0] }] };
    delete malformed.wbs[0].level;
    api.validateSchema(malformed);
  }, /WBS tidak valid/);
});

test("AI prompt includes project schedule, budget, and optional deliverables", () => {
  const prompt = api.buildPrompt({
    ...validRequest,
    startDate: "2026-09-28",
    keyDeliverables: "Reservasi online\nPembayaran digital",
  });

  assert.match(prompt, /Durasi: 14 minggu/);
  assert.match(prompt, /Tanggal Mulai: 2026-09-28/);
  assert.match(prompt, /Rp100\.000\.000/);
  assert.match(prompt, /Reservasi online/);
});
