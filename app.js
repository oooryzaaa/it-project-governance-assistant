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

// ── DOM helpers ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

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
  const { projectName, objective, duration, teamSize, category, budgetRange } = input;

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
        { desc: "Perubahan kebutuhan pengguna di tengah proyek", prob: "high", imp: "high", mit: "Lakukan review kebutuhan setiap sprint; gunakan manajemen perubahan formal" },
        { desc: "Celah keamanan pada aplikasi web (XSS, SQL Injection)", prob: "medium", imp: "high", mit: "Terapkan OWASP Top 10; lakukan code review dan pengujian penetrasi" },
        { desc: "Keterlambatan integrasi dengan sistem pihak ketiga", prob: "medium", imp: "medium", mit: "Identifikasi dependensi eksternal lebih awal; buat stub/mock API" },
        { desc: "Kinerja aplikasi tidak memenuhi target (response time)", prob: "low", imp: "high", mit: "Lakukan load testing; optimalkan query dan caching" },
        { desc: "Anggota tim mengundurkan diri atau tidak tersedia", prob: "low", imp: "high", mit: "Dokumentasikan pengetahuan teknis; siapkan rencana penggantian SDM" },
        { desc: "Ketidakpatuhan terhadap regulasi perlindungan data (UU PDP)", prob: "medium", imp: "high", mit: "Review compliance dengan UU PDP; implementasi enkripsi data sensitif" },
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
        { desc: "Fragmentasi perangkat dan versi OS menyebabkan bug", prob: "high", imp: "medium", mit: "Buat matriks perangkat target; gunakan emulator dan perangkat fisik representatif" },
        { desc: "Penolakan aplikasi oleh app store", prob: "medium", imp: "high", mit: "Ikuti panduan developer Google/Apple; review kebijakan sebelum submission" },
        { desc: "Konsumsi baterai dan data yang berlebihan", prob: "medium", imp: "medium", mit: "Profil performa sejak tahap pengembangan; optimalkan background process" },
        { desc: "Kebocoran data pengguna melalui izin aplikasi berlebihan", prob: "medium", imp: "high", mit: "Terapkan prinsip least privilege; audit izin aplikasi secara berkala" },
        { desc: "Keterlambatan feedback dari penguji beta", prob: "low", imp: "medium", mit: "Jadwalkan sesi pengujian beta lebih awal; siapkan form feedback terstruktur" },
        { desc: "Ketidakpatuhan terhadap kebijakan privasi app store", prob: "low", imp: "high", mit: "Buat privacy policy yang komprehensif; review sebelum setiap submission" },
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
        { desc: "Pelanggaran privasi data pengguna (GDPR/UU PDP)", prob: "medium", imp: "high", mit: "Terapkan anonymisasi/pseudonymisasi; buat data governance policy" },
        { desc: "Kapasitas komputasi tidak mencukupi untuk pelatihan model", prob: "low", imp: "medium", mit: "Estimasi kebutuhan komputasi lebih awal; pertimbangkan cloud computing" },
        { desc: "Ketergantungan pada data pihak ketiga yang tidak stabil", prob: "medium", imp: "medium", mit: "Buat mekanisme backup data; negosiasikan SLA dengan penyedia data" },
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
        { desc: "Kerentanan keamanan jaringan (unauthorized access)", prob: "medium", imp: "high", mit: "Lakukan security hardening; implementasi zero-trust architecture" },
        { desc: "Kegagalan komponen hardware selama implementasi", prob: "low", imp: "high", mit: "Beli komponen redundan; siapkan prosedur failover" },
        { desc: "Ketidaksesuaian antara infrastruktur baru dan sistem lama", prob: "high", imp: "medium", mit: "Lakukan compatibility testing lebih awal; buat migration plan detail" },
        { desc: "Downtime tidak terencana saat migrasi", prob: "medium", imp: "high", mit: "Jadwalkan maintenance window; siapkan rollback plan" },
        { desc: "Ketidakpatuhan terhadap regulasi keamanan data dan ISO 27001", prob: "low", imp: "high", mit: "Review compliance checklist ISO 27001; libatkan tim keamanan informasi" },
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

  // ── Project Charter ─────────────────────────────────────────────────────
  const charter = {
    objective,
    in_scope: meta.inScope,
    out_of_scope: meta.outScope,
    stakeholders: [
      "Project Manager – Bertanggung jawab atas keseluruhan proyek",
      "Tim Pengembang – Melaksanakan pekerjaan teknis",
      "Product Owner / Sponsor – Menyetujui deliverable dan anggaran",
      "Pengguna Akhir – Memberikan feedback dan melakukan UAT",
      "Tim QA – Memastikan kualitas deliverable",
    ],
    deliverables: meta.deliverables,
    milestones: meta.wbsPhases.map((phase, i) => {
      const weekEnd = Math.round(((i + 1) / meta.wbsPhases.length) * duration);
      return `Minggu ${weekEnd}: ${phase} selesai`;
    }),
  };

  // ── WBS ─────────────────────────────────────────────────────────────────
  const wbs = [];
  meta.wbsPhases.forEach((phase, phaseIdx) => {
    const phaseId = `${phaseIdx + 1}`;
    wbs.push({
      id: phaseId,
      name: phase,
      level: 1,
      deliverable: `Semua deliverable fase ${phase}`,
      completion_criteria: `Semua work package Level 2 pada fase ini telah disetujui oleh Project Manager`,
    });

    // Sub-aktivitas Level 2 & 3
    const subActivities = getSubActivities(category, phaseIdx);
    subActivities.forEach((sub, subIdx) => {
      const subId = `${phaseId}.${subIdx + 1}`;
      wbs.push({
        id: subId,
        name: sub.name,
        level: 2,
        deliverable: sub.deliverable,
        completion_criteria: sub.criteria,
      });
      // Level 3 task
      wbs.push({
        id: `${subId}.1`,
        name: `Eksekusi: ${sub.name}`,
        level: 3,
        deliverable: `Artefak teknis untuk ${sub.name}`,
        completion_criteria: `Dokumen/artefak direview dan disetujui oleh lead teknis`,
      });
    });
  });

  // ── Risk Register ───────────────────────────────────────────────────────
  const risk_register = meta.risks.map((r, i) => ({
    id: `R${String(i + 1).padStart(2, "0")}`,
    description: r.desc,
    probability: r.prob,
    impact: r.imp,
    mitigation: r.mit,
  }));

  // ── Cost Estimate ───────────────────────────────────────────────────────
  const cost_estimate = meta.costCategories.map((cat, i) => {
    const w = weights[i] || 1 / phaseCount;
    const hours = Math.round(totalHours * w);
    const subtotal = hours * baseRate;
    return { category: cat, hours, rate: baseRate, subtotal };
  });

  // ── Assumptions ─────────────────────────────────────────────────────────
  const assumptions = [
    `Tim proyek terdiri dari ${teamSize} anggota yang bekerja penuh waktu`,
    `Durasi proyek adalah ${duration} minggu kalender`,
    `Anggaran yang tersedia dalam kisaran ${budgetRange}`,
    `Tarif per jam diasumsikan Rp ${baseRate.toLocaleString("id-ID")} (estimasi standar industri lokal)`,
    "Sponsor proyek tersedia untuk review dan persetujuan rutin",
    "Infrastruktur dasar (komputer, internet) sudah tersedia",
    "Tidak ada perubahan organisasi besar selama durasi proyek",
  ];

  return { charter, wbs, risk_register, cost_estimate, assumptions };
}

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
  const { criteria, total, percentage } = computeScore(doc, input);

  return { mappings, kpis, criteria, total, percentage };
}

/**
 * buildCobitMappings()
 * Pilih objective yang relevan dari COBIT_OBJECTIVES.
 * Jika daftar kosong (belum diisi), kembalikan pesan TODO.
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

  // Pilih semua objective – dalam proyek nyata ini bisa difilter secara semantik.
  // Di sini kita petakan setiap objective ke bagian dokumen yang relevan.
  return objectives.slice(0, 5).map((obj) => ({
    code: obj.code,
    name: obj.name,
    reason: buildMappingReason(obj, doc, input),
    unknown: false,
  }));
}

function buildMappingReason(obj, doc, input) {
  // Buat alasan satu kalimat yang merujuk ke bagian dokumen
  const deliverablesSample = doc.charter.deliverables[0] || "deliverable utama";
  return `Objective ${obj.code} relevan karena proyek "${input.projectName}" mencakup "${deliverablesSample}" yang memerlukan ${obj.goal || "tata kelola yang baik"}.`;
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
      target: `${doc.risk_register.filter((r) => r.impact === "high").length} risiko berdampak tinggi memiliki rencana mitigasi aktif`,
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
  const securityRisks = doc.risk_register.filter((r) =>
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
  const hasKPIHint = doc.charter.milestones.length >= 3 && doc.charter.deliverables.length >= 3;
  const k3Score = hasKPIHint ? 2 : doc.charter.milestones.length > 0 ? 1 : 0;
  criteria.push({
    id: "K3",
    label: "Indikator keberhasilan yang terukur ada",
    score: k3Score,
    max: 2,
    reason: k3Score === 2
      ? `${doc.charter.milestones.length} milestone dan ${doc.charter.deliverables.length} deliverable teridentifikasi.`
      : k3Score === 1
      ? "Milestone ada namun belum memadai sebagai indikator keberhasilan."
      : "data tidak cukup – milestone dan deliverable tidak ditemukan.",
  });

  // K4: Peran dan akuntabilitas stakeholder jelas
  const stakeholderDetail = doc.charter.stakeholders.filter((s) => s.includes("–") || s.includes("-")).length;
  const k4Score = stakeholderDetail >= 3 ? 2 : doc.charter.stakeholders.length >= 2 ? 1 : 0;
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
  const hasDeliverables = doc.charter.deliverables.length >= 3;
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
      ["Tujuan", c.objective],
      ...c.in_scope.map((s) => ["Dalam Lingkup", s]),
      ...c.out_of_scope.map((s) => ["Luar Lingkup", s]),
      ...c.stakeholders.map((s) => ["Stakeholder", s]),
      ...c.deliverables.map((s) => ["Deliverable", s]),
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
    rows = [["Kategori", "Jam (Hours)", "Tarif (IDR/jam)", "Subtotal (IDR)"]];
    rows.push(...currentDoc.cost_estimate.map((c) => [c.category, c.hours, c.rate, c.subtotal]));
    const totalCost = currentDoc.cost_estimate.reduce((s, c) => s + c.subtotal, 0);
    rows.push(["TOTAL", "", "", totalCost]);
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
  if (mode === "ai") {
    badge.textContent = "Mode: AI";
    badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300";
  } else {
    badge.textContent = "Mode: Template";
    badge.className = "px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300";
  }
}

function renderFallbackNotice(reason) {
  const notice = $("fallback-notice");
  if (!notice) return;
  notice.textContent = `Mode template (AI tidak tersedia) — ${reason}`;
  notice.classList.remove("hidden");
}

function clearFallbackNotice() {
  const notice = $("fallback-notice");
  if (notice) notice.classList.add("hidden");
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

// ── Render dokumen ──────────────────────────────────────────────────────────

function renderDocument(doc, input) {
  renderCharter(doc.charter, input);
  renderWBS(doc.wbs);
  renderRiskRegister(doc.risk_register);
  renderCostEstimate(doc.cost_estimate);
  renderAssumptions(doc.assumptions);

  // Governance
  const governance = runGovernanceReview(doc, input);
  doc._governance = governance;
  renderGovernance(governance);

  // Tampilkan semua section
  ["section-charter", "section-wbs", "section-risk", "section-cost", "section-assumptions", "section-governance"].forEach(showSection);
  showSection("export-bar");
}

function renderCharter(charter, input) {
  const c = $("charter-content");
  if (!c) return;

  const listHTML = (items) =>
    `<ul class="list-disc list-inside space-y-1">${items.map((i) => `<li class="text-slate-700">${escHtml(i)}</li>`).join("")}</ul>`;

  c.innerHTML = `
    <div class="mb-4">
      <h4 class="font-semibold text-slate-800 mb-1">Tujuan Proyek</h4>
      <p class="text-slate-700">${escHtml(charter.objective)}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <h4 class="font-semibold text-slate-800 mb-1">Dalam Lingkup (In-Scope)</h4>
        ${listHTML(charter.in_scope)}
      </div>
      <div>
        <h4 class="font-semibold text-slate-800 mb-1">Luar Lingkup (Out-of-Scope)</h4>
        ${listHTML(charter.out_of_scope)}
      </div>
    </div>
    <div class="mb-4">
      <h4 class="font-semibold text-slate-800 mb-1">Stakeholder</h4>
      ${listHTML(charter.stakeholders)}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h4 class="font-semibold text-slate-800 mb-1">Deliverable</h4>
        ${listHTML(charter.deliverables)}
      </div>
      <div>
        <h4 class="font-semibold text-slate-800 mb-1">Milestone</h4>
        ${listHTML(charter.milestones)}
      </div>
    </div>
  `;
}

function renderWBS(wbs) {
  const tbody = $("wbs-tbody");
  if (!tbody) return;
  tbody.innerHTML = wbs
    .map((w) => {
      const indent = w.level === 2 ? "pl-6" : w.level === 3 ? "pl-12" : "";
      const weightClass = w.level === 1 ? "font-semibold bg-slate-50" : w.level === 2 ? "bg-white" : "bg-white text-slate-500 text-sm";
      return `<tr class="${weightClass} border-b border-slate-100">
        <td class="px-3 py-2 font-mono text-xs">${escHtml(w.id)}</td>
        <td class="px-3 py-2 ${indent}">${escHtml(w.name)}</td>
        <td class="px-3 py-2 text-center">${w.level}</td>
        <td class="px-3 py-2">${escHtml(w.deliverable)}</td>
        <td class="px-3 py-2">${escHtml(w.completion_criteria)}</td>
      </tr>`;
    })
    .join("");
}

function renderRiskRegister(risks) {
  const tbody = $("risk-tbody");
  if (!tbody) return;

  const levelBadge = (lvl) => {
    const map = { low: "bg-green-100 text-green-800", medium: "bg-yellow-100 text-yellow-800", high: "bg-red-100 text-red-800" };
    const label = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
    return `<span class="px-2 py-0.5 rounded text-xs font-medium ${map[lvl] || "bg-slate-100 text-slate-700"}">${label[lvl] || lvl}</span>`;
  };

  tbody.innerHTML = risks
    .map(
      (r) => `<tr class="border-b border-slate-100">
        <td class="px-3 py-2 font-mono text-xs">${escHtml(r.id)}</td>
        <td class="px-3 py-2">${escHtml(r.description)}</td>
        <td class="px-3 py-2 text-center">${levelBadge(r.probability)}</td>
        <td class="px-3 py-2 text-center">${levelBadge(r.impact)}</td>
        <td class="px-3 py-2">${escHtml(r.mitigation)}</td>
      </tr>`
    )
    .join("");
}

function renderCostEstimate(costs) {
  const tbody = $("cost-tbody");
  if (!tbody) return;

  const fmt = (n) => Number(n).toLocaleString("id-ID");

  tbody.innerHTML = costs
    .map(
      (c, i) => `<tr class="border-b border-slate-100" data-cost-idx="${i}">
        <td class="px-3 py-2">${escHtml(c.category)}</td>
        <td class="px-3 py-2 text-center">
          <input type="number" class="cost-hours w-20 border border-slate-300 rounded px-2 py-0.5 text-right text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none" 
            value="${c.hours}" min="0" data-idx="${i}" aria-label="Jam untuk ${escHtml(c.category)}">
        </td>
        <td class="px-3 py-2 text-center">
          <input type="number" class="cost-rate w-28 border border-slate-300 rounded px-2 py-0.5 text-right text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none" 
            value="${c.rate}" min="0" data-idx="${i}" aria-label="Tarif untuk ${escHtml(c.category)}">
        </td>
        <td class="px-3 py-2 text-right font-medium cost-subtotal" id="cost-sub-${i}">Rp ${fmt(c.subtotal)}</td>
      </tr>`
    )
    .join("");

  updateCostTotal();

  // Event listeners untuk edit biaya
  tbody.querySelectorAll(".cost-hours, .cost-rate").forEach((input) => {
    input.addEventListener("input", onCostEdit);
  });
}

function onCostEdit(e) {
  const idx = parseInt(e.target.dataset.idx, 10);
  if (!currentDoc || isNaN(idx)) return;

  const row = document.querySelector(`[data-cost-idx="${idx}"]`);
  if (!row) return;

  const hoursInput = row.querySelector(".cost-hours");
  const rateInput = row.querySelector(".cost-rate");
  const hours = parseFloat(hoursInput?.value) || 0;
  const rate = parseFloat(rateInput?.value) || 0;
  const subtotal = hours * rate;

  currentDoc.cost_estimate[idx].hours = hours;
  currentDoc.cost_estimate[idx].rate = rate;
  currentDoc.cost_estimate[idx].subtotal = subtotal;

  const subCell = $(`cost-sub-${idx}`);
  if (subCell) subCell.textContent = `Rp ${subtotal.toLocaleString("id-ID")}`;
  updateCostTotal();
}

function updateCostTotal() {
  const total = currentDoc?.cost_estimate?.reduce((s, c) => s + (c.subtotal || 0), 0) || 0;
  const totalEl = $("cost-total");
  if (totalEl) totalEl.textContent = `Rp ${total.toLocaleString("id-ID")}`;
}

function renderAssumptions(assumptions) {
  const container = $("assumptions-content");
  if (!container) return;
  container.innerHTML = `<ul class="list-disc list-inside space-y-1">
    ${assumptions.map((a) => `<li class="text-slate-700">${escHtml(a)}</li>`).join("")}
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
      const unknownTag = m.unknown
        ? `<span class="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">⚠ Kode tidak dikenal</span>`
        : "";
      return `<div class="p-3 border border-slate-200 rounded-lg ${m.unknown ? "border-red-300 bg-red-50" : "bg-slate-50"}">
        <div class="flex items-center flex-wrap gap-1 mb-1">
          <span class="font-mono font-semibold text-blue-700 text-sm">${escHtml(m.code)}</span>
          ${unknownTag}
          <span class="text-slate-700 text-sm font-medium">${escHtml(m.name)}</span>
        </div>
        <p class="text-slate-600 text-sm">${escHtml(m.reason)}</p>
      </div>`;
    })
    .join("");
}

function renderKPIs(kpis) {
  const container = $("kpi-list");
  if (!container) return;

  container.innerHTML = kpis
    .map(
      (k) => `<div class="flex gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div class="flex-1">
          <p class="font-medium text-slate-800 text-sm">${escHtml(k.kpi)}</p>
          <p class="text-slate-600 text-xs mt-0.5">Target: ${escHtml(k.target)}</p>
        </div>
        <div class="text-right shrink-0">
          <span class="font-mono text-xs text-blue-600 font-semibold">${escHtml(k.objective)}</span>
        </div>
      </div>`
    )
    .join("");
}

function renderScore(criteria, total, maxTotal, percentage) {
  const container = $("score-content");
  if (!container) return;

  const color = percentage >= 70 ? "text-emerald-700" : percentage >= 40 ? "text-yellow-700" : "text-red-700";
  const bgColor = percentage >= 70 ? "bg-emerald-50 border-emerald-200" : percentage >= 40 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  const scoreBar = (score, max) => {
    const pct = Math.round((score / max) * 100);
    const fill = score === 2 ? "bg-emerald-500" : score === 1 ? "bg-yellow-400" : "bg-red-300";
    return `<div class="w-16 bg-slate-200 rounded-full h-2 inline-block align-middle"><div class="${fill} h-2 rounded-full" style="width:${pct}%"></div></div>`;
  };

  container.innerHTML = `
    <div class="flex items-center justify-between p-4 rounded-xl border ${bgColor} mb-4">
      <div>
        <p class="text-slate-600 text-sm font-medium">Skor Kesesuaian Indikatif</p>
        <p class="text-xs text-slate-500 mt-0.5">Bukan hasil audit atau penilaian maturitas</p>
      </div>
      <div class="text-right">
        <p class="text-4xl font-bold ${color}">${percentage}%</p>
        <p class="text-slate-500 text-xs">${total} / ${maxTotal} poin</p>
      </div>
    </div>
    <div class="space-y-3">
      ${criteria
        .map(
          (c) => `
        <div class="flex gap-3 items-start p-3 bg-white border border-slate-200 rounded-lg">
          <span class="font-mono text-xs font-bold text-slate-500 shrink-0 mt-0.5">${c.id}</span>
          <div class="flex-1 min-w-0">
            <p class="text-slate-700 text-sm font-medium">${escHtml(c.label)}</p>
            <p class="text-slate-500 text-xs mt-0.5">${escHtml(c.reason)}</p>
          </div>
          <div class="shrink-0 text-right">
            <span class="text-sm font-bold ${c.score === 2 ? "text-emerald-600" : c.score === 1 ? "text-yellow-600" : "text-red-500"}">${c.score}/${c.max}</span>
            <div class="mt-1">${scoreBar(c.score, c.max)}</div>
          </div>
        </div>`
        )
        .join("")}
    </div>
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
 * @returns {object|null} Data form atau null bila tidak valid
 */
function getFormData() {
  const data = {
    projectName: ($("project-name")?.value || "").trim(),
    objective: ($("objective")?.value || "").trim(),
    duration: parseInt($("duration")?.value || "0", 10),
    teamSize: parseInt($("team-size")?.value || "0", 10),
    category: $("category")?.value || "",
    budgetRange: ($("budget-range")?.value || "").trim(),
  };

  const errors = [];
  if (!data.projectName) errors.push("Nama proyek wajib diisi.");
  if (!data.objective) errors.push("Tujuan proyek wajib diisi.");
  if (isNaN(data.duration) || data.duration < 1) errors.push("Durasi harus ≥ 1 minggu.");
  if (isNaN(data.teamSize) || data.teamSize < 1) errors.push("Ukuran tim harus ≥ 1 orang.");
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
  el.innerHTML = `<ul class="list-disc list-inside">${errors.map((e) => `<li>${escHtml(e)}</li>`).join("")}</ul>`;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearFormErrors() {
  const el = $("form-errors");
  if (el) {
    el.innerHTML = "";
    el.classList.add("hidden");
  }
}

/** Klik tombol "Generate Template" */
async function onGenerateTemplate() {
  const input = getFormData();
  if (!input) return;

  currentMode = "template";
  currentInput = input;
  renderBadge("template");
  clearFallbackNotice();

  const doc = generateTemplate(input);
  currentDoc = doc;
  renderDocument(doc, input);

  $("output-section")?.scrollIntoView({ behavior: "smooth" });
}

/** Klik tombol "Generate dengan AI" */
async function onGenerateAI() {
  const input = getFormData();
  if (!input) return;

  currentInput = input;
  setLoading(true);
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

    if (result.fallback) {
      // Server mengembalikan sinyal fallback
      throw new Error(result.reason || "AI tidak tersedia");
    }

    currentMode = "ai";
    currentDoc = result.data;
    renderBadge("ai");
    renderDocument(result.data, input);
  } catch (err) {
    // Fallback ke template mode
    console.warn("[AI Fallback]", err.message);
    renderFallbackNotice(err.message);
    currentMode = "template";
    renderBadge("template");
    const doc = generateTemplate(input);
    currentDoc = doc;
    renderDocument(doc, input);
  } finally {
    setLoading(false);
    $("output-section")?.scrollIntoView({ behavior: "smooth" });
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

  // Tombol ekspor CSV
  $("export-charter")?.addEventListener("click", () => exportCSV("charter"));
  $("export-wbs")?.addEventListener("click", () => exportCSV("wbs"));
  $("export-risk")?.addEventListener("click", () => exportCSV("risk"));
  $("export-cost")?.addEventListener("click", () => exportCSV("cost"));
  $("export-governance")?.addEventListener("click", () => exportCSV("governance"));
});
