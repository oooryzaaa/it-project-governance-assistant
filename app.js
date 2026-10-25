/**
 * app.js
 * ---------------------------------------------------------------------------
 * Frontend logic untuk IT Project Governance Assistant.
 * Vanilla JavaScript – tanpa framework.
 *
 * Fitur:
 *  - TEMPLATE MODE  : generate dokumen dari template per kategori (offline)
 *  - AI MODE        : kirim ke POST /api/generate, fallback ke template bila gagal
 *  - GOVERNANCE REVIEW: pemetaan COBIT 2019, KPI, skor kesesuaian indikatif
 *  - EXPORT         : CSV per seksi + print-friendly view (PDF)
 * ---------------------------------------------------------------------------
 */

"use strict";

// ── State aplikasi ──────────────────────────────────────────────────────────
/** @type {'template'|'ai'} */
let currentMode = "template";

/** Menyimpan data dokumen terakhir yang di-generate */
let currentDoc = null;

/** Input form terakhir */
let currentInput = null;

/**
 * S1.A-4: Cost-edit tracking state.
 * Set to true when the user has made any edits to the cost table (hours,
 * rate, non-labor, or contingency %) since the last generation.  Reset to
 * false after a confirmed re-generation or after a fresh render.
 */
let costEdited = false;

let generationRequestId = 0;

// ── DOM helpers ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function parseProjectDate(value) {
  const match = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.getUTCFullYear() !== Number(match[1]) ||
      date.getUTCMonth() !== Number(match[2]) - 1 ||
      date.getUTCDate() !== Number(match[3])) return null;
  return date;
}

function projectDateAtWeek(startDate, week) {
  const date = parseProjectDate(startDate);
  if (!date || !Number.isFinite(Number(week))) return null;
  date.setUTCDate(date.getUTCDate() + Math.round(Number(week) * 7));
  return date;
}

function formatProjectDate(date, month = "long") {
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString("id-ID", { day: "numeric", month, year: "numeric", timeZone: "UTC" })
    : "";
}

// ── Template data per kategori ──────────────────────────────────────────────

/**
 * generateTemplate(input)
 * Buat dokumen perencanaan proyek dari template sesuai kategori.
 *
 * @param {object} input  Data form: projectName, objective, duration,
 *                        teamSize, category, budgetRange
 * @returns {object} Struktur dokumen lengkap
 */
function generateTemplate(input) {
  const {
    projectName, objective, duration, teamSize, category, budgetRange,
    // optional Phase 2A fields — all may be undefined for backward-compat
    startDate, pmName, keyDeliverables, successCriteria, methodology, projectContext,
  } = input;

  // Teks per kategori
  const categoryMeta = {
    web: {
      label: "Aplikasi Web",
      inScope: [
        "Pengembangan antarmuka pengguna berbasis web",
        "Implementasi backend API RESTful",
        "Integrasi basis data relasional",
        "Pengujian fungsional dan keamanan aplikasi web",
        "Deployment ke server/cloud",
      ],
      outScope: [
        "Pengembangan aplikasi mobile native",
        "Migrasi data dari sistem lama (kecuali disebutkan)",
        "Pelatihan pengguna akhir di luar lingkup tim proyek",
      ],
      deliverables: [
        "Dokumen spesifikasi kebutuhan perangkat lunak (SKPL)",
        "Prototipe antarmuka pengguna",
        "Aplikasi web yang sudah diuji",
        "Panduan penggunaan aplikasi",
        "Laporan pengujian dan UAT",
      ],
      wbsPhases: ["Inisiasi & Perencanaan", "Analisis Kebutuhan", "Desain UI/UX", "Pengembangan Frontend", "Pengembangan Backend", "Pengujian", "Deployment & Penutupan"],
      risks: [
        { desc: "Perubahan kebutuhan pengguna di tengah proyek", prob: "high", imp: "high", mit: "Lakukan review kebutuhan setiap sprint; gunakan manajemen perubahan formal", family: "scope-change" },
        { desc: "Celah keamanan pada aplikasi web (XSS, SQL Injection)", prob: "medium", imp: "high", mit: "Terapkan OWASP Top 10; lakukan code review dan pengujian penetrasi", family: "web-security" },
        { desc: "Keterlambatan integrasi dengan sistem pihak ketiga", prob: "medium", imp: "medium", mit: "Identifikasi dependensi eksternal lebih awal; buat stub/mock API", family: "third-party-integration" },
        { desc: "Kinerja aplikasi tidak memenuhi target (response time)", prob: "low", imp: "high", mit: "Lakukan load testing; optimalkan query dan caching" },
        { desc: "Anggota tim mengundurkan diri atau tidak tersedia", prob: "low", imp: "high", mit: "Dokumentasikan pengetahuan teknis; siapkan rencana penggantian SDM", family: "team-availability" },
        { desc: "Ketidakpatuhan terhadap regulasi perlindungan data (UU PDP)", prob: "medium", imp: "high", mit: "Review compliance dengan UU PDP; implementasi enkripsi data sensitif", family: "data-compliance" },
      ],
      costCategories: ["Analisis & Desain", "Pengembangan Frontend", "Pengembangan Backend", "Pengujian & QA", "Deployment & DevOps", "Manajemen Proyek"],
    },
    mobile: {
      label: "Aplikasi Mobile",
      inScope: [
        "Pengembangan aplikasi mobile (Android/iOS)",
        "Desain antarmuka mobile (UX/UI)",
        "Integrasi dengan backend API",
        "Pengujian di berbagai perangkat dan sistem operasi",
        "Publikasi ke app store",
      ],
      outScope: [
        "Pengembangan versi web dari aplikasi",
        "Dukungan perangkat dengan OS di bawah versi minimum",
        "Pembuatan konten media (grafis, video) oleh tim proyek",
      ],
      deliverables: [
        "Wireframe dan prototipe interaktif",
        "Aplikasi mobile yang telah diuji",
        "Dokumentasi API",
        "Panduan rilis ke app store",
        "Laporan pengujian perangkat",
      ],
      wbsPhases: ["Inisiasi & Perencanaan", "Riset Pengguna & Analisis", "Desain UX/UI Mobile", "Pengembangan Aplikasi", "Integrasi Backend", "Pengujian & QA", "Rilis & Penutupan"],
      risks: [
        { desc: "Fragmentasi perangkat dan versi OS menyebabkan bug", prob: "high", imp: "medium", mit: "Buat matriks perangkat target; gunakan emulator dan perangkat fisik representatif", family: "mobile-compat" },
        { desc: "Penolakan aplikasi oleh app store", prob: "medium", imp: "high", mit: "Ikuti panduan developer Google/Apple; review kebijakan sebelum submission", family: "app-store-rejection" },
        { desc: "Konsumsi baterai dan data yang berlebihan", prob: "medium", imp: "medium", mit: "Profil performa sejak tahap pengembangan; optimalkan background process" },
        { desc: "Kebocoran data pengguna melalui izin aplikasi berlebihan", prob: "medium", imp: "high", mit: "Terapkan prinsip least privilege; audit izin aplikasi secara berkala", family: "credential-access" },
        { desc: "Keterlambatan feedback dari penguji beta", prob: "low", imp: "medium", mit: "Jadwalkan sesi pengujian beta lebih awal; siapkan form feedback terstruktur" },
        { desc: "Ketidakpatuhan terhadap kebijakan privasi app store", prob: "low", imp: "high", mit: "Buat privacy policy yang komprehensif; review sebelum setiap submission", family: "data-compliance" },
      ],
      costCategories: ["Riset & Analisis", "Desain UX/UI", "Pengembangan Mobile", "Integrasi Backend", "Pengujian QA", "Manajemen Proyek"],
    },
    data_ai: {
      label: "Data/AI",
      inScope: [
        "Pengumpulan dan pembersihan data (ETL)",
        "Pengembangan dan pelatihan model machine learning/AI",
        "Pembuatan dashboard analitik",
        "Validasi dan evaluasi model",
        "Dokumentasi metodologi dan model",
      ],
      outScope: [
        "Pengumpulan data primer di lapangan (kecuali disebutkan)",
        "Implementasi model ke sistem produksi di luar lingkup proyek",
        "Pembelian lisensi data dari pihak ketiga",
      ],
      deliverables: [
        "Dataset bersih yang terdokumentasi",
        "Model AI/ML yang sudah divalidasi",
        "Dashboard analitik interaktif",
        "Laporan evaluasi model (akurasi, presisi, recall)",
        "Dokumentasi teknis pipeline data",
      ],
      wbsPhases: ["Inisiasi & Perencanaan", "Pengumpulan & Eksplorasi Data", "Persiapan Data (ETL)", "Pengembangan Model", "Evaluasi & Validasi", "Visualisasi & Dashboard", "Dokumentasi & Penutupan"],
      risks: [
        { desc: "Kualitas data input rendah menyebabkan model tidak akurat", prob: "high", imp: "high", mit: "Definisikan kriteria kualitas data; lakukan profiling data sebelum pemodelan" },
        { desc: "Bias dalam data pelatihan menghasilkan keputusan tidak adil", prob: "medium", imp: "high", mit: "Analisis bias data; gunakan teknik fairness-aware ML" },
        { desc: "Overfitting model sehingga performa pada data baru buruk", prob: "medium", imp: "high", mit: "Gunakan cross-validation; pisahkan dataset training/validation/test" },
        { desc: "Pelanggaran privasi data pengguna (GDPR/UU PDP)", prob: "medium", imp: "high", mit: "Terapkan anonymisasi/pseudonymisasi; buat data governance policy", family: "data-compliance" },
        { desc: "Kapasitas komputasi tidak mencukupi untuk pelatihan model", prob: "low", imp: "medium", mit: "Estimasi kebutuhan komputasi lebih awal; pertimbangkan cloud computing" },
        { desc: "Ketergantungan pada data pihak ketiga yang tidak stabil", prob: "medium", imp: "medium", mit: "Buat mekanisme backup data; negosiasikan SLA dengan penyedia data", family: "third-party-integration" },
      ],
      costCategories: ["Pengumpulan & ETL Data", "Pengembangan Model AI/ML", "Infrastruktur Komputasi", "Validasi & Pengujian", "Dashboard & Visualisasi", "Manajemen Proyek"],
    },
    infrastructure: {
      label: "Infrastruktur TI",
      inScope: [
        "Perancangan arsitektur infrastruktur TI",
        "Pengadaan dan konfigurasi perangkat keras/server",
        "Implementasi jaringan dan keamanan (firewall, VPN)",
        "Setup monitoring dan alerting",
        "Dokumentasi infrastruktur dan runbook",
      ],
      outScope: [
        "Pengembangan aplikasi di atas infrastruktur",
        "Migrasi data dari sistem lama (kecuali disebutkan)",
        "Dukungan pengguna akhir setelah go-live",
      ],
      deliverables: [
        "Dokumen arsitektur infrastruktur (diagram jaringan, topologi)",
        "Infrastruktur yang sudah dikonfigurasi dan diuji",
        "Runbook operasional",
        "Laporan security assessment",
        "Panduan disaster recovery",
      ],
      wbsPhases: ["Inisiasi & Perencanaan", "Asesmen Infrastruktur Saat Ini", "Desain Arsitektur", "Pengadaan & Instalasi", "Konfigurasi & Keamanan", "Pengujian & Validasi", "Go-Live & Penutupan"],
      risks: [
        { desc: "Keterlambatan pengadaan perangkat keras", prob: "medium", imp: "high", mit: "Identifikasi vendor lebih awal; siapkan rencana pengadaan alternatif" },
        { desc: "Kerentanan keamanan jaringan (unauthorized access)", prob: "medium", imp: "high", mit: "Lakukan security hardening; implementasi zero-trust architecture", family: "network-security" },
        { desc: "Kegagalan komponen hardware selama implementasi", prob: "low", imp: "high", mit: "Beli komponen redundan; siapkan prosedur failover" },
        { desc: "Ketidaksesuaian antara infrastruktur baru dan sistem lama", prob: "high", imp: "medium", mit: "Lakukan compatibility testing lebih awal; buat migration plan detail", family: "migration-compat" },
        { desc: "Downtime tidak terencana saat migrasi", prob: "medium", imp: "high", mit: "Jadwalkan maintenance window; siapkan rollback plan", family: "migration-downtime" },
        { desc: "Ketidakpatuhan terhadap regulasi keamanan data dan ISO 27001", prob: "low", imp: "high", mit: "Review compliance checklist ISO 27001; libatkan tim keamanan informasi", family: "data-compliance" },
      ],
      costCategories: ["Desain & Arsitektur", "Pengadaan Hardware/Software", "Instalasi & Konfigurasi", "Keamanan & Compliance", "Pengujian & Validasi", "Manajemen Proyek"],
    },
  };

  const meta = categoryMeta[category];
  const baseRate = 150000; // IDR/jam – estimasi

  // Hitung distribusi jam berdasarkan durasi dan ukuran tim
  const totalHours = duration * teamSize * 40 * 0.7; // 70% utilisasi
  const phaseCount = meta.costCategories.length;
  const weights = [0.1, 0.15, 0.2, 0.25, 0.15, 0.15];

  // ── Parse optional multi-line inputs ────────────────────────────────────
  // Split textarea values on newlines; filter blank lines; cap at 5 items.
  const parseLines = (raw, max) =>
    (raw || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, max);

  const userDeliverables    = parseLines(keyDeliverables, 5);
  const userSuccessCriteria = parseLines(successCriteria, 10);

  // ── Decide whether to use deliverable-driven or category-static paths ──
  // Phase 2B: when user supplies deliverables, all three (scope, WBS, milestones)
  // become deliverable-driven. Fallback to category-static when no deliverables given.
  const useDeliverablePath = userDeliverables.length > 0;

  // ── Scope ────────────────────────────────────────────────────────────────
  let finalInScope, finalOutScope;
  if (useDeliverablePath) {
    const scope = buildDeliverableScope(userDeliverables, meta);
    finalInScope  = scope.inScope;
    finalOutScope = scope.outScope;
  } else {
    finalInScope  = meta.inScope;
    finalOutScope = meta.outScope;
  }

  // ── Deliverables list for Charter ────────────────────────────────────────
  const finalDeliverables = useDeliverablePath ? userDeliverables : meta.deliverables;

  // ── WBS & Milestones ─────────────────────────────────────────────────────
  let wbs, milestoneStrings;

  if (useDeliverablePath) {
    // Phase 2B path: deliverable-oriented WBS + milestones aligned to WBS L1 phases
    const result = buildDeliverableWBS(userDeliverables, duration);
    wbs              = result.wbs;
    milestoneStrings = buildDeliverableMilestones(result.l1Phases, duration, startDate);
  } else {
    // Category-static path (original behaviour — full backward compat)
    wbs = [];
    meta.wbsPhases.forEach((phase, phaseIdx) => {
      const phaseId = `${phaseIdx + 1}`;
      wbs.push({
        id: phaseId,
        name: phase,
        level: 1,
        deliverable: `Semua deliverable fase ${phase}`,
        completion_criteria: `Semua work package Level 2 pada fase ini telah disetujui oleh Project Manager`,
      });
      const subActivities = getSubActivities(category, phaseIdx);
      subActivities.forEach((sub, subIdx) => {
        const subId = `${phaseId}.${subIdx + 1}`;
        wbs.push({ id: subId, name: sub.name, level: 2, deliverable: sub.deliverable, completion_criteria: sub.criteria });
        wbs.push({
          id: `${subId}.1`,
          name: `Eksekusi: ${sub.name}`,
          level: 3,
          deliverable: `Artefak teknis untuk ${sub.name}`,
          completion_criteria: `Dokumen/artefak direview dan disetujui oleh lead teknis`,
        });
      });
    });

    // Category-static milestones (with or without start date)
    if (startDate) {
      milestoneStrings = meta.wbsPhases.map((phase, i) => {
        const weekEnd = Math.round(((i + 1) / meta.wbsPhases.length) * duration);
        const milestoneDate = projectDateAtWeek(startDate, weekEnd);
        return milestoneDate ? `${formatProjectDate(milestoneDate)}: ${phase} selesai` : `Minggu ${weekEnd}: ${phase} selesai`;
      });
    } else {
      milestoneStrings = meta.wbsPhases.map((phase, i) => {
        const weekEnd = Math.round(((i + 1) / meta.wbsPhases.length) * duration);
        return `Minggu ${weekEnd}: ${phase} selesai`;
      });
    }
  }

  // ── Compute header dates (independent of WBS path) ───────────────────────
  let startDateLabel  = "Belum ditentukan";
  let finishDateLabel = "Belum ditentukan";
  if (startDate) {
    const start = parseProjectDate(startDate);
    const finish = projectDateAtWeek(startDate, duration);
    if (start && finish) {
      startDateLabel  = formatProjectDate(start);
      finishDateLabel = formatProjectDate(finish);
    }
  }

  // ── Domain-specific 6th stakeholder role ─────────────────────────────────
  const domainRoles = {
    web:            "Tim DevOps – Mengelola deployment dan pipeline CI/CD",
    mobile:         "Mobile QA Engineer – Mengujian aplikasi di berbagai perangkat target",
    data_ai:        "Data Engineer – Menyiapkan dan memelihara pipeline data",
    infrastructure: "Network/System Engineer – Merancang dan mengkonfigurasi infrastruktur",
  };

  // ── Project Charter ─────────────────────────────────────────────────────
  const charter = {
    objective,
    in_scope:     finalInScope,
    out_of_scope: finalOutScope,
    stakeholders: [
      `Project Manager${pmName ? " (" + pmName + ")" : ""} – Bertanggung jawab atas keseluruhan proyek`,
      "Tim Pengembang – Melaksanakan pekerjaan teknis",
      "Product Owner / Sponsor – Menyetujui deliverable dan anggaran",
      "Pengguna Akhir – Memberikan feedback dan melakukan UAT",
      "Tim QA – Memastikan kualitas deliverable",
      domainRoles[category] || "Tim Teknis – Melaksanakan pekerjaan spesialisasi",
    ],
    deliverables: finalDeliverables,
    milestones:   milestoneStrings,
    // Phase 2A identity fields
    project_title:    projectName,
    start_date:       startDateLabel,
    finish_date:      finishDateLabel,
    budget_info:      budgetRange,
    pm_name:          pmName || "",
    methodology:      methodology || "",
    success_criteria: userSuccessCriteria,
    project_context:  projectContext || "",
  };

  // ── Risk Register (Phase 4: contextual, deliverable-aware) ──────────────
  const contextualRisks = buildContextualRisks(userDeliverables, meta, input);
  const risk_register = contextualRisks.map((r, i) => ({
    id: `R${String(i + 1).padStart(2, "0")}`,
    description: r.desc,
    probability: r.prob,
    impact: r.imp,
    mitigation: r.mit,
  }));

  // ── Cost Estimate ───────────────────────────────────────────────────────
  // Each row: labor cost (hours × rate) + non-labor cost = row_total.
  // non_labor defaults to 0 and is editable by the user.
  const cost_estimate = meta.costCategories.map((cat, i) => {
    const w = weights[i] || 1 / phaseCount;
    const hours = Math.round(totalHours * w);
    const labor = hours * baseRate;
    const non_labor = 0;
    const row_total = labor + non_labor;
    return { category: cat, hours, rate: baseRate, subtotal: labor, non_labor, row_total };
  });

  // ── Cost Summary (contingency reserve + grand total) ────────────────────
  // contingency_pct is an editable template assumption, not a mandatory standard.
  // Default 10% as per the reference cost estimate template (cost estimate.xlsx row 21).
  const contingency_pct = 10;
  const cost_subtotal = cost_estimate.reduce((s, c) => s + c.row_total, 0);
  const contingency_reserve = Math.round(cost_subtotal * contingency_pct / 100);
  const grand_total = cost_subtotal + contingency_reserve;

  // ── Assumptions ─────────────────────────────────────────────────────────
  const assumptions = [
    `Tim proyek terdiri dari ${teamSize} anggota yang bekerja penuh waktu`,
    `Durasi proyek adalah ${duration} minggu kalender`,
    `Anggaran yang tersedia dalam kisaran ${budgetRange}`,
    `Tarif per jam diasumsikan Rp ${baseRate.toLocaleString("id-ID")} (estimasi standar industri lokal)`,
    "Sponsor proyek tersedia untuk review dan persetujuan rutin",
    "Infrastruktur dasar (komputer, internet) sudah tersedia",
    "Tidak ada perubahan organisasi besar selama durasi proyek",
    ...(startDate    ? [] : ["[Asumsi] Tanggal mulai proyek belum ditentukan; milestone menggunakan nomor minggu relatif"]),
    ...(pmName       ? [] : ["[Asumsi] Nama Project Manager belum ditentukan"]),
    ...(methodology  ? [`Proyek menggunakan metodologi ${methodology}`] : ["[Asumsi] Metodologi pengembangan belum ditentukan"]),
    ...(userDeliverables.length > 0  ? [] : ["[Asumsi] Deliverable utama menggunakan template standar kategori proyek"]),
    ...(userSuccessCriteria.length > 0 ? [] : ["[Asumsi] Kriteria keberhasilan akan ditentukan bersama stakeholder"]),
  ];

  return { charter, wbs, risk_register, cost_estimate, cost_summary: { contingency_pct, cost_subtotal, contingency_reserve, grand_total }, assumptions };
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2B — Deliverable-driven scope, WBS, and milestones
// ═══════════════════════════════════════════════════════════════════════════

/**
 * buildDeliverableScope(userDeliverables, meta)
 *
 * When the user has supplied key deliverables, generate project-specific
 * in-scope and out-of-scope lists instead of the static category template.
 *
 * Rules:
 *  • Every user deliverable becomes an in-scope item.
 *  • Generic cross-cutting activities (requirements, testing, PM) are always in scope.
 *  • Out-of-scope items from the category template are kept ONLY if they do not
 *    contradict any user deliverable (case-insensitive keyword match).
 *  • Category template's own in-scope list is dropped to avoid confusing users
 *    with generic tasks that may not apply (e.g. firewall/VPN for Kos Pintar).
 *
 * @param {string[]} userDeliverables  Parsed deliverable lines from user input.
 * @param {object}   meta              Category meta object with .outScope array.
 * @returns {{ inScope: string[], outScope: string[] }}
 */
function buildDeliverableScope(userDeliverables, meta) {
  // Build in-scope: one item per deliverable + standard PM activities
  const inScope = [
    ...userDeliverables.map((d) => `Pengembangan dan implementasi: ${d}`),
    "Pengujian fungsional dan penerimaan pengguna (UAT) untuk semua deliverable",
    "Manajemen proyek dan koordinasi tim",
    "Dokumentasi teknis dan serah terima kepada tim operasional",
  ];

  // Cross-language synonym pairs: if the deliverable text contains the English word,
  // treat the Indonesian equivalent as a match too (and vice versa).
  // This prevents "Pengembangan aplikasi" from surviving as out-of-scope when
  // the user supplied a deliverable like "Web application".
  const synonymPairs = [
    ["application", "aplikasi"],
    ["app",         "aplikasi"],
    ["web",         "web"],
    ["mobile",      "mobile"],
    ["dashboard",   "dashboard"],
    ["data",        "data"],
    ["system",      "sistem"],
    ["database",    "database"],
    ["monitoring",  "monitoring"],
    ["integration", "integrasi"],
    ["payment",     "pembayaran"],
    ["report",      "laporan"],
    ["testing",     "pengujian"],
    ["document",    "dokumentasi"],
  ];

  // Build an expanded keyword set from user deliverables including cross-language synonyms
  const rawKeywords = userDeliverables
    .join(" ")
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  const expandedKeywords = new Set(rawKeywords);
  synonymPairs.forEach(([en, id]) => {
    if (rawKeywords.includes(en))  expandedKeywords.add(id);
    if (rawKeywords.includes(id))  expandedKeywords.add(en);
  });

  // Keep an out-of-scope item only if none of its significant words appear
  // in the expanded deliverable keyword set
  const outScope = meta.outScope.filter((item) => {
    const itemWords = item.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    return !itemWords.some((w) => expandedKeywords.has(w));
  });

  // Always add a standard clarifying out-of-scope statement
  outScope.push("Pengembangan fitur di luar daftar deliverable yang telah disepakati");
  outScope.push("Pelatihan pengguna akhir di luar lingkup tim proyek (kecuali disebutkan)");

  return { inScope, outScope };
}

/**
 * buildDeliverableWBS(userDeliverables, duration, startDate)
 *
 * Build a 3-level, deliverable-oriented WBS when user deliverables are present.
 *
 * Structure:
 *  L1  1  – Inisiasi & Perencanaan
 *  L1  2…N – one phase per user deliverable (Pengembangan [deliverable])
 *  L1  N+1 – Pengujian & Jaminan Kualitas
 *  L1  N+2 – Penutupan Proyek
 *
 * Each L1 phase gets 2 L2 work packages.
 * Each L2 work package gets 1 L3 task with a meaningful description.
 *
 * @param {string[]} userDeliverables
 * @param {number}   duration   Project duration in weeks (for completion criteria phrasing)
 * @returns {{ wbs: object[], l1Phases: string[] }}
 */
function buildDeliverableWBS(userDeliverables, duration) {
  const wbs = [];

  // Fixed phases surrounding deliverable development phases
  const initiationPhase = "Inisiasi & Perencanaan";
  const testingPhase    = "Pengujian & Jaminan Kualitas";
  const closingPhase    = "Penutupan Proyek";

  // Collect all L1 phase names in order (used for milestone generation)
  const l1Phases = [
    initiationPhase,
    ...userDeliverables.map((d) => `Pengembangan: ${d}`),
    testingPhase,
    closingPhase,
  ];

  // ── Work-package templates per phase type ──────────────────────────────
  // Each entry: { name, deliverable, criteria, l3name, l3deliverable }
  const initiationWPs = [
    {
      name: "Penyusunan Project Charter & Rencana Proyek",
      deliverable: "Project Charter dan Project Management Plan yang disetujui",
      criteria: "Ditandatangani oleh Project Manager dan sponsor",
      l3: { name: "Finalisasi dan distribusi Project Charter", deliverable: "Project Charter v1.0", criteria: "Dokumen diterima semua stakeholder" },
    },
    {
      name: "Analisis Kebutuhan & Kick-off",
      deliverable: "Dokumen analisis kebutuhan awal dan notulen kick-off",
      criteria: "Semua stakeholder utama telah dikonfirmasi",
      l3: { name: "Pelaksanaan rapat kick-off proyek", deliverable: "Notulen kick-off", criteria: "Ditandatangani peserta rapat" },
    },
  ];

  const testingWPs = [
    {
      name: "Pengujian Integrasi & Fungsional",
      deliverable: "Laporan pengujian integrasi seluruh deliverable",
      criteria: "Semua skenario uji utama lulus; 0 defect kritis terbuka",
      l3: { name: "Eksekusi skenario pengujian integrasi", deliverable: "Test execution report", criteria: "Coverage ≥ 80% pada modul utama" },
    },
    {
      name: "User Acceptance Testing (UAT)",
      deliverable: "Laporan UAT dengan sign-off pengguna",
      criteria: "Sign-off UAT diterima dari Product Owner",
      l3: { name: "Pelaksanaan sesi UAT dengan pengguna", deliverable: "UAT sign-off document", criteria: "Pengguna menyetujui semua deliverable" },
    },
  ];

  const closingWPs = [
    {
      name: "Serah Terima Deliverable & Dokumentasi",
      deliverable: "Paket serah terima lengkap (semua deliverable + dokumentasi)",
      criteria: "Semua deliverable telah diterima tim operasional",
      l3: { name: "Finalisasi dokumen serah terima", deliverable: "Berita Acara Serah Terima", criteria: "Ditandatangani semua pihak" },
    },
    {
      name: "Penutupan Proyek & Lessons Learned",
      deliverable: "Laporan penutupan proyek dan lessons learned",
      criteria: "Laporan disetujui Project Manager dan didistribusikan",
      l3: { name: "Penyusunan laporan penutupan", deliverable: "Laporan penutupan proyek", criteria: "Semua aksi penutupan terselesaikan" },
    },
  ];

  // ── Helpers to push L1 + L2 + L3 rows ────────────────────────────────
  let phaseNum = 0;

  const pushPhase = (phaseName, workPackages) => {
    phaseNum += 1;
    const phaseId = String(phaseNum);
    wbs.push({
      id: phaseId,
      name: phaseName,
      level: 1,
      deliverable: `Semua deliverable pada fase ${phaseName}`,
      completion_criteria: "Semua work package Level 2 pada fase ini telah disetujui oleh Project Manager",
    });
    workPackages.forEach((wp, wpIdx) => {
      const wpId = `${phaseId}.${wpIdx + 1}`;
      wbs.push({ id: wpId, name: wp.name, level: 2, deliverable: wp.deliverable, completion_criteria: wp.criteria });
      wbs.push({
        id: `${wpId}.1`,
        name: wp.l3.name,
        level: 3,
        deliverable: wp.l3.deliverable,
        completion_criteria: wp.l3.criteria,
      });
    });
  };

  // ── Build each phase ──────────────────────────────────────────────────
  pushPhase(initiationPhase, initiationWPs);

  userDeliverables.forEach((deliverable) => {
    const phaseName = `Pengembangan: ${deliverable}`;
    // Two work packages per deliverable phase
    const devWPs = [
      {
        name: `Analisis & Desain: ${deliverable}`,
        deliverable: `Dokumen desain dan spesifikasi untuk ${deliverable}`,
        criteria: "Spesifikasi disetujui Product Owner sebelum implementasi dimulai",
        l3: {
          name: `Penyusunan spesifikasi detail ${deliverable}`,
          deliverable: `Spesifikasi teknis ${deliverable} v1.0`,
          criteria: "Direview dan disetujui lead teknis",
        },
      },
      {
        name: `Implementasi & Verifikasi: ${deliverable}`,
        deliverable: `${deliverable} yang telah diimplementasi dan diverifikasi`,
        criteria: "Fungsionalitas utama berjalan sesuai spesifikasi; unit test passed",
        l3: {
          name: `Pengujian unit dan code review: ${deliverable}`,
          deliverable: "Laporan pengujian unit dan catatan code review",
          criteria: "0 bug kritis; code review selesai",
        },
      },
    ];
    pushPhase(phaseName, devWPs);
  });

  pushPhase(testingPhase, testingWPs);
  pushPhase(closingPhase,  closingWPs);

  return { wbs, l1Phases };
}

/**
 * buildDeliverableMilestones(l1Phases, duration, startDate)
 *
 * Map each L1 WBS phase to a milestone date/week string.
 * Mirrors the existing milestone-string format (with or without start date).
 *
 * @param {string[]} l1Phases
 * @param {number}   duration  Weeks
 * @param {string}   startDate ISO date string or empty
 * @returns {string[]}
 */
function buildDeliverableMilestones(l1Phases, duration, startDate) {
  const count = l1Phases.length;
  if (startDate) {
    return l1Phases.map((phase, i) => {
      const weekEnd = Math.round(((i + 1) / count) * duration);
      const milestoneDate = projectDateAtWeek(startDate, weekEnd);
      return milestoneDate ? `${formatProjectDate(milestoneDate)}: ${phase} selesai` : `Minggu ${weekEnd}: ${phase} selesai`;
    });
  }
  return l1Phases.map((phase, i) => {
    const weekEnd = Math.round(((i + 1) / count) * duration);
    return `Minggu ${weekEnd}: ${phase} selesai`;
  });
}

// ── End Phase 2B helpers ────────────────────────────────────────────────────

/** Sub-aktivitas per fase per kategori */
function getSubActivities(category, phaseIndex) {
  const activities = {
    web: [
      [{ name: "Penyusunan Project Charter", deliverable: "Project Charter", criteria: "Ditandatangani sponsor" }, { name: "Rencana Manajemen Proyek", deliverable: "Project Plan", criteria: "Disetujui Project Manager" }],
      [{ name: "Wawancara Stakeholder", deliverable: "Notulen wawancara", criteria: "Minimal 3 stakeholder diwawancarai" }, { name: "Dokumentasi Kebutuhan", deliverable: "SKPL v1.0", criteria: "Direview dan disetujui Product Owner" }],
      [{ name: "Wireframe", deliverable: "Wireframe semua halaman", criteria: "Disetujui Product Owner" }, { name: "Prototipe Interaktif", deliverable: "Prototipe Figma/Adobe XD", criteria: "Lulus usability test" }],
      [{ name: "Implementasi Komponen UI", deliverable: "Komponen frontend", criteria: "Unit test passed ≥80%" }, { name: "Integrasi State Management", deliverable: "State flow", criteria: "Code review selesai" }],
      [{ name: "Implementasi API", deliverable: "Endpoint API terdokumentasi", criteria: "Semua endpoint lolos integration test" }, { name: "Implementasi Database", deliverable: "Skema database", criteria: "Migration script berjalan sukses" }],
      [{ name: "Pengujian Unit & Integrasi", deliverable: "Laporan test", criteria: "Coverage ≥80%, 0 bug kritis" }, { name: "User Acceptance Testing", deliverable: "Laporan UAT", criteria: "Sign-off dari Product Owner" }],
      [{ name: "Deployment ke Production", deliverable: "Aplikasi live", criteria: "Uptime 99% selama 48 jam pertama" }, { name: "Penutupan Proyek", deliverable: "Laporan penutupan", criteria: "Semua deliverable diserahterimakan" }],
    ],
    mobile: [
      [{ name: "Penyusunan Project Charter", deliverable: "Project Charter", criteria: "Ditandatangani sponsor" }, { name: "Rencana Manajemen Proyek", deliverable: "Project Plan", criteria: "Disetujui Project Manager" }],
      [{ name: "Riset Pengguna", deliverable: "User persona & journey map", criteria: "Minimal 5 responden" }, { name: "Analisis Kompetitor", deliverable: "Laporan analisis", criteria: "Mencakup minimal 3 aplikasi serupa" }],
      [{ name: "Wireframe Mobile", deliverable: "Wireframe semua screen", criteria: "Disetujui Product Owner" }, { name: "Panduan Desain (Design System)", deliverable: "Design system", criteria: "Mencakup komponen utama" }],
      [{ name: "Pengembangan Fitur Utama", deliverable: "Modul fitur utama", criteria: "Unit test passed" }, { name: "Implementasi Navigasi", deliverable: "Alur navigasi", criteria: "Berfungsi di Android & iOS" }],
      [{ name: "Integrasi REST API", deliverable: "Integrasi backend", criteria: "Semua endpoint tersambung" }, { name: "Implementasi Push Notification", deliverable: "Fitur notifikasi", criteria: "Berfungsi di kedua platform" }],
      [{ name: "Pengujian Perangkat", deliverable: "Laporan compatibility test", criteria: "Lulus di min. 5 perangkat target" }, { name: "UAT & Beta Test", deliverable: "Laporan beta test", criteria: "NPS ≥7 dari penguji beta" }],
      [{ name: "Submission ke App Store", deliverable: "Aplikasi di store", criteria: "Diterima oleh Google/Apple" }, { name: "Penutupan Proyek", deliverable: "Laporan penutupan", criteria: "Semua deliverable diserahterimakan" }],
    ],
    data_ai: [
      [{ name: "Penyusunan Project Charter", deliverable: "Project Charter", criteria: "Ditandatangani sponsor" }, { name: "Rencana Manajemen Proyek", deliverable: "Project Plan", criteria: "Disetujui Project Manager" }],
      [{ name: "Identifikasi Sumber Data", deliverable: "Katalog sumber data", criteria: "Semua sumber teridentifikasi" }, { name: "Eksplorasi Data (EDA)", deliverable: "Laporan EDA", criteria: "Distribusi & anomali terdokumentasi" }],
      [{ name: "Pembersihan Data", deliverable: "Dataset bersih", criteria: "Missing value < 5%, tidak ada duplikat" }, { name: "Feature Engineering", deliverable: "Dataset siap model", criteria: "Fitur terdokumentasi" }],
      [{ name: "Pengembangan Baseline Model", deliverable: "Model baseline", criteria: "Metrik baseline terdokumentasi" }, { name: "Tuning & Optimasi Model", deliverable: "Model final", criteria: "Akurasi ≥ target yang disepakati" }],
      [{ name: "Evaluasi Model", deliverable: "Laporan evaluasi model", criteria: "Confusion matrix & metrik lengkap" }, { name: "Validasi Bias & Fairness", deliverable: "Laporan bias analysis", criteria: "Tidak ada bias signifikan" }],
      [{ name: "Pembuatan Dashboard", deliverable: "Dashboard interaktif", criteria: "Disetujui Product Owner" }, { name: "Dokumentasi Pipeline", deliverable: "Dokumentasi teknis", criteria: "Dapat direproduksi oleh tim lain" }],
      [{ name: "Handover Model & Data", deliverable: "Paket deliverable lengkap", criteria: "Diterima tim operasional" }, { name: "Penutupan Proyek", deliverable: "Laporan penutupan", criteria: "Semua deliverable diserahterimakan" }],
    ],
    infrastructure: [
      [{ name: "Penyusunan Project Charter", deliverable: "Project Charter", criteria: "Ditandatangani sponsor" }, { name: "Rencana Manajemen Proyek", deliverable: "Project Plan", criteria: "Disetujui Project Manager" }],
      [{ name: "Inventaris Infrastruktur Saat Ini", deliverable: "Laporan asesmen", criteria: "Semua komponen terdokumentasi" }, { name: "Gap Analysis", deliverable: "Gap analysis report", criteria: "Disetujui stakeholder teknis" }],
      [{ name: "Desain Arsitektur Jaringan", deliverable: "Network diagram", criteria: "Direview tim keamanan" }, { name: "Desain Keamanan", deliverable: "Security architecture", criteria: "Lulus review compliance" }],
      [{ name: "Pengadaan Hardware", deliverable: "Purchase order", criteria: "Semua PO disetujui" }, { name: "Instalasi Hardware", deliverable: "Hardware terpasang", criteria: "Burn-in test passed" }],
      [{ name: "Konfigurasi Server & Jaringan", deliverable: "Konfigurasi terdokumentasi", criteria: "Sesuai baseline keamanan" }, { name: "Implementasi Firewall & VPN", deliverable: "Firewall rules & VPN", criteria: "Penetration test passed" }],
      [{ name: "Load Testing", deliverable: "Laporan load test", criteria: "Memenuhi SLA yang disepakati" }, { name: "Disaster Recovery Test", deliverable: "DR test report", criteria: "RTO/RPO tercapai" }],
      [{ name: "Go-Live & Monitoring", deliverable: "Infrastruktur aktif", criteria: "Uptime 99,9% selama 72 jam pertama" }, { name: "Penutupan Proyek", deliverable: "Laporan penutupan + runbook", criteria: "Semua deliverable diserahterimakan" }],
    ],
  };

  const cats = activities[category] || activities.web;
  return cats[phaseIndex % cats.length] || [];
}


// ═══════════════════════════════════════════════════════════════════════════
// Phase 4 — Contextual Risk Register
// ═══════════════════════════════════════════════════════════════════════════

/**
 * buildContextualRisks(userDeliverables, meta, input)
 *
 * Generate a project-specific risk register by combining:
 *  1. Relevant risks from the category template (scored by keyword match).
 *  2. Deliverable-specific risks drawn from a lookup table keyed on
 *     normalised keywords found in the user's deliverable text.
 *  3. Universal project-management risks that apply to every project.
 *
 * Deduplication: two complementary mechanisms prevent duplicates:
 *  • 6-word normalised key: catches identical phrasing
 *  • family identifier (optional string on each risk): blocks semantically
 *    equivalent risks with different wording (e.g. two "migration downtime"
 *    risks, one from meta.risks and one from DELIVERABLE_RISK_TABLE).
 *    Risks that share a family but have genuinely distinct causes should
 *    use different family codes (e.g. "network-security" vs "web-security").
 *
 * When no deliverables are supplied the function returns meta.risks unchanged
 * (full backward compatibility with the category-static path).
 *
 * SCHEMA per entry returned: { desc, prob, imp, mit }
 * These are mapped to { id, description, probability, impact, mitigation }
 * by the caller in generateTemplate().
 *
 * NOTE: All probability/impact values are planning estimates, not objectively
 * measured ratings.
 *
 * @param {string[]} userDeliverables  Parsed deliverable lines (may be empty).
 * @param {object}   meta              Category meta from categoryMeta map.
 * @param {object}   input             Full form input (category, objective, etc.).
 * @returns {{ desc, prob, imp, mit }[]}
 */
function buildContextualRisks(userDeliverables, meta, input) {
  // ── Fallback: no deliverables → return category-static risks unchanged ────
  if (!userDeliverables || userDeliverables.length === 0) {
    return meta.risks;
  }

  // ── Build a keyword corpus from project context ───────────────────────────
  const corpus = [
    input.projectName    || "",
    input.objective      || "",
    input.projectContext || "",
    ...userDeliverables,
  ].join(" ").toLowerCase();

  // ── Helper: normalise a risk description to a dedup key ──────────────────
  // Take the first 6 words of the description, lowercased.
  const dedupKey = (desc) =>
    desc.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 6).join(" ");

  const seenKeys    = new Set(); // dedup by 6-word normalised description
  const seenFamilies = new Set(); // dedup by risk-family identifier
  const risks = [];

  const addRisk = (r) => {
    const key = dedupKey(r.desc);
    if (seenKeys.has(key)) return;
    // Block a second risk from the same family — same event, different wording.
    if (r.family && seenFamilies.has(r.family)) return;
    seenKeys.add(key);
    if (r.family) seenFamilies.add(r.family);
    risks.push(r);
  };

  // ── 1. Select relevant category risks (max 3, scored by corpus match) ────
  // Score each category risk by counting corpus words that appear in its desc+mit.
  const scoredMeta = meta.risks.map((r) => {
    const text = (r.desc + " " + r.mit).toLowerCase();
    const words = corpus.split(/\s+/).filter((w) => w.length > 4);
    const hits  = words.filter((w) => text.includes(w)).length;
    return { r, hits };
  });
  scoredMeta.sort((a, b) => b.hits - a.hits);
  // Always include at least the top-3 from the category, regardless of hit count.
  scoredMeta.slice(0, 3).forEach(({ r }) => addRisk(r));

  // ── 2. Deliverable-specific risk lookup table ─────────────────────────────
  // Each entry: { match: [...keywords], risks: [...{desc,prob,imp,mit}] }
  // A deliverable triggers an entry when ANY of its keywords match the deliverable text.
  // Keywords are matched as substrings of the lowercased deliverable string.
  const DELIVERABLE_RISK_TABLE = [
    // ── Payment / transaction ──────────────────────────────────────────────
    {
      match: ["payment", "pembayaran", "transaksi", "transaction", "wallet", "fintech"],
      risks: [
        {
          desc: "Kegagalan transaksi pembayaran akibat gangguan gateway atau konektivitas jaringan",
          prob: "medium", imp: "high",
          mit: "Implementasi mekanisme retry dan notifikasi kegagalan; pilih payment gateway dengan SLA tinggi",
        },
        {
          desc: "Risiko penipuan (fraud) dan akses tidak sah pada data transaksi keuangan",
          prob: "medium", imp: "high",
          mit: "Terapkan autentikasi dua faktor, enkripsi end-to-end, dan audit log transaksi",
        },
      ],
    },
    // ── IoT / sensor / device ──────────────────────────────────────────────
    {
      match: ["iot", "sensor", "device", "perangkat", "monitoring", "listrik", "electricity", "smart", "kontrol akses", "access control"],
      risks: [
        {
          desc: "Perangkat IoT/sensor tidak dapat terhubung ke jaringan akibat interferensi atau konfigurasi yang salah",
          prob: "high", imp: "medium",
          mit: "Lakukan survei jaringan lapangan sebelum instalasi; siapkan prosedur konfigurasi ulang perangkat",
        },
        {
          desc: "Data sensor tidak akurat atau hilang akibat kegagalan perangkat keras di lokasi fisik",
          prob: "medium", imp: "medium",
          mit: "Implementasi redundansi sensor pada titik kritis; tambahkan mekanisme heartbeat monitoring",
        },
        {
          desc: "Celah keamanan pada perangkat IoT yang terhubung ke jaringan (firmware tidak diperbarui)",
          prob: "medium", imp: "high",
          mit: "Terapkan kebijakan pembaruan firmware terjadwal; segmentasi jaringan IoT dari jaringan utama",
        },
      ],
    },
    // ── Mobile application ─────────────────────────────────────────────────
    {
      match: ["mobile", "android", "ios", "aplikasi mobile", "app store"],
      risks: [
        {
          desc: "Aplikasi mobile ditolak oleh platform app store karena tidak memenuhi kebijakan terbaru",
          prob: "medium", imp: "high",
          mit: "Review panduan kebijakan Google Play/App Store sebelum submission; siapkan dokumentasi privasi",
        },
        {
          desc: "Kompatibilitas aplikasi mobile bermasalah pada versi OS atau tipe perangkat tertentu",
          prob: "high", imp: "medium",
          mit: "Definisikan matriks perangkat target; lakukan pengujian di emulator dan perangkat fisik representatif",
        },
      ],
    },
    // ── Web application / frontend / backend ───────────────────────────────
    {
      match: ["web", "website", "aplikasi web", "frontend", "backend", "api", "rest"],
      risks: [
        {
          desc: "Perubahan kebutuhan pengguna di tengah proyek memperluas lingkup tanpa penyesuaian jadwal",
          prob: "high", imp: "high",
          mit: "Tetapkan proses perubahan formal (change request); lakukan review lingkup setiap sprint",
          family: "scope-change",
        },
        {
          desc: "Celah keamanan aplikasi web (XSS, SQL Injection, CSRF) membahayakan data pengguna",
          prob: "medium", imp: "high",
          mit: "Terapkan OWASP Top 10; lakukan code review keamanan dan pengujian penetrasi sebelum go-live",
          family: "web-security",
        },
      ],
    },
    // ── Database / data storage ────────────────────────────────────────────
    {
      match: ["database", "basis data", "data storage", "mysql", "postgresql", "mongodb"],
      risks: [
        {
          desc: "Korupsi atau kehilangan data akibat kegagalan database tanpa prosedur backup yang memadai",
          prob: "low", imp: "high",
          mit: "Implementasi backup otomatis harian; uji prosedur restore secara berkala",
        },
      ],
    },
    // ── Migration / cloud ──────────────────────────────────────────────────
    {
      match: ["migrasi", "migration", "cloud", "server", "infrastructure", "infrastruktur", "deployment"],
      risks: [
        {
          desc: "Downtime layanan tidak terencana selama proses migrasi ke lingkungan baru",
          prob: "medium", imp: "high",
          mit: "Jadwalkan migrasi pada jendela pemeliharaan resmi; siapkan rollback plan yang telah diuji",
          family: "migration-downtime",
        },
        {
          desc: "Inkompatibilitas konfigurasi antara lingkungan lama dan baru menyebabkan kegagalan layanan",
          prob: "high", imp: "medium",
          mit: "Lakukan pengujian kompatibilitas di lingkungan staging sebelum cutover produksi",
          family: "migration-compat",
        },
        {
          desc: "Biaya operasional cloud melebihi estimasi akibat penggunaan sumber daya yang tidak terpantau",
          prob: "medium", imp: "medium",
          mit: "Aktifkan cost alerting dan budget cap di platform cloud; review penggunaan setiap dua minggu",
        },
      ],
    },
    // ── Disaster recovery / backup ─────────────────────────────────────────
    {
      match: ["disaster recovery", "backup", "recovery", "pemulihan", "keberlangsungan", "continuity"],
      risks: [
        {
          desc: "Prosedur disaster recovery tidak teruji sehingga RTO/RPO tidak dapat dipenuhi saat insiden nyata",
          prob: "medium", imp: "high",
          mit: "Jadwalkan simulasi DR secara berkala; dokumentasikan dan validasi RTO/RPO setelah setiap uji coba",
        },
      ],
    },
    // ── Security / access control / authentication ─────────────────────────
    {
      match: ["keamanan", "security", "autentikasi", "authentication", "akses", "access", "enkripsi", "encryption", "firewall"],
      risks: [
        {
          desc: "Akses tidak sah ke sistem akibat manajemen kredensial yang lemah atau konfigurasi hak akses yang salah",
          prob: "medium", imp: "high",
          mit: "Terapkan prinsip least privilege; aktifkan autentikasi multi-faktor untuk akun dengan hak tinggi",
          family: "credential-access",
        },
      ],
    },
    // ── Compliance / regulation ────────────────────────────────────────────
    {
      match: ["regulasi", "compliance", "iso", "gdpr", "pdp", "uu pdp", "kepatuhan", "sertifikasi"],
      risks: [
        {
          desc: "Ketidakpatuhan terhadap regulasi perlindungan data (UU PDP/GDPR) akibat penanganan data pribadi yang tidak sesuai",
          prob: "medium", imp: "high",
          mit: "Lakukan assessment compliance sebelum go-live; implementasi enkripsi data pribadi dan kebijakan retensi",
          family: "data-compliance",
        },
      ],
    },
    // ── Dashboard / reporting / analytics ─────────────────────────────────
    {
      match: ["dashboard", "laporan", "report", "analitik", "analytics", "visualisasi"],
      risks: [
        {
          desc: "Data yang ditampilkan di dashboard tidak akurat akibat kesalahan logika agregasi atau pipeline data",
          prob: "medium", imp: "medium",
          mit: "Lakukan validasi data lintas sistem; terapkan unit test untuk setiap kalkulasi laporan kritis",
        },
      ],
    },
    // ── Integration / API / third party ───────────────────────────────────
    {
      match: ["integrasi", "integration", "api pihak ketiga", "third party", "webhook", "external"],
      risks: [
        {
          desc: "Perubahan atau gangguan layanan API pihak ketiga menghambat integrasi sistem",
          prob: "medium", imp: "medium",
          mit: "Identifikasi seluruh dependensi eksternal lebih awal; buat stub/mock API untuk pengembangan paralel",
          family: "third-party-integration",
        },
      ],
    },
    // ── Documentation / knowledge transfer ────────────────────────────────
    {
      match: ["dokumentasi", "documentation", "runbook", "manual", "panduan", "serah terima"],
      risks: [
        {
          desc: "Dokumentasi teknis tidak lengkap saat serah terima, menyebabkan kesulitan operasional tim pemelihara",
          prob: "medium", imp: "medium",
          mit: "Tetapkan standar dokumentasi sejak awal; jadikan kelengkapan dokumen sebagai kriteria penerimaan deliverable",
        },
      ],
    },
    // ── Testing / UAT ─────────────────────────────────────────────────────
    {
      match: ["pengujian", "testing", "uat", "quality assurance", "qa"],
      risks: [
        {
          desc: "Pengujian penerimaan pengguna (UAT) menemukan defect kritis mendekati batas waktu rilis",
          prob: "medium", imp: "high",
          mit: "Libatkan pengguna akhir dalam pengujian iteratif sejak fase pengembangan; siapkan buffer waktu UAT",
        },
      ],
    },
  ];

  // ── Cap constants ────────────────────────────────────────────────────────
  // MAX_FROM_DELIVERABLES: max risks from deliverable + corpus scans combined.
  // MAX_TOTAL enforced after universals; keeps the register readable (≤ 10 rows).
  const MAX_FROM_DELIVERABLES = 7;
  const MAX_TOTAL = 10;

  // Apply the deliverable risk table: for each deliverable, check all entries.
  for (const deliverable of userDeliverables) {
    const dLower = deliverable.toLowerCase();
    for (const entry of DELIVERABLE_RISK_TABLE) {
      if (entry.match.some((kw) => dLower.includes(kw))) {
        for (const r of entry.risks) {
          addRisk(r);
          if (risks.length >= MAX_FROM_DELIVERABLES) break;
        }
      }
      if (risks.length >= MAX_FROM_DELIVERABLES) break;
    }
    if (risks.length >= MAX_FROM_DELIVERABLES) break;
  }

  // Also scan the full corpus for category-level keyword triggers (for context like "cloud" in objective).
  // Only runs if deliverable scan did not already fill the quota.
  if (risks.length < MAX_FROM_DELIVERABLES) {
    for (const entry of DELIVERABLE_RISK_TABLE) {
      if (entry.match.some((kw) => corpus.includes(kw))) {
        for (const r of entry.risks) {
          addRisk(r);
          if (risks.length >= MAX_FROM_DELIVERABLES) break;
        }
      }
      if (risks.length >= MAX_FROM_DELIVERABLES) break;
    }
  }

  // ── 3. Universal project risks (added if not already present) ────────────
  const universalRisks = [
    {
      desc: "Anggota tim kunci mengundurkan diri atau tidak tersedia, mengganggu kesinambungan pengerjaan",
      prob: "low", imp: "high",
      mit: "Dokumentasikan pengetahuan teknis secara berkala; siapkan rencana cadangan SDM dan onboarding cepat",
      family: "team-availability",
    },
    {
      desc: "Lingkup proyek bertambah tanpa penyesuaian jadwal dan anggaran (scope creep)",
      prob: "medium", imp: "high",
      mit: "Tetapkan baseline lingkup yang disetujui; kelola setiap permintaan perubahan melalui proses formal",
    },
  ];
  for (const r of universalRisks) addRisk(r);

  // ── 4. Enforce minimum of 6 risks ────────────────────────────────────────
  // If still below 6 after all the above, pull remaining category risks in order.
  if (risks.length < 6) {
    for (const { r } of scoredMeta.slice(3)) {
      addRisk(r);
      if (risks.length >= 6) break;
    }
  }

  // ── 5. Enforce maximum cap ───────────────────────────────────────────────
  return risks.slice(0, MAX_TOTAL);
}


// ── Governance Review ───────────────────────────────────────────────────────

/**
 * runGovernanceReview(doc, input)
 * Pemetaan COBIT 2019, KPI, dan skor kesesuaian indikatif.
 * Hanya menggunakan kode dari COBIT_OBJECTIVES (cobit-data.js).
 *
 * @param {object} doc    Dokumen yang sudah di-generate
 * @param {object} input  Data form pengguna
 * @returns {object} { mappings, kpis, score, criteria }
 */
function runGovernanceReview(doc, input) {
  // Ambil COBIT_OBJECTIVES dari cobit-data.js (dimuat sebagai script global)
  const objectives = (typeof COBIT_OBJECTIVES !== "undefined") ? COBIT_OBJECTIVES : [];

  // Pemetaan COBIT berdasarkan kategori proyek dan isi dokumen
  const mappings = buildCobitMappings(doc, input, objectives);

  // KPI – 3 sampai 5
  const kpis = buildKPIs(doc, input, mappings);

  // Skor kesesuaian indikatif
  const { criteria, total, maxTotal, percentage } = computeScore(doc, input);

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
function computeScore(doc, input) {
  const criteria = [];

  // K1: Tujuan proyek memetakan ke setidaknya satu objective COBIT
  const hasObjectives = typeof COBIT_OBJECTIVES !== "undefined" && COBIT_OBJECTIVES.length > 0;
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

// ── CSV Export ──────────────────────────────────────────────────────────────

function exportCSV(section) {
  if (!currentDoc) return;

  let rows = [];
  let filename = "export.csv";

  if (section === "charter") {
    filename = "project_charter.csv";
    const c = currentDoc.charter;
    rows = [
      ["Bagian", "Konten"],
      // identity / header fields (Phase 2A)
      ["Nama Proyek",      c.project_title  || ""],
      ["Tanggal Mulai",    c.start_date     || ""],
      ["Proyeksi Selesai", c.finish_date    || ""],
      ["Anggaran",         c.budget_info    || ""],
      ["Project Manager",  c.pm_name        || ""],
      ["Metodologi",       c.methodology    || ""],
      // core charter content
      ["Tujuan", c.objective],
      ...(c.project_context ? [["Konteks Proyek", c.project_context]] : []),
      ...c.in_scope.map((s) => ["Dalam Lingkup", s]),
      ...c.out_of_scope.map((s) => ["Luar Lingkup", s]),
      ...c.deliverables.map((s) => ["Deliverable Utama", s]),
      ...((c.success_criteria || []).map((s) => ["Kriteria Keberhasilan", s])),
      ...c.stakeholders.map((s) => ["Stakeholder", s]),
      ...c.milestones.map((s) => ["Milestone", s]),
    ];
  } else if (section === "wbs") {
    filename = "wbs.csv";
    rows = [["ID", "Nama", "Level", "Deliverable", "Kriteria Penyelesaian"]];
    rows.push(...currentDoc.wbs.map((w) => [w.id, w.name, w.level, w.deliverable, w.completion_criteria]));
  } else if (section === "risk") {
    filename = "risk_register.csv";
    rows = [["ID", "Deskripsi", "Probabilitas", "Dampak", "Mitigasi"]];
    rows.push(...currentDoc.risk_register.map((r) => [r.id, r.description, r.probability, r.impact, r.mitigation]));
  } else if (section === "cost") {
    filename = "estimasi_biaya.csv";
    rows = [["Kategori", "Jam (Hours)", "Tarif (IDR/jam)", "Biaya Tenaga Kerja (IDR)", "Biaya Non-Tenaga Kerja (IDR)", "Total Baris (IDR)"]];
    rows.push(...currentDoc.cost_estimate.map((c) => [
      c.category,
      c.hours,
      c.rate,
      c.subtotal,
      c.non_labor ?? 0,
      c.row_total ?? c.subtotal,
    ]));
    // Summary rows — read from currentDoc.cost_summary (kept in sync by updateCostSummary)
    const cs = currentDoc.cost_summary || {};
    rows.push(["Subtotal", "", "", "", "", cs.cost_subtotal ?? ""]);
    rows.push([`Cadangan Risiko (${cs.contingency_pct ?? 10}%)`, "", "", "", "", cs.contingency_reserve ?? ""]);
    rows.push(["Total Estimasi Akhir", "", "", "", "", cs.grand_total ?? ""]);
  } else if (section === "governance") {
    filename = "governance_review.csv";
    rows = [["Kode COBIT", "Nama Objective", "Alasan Pemetaan"]];
    if (currentDoc._governance) {
      rows.push(...currentDoc._governance.mappings.map((m) => [m.code, m.name, m.reason]));
    }
  }

  const csvContent = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Render helpers ──────────────────────────────────────────────────────────

function renderBadge(mode) {
  const badge = $("mode-badge");
  if (!badge) return;
  // Inner dot + text — preserve the span dot inside the badge
  const dotColor = mode === "ai" ? "bg-emerald-500" : "bg-blue-500";
  const label    = mode === "ai" ? "Mode: AI" : "Mode: Template";
  const cls      = mode === "ai" ? "badge-ai" : "badge-template";
  badge.className = `${cls} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold`;
  badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dotColor} inline-block"></span>${label}`;
}

function renderFallbackNotice(reason) {
  const notice = $("fallback-notice");
  if (!notice) return;
  // The notice div uses flex layout; write into the <span class="font-medium"> child
  const span = notice.querySelector("span");
  const msg = `Mode template (AI tidak tersedia) — ${reason}`;
  if (span) {
    span.textContent = msg;
  } else {
    notice.textContent = msg;
  }
  notice.classList.remove("hidden");
  // Ensure flex display is restored (Tailwind hidden overrides display)
  notice.style.display = "flex";
}

function clearFallbackNotice() {
  const notice = $("fallback-notice");
  if (notice) {
    notice.classList.add("hidden");
    notice.style.display = "";
  }
}

function showSection(id) {
  const section = $(id);
  if (section) section.classList.remove("hidden");
}

function hideSection(id) {
  const section = $(id);
  if (section) section.classList.add("hidden");
}

function setLoading(loading) {
  const btn = $("btn-ai");
  const spinner = $("spinner");
  if (btn) btn.disabled = loading;
  if (spinner) spinner.classList.toggle("hidden", !loading);
}

function setCostEditingDisabled(disabled) {
  document.querySelectorAll("#cost-tbody input, #contingency-pct-input").forEach((input) => {
    input.disabled = disabled;
  });
}

function clearAIGenerationState() {
  $("ai-loading-banner")?.remove();
  ["section-charter", "section-wbs", "section-risk", "section-cost", "section-assumptions", "section-gantt", "section-governance"].forEach((id) => {
    const section = $(id);
    if (section) section.style.opacity = "";
  });
  setCostEditingDisabled(false);
  setLoading(false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 5 — WBS-based Gantt Chart
// ═══════════════════════════════════════════════════════════════════════════

/**
 * buildGanttSchedule(wbs, input)
 *
 * Derives a Gantt schedule from the WBS L1 phases and the Charter date/duration.
 *
 * Algorithm:
 *  1. Extract L1 phases from the WBS array (level === 1 items).
 *  2. Assign deterministic weights:
 *     - Inisiasi:    12% of total duration (always first slot)
 *     - Penutupan:   10% of total duration (always last slot)
 *     - Pengujian:   15% of total duration (always second-to-last)
 *     - Pengembangan phases: remaining 63% split equally across dev phases
 *  3. Sequence tasks with overlap rules:
 *     - Dev phases overlap by 15% (next starts when current is 85% done).
 *     - Testing starts strictly after last dev phase finishes (no overlap).
 *     - Penutupan starts strictly after testing finishes.
 *  4. All durations are in fractional weeks (rounded to 1 decimal for display).
 *  5. All dates clamped so no task exceeds projectEnd.
 *  6. When startDate is absent, use week offsets (no invented calendar dates).
 *
 * @param {object[]} wbs    WBS array (same schema as currentDoc.wbs)
 * @param {object}   input  Form input { startDate, duration, ... }
 * @returns {object}  { tasks, startDate, projectEndWeek, hasCalendarDates }
 *
 * Each task: { id, name, isMilestone, startWeek, endWeek, durationWeeks,
 *              startDate?, endDate?, assumption }
 */
function buildGanttSchedule(wbs, input) {
  const requestedWeeks = Number(input?.duration);
  const totalWeeks = Number.isInteger(requestedWeeks) && requestedWeeks >= 1 && requestedWeeks <= 520
    ? requestedWeeks
    : 1;
  const originDate = parseProjectDate(input?.startDate);
  const hasCalendarDates = !!originDate;

  // ── Extract L1 phases in order ───────────────────────────────────────────
  const l1Phases = (Array.isArray(wbs) ? wbs : [])
    .filter((w) => w && Number(w.level) === 1 && typeof w.name === "string" && w.name.trim())
    .map((w) => w.name.trim());

  if (l1Phases.length === 0) return { tasks: [], startDate: null, projectEndWeek: totalWeeks, hasCalendarDates };

  // ── Identify structural roles ────────────────────────────────────────────
  // Inisiasi is always first, Penutupan is always last, Pengujian is second-to-last.
  // Everything between them is Pengembangan.
  const initiationIdx = 0;
  const closingIdx    = l1Phases.length - 1;
  const testingIdx    = l1Phases.length - 2;
  const devIndices    = [];
  for (let i = 1; i < l1Phases.length - 2; i++) devIndices.push(i);
  // Fallback: if only 1 or 2 phases exist, treat all as dev
  const hasTestingPhase  = l1Phases.length >= 3;
  const hasClosingPhase  = l1Phases.length >= 2;

  // ── Compute durations (in weeks) per phase ───────────────────────────────
  const W_INIT    = 0.12;
  const W_TEST    = hasTestingPhase  ? 0.15 : 0;
  const W_CLOSE   = hasClosingPhase  ? 0.10 : 0;
  const W_DEV_TOT = Math.max(0, 1 - W_INIT - W_TEST - W_CLOSE);
  const devCount  = devIndices.length || 1;
  const W_DEV_EACH = W_DEV_TOT / devCount;

  // Map phase index → duration in weeks
  const phaseDurationWeeks = l1Phases.map((_, idx) => {
    if (idx === initiationIdx)                         return Math.max(0.1, Math.round(W_INIT * totalWeeks * 10) / 10);
    if (hasTestingPhase  && idx === testingIdx)        return Math.max(0.1, Math.round(W_TEST * totalWeeks * 10) / 10);
    if (hasClosingPhase  && idx === closingIdx)        return Math.max(0.1, Math.round(W_CLOSE * totalWeeks * 10) / 10);
    return Math.max(0.1, Math.round(W_DEV_EACH * totalWeeks * 10) / 10);
  });

  // ── Schedule phases (with 15% dev-to-dev overlap) ────────────────────────
  // OVERLAP_FACTOR: next dev phase starts when current is this fraction done.
  const OVERLAP_FACTOR = 0.85;

  const startWeeks  = new Array(l1Phases.length).fill(0);
  const endWeeks    = new Array(l1Phases.length).fill(0);

  // Inisiasi starts at week 0
  startWeeks[initiationIdx] = 0;
  endWeeks[initiationIdx]   = phaseDurationWeeks[initiationIdx];

  if (l1Phases.length === 1) {
    // Single phase — fits the full duration
    endWeeks[0] = totalWeeks;
  } else if (devIndices.length === 0) {
    // Only init + optional testing + closing
    let cursor = endWeeks[initiationIdx];
    for (let i = 1; i < l1Phases.length; i++) {
      startWeeks[i] = cursor;
      endWeeks[i]   = Math.min(totalWeeks, cursor + phaseDurationWeeks[i]);
      cursor = endWeeks[i];
    }
  } else {
    // Normal multi-phase schedule
    // Dev phases: first dev starts after init; subsequent devs overlap at OVERLAP_FACTOR
    let devCursor = endWeeks[initiationIdx];
    devIndices.forEach((idx, di) => {
      startWeeks[idx] = devCursor;
      endWeeks[idx]   = Math.min(totalWeeks, startWeeks[idx] + phaseDurationWeeks[idx]);
      // Next dev starts after OVERLAP_FACTOR of this dev's duration
      devCursor = startWeeks[idx] + phaseDurationWeeks[idx] * OVERLAP_FACTOR;
    });

    // Identify actual end of last dev phase for testing start
    const lastDevEnd = endWeeks[devIndices[devIndices.length - 1]];

    if (hasTestingPhase) {
      startWeeks[testingIdx] = lastDevEnd;
      endWeeks[testingIdx]   = Math.min(totalWeeks, lastDevEnd + phaseDurationWeeks[testingIdx]);
    }
    if (hasClosingPhase) {
      const testEnd = hasTestingPhase ? endWeeks[testingIdx] : lastDevEnd;
      startWeeks[closingIdx] = testEnd;
      endWeeks[closingIdx]   = Math.min(totalWeeks, testEnd + phaseDurationWeeks[closingIdx]);
    }
  }

  // ── Pin the closing milestone exactly to the planned project end ──────────
  // Rounding of individual phase durations can leave a gap of up to ~1 week
  // between the last activity and the project end. The closing task/milestone
  // is pinned to totalWeeks so the Gantt end matches the Charter finish date.
  // The gap (if any) is surfaced as an explicit "Schedule Buffer" row.
  let bufferWeeks = 0;
  if (hasClosingPhase) {
    const lastWorkEnd = endWeeks[closingIdx]; // before pinning
    bufferWeeks = Math.round((totalWeeks - lastWorkEnd) * 10) / 10;
    // Move the closing phase to end exactly at totalWeeks
    if (bufferWeeks > 0) {
      startWeeks[closingIdx] = Math.round((startWeeks[closingIdx] + bufferWeeks) * 10) / 10;
      endWeeks[closingIdx]   = totalWeeks;
    }
  }

  // ── Convert weeks to calendar dates if startDate provided ────────────────
  const weekToDate = (weeks) => {
    if (!originDate) return null;
    return projectDateAtWeek(input.startDate, weeks);
  };

  const fmtDate = (d) =>
    d ? formatProjectDate(d, "short") : null;

  // ── Build task objects ────────────────────────────────────────────────────
  const tasks = l1Phases.map((name, idx) => {
    const rawStart = Math.round(startWeeks[idx] * 10) / 10;
    const rawEnd = Math.round(endWeeks[idx] * 10) / 10;
    const sw = Math.min(totalWeeks, Math.max(0, rawStart));
    const ew = Math.min(totalWeeks, Math.max(sw, rawEnd));
    const dur = Math.round((ew - sw) * 10) / 10;

    // Closing phase (last index) is the project milestone marker.
    const isMilestone = (idx === closingIdx && (hasClosingPhase || l1Phases.length === 1));

    // Scheduling assumption label
    let assumption;
    if (l1Phases.length === 1)
      assumption = "Fase WBS tunggal; milestone penyelesaian berada pada akhir durasi proyek";
    else if (idx === initiationIdx)
      assumption = `Estimasi: ${Math.round(W_INIT * 100)}% durasi total`;
    else if (hasTestingPhase && idx === testingIdx)
      assumption = `Estimasi: ${Math.round(W_TEST * 100)}% durasi total; dimulai setelah semua pengembangan selesai`;
    else if (hasClosingPhase && idx === closingIdx)
      assumption = `Estimasi: ${Math.round(W_CLOSE * 100)}% durasi total; milestone selesai tepat pada akhir durasi proyek`;
    else {
      const overlapNote = devIndices.indexOf(idx) > 0 ? `; overlap 15% dengan fase sebelumnya` : `; dimulai setelah inisiasi`;
      assumption = `Estimasi: ${Math.round(W_DEV_EACH * 100)}% durasi total per deliverable${overlapNote}`;
    }

    const sd = weekToDate(sw);
    const ed = weekToDate(ew);

    return {
      id:            String(idx + 1),
      name,
      isMilestone,
      startWeek:     sw,
      endWeek:       ew,
      durationWeeks: dur,
      startDate:     sd,
      endDate:       ed,
      startDateStr:  fmtDate(sd),
      endDateStr:    fmtDate(ed),
      assumption,
    };
  });

  // ── Inject Schedule Buffer row if the gap is meaningful (≥ 0.5 weeks) ───
  // The buffer sits between the last work activity and the closing phase.
  // It is NOT a work task — it represents planned contingency/float time.
  if (hasClosingPhase && bufferWeeks >= 0.5) {
    const bufStartWeek = Math.round((startWeeks[closingIdx] - bufferWeeks) * 10) / 10;
    const bufEndWeek   = startWeeks[closingIdx];
    const bufSD = weekToDate(bufStartWeek);
    const bufED = weekToDate(bufEndWeek);
    // Insert immediately before the closing task (second-to-last position)
    tasks.splice(tasks.length - 1, 0, {
      id:            `${tasks.length}b`,
      name:          "Schedule Buffer (Cadangan Waktu)",
      isMilestone:   false,
      isBuffer:      true,          // renderer uses this to style differently
      startWeek:     bufStartWeek,
      endWeek:       bufEndWeek,
      durationWeeks: bufferWeeks,
      startDate:     bufSD,
      endDate:       bufED,
      startDateStr:  fmtDate(bufSD),
      endDateStr:    fmtDate(bufED),
      assumption:    `Cadangan waktu estimasi (float); bukan aktivitas kerja. Muncul karena pembulatan alokasi durasi fase.`,
    });
  }

  // ── Final validation guard ───────────────────────────────────────────────
  // Ensure no task has negative duration or exceeds project horizon.
  tasks.forEach((t) => {
    if (t.endWeek > totalWeeks) t.endWeek = totalWeeks;
    if (t.startWeek > totalWeeks) t.startWeek = totalWeeks;
    t.startWeek = Math.max(0, t.startWeek);
    t.endWeek = Math.max(t.startWeek, t.endWeek);
    t.durationWeeks = Math.round((t.endWeek - t.startWeek) * 10) / 10;
  });

  return { tasks, projectEndWeek: totalWeeks, hasCalendarDates, originDate };
}

/**
 * renderGantt(ganttData)
 *
 * Renders an SVG-based horizontal Gantt chart into #gantt-content.
 * Features:
 *  - Phase/task labels on the left
 *  - Horizontal bars proportional to duration
 *  - Time axis with tick marks (weeks or dates)
 *  - Milestones shown as diamonds
 *  - Horizontal scroll on narrow screens
 *  - Print-safe (no clip, forced page-break)
 *
 * @param {object} ganttData  Return value of buildGanttSchedule()
 * @param {object} input      Form input (for disclaimer text)
 */
function renderGantt(ganttData, input) {
  const container = $("gantt-content");
  if (!container) return;

  const { tasks, projectEndWeek, hasCalendarDates, originDate } = ganttData;

  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<p class="text-slate-400 italic text-sm py-4">Gantt tidak tersedia untuk dokumen ini.</p>`;
    return;
  }

  // ── Layout constants ─────────────────────────────────────────────────────
  const LABEL_W    = 220;   // px — left label column
  const ROW_H      = 34;    // px — row height
  const BAR_H      = 20;    // px — bar height within row
  const BAR_PAD_V  = (ROW_H - BAR_H) / 2;
  const HEADER_H   = 38;    // px — time axis header height
  const TICK_COUNT = Math.min(projectEndWeek, 20); // max 20 ticks
  const CHART_W    = 700;   // px — timeline draw area (scrollable)
  const SVG_W      = LABEL_W + CHART_W;
  const SVG_H      = HEADER_H + tasks.length * ROW_H + 20; // +20 bottom pad

  const totalW = projectEndWeek;

  // Week → px
  const xOf = (week) => LABEL_W + (week / totalW) * CHART_W;

  // Colour palette per structural role
  const barColor = (t, idx) => {
    if (t.isBuffer)                                       return "#94a3b8"; // slate-400 — buffer
    if (t.isMilestone)                                    return "#7c3aed"; // purple
    const name = t.name.toLowerCase();
    if (name.includes("inisiasi") || name.includes("perencanaan")) return "#1e40af"; // blue
    if (name.includes("pengujian") || name.includes("qa"))         return "#dc2626"; // red
    if (name.includes("penutupan") || name.includes("closing"))    return "#475569"; // slate
    // Pengembangan — cycle through teal shades
    const devColors = ["#0d9488", "#0891b2", "#047857", "#0369a1", "#065f46"];
    return devColors[idx % devColors.length];
  };

  // ── Tick intervals ───────────────────────────────────────────────────────
  // Choose a nice tick interval so we get ≤20 ticks
  const rawInterval = totalW / TICK_COUNT;
  const tickInterval = rawInterval <= 1 ? 1 : rawInterval <= 2 ? 2 : rawInterval <= 4 ? 4 : 5;
  const ticks = [];
  for (let w = 0; w <= totalW; w += tickInterval) ticks.push(w);
  if (ticks[ticks.length - 1] < totalW) ticks.push(totalW);

  // ── Generate tick labels ──────────────────────────────────────────────────
  const tickLabel = (w) => {
    if (hasCalendarDates && originDate) {
      const d = new Date(originDate);
      d.setDate(d.getDate() + Math.round(w * 7));
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    }
    return `W${w}`;
  };

  // ── Build SVG rows ────────────────────────────────────────────────────────
  const rowsSVG = tasks.map((t, idx) => {
    const y       = HEADER_H + idx * ROW_H;
    const barX    = xOf(t.startWeek);
    const barW    = Math.max(4, xOf(t.endWeek) - xOf(t.startWeek));
    const midY    = y + BAR_PAD_V + BAR_H / 2;
    const color   = barColor(t, idx);

    // Background alternating stripe
    const stripe = idx % 2 === 0
      ? `<rect x="0" y="${y}" width="${SVG_W}" height="${ROW_H}" fill="#f8fafc"/>`
      : `<rect x="0" y="${y}" width="${SVG_W}" height="${ROW_H}" fill="#ffffff"/>`;

    // Label (truncated at LABEL_W - 12 px)
    const label = `<text x="${LABEL_W - 10}" y="${midY + 4.5}" text-anchor="end"
        font-family="Inter,system-ui,sans-serif" font-size="11" fill="#334155"
        class="gantt-label">${escHtml(t.name.length > 28 ? t.name.slice(0, 26) + "…" : t.name)}</text>`;

    let barEl;
    if (t.isBuffer) {
      // Schedule Buffer: hatched grey bar to distinguish from work
      barEl = `
        <rect x="${barX}" y="${y + BAR_PAD_V}" width="${barW}" height="${BAR_H}"
          rx="4" ry="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 2"/>
        <text x="${barX + barW + 5}" y="${midY + 4}" font-family="Inter,system-ui,sans-serif"
          font-size="10" fill="#94a3b8" font-style="italic">${t.durationWeeks}w float</text>`;
    } else if (t.isMilestone) {
      // Closing phase: draw the activity bar + a milestone diamond pinned at project end (endWeek = totalWeeks)
      const DS = 9; // diamond half-size
      const diamondX = Math.min(xOf(t.endWeek), LABEL_W + CHART_W - DS - 2);
      barEl = `
        <rect x="${barX}" y="${y + BAR_PAD_V}" width="${barW}" height="${BAR_H}"
          rx="4" ry="4" fill="${color}" opacity="0.55"/>
        <polygon points="${diamondX},${midY - DS} ${diamondX + DS},${midY} ${diamondX},${midY + DS} ${diamondX - DS},${midY}"
          fill="${color}" opacity="0.95"/>
        <text x="${diamondX + DS + 4}" y="${midY + 4}" font-family="Inter,system-ui,sans-serif"
          font-size="10" fill="${color}" font-weight="600">Milestone</text>`;
    } else {
      // Standard work bar
      barEl = `
        <rect x="${barX}" y="${y + BAR_PAD_V}" width="${barW}" height="${BAR_H}"
          rx="4" ry="4" fill="${color}" opacity="0.88"/>
        <text x="${barX + barW + 5}" y="${midY + 4}" font-family="Inter,system-ui,sans-serif"
          font-size="10" fill="#64748b">${t.durationWeeks}w</text>`;
    }

    // Vertical separator after label column
    const sep = `<line x1="${LABEL_W}" y1="${y}" x2="${LABEL_W}" y2="${y + ROW_H}" stroke="#e2e8f0" stroke-width="1"/>`;

    return stripe + label + sep + barEl;
  }).join("\n");

  // ── Time axis ─────────────────────────────────────────────────────────────
  const ticksSVG = ticks.map((w) => {
    const x = xOf(w);
    const lbl = tickLabel(w);
    return `
      <line x1="${x}" y1="${HEADER_H - 6}" x2="${x}" y2="${SVG_H - 20}" stroke="#e2e8f0" stroke-width="1"/>
      <text x="${x}" y="${HEADER_H - 10}" text-anchor="middle" font-family="Inter,system-ui,sans-serif"
        font-size="10" fill="#94a3b8">${lbl}</text>`;
  }).join("\n");

  // Axis baseline
  const axisLine = `<line x1="${LABEL_W}" y1="${HEADER_H}" x2="${SVG_W}" y2="${HEADER_H}" stroke="#cbd5e1" stroke-width="1.5"/>`;

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendSVG = `
    <rect x="${LABEL_W + 8}" y="6" width="14" height="10" rx="2" fill="#0d9488" opacity="0.88"/>
    <text x="${LABEL_W + 26}" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#64748b">Aktivitas</text>
    <polygon points="${LABEL_W + 110},11 ${LABEL_W + 119},6 ${LABEL_W + 128},11 ${LABEL_W + 119},16"
      fill="#7c3aed" opacity="0.9"/>
    <text x="${LABEL_W + 134}" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#64748b">Milestone</text>
    <rect x="${LABEL_W + 215}" y="6" width="14" height="10" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 2"/>
    <text x="${LABEL_W + 234}" y="15.5" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#94a3b8" font-style="italic">Buffer</text>`;

  // ── Compose SVG ───────────────────────────────────────────────────────────
  const svgContent = `
    ${legendSVG}
    ${ticksSVG}
    ${axisLine}
    ${rowsSVG}
    <line x1="${LABEL_W}" y1="0" x2="${LABEL_W}" y2="${SVG_H}" stroke="#e2e8f0" stroke-width="1"/>`;

  const disclaimer = hasCalendarDates
    ? `Jadwal di atas adalah <strong>estimasi sistem</strong> — bukan komitmen aktual. Tanggal dihitung dari tanggal mulai dan durasi yang diinput.`
    : `Tanggal mulai proyek belum ditentukan. Timeline ditampilkan dalam <strong>minggu relatif</strong> (W0 = awal proyek). Jadwal di atas adalah estimasi perencanaan.`;

  // ── Detail table HTML ──────────────────────────────────────────────────────
  const detailRows = tasks.map((t) => {
    const startLabel = t.startDateStr || `Minggu ${t.startWeek}`;
    const endLabel   = t.endDateStr   || `Minggu ${t.endWeek}`;
    const typeLabel  = t.isBuffer
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-300 italic">⋯ Buffer</span>`
      : t.isMilestone
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">◆ Milestone</span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">— Aktivitas</span>`;
    const rowClass = t.isBuffer ? "border-b border-slate-100 bg-slate-50 opacity-70" : "border-b border-slate-100";
    return `<tr class="${rowClass}">
      <td class="px-3 py-2 font-mono text-xs text-slate-400">${escHtml(t.id)}</td>
      <td class="px-3 py-2 text-sm ${t.isBuffer ? 'text-slate-400 italic' : 'text-slate-700 font-medium'}">${escHtml(t.name)}</td>
      <td class="px-3 py-2 text-center">${typeLabel}</td>
      <td class="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">${escHtml(startLabel)}</td>
      <td class="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">${escHtml(endLabel)}</td>
      <td class="px-3 py-2 text-xs text-slate-500 text-center">${t.durationWeeks}w</td>
      <td class="px-3 py-2 text-xs text-slate-400 italic">${escHtml(t.assumption)}</td>
    </tr>`;
  }).join("");

  container.innerHTML = `
    <!-- Disclaimer -->
    <div class="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
      <svg class="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span>${disclaimer}</span>
    </div>

    <!-- Gantt SVG (scrollable) -->
    <div class="gantt-scroll-wrap" style="overflow-x:auto; -webkit-overflow-scrolling:touch; border:1px solid #e2e8f0; border-radius:12px; background:#fff;">
      <svg id="gantt-svg" xmlns="http://www.w3.org/2000/svg"
        width="${SVG_W}" height="${SVG_H}"
        viewBox="0 0 ${SVG_W} ${SVG_H}"
        role="img" aria-label="Gantt Chart Proyek"
        style="display:block; min-width:${SVG_W}px;">
        <title>Gantt Chart — Jadwal Proyek</title>
        ${svgContent}
      </svg>
    </div>

    <!-- Detail table -->
    <div class="mt-5">
      <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Rincian Jadwal</p>
      <div class="table-wrap rounded-xl border border-slate-200 overflow-hidden">
        <table class="data-table w-full text-sm border-collapse" role="grid">
          <thead>
            <tr class="bg-indigo-600 text-white text-left text-xs font-semibold uppercase tracking-wide">
              <th class="px-3 py-2.5 w-10">ID</th>
              <th class="px-3 py-2.5">Fase / Aktivitas</th>
              <th class="px-3 py-2.5 text-center w-24">Tipe</th>
              <th class="px-3 py-2.5 whitespace-nowrap">Mulai (Est.)</th>
              <th class="px-3 py-2.5 whitespace-nowrap">Selesai (Est.)</th>
              <th class="px-3 py-2.5 text-center w-16">Durasi</th>
              <th class="px-3 py-2.5">Asumsi Penjadwalan</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Render dokumen ──────────────────────────────────────────────────────────

/**
 * syncCharterMilestonesToGantt(doc, input, ganttData)
 * S1.C-9, S1.C-10, S1.C-12: Replace charter milestone strings with the
 * Gantt-derived schedule so Charter and Gantt show identical dates.
 *
 * Rules:
 *  - Uses the Gantt task list (L1 phases only, excluding the buffer row).
 *  - Uses calendar dates when available; otherwise uses relative week offsets.
 *  - Preserves the existing milestone string format:
 *      "4 Januari 2027: Penutupan Proyek selesai"
 *  - If Gantt has no tasks (empty WBS), milestone strings are left unchanged.
 *  - Does NOT invent calendar dates when startDate is absent (S1.C-13).
 */
function syncCharterMilestonesToGantt(doc, ganttData) {
  if (!ganttData) return;
  if (!ganttData.tasks || ganttData.tasks.length === 0) return;
  if (!doc.charter) return;

  // Work tasks only — exclude the synthetic buffer row (isBuffer === true)
  const workTasks = ganttData.tasks.filter((t) => !t.isBuffer);

  if (workTasks.length === 0) return;

  const milestones = workTasks.map((t) => {
    if (ganttData.hasCalendarDates) {
      const dateStr = formatProjectDate(t.endDate);
      return dateStr ? `${dateStr}: ${t.name} selesai` : null;
    }
    const week = Number(t.endWeek.toFixed(1)).toLocaleString("id-ID");
    return `Minggu ${week}: ${t.name} selesai`;
  }).filter(Boolean);

  if (milestones.length > 0) {
    doc.charter.milestones = milestones;
  }
}

function renderDocument(doc, input) {
  // S1.E-22: Guard against malformed AI data reaching critical paths
  if (!doc.charter)       doc.charter       = {};
  if (!Array.isArray(doc.wbs))           doc.wbs           = [];
  if (!Array.isArray(doc.risk_register)) doc.risk_register = [];
  if (!Array.isArray(doc.cost_estimate)) doc.cost_estimate = [];
  if (!doc.cost_summary)  doc.cost_summary  = {};
  if (!Array.isArray(doc.assumptions))   doc.assumptions   = [];

  // S1.C-9/10/11/12: Compute Gantt schedule FIRST (single authoritative schedule).
  // Then sync Charter milestone dates FROM the Gantt before rendering Charter.
  const ganttData = buildGanttSchedule(doc.wbs, input);
  doc._gantt = ganttData;

  if (ganttData.hasCalendarDates && ganttData.tasks.length > 0) {
    const closingTask = ganttData.tasks.filter((task) => !task.isBuffer).slice(-1)[0];
    if (closingTask?.endDate) doc.charter.finish_date = formatProjectDate(closingTask.endDate);
  }

  // Charter milestone dates/weeks are derived from the same schedule as Gantt.
  syncCharterMilestonesToGantt(doc, ganttData);

  renderCharter(doc.charter, input);
  renderWBS(doc.wbs);
  renderRiskRegister(doc.risk_register);
  renderCostEstimate(doc.cost_estimate, doc.cost_summary);
  renderAssumptions(doc.assumptions);

  // Render Gantt using the already-computed ganttData (S1.C-11: no re-computation)
  renderGantt(ganttData, input);

  // Governance
  const governance = runGovernanceReview(doc, input);
  doc._governance = governance;
  renderGovernance(governance);

  // Tampilkan semua section
  ["section-charter", "section-wbs", "section-risk", "section-cost", "section-assumptions", "section-gantt", "section-governance"].forEach(showSection);
  showSection("export-bar");

  // S1.D-15/19: Show initial budget status after first render
  const cs = doc.cost_summary;
  const grandTotal = cs?.grand_total ?? 0;
  // Remove stale budget-status from previous doc
  const oldStatus = $("budget-status");
  if (oldStatus) oldStatus.remove();
  renderBudgetStatus(grandTotal, input?.budgetRange || "");
}

function renderCharter(charter, input) {
  const c = $("charter-content");
  if (!c) return;

  // ── Shared helpers ───────────────────────────────────────────────────────
  const listHTML = (items, iconColor) => {
    if (!items || items.length === 0) return `<p class="text-sm text-slate-400 italic">Belum ditentukan</p>`;
    const color = iconColor || "text-blue-500";
    return `<ul class="space-y-1.5">${items.map((i) => `
      <li class="flex items-start gap-2 text-slate-700 text-sm">
        <svg class="w-4 h-4 ${color} shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>${escHtml(i)}</span>
      </li>`).join("")}</ul>`;
  };

  const sectionLabel = (text, color) =>
    `<p class="text-xs font-semibold uppercase tracking-widest ${color || "text-slate-500"} mb-2">${escHtml(text)}</p>`;

  const infoRow = (label, value) => {
    const display = value ? escHtml(value) : `<span class="text-slate-400 italic">Belum ditentukan</span>`;
    return `<div class="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 text-sm border-b border-slate-100 py-2 last:border-0">
      <span class="font-semibold text-slate-600 shrink-0 w-full sm:w-44">${escHtml(label)}</span>
      <span class="text-slate-700">${display}</span>
    </div>`;
  };

  // ── Section: Header / Identity ───────────────────────────────────────────
  const headerSection = `
    <div class="mb-5 p-4 bg-slate-800 text-white rounded-xl">
      <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Project Charter</p>
      <h3 class="text-base font-bold leading-tight">${escHtml(charter.project_title || input.projectName)}</h3>
    </div>
    <div class="mb-5 p-4 bg-white border border-slate-200 rounded-xl">
      ${sectionLabel("Informasi Proyek", "text-slate-500")}
      <div class="divide-y divide-slate-100">
        ${infoRow("Nama Proyek",     charter.project_title || input.projectName)}
        ${infoRow("Tanggal Mulai",   charter.start_date)}
        ${infoRow("Proyeksi Selesai",charter.finish_date)}
        ${infoRow("Anggaran",        charter.budget_info || input.budgetRange)}
        ${infoRow("Project Manager", charter.pm_name)}
        ${infoRow("Metodologi",      charter.methodology)}
      </div>
    </div>`;

  // ── Section: Objective & Context ─────────────────────────────────────────
  const objectiveSection = `
    <div class="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
      ${sectionLabel("Tujuan & Latar Belakang Proyek", "text-blue-600")}
      <p class="text-slate-800 text-sm leading-relaxed">${escHtml(charter.objective)}</p>
      ${charter.project_context ? `<p class="text-slate-600 text-sm leading-relaxed mt-2 pt-2 border-t border-blue-100">${escHtml(charter.project_context)}</p>` : ""}
    </div>`;

  // ── Section: Scope ────────────────────────────────────────────────────────
  const scopeSection = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <div class="p-4 bg-white border border-slate-200 rounded-xl">
        ${sectionLabel("Dalam Lingkup", "text-emerald-600")}
        ${listHTML(charter.in_scope, "text-emerald-500")}
      </div>
      <div class="p-4 bg-white border border-slate-200 rounded-xl">
        ${sectionLabel("Luar Lingkup", "text-slate-400")}
        ${listHTML(charter.out_of_scope, "text-slate-400")}
      </div>
    </div>`;

  // ── Section: Deliverables & Success Criteria ──────────────────────────────
  const successCriteriaHTML = charter.success_criteria && charter.success_criteria.length > 0
    ? listHTML(charter.success_criteria, "text-teal-500")
    : `<p class="text-sm text-slate-400 italic">Belum ditentukan — akan disepakati bersama stakeholder</p>`;

  const deliverableSection = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <div class="p-4 bg-white border border-slate-200 rounded-xl">
        ${sectionLabel("Deliverable Utama", "text-blue-600")}
        ${listHTML(charter.deliverables, "text-blue-400")}
      </div>
      <div class="p-4 bg-teal-50 border border-teal-100 rounded-xl">
        ${sectionLabel("Kriteria Keberhasilan", "text-teal-700")}
        ${successCriteriaHTML}
      </div>
    </div>`;

  // ── Section: Stakeholders ─────────────────────────────────────────────────
  const stakeholderSection = `
    <div class="mb-5 p-4 bg-white border border-slate-200 rounded-xl">
      ${sectionLabel("Peran & Tanggung Jawab Stakeholder", "text-purple-600")}
      ${listHTML(charter.stakeholders, "text-purple-400")}
    </div>`;

  // ── Section: Milestones ───────────────────────────────────────────────────
  const milestoneSection = `
    <div class="mb-5 p-4 bg-white border border-slate-200 rounded-xl">
      ${sectionLabel("Milestone", "text-amber-600")}
      ${listHTML(charter.milestones, "text-amber-400")}
    </div>`;

  // ── Section: Approach ─────────────────────────────────────────────────────
  const methodLabel = charter.methodology || "Belum ditentukan";
  const methodDesc  = {
    "Waterfall":          "Proyek dilaksanakan secara sekuensial: setiap fase diselesaikan sebelum fase berikutnya dimulai. Perubahan lingkup dikelola melalui proses perubahan formal.",
    "Agile / Scrum":      "Proyek dilaksanakan secara iteratif dalam sprint. Deliverable dirilis secara bertahap; kebutuhan dapat disesuaikan setiap sprint.",
    "Hybrid (Waterfall + Agile)": "Perencanaan dan arsitektur mengikuti pendekatan Waterfall; eksekusi dan pengujian dilakukan secara iteratif (Agile).",
    "Other":              "Pendekatan pengembangan disesuaikan dengan kebutuhan proyek dan tim.",
  };
  const approachDetail = methodDesc[charter.methodology] || "Pendekatan pengembangan akan ditentukan pada fase inisiasi proyek.";

  const approachSection = `
    <div class="mb-5 p-4 bg-white border border-slate-200 rounded-xl">
      ${sectionLabel("Pendekatan Proyek", "text-indigo-600")}
      <p class="text-sm font-semibold text-slate-700 mb-1">${escHtml(methodLabel)}</p>
      <p class="text-sm text-slate-600 leading-relaxed">${escHtml(approachDetail)}</p>
    </div>`;

  // ── Section: Sign-off (always shown as draft placeholder) ────────────────
  const signoffSection = `
    <div class="mt-5 p-4 border-2 border-dashed border-slate-200 rounded-xl">
      ${sectionLabel("Persetujuan / Sign-off (Draft)", "text-slate-400")}
      <p class="text-xs text-slate-400 italic mb-3">Bagian ini diisi dan ditandatangani setelah charter disetujui semua pihak.</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${["Project Manager", "Product Owner / Sponsor", "Tim QA"].map((role) => `
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p class="text-xs font-semibold text-slate-500 mb-6">${escHtml(role)}</p>
            <div class="border-t border-slate-300 pt-1">
              <p class="text-xs text-slate-400">Tanda tangan &amp; tanggal</p>
            </div>
          </div>`).join("")}
      </div>
    </div>`;

  c.innerHTML =
    headerSection +
    objectiveSection +
    scopeSection +
    deliverableSection +
    stakeholderSection +
    milestoneSection +
    approachSection +
    signoffSection;
}

function renderWBS(wbs) {
  const tbody = $("wbs-tbody");
  if (!tbody) return;
  tbody.innerHTML = wbs
    .map((w) => {
      // Visual hierarchy by level
      const indent     = w.level === 2 ? "pl-6" : w.level === 3 ? "pl-10" : "";
      const rowBase    = "border-b border-slate-100 transition-colors";
      const levelStyle = w.level === 1
        ? `${rowBase} bg-blue-50/60 font-semibold`
        : w.level === 2
        ? `${rowBase} bg-white`
        : `${rowBase} bg-white text-slate-500 text-xs`;

      // Level badge
      const levelBadge = w.level === 1
        ? `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white text-[10px] font-bold">L1</span>`
        : w.level === 2
        ? `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-300 text-slate-700 text-[10px] font-bold">L2</span>`
        : `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-200 text-slate-500 text-[10px]">L3</span>`;

      return `<tr class="${levelStyle}">
        <td class="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">${escHtml(w.id)}</td>
        <td class="px-4 py-2.5 ${indent}">${escHtml(w.name)}</td>
        <td class="px-4 py-2.5 text-center">${levelBadge}</td>
        <td class="px-4 py-2.5 text-slate-600">${escHtml(w.deliverable)}</td>
        <td class="px-4 py-2.5 text-slate-600">${escHtml(w.completion_criteria)}</td>
      </tr>`;
    })
    .join("");
}

function renderRiskRegister(risks) {
  const tbody = $("risk-tbody");
  if (!tbody) return;

  const levelBadge = (lvl) => {
    const styles = {
      low:    "bg-emerald-100 text-emerald-800 border border-emerald-200",
      medium: "bg-amber-100 text-amber-800 border border-amber-200",
      high:   "bg-red-100 text-red-800 border border-red-200",
    };
    const label = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
    const dot   = { low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-red-500" };
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${styles[lvl] || "bg-slate-100 text-slate-700"}">
      <span class="w-1.5 h-1.5 rounded-full ${dot[lvl] || "bg-slate-400"} inline-block"></span>
      ${label[lvl] || lvl}
    </span>`;
  };

  tbody.innerHTML = risks
    .map(
      (r) => `<tr class="border-b border-slate-100 transition-colors">
        <td class="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">${escHtml(r.id)}</td>
        <td class="px-4 py-3 text-sm">${escHtml(r.description)}</td>
        <td class="px-4 py-3 text-center whitespace-nowrap">${levelBadge(r.probability)}</td>
        <td class="px-4 py-3 text-center whitespace-nowrap">${levelBadge(r.impact)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${escHtml(r.mitigation)}</td>
      </tr>`
    )
    .join("");
}

/**
 * renderCostEstimate(costs, summary)
 * Render the cost estimate table rows and wire up all editable inputs.
 * Each data row has: Kategori | Jam | Tarif | Non-Labor | Total Baris
 * The tfoot shows: Subtotal | Cadangan (editable %) | Total Estimasi Akhir
 *
 * @param {Array}  costs    Array of cost_estimate items from currentDoc
 * @param {object} summary  { contingency_pct, cost_subtotal, contingency_reserve, grand_total }
 */
function renderCostEstimate(costs, summary) {
  const tbody = $("cost-tbody");
  if (!tbody) return;

  const contingencyInput = $("contingency-pct-input");
  const summaryPct = summary?.contingency_pct;
  const initialPct = Number(summaryPct);
  if (contingencyInput) {
    contingencyInput.value = summaryPct !== null && summaryPct !== undefined &&
      Number.isFinite(initialPct) && initialPct >= 0 && initialPct <= 100
      ? String(initialPct)
      : "10";
  }

  const fmt = (n) => Math.max(0, Number(n) || 0).toLocaleString("id-ID");

  tbody.innerHTML = costs
    .map(
      (c, i) => `<tr class="border-b border-slate-100 transition-colors" data-cost-idx="${i}">
        <td class="px-4 py-3 text-sm font-medium text-slate-700">${escHtml(c.category)}</td>
        <td class="px-4 py-3 text-center">
          <input type="number"
            class="cost-hours w-20 border border-slate-300 rounded-lg px-2 py-1 text-right text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none transition"
            value="${Math.max(0, c.hours || 0)}" min="0" data-idx="${i}" aria-label="Jam untuk ${escHtml(c.category)}">
        </td>
        <td class="px-4 py-3 text-center">
          <input type="number"
            class="cost-rate w-28 border border-slate-300 rounded-lg px-2 py-1 text-right text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none transition"
            value="${Math.max(0, c.rate || 0)}" min="0" data-idx="${i}" aria-label="Tarif untuk ${escHtml(c.category)}">
        </td>
        <td class="px-4 py-3 text-center">
          <input type="number"
            class="cost-nonlabor w-28 border border-slate-300 rounded-lg px-2 py-1 text-right text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none transition"
            value="${Math.max(0, c.non_labor || 0)}" min="0" data-idx="${i}" aria-label="Biaya non-tenaga kerja untuk ${escHtml(c.category)}">
        </td>
        <td class="px-4 py-3 text-right font-semibold text-emerald-700 cost-row-total" id="cost-sub-${i}">Rp ${fmt(c.row_total)}</td>
      </tr>`
    )
    .join("");

  updateCostSummary();

  // Event listeners untuk semua kolom yang dapat diedit
  tbody.querySelectorAll(".cost-hours, .cost-rate, .cost-nonlabor").forEach((input) => {
    input.addEventListener("input", onCostEdit);
  });
}

/**
 * onCostEdit(e)
 * Handles edits to hours, rate, or non-labor inputs.
 * Recalculates: subtotal (labor) = hours × rate; row_total = subtotal + non_labor.
 * S1.A-4: Sets costEdited = true so re-generation triggers a confirmation.
 */
function onCostEdit(e) {
  const idx = parseInt(e.target.dataset.idx, 10);
  if (!currentDoc || isNaN(idx)) return;

  const row = document.querySelector(`[data-cost-idx="${idx}"]`);
  if (!row) return;

  const hours    = Math.max(0, parseFloat(row.querySelector(".cost-hours")?.value)    || 0);
  const rate     = Math.max(0, parseFloat(row.querySelector(".cost-rate")?.value)     || 0);
  const nonLabor = Math.max(0, parseFloat(row.querySelector(".cost-nonlabor")?.value) || 0);
  const labor    = hours * rate;
  const rowTotal = labor + nonLabor;

  // Keep existing subtotal field = labor cost (backward-compatible with AI schema)
  currentDoc.cost_estimate[idx].hours     = hours;
  currentDoc.cost_estimate[idx].rate      = rate;
  currentDoc.cost_estimate[idx].subtotal  = labor;
  currentDoc.cost_estimate[idx].non_labor = nonLabor;
  currentDoc.cost_estimate[idx].row_total = rowTotal;

  const rowTotalCell = $(`cost-sub-${idx}`);
  if (rowTotalCell) rowTotalCell.textContent = `Rp ${rowTotal.toLocaleString("id-ID")}`;

  // S1.A-4: Mark cost table as edited.
  costEdited = true;

  updateCostSummary();
}

// ── Budget health helpers ────────────────────────────────────────────────────

/**
 * parseBudgetIDR(text)
 * S1.D-16: Parse common Indonesian currency strings into a numeric IDR value.
 *
 * Supported patterns:
 *  - Plain numbers:                        100000000
 *  - Dot-separated thousands:              100.000.000
 *  - "juta" suffix (+ optional Rp):        100 juta  /  Rp 100 juta  /  Rp100juta
 *  - "miliar" / "milyar" suffix:           1 miliar  /  1.5 miliar
 *  - Full Rp notation:                     Rp100.000.000  /  Rp 80.000.000
 *  - Ranges (returns upper bound):         Rp80–100 juta  /  80-100 juta
 *    (callers must pass the returned {isRange, upperBound} through to the UI)
 *
 * @param {string} text  Raw budget string from the form.
 * @returns {{ value: number|null, isRange: boolean, upperBound: number|null }}
 *   value — single parsed value (or upper bound when isRange=true); null if unparseable.
 *   isRange — true when the input contained a range expression.
 *   upperBound — the upper bound of a range; same as value for non-range inputs.
 */
function parseBudgetIDR(text) {
  if (!text || typeof text !== "string") return { value: null, isRange: false, upperBound: null };

  const t = text.trim().toLowerCase().replace(/\brp\s*/g, "").replace(/\s+/g, " ");
  const unitPattern = "(juta|miliar|milyar|ribu|rb|jt|m)";
  const numberPattern = "([\\d.,]+)";

  const parseAmount = (raw, unit = "") => {
    let normalized;
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else if (/^\d+(?:,\d+)?$/.test(raw)) {
      if (raw.includes(",") && (!unit || raw.split(",")[1].length === 3)) return null;
      normalized = raw.replace(",", ".");
    } else if (/^\d+(?:\.\d+)?$/.test(raw)) {
      if (raw.includes(".") && !unit) return null;
      normalized = raw;
    } else {
      return null;
    }
    const amount = Number(normalized) * multiplierFromUnit(unit);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  };

  const rangeMatch = t.match(
    new RegExp(`^${numberPattern}\\s*${unitPattern}?\\s*(?:–|-|~|s/d)\\s*${numberPattern}\\s*${unitPattern}?$`)
  );
  if (rangeMatch) {
    const lowerUnit = rangeMatch[2] || rangeMatch[4] || "";
    const upperUnit = rangeMatch[4] || rangeMatch[2] || "";
    const lower = parseAmount(rangeMatch[1], lowerUnit);
    const upper = parseAmount(rangeMatch[3], upperUnit);
    if (lower !== null && upper !== null && lower <= upper) {
      return { value: upper, isRange: true, upperBound: upper };
    }
  }

  const singleMatch = t.match(new RegExp(`^${numberPattern}\\s*${unitPattern}?$`));
  if (singleMatch) {
    const value = parseAmount(singleMatch[1], singleMatch[2] || "");
    if (value !== null) return { value, isRange: false, upperBound: value };
  }

  return { value: null, isRange: false, upperBound: null };
}

/** Maps Indonesian numeric unit names to their IDR multiplier. */
function multiplierFromUnit(unit) {
  switch (unit.toLowerCase()) {
    case "juta": case "jt": case "m":  return 1_000_000;
    case "miliar": case "milyar":      return 1_000_000_000;
    case "ribu": case "rb":            return 1_000;
    default:                           return 1;
  }
}

/**
 * renderBudgetStatus(grandTotal, budgetText)
 * S1.D-15–20: Compare current grand total (incl. contingency) to the parsed
 * project budget and update the #budget-status element.
 *
 * Creates the element dynamically if not already present in the cost section.
 */
function renderBudgetStatus(grandTotal, budgetText) {
  // Ensure the status element exists
  let statusEl = $("budget-status");
  if (!statusEl) {
    const costSection = $("section-cost");
    if (!costSection) return;
    // Insert before the footnote paragraph inside the cost section
    const footnote = costSection.querySelector("p.text-xs.text-slate-400.mt-2");
    statusEl = document.createElement("div");
    statusEl.id = "budget-status";
    statusEl.className = "mt-3";
    if (footnote) {
      footnote.parentNode.insertBefore(statusEl, footnote);
    } else {
      costSection.querySelector(".px-6.py-5").appendChild(statusEl);
    }
  }

  const parsed = parseBudgetIDR(budgetText || "");

  if (parsed.value === null) {
    // S1.D-18: unparseable budget
    statusEl.innerHTML = `
      <div class="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
        <svg class="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span><strong>Budget tidak dapat dibandingkan</strong> — format anggaran tidak dikenali (<em>${escHtml(budgetText)}</em>).</span>
      </div>`;
    return;
  }

  const budget = parsed.value; // S1.D-17: use upper bound for ranges
  const diff   = grandTotal - budget;
  const pct    = budget > 0 ? Math.round((Math.abs(diff) / budget) * 100) : 0;

  let html;
  if (diff > 0) {
    // S1.D-20: over budget
    html = `
      <div class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
        <svg class="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <span>
          <strong>Melebihi anggaran</strong> sebesar <strong>Rp ${diff.toLocaleString("id-ID")}</strong> (+${pct}%).
          ${parsed.isRange ? `<em class="text-red-500">(Asumsi: dibandingkan batas atas anggaran Rp ${budget.toLocaleString("id-ID")})</em>` : ""}
        </span>
      </div>`;
  } else if (Math.abs(diff) / Math.max(budget, 1) <= 0.05) {
    // S1.D-20: within budget (within ±5%)
    html = `
      <div class="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <svg class="w-4 h-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
        </svg>
        <span>
          <strong>Dalam batas anggaran</strong> (selisih ${pct}%).
          ${parsed.isRange ? `<em class="text-amber-600">(Asumsi: dibandingkan batas atas anggaran Rp ${budget.toLocaleString("id-ID")})</em>` : ""}
        </span>
      </div>`;
  } else {
    // S1.D-20: under budget
    html = `
      <div class="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
        <svg class="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>
          <strong>Di bawah anggaran</strong> — estimasi lebih rendah Rp ${Math.abs(diff).toLocaleString("id-ID")} (${pct}%) dari anggaran.
          ${parsed.isRange ? `<em class="text-emerald-600">(Asumsi: dibandingkan batas atas anggaran Rp ${budget.toLocaleString("id-ID")})</em>` : ""}
        </span>
      </div>`;
  }
  statusEl.innerHTML = html;
}

/**
 * updateCostSummary()
 * Recomputes and renders:
 *   cost_subtotal        = sum of all row_totals
 *   contingency_reserve  = cost_subtotal × contingency_pct / 100
 *   grand_total          = cost_subtotal + contingency_reserve
 *
 * S1.D-19: Also immediately updates budget status after any cost change.
 * Also keeps #cost-total updated for any legacy references (it now shows grand_total).
 */
function updateCostSummary() {
  if (!currentDoc) return;
  const items = currentDoc.cost_estimate || [];

  const costSubtotal = items.reduce((s, c) => s + (Math.max(0, c.row_total || 0)), 0);

  // Read current contingency % from the editable input; fall back to stored value or 10
  const pctInput = $("contingency-pct-input");
  let pct = parseFloat(pctInput?.value);
  if (isNaN(pct) || pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  const reserve   = Math.round(costSubtotal * pct / 100);
  const grandTotal = costSubtotal + reserve;

  // Persist into doc so CSV export reads current values
  if (!currentDoc.cost_summary) currentDoc.cost_summary = {};
  currentDoc.cost_summary.contingency_pct       = pct;
  currentDoc.cost_summary.cost_subtotal         = costSubtotal;
  currentDoc.cost_summary.contingency_reserve   = reserve;
  currentDoc.cost_summary.grand_total           = grandTotal;

  // Update display cells
  const subtotalEl   = $("cost-subtotal-display");
  const reserveEl    = $("cost-reserve-display");
  const grandTotalEl = $("cost-total"); // existing ID — now shows grand total

  if (subtotalEl)   subtotalEl.textContent  = `Rp ${costSubtotal.toLocaleString("id-ID")}`;
  if (reserveEl)    reserveEl.textContent   = `Rp ${reserve.toLocaleString("id-ID")}`;
  if (grandTotalEl) grandTotalEl.textContent = `Rp ${grandTotal.toLocaleString("id-ID")}`;

  // S1.D-19: Update budget health status immediately
  renderBudgetStatus(grandTotal, currentInput?.budgetRange || "");
}

// Keep a thin backward-compatible alias so any future caller of the old name still works
function updateCostTotal() { updateCostSummary(); }

function renderAssumptions(assumptions) {
  const container = $("assumptions-content");
  if (!container) return;
  container.innerHTML = `<ul class="space-y-2">
    ${assumptions.map((a) => `
      <li class="flex items-start gap-2.5 text-sm text-slate-700 p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
        <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>${escHtml(a)}</span>
      </li>`).join("")}
  </ul>`;
}

function renderGovernance(gov) {
  renderCobitMappings(gov.mappings);
  renderKPIs(gov.kpis);
  renderScore(gov.criteria, gov.total, gov.maxTotal, gov.percentage);
}

function renderCobitMappings(mappings) {
  const container = $("cobit-mappings");
  if (!container) return;

  container.innerHTML = mappings
    .map((m) => {
      const isUnknown = m.unknown;
      const unknownTag = isUnknown
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full font-bold border border-red-200">
             <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
             Kode tidak dikenal
           </span>`
        : "";
      const cardCls = isUnknown
        ? "p-4 border border-red-200 rounded-xl bg-red-50"
        : "p-4 border border-slate-200 rounded-xl bg-white hover:border-purple-200 transition-colors";

      return `<div class="${cardCls}">
        <div class="flex items-start justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono font-bold text-purple-700 text-xs bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">${escHtml(m.code)}</span>
            ${unknownTag}
          </div>
        </div>
        <p class="text-slate-700 text-sm font-semibold leading-snug mb-1">${escHtml(m.name)}</p>
        <p class="text-slate-500 text-xs leading-relaxed">${escHtml(m.reason)}</p>
      </div>`;
    })
    .join("");
}

function renderKPIs(kpis) {
  const container = $("kpi-list");
  if (!container) return;

  container.innerHTML = kpis
    .map(
      (k, i) => `<div class="flex items-start gap-3 p-3.5 bg-white border border-slate-200 rounded-xl hover:border-teal-200 transition-colors">
        <div class="w-6 h-6 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 text-xs font-bold">${i + 1}</div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-slate-800 text-sm">${escHtml(k.kpi)}</p>
          <p class="text-slate-500 text-xs mt-0.5 leading-relaxed">🎯 ${escHtml(k.target)}</p>
        </div>
        <div class="shrink-0">
          <span class="font-mono text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">${escHtml(k.objective)}</span>
        </div>
      </div>`
    )
    .join("");
}

function renderScore(criteria, total, maxTotal, percentage) {
  const container = $("score-content");
  if (!container) return;

  // Color scheme by score band
  const band = percentage >= 70 ? "green" : percentage >= 40 ? "yellow" : "red";
  const bandCfg = {
    green:  { text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", grad: "from-emerald-400 to-emerald-600", label: "Baik" },
    yellow: { text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   grad: "from-amber-400 to-amber-600",   label: "Perlu Perhatian" },
    red:    { text: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     grad: "from-red-400 to-red-600",       label: "Perlu Perbaikan" },
  };
  const cfg = bandCfg[band];

  // Arc progress (SVG circle) — r=36, circumference ≈ 226
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (percentage / 100) * circ;
  const scoreArc = `
    <svg class="w-24 h-24" viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="8"/>
      <circle cx="44" cy="44" r="${r}" fill="none"
        stroke="url(#scoreGrad)" stroke-width="8"
        stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}"
        stroke-dashoffset="${(circ / 4).toFixed(1)}"
        stroke-linecap="round"/>
      <defs>
        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" class="stop-color-start"/>
          <stop offset="100%" class="stop-color-end"/>
        </linearGradient>
      </defs>
    </svg>`;

  const scoreBgGrad = percentage >= 70 ? "#10b981" : percentage >= 40 ? "#f59e0b" : "#ef4444";

  const criteriaRows = criteria.map((c) => {
    const scoreColor = c.score === 2 ? "text-emerald-600" : c.score === 1 ? "text-amber-600" : "text-red-500";
    const barFill    = c.score === 2 ? "#10b981" : c.score === 1 ? "#f59e0b" : "#ef4444";
    const barPct     = Math.round((c.score / c.max) * 100);
    return `<div class="flex gap-3 items-start p-3.5 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition-colors">
      <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <span class="font-mono text-xs font-bold text-slate-600">${c.id}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-slate-700 text-sm font-semibold">${escHtml(c.label)}</p>
        <p class="text-slate-400 text-xs mt-0.5 leading-relaxed">${escHtml(c.reason)}</p>
      </div>
      <div class="shrink-0 text-right">
        <span class="text-base font-bold ${scoreColor}">${c.score}<span class="text-slate-300 text-xs">/${c.max}</span></span>
        <div class="w-16 bg-slate-200 rounded-full h-1.5 mt-1.5">
          <div class="h-1.5 rounded-full transition-all" style="width:${barPct}%;background:${barFill}"></div>
        </div>
      </div>
    </div>`;
  }).join("");

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl border ${cfg.border} ${cfg.bg} mb-5">
      <div class="relative shrink-0">
        <svg class="w-24 h-24" viewBox="0 0 88 88" aria-hidden="true">
          <circle cx="44" cy="44" r="36" fill="none" stroke="#e2e8f0" stroke-width="8"/>
          <circle cx="44" cy="44" r="36" fill="none"
            stroke="${scoreBgGrad}" stroke-width="8"
            stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}"
            stroke-dashoffset="${(circ / 4).toFixed(1)}"
            stroke-linecap="round"/>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-2xl font-extrabold ${cfg.text}">${percentage}%</span>
        </div>
      </div>
      <div>
        <p class="font-bold text-slate-800 text-base">${cfg.label}</p>
        <p class="text-slate-600 text-sm mt-0.5">Skor Kesesuaian Indikatif</p>
        <p class="text-slate-400 text-xs mt-1">${total} dari ${maxTotal} poin · ${criteria.length} kriteria</p>
      </div>
    </div>
    <div class="space-y-2">${criteriaRows}</div>
  `;
}

// ── Security helper ─────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ── Main controller ─────────────────────────────────────────────────────────

/**
 * getFormData()
 * Baca dan validasi data dari form.
 * S1.A-3: Enforces duration 1–520 and teamSize 1–500 as finite positive
 *          integers.  Decimals, zero, and out-of-range values are rejected
 *          with explicit error messages.
 * @returns {object|null} Data form atau null bila tidak valid
 */
function getFormData() {
  // S1.A-3: Read raw strings so we can detect non-integer input before parsing.
  const durationRaw  = ($("duration")?.value  || "").trim();
  const teamSizeRaw  = ($("team-size")?.value || "").trim();

  // Reject values that are not whole-number strings (e.g. "3.5", "1.0e2", "abc").
  const isWholeNumber = (s) => /^\d+$/.test(s);

  const durationParsed  = isWholeNumber(durationRaw)  ? parseInt(durationRaw,  10) : NaN;
  const teamSizeParsed  = isWholeNumber(teamSizeRaw)   ? parseInt(teamSizeRaw,  10) : NaN;

  const data = {
    // required fields (unchanged)
    projectName:  ($("project-name")?.value || "").trim(),
    objective:    ($("objective")?.value || "").trim(),
    duration:     durationParsed,
    teamSize:     teamSizeParsed,
    category:     $("category")?.value || "",
    budgetRange:  ($("budget-range")?.value || "").trim(),
    // optional Phase 2A fields — silently empty when not filled
    startDate:       ($("start-date")?.value        || "").trim(),
    pmName:          ($("pm-name")?.value           || "").trim(),
    methodology:     ($("methodology")?.value       || "").trim(),
    keyDeliverables: ($("key-deliverables")?.value  || "").trim(),
    successCriteria: ($("success-criteria")?.value  || "").trim(),
    projectContext:  ($("project-context")?.value   || "").trim(),
  };

  const errors = [];
  if (!data.projectName) errors.push("Nama proyek wajib diisi.");
  if (!data.objective) errors.push("Tujuan proyek wajib diisi.");

  // S1.A-3: duration validation — must be integer 1–520
  if (!isWholeNumber(durationRaw)) {
    errors.push("Durasi harus bilangan bulat (mis. 14). Nilai desimal atau teks tidak diterima.");
  } else if (durationParsed < 1) {
    errors.push("Durasi harus ≥ 1 minggu.");
  } else if (durationParsed > 520) {
    errors.push("Durasi tidak boleh melebihi 520 minggu (10 tahun).");
  }

  // S1.A-3: teamSize validation — must be integer 1–500
  if (!isWholeNumber(teamSizeRaw)) {
    errors.push("Ukuran tim harus bilangan bulat (mis. 5). Nilai desimal atau teks tidak diterima.");
  } else if (teamSizeParsed < 1) {
    errors.push("Ukuran tim harus ≥ 1 orang.");
  } else if (teamSizeParsed > 500) {
    errors.push("Ukuran tim tidak boleh melebihi 500 orang.");
  }

  if (!data.category) errors.push("Pilih kategori proyek.");
  if (!data.budgetRange) errors.push("Kisaran anggaran wajib diisi.");

  if (errors.length > 0) {
    showFormErrors(errors);
    return null;
  }
  clearFormErrors();
  return data;
}

function showFormErrors(errors) {
  const el = $("form-errors");
  if (!el) return;
  // The new design has a <div> sibling next to the SVG icon inside form-errors
  const inner = el.querySelector("div") || el;
  inner.innerHTML = `<ul class="space-y-0.5">${errors.map((e) => `<li>${escHtml(e)}</li>`).join("")}</ul>`;
  el.classList.remove("hidden");
  el.style.display = "flex";
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearFormErrors() {
  const el = $("form-errors");
  if (el) {
    const inner = el.querySelector("div") || el;
    inner.innerHTML = "";
    el.classList.add("hidden");
    el.style.display = "";
  }
}

/**
 * confirmCostEditOverwrite(modeName)
 * S1.A-4: If the user has edited cost values, ask for confirmation before
 * re-generation would overwrite them.  Returns true to proceed, false to cancel.
 *
 * Uses window.confirm() which is synchronous and universally available.
 * No DOM mutation on cancel — the existing document is preserved as-is.
 *
 * @param {string} modeName  e.g. "Template" or "AI"
 * @returns {boolean}
 */
function confirmCostEditOverwrite(modeName) {
  if (!costEdited) return true;
  return window.confirm(
    `Anda telah mengedit Estimasi Biaya.\n\nGenerate ulang dengan ${modeName} akan mengganti semua nilai yang telah diedit.\n\nLanjutkan dan timpa editan?`
  );
}

/** Klik tombol "Generate Template" */
async function onGenerateTemplate() {
  // S1.A-4: Guard cost edits before re-generation
  if (!confirmCostEditOverwrite("Template")) return;

  const input = getFormData();
  if (!input) return;

  generationRequestId += 1;
  clearAIGenerationState();
  currentMode = "template";
  currentInput = input;
  renderBadge("template");
  clearFallbackNotice();

  const doc = generateTemplate(input);
  currentDoc = doc;
  // S1.A-4: Reset edit tracking after successful re-generation
  costEdited = false;
  renderDocument(doc, input);

  $("output-section")?.scrollIntoView({ behavior: "smooth" });
}

// ── AI output normalisation helpers ─────────────────────────────────────────

/**
 * normaliseAICharter(charter, input)
 * S1.A-1: Compute finish_date from startDate + duration*7 if AI omitted it.
 * S1.A-2: Guard null/missing deliverables and milestones arrays.
 * S1.B-6: Backfill all Phase 2A identity fields from user input.
 */
function normaliseAICharter(charter, input) {
  if (!charter || typeof charter !== "object") charter = {};

  charter.project_title   = charter.project_title   || input.projectName;
  charter.budget_info     = charter.budget_info     || input.budgetRange;
  charter.pm_name         = charter.pm_name         || input.pmName        || "";
  charter.methodology     = charter.methodology     || input.methodology   || "";
  charter.start_date      = charter.start_date      || input.startDate     || "";
  charter.project_context = charter.project_context || input.projectContext || "";

  // S1.A-1: Compute finish_date when AI did not return it — identical formula
  // to Template Mode: start + duration * 7 days.
  if (typeof charter.finish_date !== "string" || !charter.finish_date.trim()) {
    if (input.startDate) {
      charter.finish_date = formatProjectDate(projectDateAtWeek(input.startDate, input.duration));
    } else {
      charter.finish_date = "";
    }
  }

  // S1.A-2: Guard missing arrays to prevent null-reference crashes in
  // renderCharter() and computeScore()
  if (!Array.isArray(charter.deliverables)) charter.deliverables = [];
  if (!Array.isArray(charter.milestones))   charter.milestones   = [];
  if (!Array.isArray(charter.in_scope))     charter.in_scope     = [];
  if (!Array.isArray(charter.out_of_scope)) charter.out_of_scope = [];
  if (!Array.isArray(charter.stakeholders)) charter.stakeholders = [];

  if (!charter.success_criteria) {
    const lines = (input.successCriteria || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    charter.success_criteria = lines;
  }

  // Ensure objective is always a string
  if (typeof charter.objective !== "string") {
    charter.objective = input.objective || "";
  }

  return charter;
}

/**
 * normaliseAIWBS(wbs)
 * S1.B-7: Validate minimum WBS fields required by buildGanttSchedule.
 * Drops rows that don't have at minimum a valid level (1/2/3) and a name.
 * Returns a normalised array, or an empty array with a flag if unusable.
 *
 * @param {any} wbs  The wbs field from AI output.
 * @returns {{ wbs: object[], usable: boolean, reason: string }}
 */
function normaliseAIWBS(wbs) {
  if (!Array.isArray(wbs) || wbs.length === 0) {
    return { wbs: [], usable: false, reason: "AI tidak mengembalikan WBS." };
  }

  const cleaned = wbs
    .filter((row) => {
      if (typeof row !== "object" || row === null) return false;
      const lvl = Number(row.level);
      if (![1, 2, 3].includes(lvl)) return false;
      if (!row.name || typeof row.name !== "string" || !row.name.trim()) return false;
      return true;
    })
    .map((row) => ({
      id:                   String(row.id  ?? ""),
      name:                 String(row.name).trim(),
      level:                Number(row.level),
      deliverable:          String(row.deliverable          ?? "").trim(),
      completion_criteria:  String(row.completion_criteria  ?? "").trim(),
    }));

  // Must have at least one L1 phase for Gantt to work
  const hasL1 = cleaned.some((r) => r.level === 1);
  if (!hasL1) {
    return {
      wbs: cleaned,
      usable: false,
      reason: "WBS dari AI tidak memiliki fase Level 1. Gantt tidak dapat ditampilkan dengan data ini.",
    };
  }

  return { wbs: cleaned, usable: true, reason: "" };
}

/**
 * showWBSFallbackNotice(reason)
 * S1.B-7: Show a human-readable notice inside the Gantt section when
 * AI WBS is unusable.  This prevents silent corruption or crashes.
 */
function showWBSFallbackNotice(reason) {
  const ganttContent = $("gantt-content");
  if (ganttContent) {
    ganttContent.innerHTML = `
      <div class="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <svg class="w-5 h-5 shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <div>
          <p class="font-semibold">Gantt tidak dapat ditampilkan</p>
          <p class="text-xs mt-0.5">${escHtml(reason)}</p>
        </div>
      </div>`;
  }
}

/** Klik tombol "Generate dengan AI" */
async function onGenerateAI() {
  // S1.A-4: Guard cost edits before re-generation
  if (!confirmCostEditOverwrite("AI")) return;

  const input = getFormData();
  if (!input) return;

  const requestId = ++generationRequestId;
  currentInput = input;

  // S1.B-5: Mark existing output as stale while loading.
  // Dim old sections so they cannot be mistaken for the new result.
  const outputSection = $("output-section");
  let loadingBanner = null;
  if (outputSection && currentDoc) {
    loadingBanner = document.createElement("div");
    loadingBanner.id = "ai-loading-banner";
    loadingBanner.className = "flex items-center gap-3 p-4 mb-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800";
    loadingBanner.innerHTML = `
      <svg class="w-5 h-5 animate-spin shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span></span>`;
    loadingBanner.querySelector("span").textContent =
      `Memproses "${input.projectName}" dengan AI. Dokumen di bawah adalah hasil sebelumnya, bukan hasil permintaan ini.`;
    outputSection.prepend(loadingBanner);
    ["section-charter","section-wbs","section-risk","section-cost","section-assumptions","section-gantt","section-governance"].forEach(id => {
      const s = $(id);
      if (s) s.style.opacity = "0.3";
    });
  }

  setLoading(true);
  setCostEditingDisabled(true);
  clearFallbackNotice();

  try {
    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const result = await resp.json();

    if (requestId !== generationRequestId) return;

    if (result.fallback) {
      // Server mengembalikan sinyal fallback
      throw new Error(result.reason || "AI tidak tersedia");
    }

    // ── Normalize AI output ──────────────────────────────────────────────
    const aiData = result.data;

    // S1.A-1 + S1.A-2 + S1.B-6: Normalise charter
    aiData.charter = normaliseAICharter(aiData.charter || {}, input);

    // S1.B-7: Normalise and validate WBS
    let wbsUnusableReason = "";
    {
      const wbsResult = normaliseAIWBS(aiData.wbs);
      aiData.wbs = wbsResult.wbs;
      if (!wbsResult.usable) {
        wbsUnusableReason = wbsResult.reason;
      }
    }

    // Normalize cost_estimate: backfill non_labor and row_total
    if (Array.isArray(aiData.cost_estimate)) {
      aiData.cost_estimate = aiData.cost_estimate.map((c) => {
        const labor    = Math.max(0, Number(c.subtotal) || 0);
        const nonLabor = Math.max(0, Number(c.non_labor) || 0);
        return { ...c, subtotal: labor, non_labor: nonLabor, row_total: labor + nonLabor };
      });
    } else {
      aiData.cost_estimate = [];
    }

    // Build a fresh cost_summary so the tfoot renders correctly
    if (!aiData.cost_summary) {
      const costSubtotal = (aiData.cost_estimate || []).reduce((s, c) => s + (c.row_total || 0), 0);
      const pct = 10;
      aiData.cost_summary = {
        contingency_pct:     pct,
        cost_subtotal:       costSubtotal,
        contingency_reserve: Math.round(costSubtotal * pct / 100),
        grand_total:         costSubtotal + Math.round(costSubtotal * pct / 100),
      };
    }

    // Ensure risk_register and assumptions are arrays (S1.E-22)
    if (!Array.isArray(aiData.risk_register))  aiData.risk_register  = [];
    if (!Array.isArray(aiData.assumptions))    aiData.assumptions    = [];

    currentMode = "ai";
    currentDoc  = aiData;
    // S1.A-4: Reset edit tracking after successful re-generation
    costEdited = false;
    // S1.B-6: Explicit badge — this is real Gemini output, not a fallback
    renderBadge("ai");
    renderDocument(aiData, input);

    // S1.B-7: Show explanation in Gantt area if WBS was unusable
    if (wbsUnusableReason) {
      showWBSFallbackNotice(wbsUnusableReason);
    }

  } catch (err) {
    if (requestId !== generationRequestId) return;

    // S1.B-5: Restore old sections on failure so user can still read previous doc
    ["section-charter","section-wbs","section-risk","section-cost","section-assumptions","section-gantt","section-governance"].forEach(id => {
      const s = $(id);
      if (s) s.style.opacity = "";
    });

    // S1.B-6: Explicit fallback labeling — not presented as successful AI output
    console.warn("[AI Fallback]", err.message);
    renderFallbackNotice(err.message);
    currentMode = "template";
    renderBadge("template");
    const doc = generateTemplate(input);
    currentDoc = doc;
    // S1.A-4: Reset edit tracking on fallback too (new doc generated)
    costEdited = false;
    renderDocument(doc, input);
  } finally {
    if (requestId === generationRequestId) {
      // S1.B-5: Always remove the loading banner and restore opacity
      if (loadingBanner) loadingBanner.remove();
      clearAIGenerationState();
      $("output-section")?.scrollIntoView({ behavior: "smooth" });
    }
  }
}

/** Cetak tampilan ramah-print */
function onPrint() {
  window.print();
}

// ── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Badge awal
  renderBadge("template");

  // Tombol generate
  $("btn-template")?.addEventListener("click", onGenerateTemplate);
  $("btn-ai")?.addEventListener("click", onGenerateAI);
  $("btn-print")?.addEventListener("click", onPrint);

  // Contingency % input — fires updateCostSummary whenever the user changes the %
  // S1.A-4: Also marks the cost table as edited when contingency is changed.
  $("contingency-pct-input")?.addEventListener("input", () => {
    costEdited = true;
    updateCostSummary();
  });

  // Tombol ekspor CSV
  $("export-charter")?.addEventListener("click", () => exportCSV("charter"));
  $("export-wbs")?.addEventListener("click", () => exportCSV("wbs"));
  $("export-risk")?.addEventListener("click", () => exportCSV("risk"));
  $("export-cost")?.addEventListener("click", () => exportCSV("cost"));
  $("export-governance")?.addEventListener("click", () => exportCSV("governance"));
});
