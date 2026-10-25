"use strict";

(function (root, factory) {
  const utils = factory(() => root.document);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = utils;
  } else {
    root.GovPlanUtils = utils;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (getDocument) {
  function $(id) {
    return getDocument().getElementById(id);
  }

  function el(tag, cls, text) {
    const element = getDocument().createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  }

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

  function escHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  return Object.freeze({
    $,
    el,
    parseProjectDate,
    projectDateAtWeek,
    formatProjectDate,
    escHtml,
  });
});
