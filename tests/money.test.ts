import { describe, it, expect } from "vitest";
import { toCents, fmtMoney, dateKey, formatDocNumber, docTotals, surchargeFor, priceFromCost } from "../src/lib/money";

describe("toCents", () => {
  it("parses dollars", () => {
    expect(toCents("12.34")).toBe(1234);
    expect(toCents("$1,250.00")).toBe(125000);
    expect(toCents("")).toBe(0);
    expect(toCents("abc")).toBe(0);
    expect(toCents(99.999)).toBe(10000); // rounds
  });
});

describe("doc numbering", () => {
  it("formats per kind, resets daily via key", () => {
    const key = dateKey(new Date(2026, 5, 11)); // Jun 11 2026
    expect(key).toBe("061126");
    expect(formatDocNumber("INVOICE", key, 1)).toBe("061126-01");
    expect(formatDocNumber("INVOICE", key, 12)).toBe("061126-12");
    expect(formatDocNumber("WORKORDER", key, 3)).toBe("RO-061126-03");
    expect(formatDocNumber("ESTIMATE", key, 7)).toBe("EST-061126-07");
  });
});

describe("docTotals", () => {
  const base = { taxEnabled: false, taxRate: 0 };

  it("sums parts + labor, excludes declined", () => {
    const t = docTotals({
      ...base,
      items: [
        { type: "PART", qty: 2, unitPriceCents: 1500 },
        { type: "LABOR", qty: 1.5, unitPriceCents: 12000 },
        { type: "PART", qty: 1, unitPriceCents: 99900, declined: true },
      ],
    });
    expect(t.subtotal).toBe(3000 + 18000);
    expect(t.laborSubtotal).toBe(18000);
    expect(t.partsSubtotal).toBe(3000);
    expect(t.declinedTotal).toBe(99900);
    expect(t.total).toBe(21000);
  });

  it("applies tax to subtotal + supplies, frozen rate", () => {
    const t = docTotals({
      items: [{ type: "LABOR", qty: 2, unitPriceCents: 10000 }],
      taxEnabled: true,
      taxRate: 7.25,
      suppliesEnabled: true,
      suppliesPct: 5,
      suppliesCapCents: 0,
    });
    expect(t.supplies).toBe(1000); // 5% of 20000 labor
    expect(t.tax).toBe(Math.round(21000 * 0.0725)); // 1523
    expect(t.total).toBe(20000 + 1000 + 1523);
  });

  it("caps supplies fee", () => {
    const t = docTotals({
      ...base,
      items: [{ type: "LABOR", qty: 10, unitPriceCents: 12000 }],
      suppliesEnabled: true,
      suppliesPct: 10,
      suppliesCapCents: 2500,
    });
    expect(t.supplies).toBe(2500); // 12000 uncapped → 2500 cap
  });

  it("supplies only on labor, not parts", () => {
    const t = docTotals({
      ...base,
      items: [{ type: "PART", qty: 1, unitPriceCents: 50000 }],
      suppliesEnabled: true,
      suppliesPct: 10,
      suppliesCapCents: 0,
    });
    expect(t.supplies).toBe(0);
  });

  it("computes balance and parts profit", () => {
    const t = docTotals({
      ...base,
      items: [{ type: "PART", qty: 2, unitPriceCents: 3000, costCents: 2000 }],
      payments: [{ amountCents: 4000 }],
    });
    expect(t.total).toBe(6000);
    expect(t.paid).toBe(4000);
    expect(t.balance).toBe(2000);
    expect(t.partsCost).toBe(4000);
    expect(t.partsProfit).toBe(2000);
  });

  it("fractional hours round per line", () => {
    const t = docTotals({ ...base, items: [{ type: "LABOR", qty: 0.3, unitPriceCents: 12500 }] });
    expect(t.subtotal).toBe(3750);
  });
});

describe("surcharge + markup", () => {
  it("surchargeFor", () => {
    expect(surchargeFor(10000, 3)).toBe(300);
    expect(surchargeFor(10000, 0)).toBe(0);
  });
  it("priceFromCost", () => {
    expect(priceFromCost(1000, 40)).toBe(1400);
    expect(priceFromCost(333, 50)).toBe(500);
  });
});

describe("fmtMoney", () => {
  it("formats USD", () => {
    expect(fmtMoney(123456)).toBe("$1,234.56");
  });
});
