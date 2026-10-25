"use strict";

(function (root, factory) {
  const feature = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanRiskFeature = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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

  return Object.freeze({ buildContextualRisks });
});
