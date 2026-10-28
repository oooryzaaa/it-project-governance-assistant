"use strict";

const PUBLIC_ASSETS = new Set([
  "/index.html",
  "/app.js",
  "/cobit-data.js",
  "/css/app.css",
  "/css/gantt.css",
  "/js/core/utils.js",
  "/js/core/project-store.js",
  "/js/core/project-persistence.js",
  "/js/features/risks.js",
  "/js/features/template.js",
  "/js/features/cobit.js",
  "/js/features/gantt-schedule.js",
  "/js/features/cost.js",
  "/js/features/ai-normalization.js",
  "/js/features/document-renderers.js",
  "/js/features/gantt-ui.js",
  "/js/features/cost-ui.js",
  "/js/features/assumptions-ui.js",
  "/js/features/governance-ui.js",
  "/js/features/status-ui.js",
  "/js/features/export-ui.js",
  "/js/features/workspace-ui.js",
  "/js/features/projects-ui.js",
]);

function isPublicAssetPath(requestPath) {
  return typeof requestPath === "string" && PUBLIC_ASSETS.has(requestPath);
}

module.exports = { isPublicAssetPath, PUBLIC_ASSETS };
