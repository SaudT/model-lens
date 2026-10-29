import { INVOICE_FIELDS, type Invoice, type InvoiceField } from "./dataset";

export type FieldCheck = { field: InvoiceField; expected: string | number | null; actual: unknown; correct: boolean; kind: "correct" | "missing" | "invented" | "incorrect" };
export type Verdict = { jsonValid: boolean; schemaValid: boolean; pass: boolean; fieldAccuracy: number; fields: FieldCheck[]; errors: string[] };

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateInvoice(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Expected one JSON object"];
  const obj = value as Record<string, unknown>;
  const errors: string[] = [];
  for (const field of INVOICE_FIELDS) {
    const v = obj[field];
    if (!(field in obj)) { errors.push(`Missing field: ${field}`); continue; }
    if (v === null) continue;
    if (field === "total") {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || Math.abs(v * 100 - Math.round(v * 100)) > 1e-7) errors.push("total must be a nonnegative number with at most two decimal places or null");
    } else if (typeof v !== "string" || !v.trim()) errors.push(`${field} must be a nonempty string or null`);
    else if ((field === "invoiceDate" || field === "dueDate") && !isDate(v)) errors.push(`${field} must be a real ISO date or null`);
    else if (field === "currency" && !/^[A-Z]{3}$/.test(v)) errors.push("currency must be a three-letter uppercase code or null");
  }
  for (const key of Object.keys(obj)) if (!INVOICE_FIELDS.includes(key as InvoiceField)) errors.push(`Unexpected field: ${key}`);
  return errors;
}

export function scoreInvoice(raw: string, expected: Invoice, complete = true): Verdict {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    return { jsonValid: false, schemaValid: false, pass: false, fieldAccuracy: 0, fields: [], errors: ["Response is not valid JSON", ...(!complete ? ["Generation was incomplete"] : [])] };
  }
  const errors = validateInvoice(parsed);
  const obj = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  const fields: FieldCheck[] = INVOICE_FIELDS.map(field => {
    const actual = obj[field];
    const target = expected[field];
    const correct = field === "total" && typeof actual === "number" && typeof target === "number"
      ? Number.isFinite(actual) && Math.abs(actual - target) < 1e-7 : actual === target;
    return { field, expected: target, actual: actual ?? null, correct, kind: correct ? "correct" : actual == null ? "missing" : target === null ? "invented" : "incorrect" };
  });
  if (!complete) errors.push("Generation was incomplete");
  return { jsonValid: true, schemaValid: validateInvoice(parsed).length === 0, pass: errors.length === 0 && fields.every(f => f.correct), fieldAccuracy: fields.filter(f => f.correct).length / INVOICE_FIELDS.length, fields, errors };
}

/** Deliberately simple, general label parser. Never reads expected answers. */
export function extractBaseline(text: string): Invoice {
  function single(label: string): string | null {
    const matches = [...text.matchAll(new RegExp(`^${label}:\\s*(.+)$`, "gim"))].map(m => m[1].trim());
    const unique = [...new Set(matches)];
    return unique.length === 1 ? unique[0] : null;
  }
  const invoiceDate = single("Invoice Date");
  const dueDate = single("Due Date");
  const totalText = single("Total");
  // US-style numbers only: intentionally exposes the baseline's locale limitation.
  const total = totalText && /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(totalText) ? Number(totalText.replaceAll(",", "")) : null;
  const currency = single("Currency");
  return { vendor: single("Vendor"), invoiceNumber: single("Invoice Number"), invoiceDate: invoiceDate && isDate(invoiceDate) ? invoiceDate : null, dueDate: dueDate && isDate(dueDate) ? dueDate : null, currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null, total };
}
