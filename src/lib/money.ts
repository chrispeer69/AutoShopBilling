// Pure money/date/totals helpers — no Prisma import, unit-testable.

export function fmtMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function toCents(dollars: string | number): number {
  const n = typeof dollars === "string" ? parseFloat(dollars.replace(/[$,]/g, "")) : dollars;
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function dateKey(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
}

export function formatDocNumber(kind: "ESTIMATE" | "WORKORDER" | "INVOICE", key: string, seq: number): string {
  const nn = String(seq).padStart(2, "0");
  if (kind === "INVOICE") return `${key}-${nn}`;
  if (kind === "WORKORDER") return `RO-${key}-${nn}`;
  return `EST-${key}-${nn}`;
}

type ItemLike = { type: "PART" | "LABOR" | "FEE" | string; qty: number; unitPriceCents: number; costCents?: number | null; declined?: boolean };
type PaymentLike = { amountCents: number };
type DocLike = {
  items: ItemLike[];
  payments?: PaymentLike[];
  taxEnabled: boolean;
  taxRate: number;
  suppliesEnabled?: boolean;
  suppliesPct?: number;
  suppliesCapCents?: number;
};

/**
 * Totals. Declined lines are excluded from all charges.
 * Shop supplies fee = suppliesPct% of (active) labor, capped at suppliesCapCents (0 = no cap).
 * Tax applies to subtotal + supplies.
 */
export function docTotals(doc: DocLike) {
  const active = doc.items.filter((i) => !i.declined);
  const line = (i: ItemLike) => Math.round(i.qty * i.unitPriceCents);
  const subtotal = active.reduce((s, i) => s + line(i), 0);
  const laborSubtotal = active.filter((i) => i.type === "LABOR").reduce((s, i) => s + line(i), 0);
  const partsSubtotal = active.filter((i) => i.type === "PART").reduce((s, i) => s + line(i), 0);
  const declinedTotal = doc.items.filter((i) => i.declined).reduce((s, i) => s + line(i), 0);

  let supplies = 0;
  if (doc.suppliesEnabled && (doc.suppliesPct ?? 0) > 0) {
    supplies = Math.round(laborSubtotal * ((doc.suppliesPct ?? 0) / 100));
    const cap = doc.suppliesCapCents ?? 0;
    if (cap > 0) supplies = Math.min(supplies, cap);
  }

  const taxable = subtotal + supplies;
  const tax = doc.taxEnabled ? Math.round(taxable * (doc.taxRate / 100)) : 0;
  const total = taxable + tax;
  const paid = (doc.payments ?? []).reduce((s, p) => s + p.amountCents, 0);
  const balance = total - paid;

  const partsCost = active
    .filter((i) => i.type === "PART" && i.costCents != null)
    .reduce((s, i) => s + Math.round(i.qty * (i.costCents as number)), 0);
  const partsProfit = partsSubtotal - partsCost;

  return { subtotal, laborSubtotal, partsSubtotal, supplies, tax, total, paid, balance, declinedTotal, partsCost, partsProfit };
}

export function surchargeFor(balanceCents: number, pct: number): number {
  if (pct <= 0) return 0;
  return Math.round(balanceCents * (pct / 100));
}

export function priceFromCost(costCents: number, markupPct: number): number {
  return Math.round(costCents * (1 + markupPct / 100));
}

export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function vehicleLabel(v?: { year: string; make: string; model: string } | null): string {
  if (!v) return "";
  return [v.year, v.make, v.model].filter(Boolean).join(" ");
}
