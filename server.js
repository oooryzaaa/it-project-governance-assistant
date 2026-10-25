/**
 * server.js
 * ---------------------------------------------------------------------------
 * Backend Express untuk IT Project Governance Assistant.
 * Menyediakan satu endpoint: POST /api/generate
 *
 * Semua panggilan ke LLM (Google Gemini) dikelola melalui callLLM() agar
 * provider dapat diganti di masa mendatang (mis. IBM watsonx.ai).
 * ---------------------------------------------------------------------------
 */

"use strict";

require("dotenv").config();
const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { getKnownCobitCodes } = require("./cobit-data");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname)));

// ── LLM provider wrapper ────────────────────────────────────────────────────
/**
 * callLLM(prompt)
 * Kirim prompt ke LLM dan kembalikan teks respons mentah.
 * Ganti isi fungsi ini untuk beralih ke provider lain (mis. IBM watsonx.ai).
 *
 * @param {string} prompt  Prompt lengkap yang akan dikirim ke LLM.
 * @returns {Promise<string>} Teks mentah dari LLM.
 */
async function callLLM(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY tidak dikonfigurasi di file .env");
  }
  if (!modelName) {
    throw new Error("GEMINI_MODEL tidak dikonfigurasi di file .env");
  }

  const genai = new GoogleGenAI({ apiKey });
  const response = await genai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  // Gunakan getter .text() bawaan SDK untuk akses yang lebih aman
  const text = response.text;
  if (!text) throw new Error("LLM mengembalikan respons kosong");
  return text;
}

// ── Validasi skema JSON hasil LLM ──────────────────────────────────────────
/**
 * validateSchema(data)
 * Periksa struktur dasar objek JSON yang dikembalikan LLM.
 * Lempar Error bila field wajib tidak ada.
 *
 * @param {object} data Objek yang sudah di-parse dari JSON.
 */
function validateSchema(data) {
  const required = ["charter", "wbs", "risk_register", "cost_estimate", "assumptions"];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      throw new Error(`Skema tidak valid: field '${key}' tidak ditemukan`);
    }
  }

  // charter
  const charterFields = ["objective", "in_scope", "out_of_scope", "stakeholders", "deliverables", "milestones"];
  for (const f of charterFields) {
    if (!Object.prototype.hasOwnProperty.call(data.charter, f)) {
      throw new Error(`Skema charter tidak valid: field '${f}' tidak ditemukan`);
    }
  }

  // wbs
  if (!Array.isArray(data.wbs) || data.wbs.length === 0) {
    throw new Error("Skema tidak valid: 'wbs' harus array tidak kosong");
  }
  for (const item of data.wbs) {
    for (const f of ["id", "name", "level", "deliverable", "completion_criteria"]) {
      if (!Object.prototype.hasOwnProperty.call(item, f)) {
        throw new Error(`Skema WBS tidak valid: field '${f}' tidak ditemukan`);
      }
    }
  }

  // risk_register
  if (!Array.isArray(data.risk_register) || data.risk_register.length < 6) {
    throw new Error("Skema tidak valid: 'risk_register' harus memiliki minimal 6 entri");
  }

  // cost_estimate
  if (!Array.isArray(data.cost_estimate) || data.cost_estimate.length === 0) {
    throw new Error("Skema tidak valid: 'cost_estimate' harus array tidak kosong");
  }

  // assumptions
  if (!Array.isArray(data.assumptions)) {
    throw new Error("Skema tidak valid: 'assumptions' harus berupa array");
  }
}

// ── Validasi input request ─────────────────────────────────────────────────
/**
 * validateRequestBody(body)
 * Periksa dan bersihkan input dari frontend.
 * Lempar Error bila field wajib tidak ada atau nilainya tidak valid.
 *
 * @param {object} body  req.body
 * @returns {object} data yang sudah dibersihkan
 */
function validateRequestBody(body) {
  const {
    projectName, objective, duration, teamSize, category, budgetRange,
    // Phase 2A optional fields — pass through if present, ignore if absent
    startDate, pmName, methodology, keyDeliverables, successCriteria, projectContext,
  } = body || {};

  if (!projectName || typeof projectName !== "string" || projectName.trim() === "") {
    throw new Error("Nama proyek wajib diisi");
  }
  if (!objective || typeof objective !== "string" || objective.trim() === "") {
    throw new Error("Tujuan proyek wajib diisi");
  }

  const durationNum = (typeof duration === "number" || typeof duration === "string") ? Number(duration) : NaN;
  if (!Number.isInteger(durationNum) || durationNum < 1 || durationNum > 520) {
    throw new Error("Durasi harus berupa angka antara 1 dan 520 minggu");
  }

  const teamSizeNum = (typeof teamSize === "number" || typeof teamSize === "string") ? Number(teamSize) : NaN;
  if (!Number.isInteger(teamSizeNum) || teamSizeNum < 1 || teamSizeNum > 500) {
    throw new Error("Ukuran tim harus berupa angka antara 1 dan 500");
  }

  const validCategories = ["web", "mobile", "data_ai", "infrastructure"];
  if (!validCategories.includes(category)) {
    throw new Error("Kategori proyek tidak valid");
  }

  if (!budgetRange || typeof budgetRange !== "string" || budgetRange.trim() === "") {
    throw new Error("Kisaran anggaran wajib diisi");
  }

  // Sanitize optional string fields (accept only if non-empty strings; else undefined)
  const optStr = (v, max) => (v && typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

  return {
    projectName:     projectName.trim().slice(0, 200),
    objective:       objective.trim().slice(0, 1000),
    duration:        durationNum,
    teamSize:        teamSizeNum,
    category,
    budgetRange:     budgetRange.trim().slice(0, 200),
    // optional — undefined when not supplied, so JSON.stringify omits them
    startDate:        optStr(startDate, 20),
    pmName:           optStr(pmName, 200),
    methodology:      optStr(methodology, 100),
    keyDeliverables:  optStr(keyDeliverables, 1000),
    successCriteria:  optStr(successCriteria, 1000),
    projectContext:   optStr(projectContext, 1000),
  };
}

// ── Buat prompt untuk LLM ──────────────────────────────────────────────────
function buildPrompt(data) {
  const {
    projectName, objective, duration, teamSize, category, budgetRange,
    startDate, pmName, methodology, keyDeliverables, successCriteria, projectContext,
  } = data;

  const categoryLabels = {
    web: "Aplikasi Web",
    mobile: "Aplikasi Mobile",
    data_ai: "Data/AI",
    infrastructure: "Infrastruktur TI",
  };

  // Build optional context lines — only include when the user supplied them
  const optLines = [
    startDate       && `- Tanggal Mulai: ${startDate}`,
    pmName          && `- Project Manager: ${pmName}`,
    methodology     && `- Metodologi: ${methodology}`,
    keyDeliverables && `- Deliverable Utama yang Diharapkan:\n${keyDeliverables.split(/\r?\n/).filter(Boolean).map(l => `    • ${l}`).join("\n")}`,
    successCriteria && `- Kriteria Keberhasilan:\n${successCriteria.split(/\r?\n/).filter(Boolean).map(l => `    • ${l}`).join("\n")}`,
    projectContext  && `- Konteks & Fitur Utama:\n  ${projectContext}`,
  ].filter(Boolean).join("\n");

  return `
Kamu adalah konsultan manajemen proyek TI. Gunakan HANYA informasi dari input pengguna.
Hal apapun yang kamu tambahkan yang tidak disebutkan pengguna HARUS dicatat di 'assumptions'.
Jangan mengarang nama orang, perusahaan, atau angka nyata, kecuali nilai biaya yang diberi label estimasi.
Tulis dalam Bahasa Indonesia.
Kembalikan HANYA JSON yang valid, tanpa markdown, sesuai skema yang diberikan.

Input Proyek:
- Nama Proyek: ${projectName}
- Tujuan: ${objective}
- Durasi: ${duration} minggu
- Ukuran Tim: ${teamSize} orang
- Kategori: ${categoryLabels[category]}
- Kisaran Anggaran: ${budgetRange}
${optLines ? optLines + "\n" : ""}
Skema JSON yang harus dikembalikan (tidak ada field lain):
{
  "charter": {
    "objective": "string",
    "in_scope": ["string"],
    "out_of_scope": ["string"],
    "stakeholders": ["string"],
    "deliverables": ["string"],
    "milestones": ["string"]
  },
  "wbs": [
    { "id": "string", "name": "string", "level": 1|2|3, "deliverable": "string", "completion_criteria": "string" }
  ],
  "risk_register": [
    { "id": "string", "description": "string", "probability": "low"|"medium"|"high", "impact": "low"|"medium"|"high", "mitigation": "string" }
  ],
  "cost_estimate": [
    { "category": "string", "hours": number, "rate": number, "subtotal": number }
  ],
  "assumptions": ["string"]
}

Pastikan:
- charter.in_scope, out_of_scope, deliverables, dan stakeholders mencerminkan proyek "${projectName}" secara spesifik — bukan template generik.
- WBS memiliki 3 level dan mencakup semua deliverable utama.
- risk_register memiliki minimal 6 risiko, termasuk risiko keamanan dan kepatuhan.
- cost_estimate menggunakan jam-orang × tarif per jam, semua nilai adalah estimasi.
- Semua nilai subtotal = hours × rate.
- Jangan tambahkan field di luar skema.
`.trim();
}

// ── Endpoint POST /api/generate ────────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  let cleanData;

  // 1. Validasi input
  try {
    cleanData = validateRequestBody(req.body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // 2. Panggil LLM
  let rawText;
  try {
    const prompt = buildPrompt(cleanData);
    rawText = await callLLM(prompt);
  } catch (err) {
    console.error("[LLM Error]", err.message);
    return res.status(200).json({ fallback: true, reason: err.message });
  }

  // 3. Bersihkan markdown fences, parse JSON
  let parsed;
  try {
    // Hapus blok ```json ... ``` atau ``` ... ``` jika ada
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[JSON Parse Error]", err.message, "| Raw:", rawText.slice(0, 200));
    return res.status(200).json({ fallback: true, reason: "LLM mengembalikan JSON tidak valid" });
  }

  // 4. Validasi skema
  try {
    validateSchema(parsed);
  } catch (err) {
    console.error("[Schema Error]", err.message);
    return res.status(200).json({ fallback: true, reason: err.message });
  }

  // 5. Validasi kode COBIT bila ada di respons
  // (COBIT governance dilakukan di frontend, tapi tandai kode tidak dikenal bila
  //  LLM menyertakan field 'cobit_mappings' tak terduga)
  const knownCodes = getKnownCobitCodes();
  if (parsed.cobit_mappings && Array.isArray(parsed.cobit_mappings)) {
    parsed.cobit_mappings = parsed.cobit_mappings.map((m) => ({
      ...m,
      unknown: knownCodes.size > 0 && !knownCodes.has(m.code),
    }));
  }

  return res.status(200).json({ success: true, data: parsed });
});

// ── Health check ───────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", mode: "AI", timestamp: new Date().toISOString() });
});

// ── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`IT Project Governance Assistant berjalan di http://localhost:${PORT}`);
  console.log(`Model LLM  : ${process.env.GEMINI_MODEL || "(belum dikonfigurasi)"}`);
  console.log(`API Key    : ${process.env.GEMINI_API_KEY ? "✓ terkonfigurasi" : "✗ BELUM diset"}`);
});
