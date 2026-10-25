"use strict";

function validateSchema(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Skema respons tidak valid: harus berupa objek");
  }

  const required = ["charter", "wbs", "risk_register", "cost_estimate", "assumptions"];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      throw new Error(`Skema tidak valid: field '${key}' tidak ditemukan`);
    }
  }

  if (!data.charter || typeof data.charter !== "object" || Array.isArray(data.charter)) {
    throw new Error("Skema charter tidak valid");
  }
  const charterFields = ["objective", "in_scope", "out_of_scope", "stakeholders", "deliverables", "milestones"];
  for (const field of charterFields) {
    if (!Object.prototype.hasOwnProperty.call(data.charter, field)) {
      throw new Error(`Skema charter tidak valid: field '${field}' tidak ditemukan`);
    }
  }

  if (!Array.isArray(data.wbs) || data.wbs.length === 0) {
    throw new Error("Skema tidak valid: 'wbs' harus array tidak kosong");
  }
  for (const item of data.wbs) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Skema WBS tidak valid: setiap item harus berupa objek");
    }
    for (const field of ["id", "name", "level", "deliverable", "completion_criteria"]) {
      if (!Object.prototype.hasOwnProperty.call(item, field)) {
        throw new Error(`Skema WBS tidak valid: field '${field}' tidak ditemukan`);
      }
    }
  }

  if (!Array.isArray(data.risk_register) || data.risk_register.length < 6) {
    throw new Error("Skema tidak valid: 'risk_register' harus memiliki minimal 6 entri");
  }
  if (!Array.isArray(data.cost_estimate) || data.cost_estimate.length === 0) {
    throw new Error("Skema tidak valid: 'cost_estimate' harus array tidak kosong");
  }
  if (!Array.isArray(data.assumptions)) {
    throw new Error("Skema tidak valid: 'assumptions' harus berupa array");
  }
}

function validateRequestBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Isi request harus berupa objek JSON");
  }
  const {
    projectName, objective, duration, teamSize, category, budgetRange,
    startDate, pmName, methodology, keyDeliverables, successCriteria, projectContext,
  } = body;

  if (typeof projectName !== "string" || projectName.trim() === "") {
    throw new Error("Nama proyek wajib diisi");
  }
  if (typeof objective !== "string" || objective.trim() === "") {
    throw new Error("Tujuan proyek wajib diisi");
  }

  const durationNum = typeof duration === "number" || typeof duration === "string" ? Number(duration) : NaN;
  if (!Number.isInteger(durationNum) || durationNum < 1 || durationNum > 520) {
    throw new Error("Durasi harus berupa angka antara 1 dan 520 minggu");
  }
  const teamSizeNum = typeof teamSize === "number" || typeof teamSize === "string" ? Number(teamSize) : NaN;
  if (!Number.isInteger(teamSizeNum) || teamSizeNum < 1 || teamSizeNum > 500) {
    throw new Error("Ukuran tim harus berupa angka antara 1 dan 500");
  }

  const validCategories = ["web", "mobile", "data_ai", "infrastructure"];
  if (!validCategories.includes(category)) throw new Error("Kategori proyek tidak valid");
  if (typeof budgetRange !== "string" || budgetRange.trim() === "") {
    throw new Error("Kisaran anggaran wajib diisi");
  }

  const limits = {
    projectName: 200,
    objective: 1000,
    budgetRange: 200,
    startDate: 20,
    pmName: 200,
    methodology: 100,
    keyDeliverables: 1000,
    successCriteria: 1000,
    projectContext: 1000,
  };
  const rawValues = {
    projectName, objective, budgetRange, startDate, pmName, methodology,
    keyDeliverables, successCriteria, projectContext,
  };
  for (const [field, value] of Object.entries(rawValues)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string") throw new Error(`Field '${field}' harus berupa teks`);
    if (value.length > limits[field]) throw new Error(`Field '${field}' melebihi batas ${limits[field]} karakter`);
  }
  const optionalString = (value) => typeof value === "string" && value.trim() ? value.trim() : undefined;

  return {
    projectName: projectName.trim(),
    objective: objective.trim(),
    duration: durationNum,
    teamSize: teamSizeNum,
    category,
    budgetRange: budgetRange.trim(),
    startDate: optionalString(startDate),
    pmName: optionalString(pmName),
    methodology: optionalString(methodology),
    keyDeliverables: optionalString(keyDeliverables),
    successCriteria: optionalString(successCriteria),
    projectContext: optionalString(projectContext),
  };
}

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
  const optionalLines = [
    startDate && `- Tanggal Mulai: ${startDate}`,
    pmName && `- Project Manager: ${pmName}`,
    methodology && `- Metodologi: ${methodology}`,
    keyDeliverables && `- Deliverable Utama yang Diharapkan:\n${keyDeliverables.split(/\r?\n/).filter(Boolean).map((line) => `    • ${line}`).join("\n")}`,
    successCriteria && `- Kriteria Keberhasilan:\n${successCriteria.split(/\r?\n/).filter(Boolean).map((line) => `    • ${line}`).join("\n")}`,
    projectContext && `- Konteks & Fitur Utama:\n  ${projectContext}`,
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
${optionalLines ? `${optionalLines}\n` : ""}
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

function parseModelResponse(rawText) {
  if (typeof rawText !== "string" || rawText.length > 256_000) {
    throw new Error("Respons AI tidak valid atau terlalu besar");
  }
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

module.exports = { validateSchema, validateRequestBody, buildPrompt, parseModelResponse };
