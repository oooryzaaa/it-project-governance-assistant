"use strict";

(function (root, factory) {
  const feature = factory(root.GovPlanUtils, root.GovPlanRiskFeature);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanTemplateFeature = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (utils, riskFeature) {
  const { parseProjectDate, projectDateAtWeek, formatProjectDate } = utils;
  const { buildContextualRisks } = riskFeature;
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

  return Object.freeze({
    generateTemplate,
    buildDeliverableScope,
    buildDeliverableWBS,
    buildDeliverableMilestones,
    getSubActivities,
  });
});
