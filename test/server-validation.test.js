"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPrompt, parseModelResponse, validateRequestBody, validateSchema } = require("../server/generation");
const { createApp } = require("../server");
const { isPublicAssetPath } = require("../server/public-assets");

const api = { buildPrompt, parseModelResponse, validateRequestBody, validateSchema };

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

test("model response parser accepts JSON fences and rejects oversized or malformed responses", () => {
  assert.deepEqual(api.parseModelResponse('```json\n{"ok":true}\n```'), { ok: true });
  assert.throws(() => api.parseModelResponse("{broken"), SyntaxError);
  assert.throws(() => api.parseModelResponse("x".repeat(256_001)), /terlalu besar/);
});

test("HTTP server only serves allowlisted frontend assets and retains health endpoint", async (t) => {
  const app = createApp({ generate: async () => { throw new Error("mock unavailable"); } });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;

  for (const asset of ["/", "/index.html", "/css/app.css", "/css/gantt.css", "/app.js", "/cobit-data.js", "/js/features/gantt-ui.js"]) {
    const response = await fetch(`${base}${asset}`);
    assert.equal(response.status, 200, `${asset} should be public`);
  }
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const localReferences = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), (match) => match[1])
    .filter((reference) => !/^(?:https?:|data:|#)/i.test(reference));
  for (const reference of localReferences) {
    const response = await fetch(`${base}/${reference.replace(/^\/+/, "")}`);
    assert.equal(response.status, 200, `${reference} should be served`);
  }
  for (const denied of ["/server.js", "/server/generation.js", "/test/server-validation.test.js", "/reference", "/node_modules/express/package.json", "/.env"]) {
    const response = await fetch(`${base}${denied}`);
    assert.equal(response.status, 404, `${denied} should not be public`);
  }
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
});

test("all local HTML script and stylesheet references exist and are explicitly public", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const localReferences = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), (match) => match[1])
    .filter((reference) => !/^(?:https?:|data:|#)/i.test(reference));
  assert.ok(localReferences.length > 0);
  for (const reference of localReferences) {
    const normalized = reference.replace(/^\/+/, "");
    assert.ok(fs.existsSync(path.join(__dirname, "..", normalized)), `${reference} should exist`);
    assert.ok(isPublicAssetPath(`/${normalized}`), `${reference} should be in the public allowlist`);
  }
});

test("HTTP generation preserves validation and labeled fallback response behavior", async (t) => {
  const app = createApp({ generate: async () => { throw new Error("mock unavailable"); } });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${server.address().port}/api/generate`;

  const invalid = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validRequest, duration: 0 }),
  });
  assert.equal(invalid.status, 400);
  const fallback = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validRequest),
  });
  assert.equal(fallback.status, 200);
  assert.deepEqual(await fallback.json(), { fallback: true, reason: "mock unavailable" });
});

test("malformed and oversized JSON request bodies return explicit client errors", async (t) => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${server.address().port}/api/generate`;

  const malformed = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "JSON request body tidak valid" });
  const oversized = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: "x".repeat(70_000) }),
  });
  assert.equal(oversized.status, 413);
});
