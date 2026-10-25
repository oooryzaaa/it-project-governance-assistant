"use strict";

(function (root, factory) {
  const feature = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanCobitFeature = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
/**
 * runGovernanceReview(doc, input)
 * Pemetaan COBIT 2019, KPI, dan skor kesesuaian indikatif.
 * Hanya menggunakan kode dari COBIT_OBJECTIVES (cobit-data.js).
 *
 * @param {object} doc    Dokumen yang sudah di-generate
 * @param {object} input  Data form pengguna
 * @returns {object} { mappings, kpis, score, criteria }
 */
function runGovernanceReview(doc, input, objectives) {
  // Pemetaan COBIT berdasarkan kategori proyek dan isi dokumen
  const mappings = buildCobitMappings(doc, input, objectives);

  // KPI – 3 sampai 5
  const kpis = buildKPIs(doc, input, mappings);

  // Skor kesesuaian indikatif
  const { criteria, total, maxTotal, percentage } = computeScore(doc, input, objectives);

  return { mappings, kpis, criteria, total, maxTotal, percentage };
}

/**
 * buildCobitMappings()
 * Pilih hingga 5 objective COBIT 2019 yang paling relevan dengan konteks proyek
 * menggunakan pendekatan pencocokan kata kunci berbasis tag.
 *
 * PENDEKATAN (deterministik, tanpa AI eksternal):
 *  1. Bangun korpus sinyal dari input: kategori, tujuan, nama proyek, deliverable.
 *  2. Hitung skor setiap objective dari jumlah tag-nya yang cocok dengan korpus.
 *  3. Tambahkan bonus kategori untuk objective yang secara struktural relevan
 *     terhadap tipe proyek tertentu (mis. BAI04 selalu relevan untuk infrastruktur).
 *  4. Ambil 5 teratas; urutan deklarasi sebagai tiebreaker (deterministik).
 *  5. Hasilkan alasan spesifik yang merujuk elemen dokumen nyata.
 *
 * CATATAN: Ini adalah rekomendasi perencanaan indikatif, bukan audit COBIT resmi,
 * penilaian kematangan, atau sertifikasi kepatuhan.
 */
function buildCobitMappings(doc, input, objectives) {
  if (!objectives || objectives.length === 0) {
    return [{
      code: "TODO",
      name: "cobit-data.js belum diisi",
      reason: "Isi file cobit-data.js dengan objective COBIT 2019 yang sesuai untuk mengaktifkan fitur ini.",
      unknown: true,
    }];
  }

  // ── 1. Bangun korpus sinyal ──────────────────────────────────────────────
  // S1.A-2 / S1.E-22: Guard all charter arrays against null/undefined
  const safeCharterDeliverables = Array.isArray(doc.charter?.deliverables) ? doc.charter.deliverables : [];
  const safeCharterInScope      = Array.isArray(doc.charter?.in_scope)     ? doc.charter.in_scope     : [];
  const safeRiskRegister        = Array.isArray(doc.risk_register)         ? doc.risk_register        : [];

  const corpus = [
    input.projectName   || "",
    input.objective     || "",
    input.category      || "",
    input.keyDeliverables || "",
    input.projectContext  || "",
    ...safeCharterDeliverables,
    ...safeCharterInScope,
    // Sample risk descriptions to catch security/compliance signals
    ...safeRiskRegister.slice(0, 6).map((r) => (r.description || "") + " " + (r.mitigation || "")),
  ].join(" ").toLowerCase();

  // ── 2. Bonus per kategori proyek ─────────────────────────────────────────
  // Daftar objective yang secara struktural penting untuk setiap kategori,
  // bahkan jika kata kunci tidak muncul secara eksplisit di input.
  const CATEGORY_BONUS = {
    web:            ["BAI03", "BAI02", "APO11", "DSS05", "MEA03"],
    mobile:         ["BAI03", "BAI02", "APO11", "DSS05", "APO04"],
    data_ai:        ["APO14", "APO04", "APO12", "DSS05", "MEA03"],
    infrastructure: ["BAI04", "BAI10", "DSS01", "DSS04", "BAI07"],
  };
  const bonusCodes = new Set(CATEGORY_BONUS[input.category] || []);

  // Objective yang universal untuk semua proyek (selalu mendapat sedikit bonus)
  const UNIVERSAL_BONUS = new Set(["BAI11", "EDM02", "APO12"]);

  // ── 3. Hitung skor setiap objective ─────────────────────────────────────
  const scored = objectives.map((obj) => {
    const tags = Array.isArray(obj.tags) ? obj.tags : [];
    // Hitung berapa banyak tag yang muncul di korpus (substring match)
    const tagHits = tags.filter((tag) => corpus.includes(tag));
    let score = tagHits.length;
    if (bonusCodes.has(obj.code))   score += 3;
    if (UNIVERSAL_BONUS.has(obj.code)) score += 1;
    return { obj, score, tagHits };
  });

  // ── 4. Urutkan dan ambil 5 teratas ───────────────────────────────────────
  // sort() stabil di V8, sehingga urutan deklarasi dipertahankan sebagai tiebreaker.
  scored.sort((a, b) => b.score - a.score);
  const top5 = scored.slice(0, 5);

  // ── 5. Kembalikan pemetaan dengan alasan spesifik ────────────────────────
  return top5.map(({ obj, tagHits }) => ({
    code: obj.code,
    name: obj.name,
    reason: buildMappingReason(obj, doc, input, tagHits),
    unknown: false,
  }));
}

/**
 * buildMappingReason()
 * Hasilkan penjelasan satu-dua kalimat yang spesifik untuk mengapa objective ini
 * relevan dengan proyek ini. Merujuk elemen dokumen nyata (deliverable, kategori,
 * risiko) alih-alih teks boilerplate generik.
 */
function buildMappingReason(obj, doc, input, tagHits) {
  const hits = Array.isArray(tagHits) ? tagHits : [];
  const projectName  = input.projectName || "proyek ini";
  const categoryMap  = {
    web:            "pengembangan aplikasi web",
    mobile:         "pengembangan aplikasi mobile",
    data_ai:        "proyek data/AI",
    infrastructure: "migrasi/implementasi infrastruktur TI",
  };
  const categoryLabel = categoryMap[input.category] || "proyek TI";

  // Ambil deliverable pertama yang relevan, atau fallback ke kategori
  // S1.A-2: Guard against null deliverables
  const firstDeliverable = (Array.isArray(doc.charter?.deliverables) ? doc.charter.deliverables : [])[0];
  const anchor = firstDeliverable
    ? `deliverable "${firstDeliverable}"`
    : `lingkup ${categoryLabel}`;

  // Susun kalimat berdasarkan domain objective
  const domain = obj.code.slice(0, 3); // "EDM", "APO", "BAI", "DSS", "MEA"

  const domainIntro = {
    EDM: `Dari sisi tata kelola (EDM), ${obj.name} relevan untuk memastikan`,
    APO: `Dari sisi perencanaan (APO), ${obj.name} relevan untuk mengelola`,
    BAI: `Dari sisi pembangunan (BAI), ${obj.name} relevan untuk`,
    DSS: `Dari sisi operasional (DSS), ${obj.name} relevan untuk`,
    MEA: `Dari sisi pemantauan (MEA), ${obj.name} relevan untuk`,
  }[domain] || `Objective ${obj.code} relevan untuk`;

  // Bangun konteks spesifik dari sinyal yang terdeteksi
  let context = "";
  if (hits.length > 0) {
    // Pilih maksimal 2 tag yang paling informatif (hindari kata terlalu pendek)
    const shown = hits.filter((t) => t.length > 3).slice(0, 2);
    if (shown.length > 0) {
      context = ` — sinyal terdeteksi: ${shown.join(", ")}`;
    }
  }

  return `${domainIntro} aspek ${anchor} pada proyek "${projectName}" (${categoryLabel})${context}. ` +
    `Ini adalah rekomendasi perencanaan indikatif, bukan audit atau sertifikasi COBIT resmi.`;
}

function buildKPIs(doc, input, mappings) {
  const baseKPIs = [
    {
      kpi: "Persentase milestone selesai tepat waktu",
      target: "≥ 90% milestone dicapai sesuai jadwal",
      objective: mappings[0]?.code || "N/A",
    },
    {
      kpi: "Tingkat kepuasan pengguna akhir",
      target: "Skor kepuasan ≥ 4/5 pada survei UAT",
      objective: mappings[1]?.code || mappings[0]?.code || "N/A",
    },
    {
      kpi: "Jumlah risiko kritis yang dimitigasi",
      // S1.A-2 / S1.E-22: Guard against null risk_register from AI
      target: `${(Array.isArray(doc.risk_register) ? doc.risk_register : []).filter((r) => r.impact === "high").length} risiko berdampak tinggi memiliki rencana mitigasi aktif`,
      objective: mappings[2]?.code || mappings[0]?.code || "N/A",
    },
    {
      kpi: "Utilisasi anggaran proyek",
      target: "Realisasi biaya ≤ 110% dari estimasi awal",
      objective: mappings[0]?.code || "N/A",
    },
    {
      kpi: "Cakupan pengujian (test coverage)",
      target: "Coverage kode ≥ 80% untuk modul utama",
      objective: mappings[1]?.code || mappings[0]?.code || "N/A",
    },
  ];

  return baseKPIs.slice(0, 5);
}

/**
 * computeScore()
 * Hitung skor kesesuaian indikatif berdasarkan 5 kriteria, masing-masing 0-2.
 */
function computeScore(doc, input, objectives) {
  const criteria = [];

  // K1: Tujuan proyek memetakan ke setidaknya satu objective COBIT
  const hasObjectives = Array.isArray(objectives) && objectives.length > 0;
  const k1Score = hasObjectives ? 2 : (doc.charter.objective && doc.charter.objective.length > 10 ? 1 : 0);
  criteria.push({
    id: "K1",
    label: "Tujuan proyek memetakan ke setidaknya satu objective COBIT",
    score: k1Score,
    max: 2,
    reason: hasObjectives
      ? "Tujuan proyek berhasil dipetakan ke objective COBIT yang terdaftar."
      : doc.charter.objective
      ? "Tujuan proyek ada namun cobit-data.js belum diisi; mapping tidak dapat dilakukan (skor parsial)."
      : "data tidak cukup – tujuan proyek tidak ditemukan.",
  });

  // K2: Risiko keamanan dan kepatuhan tercakup dalam risk register
  // S1.A-2 / S1.E-22: Guard against null risk_register
  const securityRisks = (Array.isArray(doc.risk_register) ? doc.risk_register : []).filter((r) =>
    /(keamanan|kepatuhan|security|compliance|privasi|data|regulasi|UU|ISO|GDPR)/i.test(r.description + r.mitigation)
  );
  const k2Score = securityRisks.length >= 2 ? 2 : securityRisks.length === 1 ? 1 : 0;
  criteria.push({
    id: "K2",
    label: "Risiko keamanan dan kepatuhan tercakup dalam risk register",
    score: k2Score,
    max: 2,
    reason: k2Score === 2
      ? `${securityRisks.length} risiko keamanan/kepatuhan ditemukan dalam risk register.`
      : k2Score === 1
      ? "Hanya 1 risiko keamanan/kepatuhan ditemukan; disarankan tambah cakupan."
      : "data tidak cukup – tidak ditemukan risiko keamanan/kepatuhan dalam risk register.",
  });

  // K3: Indikator keberhasilan yang terukur ada
  // S1.A-2: Guard missing arrays — charter may arrive from AI without these fields
  const safeMilestones   = Array.isArray(doc.charter.milestones)   ? doc.charter.milestones   : [];
  const safeDeliverables = Array.isArray(doc.charter.deliverables) ? doc.charter.deliverables : [];
  const hasKPIHint = safeMilestones.length >= 3 && safeDeliverables.length >= 3;
  const k3Score = hasKPIHint ? 2 : safeMilestones.length > 0 ? 1 : 0;
  criteria.push({
    id: "K3",
    label: "Indikator keberhasilan yang terukur ada",
    score: k3Score,
    max: 2,
    reason: k3Score === 2
      ? `${safeMilestones.length} milestone dan ${safeDeliverables.length} deliverable teridentifikasi.`
      : k3Score === 1
      ? "Milestone ada namun belum memadai sebagai indikator keberhasilan."
      : "data tidak cukup – milestone dan deliverable tidak ditemukan.",
  });

  // K4: Peran dan akuntabilitas stakeholder jelas
  // S1.A-2: Guard missing stakeholders array
  const safeStakeholders = Array.isArray(doc.charter.stakeholders) ? doc.charter.stakeholders : [];
  const stakeholderDetail = safeStakeholders.filter((s) => s.includes("–") || s.includes("-")).length;
  const k4Score = stakeholderDetail >= 3 ? 2 : safeStakeholders.length >= 2 ? 1 : 0;
  criteria.push({
    id: "K4",
    label: "Peran dan akuntabilitas stakeholder jelas",
    score: k4Score,
    max: 2,
    reason: k4Score === 2
      ? `${stakeholderDetail} stakeholder memiliki deskripsi peran yang jelas.`
      : k4Score === 1
      ? "Stakeholder terdaftar namun peran belum seluruhnya didefinisikan."
      : "data tidak cukup – stakeholder tidak ditemukan.",
  });

  // K5: Manfaat proyek terdefinisi
  const hasDeliverables = safeDeliverables.length >= 3;
  const hasBenefit = doc.charter.objective && doc.charter.objective.length > 20;
  const k5Score = hasDeliverables && hasBenefit ? 2 : hasBenefit ? 1 : 0;
  criteria.push({
    id: "K5",
    label: "Manfaat proyek terdefinisi",
    score: k5Score,
    max: 2,
    reason: k5Score === 2
      ? "Tujuan proyek dan deliverable cukup untuk mendefinisikan manfaat."
      : k5Score === 1
      ? "Tujuan ada namun deliverable kurang spesifik untuk mendefinisikan manfaat."
      : "data tidak cukup – tujuan proyek tidak ditemukan.",
  });

  const total = criteria.reduce((s, c) => s + c.score, 0);
  const maxTotal = criteria.reduce((s, c) => s + c.max, 0);
  const percentage = Math.round((total / maxTotal) * 100);

  return { criteria, total, maxTotal, percentage };
}

  return Object.freeze({
    runGovernanceReview,
    buildCobitMappings,
    buildMappingReason,
    buildKPIs,
    computeScore,
  });
});
