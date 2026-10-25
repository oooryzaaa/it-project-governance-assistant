"use strict";

(function (root, factory) {
  const feature = factory(root);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanWorkspaceUI = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const store = root.GovPlanProjectStore;
  const modules = {
    overview: { sectionId: "section-overview", hash: "#overview", navId: "nav-overview" },
    charter: { sectionId: "section-charter", hash: "#section-charter", navId: "nav-charter" },
    wbs: { sectionId: "section-wbs", hash: "#section-wbs", navId: "nav-wbs" },
    gantt: { sectionId: "section-gantt", hash: "#section-gantt", navId: "nav-gantt" },
    risk: { sectionId: "section-risk", hash: "#section-risk", navId: "nav-risk" },
    cost: { sectionId: "section-cost", hash: "#section-cost", navId: "nav-cost" },
    assumptions: { sectionId: "section-assumptions", hash: "#section-assumptions", navId: "nav-assumptions" },
    governance: { sectionId: "section-governance", hash: "#section-governance", navId: "nav-governance" },
  };
  const hashToModule = Object.fromEntries(
    Object.entries(modules).flatMap(([moduleId, module]) => [
      [module.hash, moduleId],
      [`#${module.sectionId}`, moduleId],
    ]),
  );
  let initialized = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function formatDate(value) {
    if (!value) return "Belum ditentukan";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return String(value);
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) :
      new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
  }

  function renderOverview() {
    const container = root.document?.getElementById("overview-content");
    const doc = store.getDocument();
    if (!container || !doc) return;
    const charter = doc.charter || {};
    const input = store.getLastAcceptedInput() || {};
    const deliverables = Array.isArray(charter.deliverables) ? charter.deliverables.length : 0;
    const risks = Array.isArray(doc.risk_register) ? doc.risk_register.length : 0;
    const total = Number(doc.cost_summary?.grand_total);
    const duration = input.duration ?? "—";
    const cards = [
      ["Mulai", formatDate(charter.start_date || input.startDate)],
      ["Selesai", formatDate(charter.finish_date)],
      ["Durasi", duration === "—" ? duration : `${duration} minggu`],
      ["Deliverable", String(deliverables)],
      ["Estimasi biaya", Number.isFinite(total) ? `Rp ${total.toLocaleString("id-ID")}` : "Belum tersedia"],
      ["Risiko terdaftar", String(risks)],
    ];
    container.innerHTML = `
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-widest text-slate-400">Ringkasan proyek</p>
        <h3 class="mt-1 text-xl font-bold text-slate-800">${escapeHtml(charter.project_title || input.projectName || "Proyek tanpa nama")}</h3>
      </div>
      <dl class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        ${cards.map(([label, value]) => `<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <dt class="text-xs font-medium text-slate-500">${label}</dt>
          <dd class="mt-1 text-base font-semibold text-slate-800">${escapeHtml(value)}</dd>
        </div>`).join("")}
      </dl>
      <div id="overview-budget-health" class="mt-4"></div>
      <div class="mt-6">
        <h4 class="text-sm font-bold text-slate-700">Dokumen proyek</h4>
        <div class="mt-3 flex flex-wrap gap-2">
          ${Object.entries(modules).filter(([id]) => id !== "overview").map(([id, module]) => {
            const label = id === "governance" ? "COBIT Review" : id === "risk" ? "Risk Register" :
              id === "cost" ? "Estimasi Biaya" : id === "wbs" ? "WBS" :
              id === "gantt" ? "Gantt Chart" : id === "assumptions" ? "Asumsi" : "Project Charter";
            return `<a href="${module.hash}" data-workspace-link="${id}" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">${label}</a>`;
          }).join("")}
        </div>
      </div>
      <div class="mt-6">
        <h4 class="text-sm font-bold text-slate-700">Ekspor CSV</h4>
        <div class="mt-3 flex flex-wrap gap-2">
          ${["charter", "wbs", "risk", "cost", "gantt", "governance"].map((id) => {
            const label = id === "charter" ? "Project Charter" : id === "wbs" ? "WBS" :
              id === "risk" ? "Risk Register" : id === "cost" ? "Biaya" :
              id === "gantt" ? "Gantt" : "COBIT";
            const section = id === "governance" ? "governance" : id;
            return `<button type="button" data-export-section="${section}" class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Ekspor ${label}</button>`;
          }).join("")}
        </div>
      </div>`;
    const budgetHealth = root.document.getElementById("budget-status");
    const overviewBudgetHealth = root.document.getElementById("overview-budget-health");
    if (budgetHealth && overviewBudgetHealth) overviewBudgetHealth.innerHTML = budgetHealth.innerHTML;
  }

  function applyActiveModule() {
    const active = store.getActiveUiModule();
    for (const [id, module] of Object.entries(modules)) {
      const section = root.document.getElementById(module.sectionId);
      const link = root.document.getElementById(module.navId);
      const visible = id === active && Boolean(store.getDocument());
      if (section) {
        section.classList.toggle("hidden", !visible);
        section.setAttribute("aria-hidden", String(!visible));
      }
      if (link) {
        if (visible) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
        link.classList.toggle("bg-blue-50", visible);
        link.classList.toggle("text-blue-700", visible);
        link.classList.toggle("font-semibold", visible);
        link.classList.toggle("text-slate-400", !visible);
        const badge = link.querySelector("span");
        badge?.classList.toggle("bg-blue-600", visible);
        badge?.classList.toggle("text-white", visible);
        badge?.classList.toggle("bg-slate-100", !visible);
        badge?.classList.toggle("text-slate-400", !visible);
      }
      if (section) {
        section.setAttribute("tabindex", "-1");
      }
    }
  }

  function closeMobileNavigation(returnFocus = true) {
    const sidebar = root.document.getElementById("workspace-sidebar");
    const backdrop = root.document.getElementById("nav-backdrop");
    store.setMobileNavigationOpen(false);
    sidebar?.classList.remove("mobile-open");
    backdrop?.classList.add("hidden");
    root.document.getElementById("mobile-nav-toggle")?.setAttribute("aria-expanded", "false");
    if (returnFocus) root.document.getElementById("mobile-nav-toggle")?.focus();
  }

  function openMobileNavigation() {
    const sidebar = root.document.getElementById("workspace-sidebar");
    const backdrop = root.document.getElementById("nav-backdrop");
    store.setMobileNavigationOpen(true);
    sidebar?.classList.add("mobile-open");
    backdrop?.classList.remove("hidden");
    root.document.getElementById("mobile-nav-toggle")?.setAttribute("aria-expanded", "true");
    root.document.querySelector("#sidebar-nav a")?.focus();
  }

  function navigate(moduleId, updateHash = true) {
    if (!modules[moduleId]) return;
    store.setActiveUiModule(moduleId);
    if (updateHash) {
      const hash = modules[moduleId].hash;
      if (root.location.hash !== hash) root.history.pushState(null, "", hash);
    }
    if (store.isMobileNavigationOpen()) closeMobileNavigation(false);
    if (store.getDocument()) root.document.getElementById(modules[moduleId].sectionId)?.focus();
  }

  function onStoreChange(change) {
    if (change.type === "document" || change.type === "document-updated" || change.type === "input") {
      renderOverview();
    }
    if (change.type === "active-module" || change.type === "document") applyActiveModule();
    if (change.type === "mobile-navigation") {
      const sidebar = root.document.getElementById("workspace-sidebar");
      const backdrop = root.document.getElementById("nav-backdrop");
      sidebar?.classList.toggle("mobile-open", change.open);
      backdrop?.classList.toggle("hidden", !change.open);
      root.document.getElementById("mobile-nav-toggle")?.setAttribute("aria-expanded", String(change.open));
    }
  }

  function init() {
    if (initialized || !root.document) return;
    initialized = true;
    root.document.getElementById("sidebar-nav")?.addEventListener("click", (event) => {
      const link = event.target.closest("[data-workspace-link]");
      if (!link) return;
      event.preventDefault();
      navigate(link.dataset.workspaceLink);
    });
    root.document.getElementById("overview-content")?.addEventListener("click", (event) => {
      const link = event.target.closest("[data-workspace-link]");
      if (!link) return;
      event.preventDefault();
      navigate(link.dataset.workspaceLink);
    });
    root.document.getElementById("mobile-nav-toggle")?.addEventListener("click", () => {
      if (store.isMobileNavigationOpen()) closeMobileNavigation();
      else openMobileNavigation();
    });
    root.document.getElementById("nav-backdrop")?.addEventListener("click", () => closeMobileNavigation());
    root.document.addEventListener("keydown", (event) => {
      if (!store.isMobileNavigationOpen()) return;
      if (event.key === "Escape") {
        closeMobileNavigation();
        return;
      }
      if (event.key !== "Tab") return;
      const links = [...root.document.querySelectorAll("#sidebar-nav a")];
      if (!links.length) return;
      const first = links[0];
      const last = links[links.length - 1];
      if (event.shiftKey && root.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && root.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    root.addEventListener("hashchange", () => {
      const moduleId = hashToModule[root.location.hash];
      if (moduleId) navigate(moduleId, false);
    });
    root.addEventListener("popstate", () => {
      const moduleId = hashToModule[root.location.hash];
      if (moduleId) navigate(moduleId, false);
    });
    store.subscribe(onStoreChange);
    root.document.getElementById("nav-input")?.addEventListener("click", () => {
      if (store.isMobileNavigationOpen()) {
        closeMobileNavigation(false);
        root.document.getElementById("section-form")?.focus();
      }
    });
    const initialModule = hashToModule[root.location.hash] || store.getActiveUiModule();
    if (modules[initialModule]) store.setActiveUiModule(initialModule);
    applyActiveModule();
    renderOverview();
  }

  return Object.freeze({ init, navigate, renderOverview, modules, hashToModule });
});
