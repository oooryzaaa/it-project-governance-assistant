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
    const totalValue = doc.cost_summary?.grand_total;
    const total = totalValue === null || totalValue === undefined || !Number.isFinite(Number(totalValue))
      ? null
      : Number(totalValue);
    const duration = input.duration ?? "—";
    const projectName = charter.project_title || input.projectName || "Proyek tanpa nama";
    const governanceScore = Number(doc._governance?.percentage);
    const governanceMarkup = Number.isFinite(governanceScore)
      ? `<section class="overview-panel overview-governance-panel">
          <div class="overview-panel-heading">
            <div><h4>Governance review</h4><p>Indicative planning score · not an audit result</p></div>
            <span class="overview-score">${escapeHtml(`${governanceScore}%`)}</span>
          </div>
          <a href="#section-governance" data-workspace-link="governance" class="overview-panel-link">Review COBIT 2019 mapping <span aria-hidden="true">→</span></a>
        </section>`
      : "";
    const metrics = [
      { label: "Duration", value: duration === "—" ? duration : `${duration} weeks`, icon: "◷", tone: "indigo" },
      { label: "Deliverables", value: String(deliverables), icon: "▤", tone: "teal" },
      { label: "Risks identified", value: String(risks), icon: "◇", tone: "amber" },
      { label: "Estimated total", value: total === null ? "Not available" : `Rp ${total.toLocaleString("id-ID")}`, icon: "Rp", tone: "blue" },
    ];
    const documentLinks = [
      ["charter", "Project Charter", "Project scope, objectives and stakeholders"],
      ["wbs", "Work Breakdown Structure", "Deliverables and work packages"],
      ["gantt", "Gantt Chart", "Estimated timeline and dependencies"],
      ["risk", "Risk Register", "Contextual project risks"],
      ["cost", "Cost Estimation", "Editable estimate and budget health"],
      ["assumptions", "Assumptions", "Planning assumptions to validate"],
      ["governance", "COBIT 2019 Review", "Indicative objective mapping"],
    ];
    container.innerHTML = `
      <div class="overview-dashboard">
        <section class="overview-project-card">
          <div class="overview-project-heading">
            <div>
              <p class="overview-eyebrow">Project snapshot</p>
              <h3>${escapeHtml(projectName)}</h3>
              <p class="overview-project-description">Generated planning documents and current estimate for this project.</p>
            </div>
            <a href="#section-charter" data-workspace-link="charter" class="overview-primary-link">Open project charter <span aria-hidden="true">→</span></a>
          </div>
          <dl class="overview-metrics">
            ${metrics.map((metric) => `<div class="overview-metric-card">
              <span class="overview-metric-icon overview-tone-${metric.tone}" aria-hidden="true">${metric.icon}</span>
              <dt>${metric.label}</dt>
              <dd>${escapeHtml(metric.value)}</dd>
            </div>`).join("")}
          </dl>
        </section>

        <div class="overview-detail-grid">
          <section class="overview-panel overview-schedule-panel">
            <div class="overview-panel-heading">
              <div><h4>Planned schedule</h4><p>Dates from the current Project Charter and schedule</p></div>
              <a href="#section-gantt" data-workspace-link="gantt" class="overview-text-link">View Gantt</a>
            </div>
            <div class="overview-date-range">
              <div><span>Planned start</span><strong>${escapeHtml(formatDate(charter.start_date || input.startDate))}</strong></div>
              <span class="overview-date-arrow" aria-hidden="true">→</span>
              <div><span>Planned finish</span><strong>${escapeHtml(formatDate(charter.finish_date))}</strong></div>
            </div>
            <div class="overview-schedule-meta">
              <span>${escapeHtml(duration === "—" ? duration : `${duration} weeks`)}</span>
              <span>${deliverables} deliverable${deliverables === 1 ? "" : "s"}</span>
            </div>
          </section>

          <section class="overview-panel overview-budget-panel">
            <div class="overview-panel-heading">
              <div><h4>Budget health</h4><p>Compared with the project budget provided</p></div>
              <span class="overview-panel-icon" aria-hidden="true">Rp</span>
            </div>
            <div id="overview-budget-health"></div>
            <a href="#section-cost" data-workspace-link="cost" class="overview-panel-link">Review cost estimate <span aria-hidden="true">→</span></a>
          </section>
          ${governanceMarkup}
        </div>

        <section class="overview-panel overview-documents-panel">
          <div class="overview-panel-heading">
            <div><h4>Project documents</h4><p>Open a module to review the generated detail</p></div>
          </div>
          <div class="overview-document-grid">
            ${documentLinks.map(([id, label, description]) => `<a href="${modules[id].hash}" data-workspace-link="${id}" class="overview-document-link">
              <span class="overview-document-mark" aria-hidden="true">${escapeHtml(label.slice(0, 1))}</span>
              <span><strong>${label}</strong><small>${description}</small></span>
              <span class="overview-document-arrow" aria-hidden="true">↗</span>
            </a>`).join("")}
          </div>
        </section>

        <section class="overview-panel overview-export-panel">
          <div class="overview-panel-heading">
            <div><h4>Export documents</h4><p>Download the latest generated or edited values as CSV</p></div>
          </div>
          <div class="overview-export-actions">
          ${["charter", "wbs", "risk", "cost", "gantt", "governance"].map((id) => {
            const label = id === "charter" ? "Project Charter" : id === "wbs" ? "WBS" :
              id === "risk" ? "Risk Register" : id === "cost" ? "Cost Estimation" :
              id === "gantt" ? "Gantt Chart" : "COBIT Review";
            return `<button type="button" data-export-section="${id}" class="overview-export-button">${label}</button>`;
          }).join("")}
          </div>
        </section>
      </div>`;
    const budgetHealth = root.document.getElementById("budget-status");
    const overviewBudgetHealth = root.document.getElementById("overview-budget-health");
    if (budgetHealth && overviewBudgetHealth) {
      overviewBudgetHealth.innerHTML = budgetHealth.innerHTML.replace(
        'id="budget-status"',
        'class="budget-status-copy"',
      );
    }
  }

  function applyActiveModule() {
    const active = store.getActiveUiModule();
    const moduleTitles = {
      overview: "Overview",
      charter: "Project Charter",
      wbs: "Work Breakdown Structure",
      gantt: "Gantt Chart",
      risk: "Risk Register",
      cost: "Cost Estimation",
      assumptions: "Assumptions",
      governance: "COBIT 2019 Review",
    };
    const contextTitle = root.document.getElementById("workspace-context-title");
    if (contextTitle) contextTitle.textContent = store.getDocument()
      ? moduleTitles[active] || "Project workspace"
      : "New project";
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
