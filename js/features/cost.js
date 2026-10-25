"use strict";

(function (root, factory) {
  const feature = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = feature;
  } else {
    root.GovPlanCostFeature = feature;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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

function calculateCostRow(hours, rate, nonLabor) {
  const safeHours = Math.max(0, Number(hours) || 0);
  const safeRate = Math.max(0, Number(rate) || 0);
  const safeNonLabor = Math.max(0, Number(nonLabor) || 0);
  const labor = safeHours * safeRate;
  return {
    hours: safeHours,
    rate: safeRate,
    nonLabor: safeNonLabor,
    labor,
    rowTotal: labor + safeNonLabor,
  };
}

function calculateCostSummary(items, rawPct) {
  const costSubtotal = (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(0, item.row_total || 0),
    0
  );
  let pct = parseFloat(rawPct);
  if (isNaN(pct) || pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  const contingencyReserve = Math.round(costSubtotal * pct / 100);
  return {
    contingency_pct: pct,
    cost_subtotal: costSubtotal,
    contingency_reserve: contingencyReserve,
    grand_total: costSubtotal + contingencyReserve,
  };
}

  return Object.freeze({
    parseBudgetIDR,
    multiplierFromUnit,
    calculateCostRow,
    calculateCostSummary,
  });
});
