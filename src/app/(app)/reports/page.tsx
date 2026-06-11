import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { fmtMoney, fmtDate, docTotals, inputClsSafe } from "./helpers";
import { Card, CardHeader, EmptyState, inputCls, btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { user } = await requireOwner();

  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = searchParams.from ? new Date(searchParams.from + "T00:00:00") : defFrom;
  const to = searchParams.to ? new Date(searchParams.to + "T23:59:59") : now;

  const [invoices, openInvoices, payments] = await Promise.all([
    prisma.doc.findMany({
      where: { shopId: user.shopId, kind: "INVOICE", status: { not: "VOID" }, date: { gte: from, lte: to } },
      include: { items: true, payments: true, customer: true },
    }),
    prisma.doc.findMany({
      where: { shopId: user.shopId, kind: "INVOICE", status: { in: ["OPEN", "PARTIAL"] } },
      include: { items: true, payments: true, customer: true },
    }),
    prisma.payment.findMany({
      where: { doc: { shopId: user.shopId, status: { not: "VOID" } }, date: { gte: from, lte: to } },
    }),
  ]);

  // Period summary
  let sales = 0, taxCollected = 0, suppliesCollected = 0, partsRevenue = 0, partsCost = 0, laborRevenue = 0;
  const byCustomer = new Map<string, { name: string; total: number }>();
  for (const inv of invoices) {
    const t = docTotals(inv);
    sales += t.total;
    taxCollected += t.tax;
    suppliesCollected += t.supplies;
    partsRevenue += t.partsSubtotal;
    partsCost += t.partsCost;
    laborRevenue += t.laborSubtotal;
    const c = byCustomer.get(inv.customerId) ?? { name: inv.customer.name, total: 0 };
    c.total += t.total;
    byCustomer.set(inv.customerId, c);
  }
  const topCustomers = Array.from(byCustomer.values()).sort((a, b) => b.total - a.total).slice(0, 8);

  // Payments by method
  const byMethod = new Map<string, number>();
  let collected = 0;
  for (const p of payments) {
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountCents);
    collected += p.amountCents;
  }

  // Labor by tech (period invoices)
  const techIds = new Set<string>();
  invoices.forEach((inv) => inv.items.forEach((i) => i.techId && !i.declined && techIds.add(i.techId)));
  const techs = techIds.size ? await prisma.user.findMany({ where: { id: { in: Array.from(techIds) } } }) : [];
  const techName = new Map(techs.map((t) => [t.id, t.name]));
  const byTech = new Map<string, { hours: number; revenue: number }>();
  let unassignedLabor = 0;
  for (const inv of invoices) {
    for (const i of inv.items) {
      if (i.type !== "LABOR" || i.declined) continue;
      const rev = Math.round(i.qty * i.unitPriceCents);
      if (!i.techId) { unassignedLabor += rev; continue; }
      const cur = byTech.get(i.techId) ?? { hours: 0, revenue: 0 };
      cur.hours += i.qty;
      cur.revenue += rev;
      byTech.set(i.techId, cur);
    }
  }

  // A/R aging
  const buckets = [0, 0, 0, 0]; // 0-30 / 31-60 / 61-90 / 90+
  const aged: { number: string; name: string; date: Date; balance: number; days: number }[] = [];
  for (const inv of openInvoices) {
    const t = docTotals(inv);
    if (t.balance <= 0) continue;
    const days = Math.floor((now.getTime() - inv.date.getTime()) / 86400000);
    buckets[days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3] += t.balance;
    aged.push({ number: inv.number, name: inv.customer.name, date: inv.date, balance: t.balance, days });
  }
  aged.sort((a, b) => b.days - a.days);

  const fd = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-steel-900">Reports</h1>
        <form className="flex items-end gap-2 flex-wrap">
          <label className="block">
            <span className="block text-xs font-semibold text-steel-500 uppercase mb-1">From</span>
            <input type="date" name="from" defaultValue={fd(from)} className={inputClsSafe} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-steel-500 uppercase mb-1">To</span>
            <input type="date" name="to" defaultValue={fd(to)} className={inputClsSafe} />
          </label>
          <button className={btnPrimary}>Run</button>
        </form>
      </div>
      <p className="text-sm text-steel-500 -mt-3">{fmtDate(from)} → {fmtDate(to)} · voided invoices excluded</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Invoiced sales" value={fmtMoney(sales)} />
        <Stat label="Tax collected" value={fmtMoney(taxCollected)} sub="for your sales tax filing" />
        <Stat label="Payments collected" value={fmtMoney(collected)} />
        <Stat label="Parts profit" value={fmtMoney(partsRevenue - partsCost)} sub={`on ${fmtMoney(partsRevenue)} parts sold`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Revenue mix" />
          <div className="p-5 text-sm space-y-2">
            <Row k="Labor" v={fmtMoney(laborRevenue)} />
            <Row k="Parts" v={fmtMoney(partsRevenue)} />
            <Row k="Parts cost" v={`-${fmtMoney(partsCost)}`} muted />
            <Row k="Shop supplies collected" v={fmtMoney(suppliesCollected)} />
            <Row k="Tax collected" v={fmtMoney(taxCollected)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Payments by method" />
          {byMethod.size === 0 ? <EmptyState>No payments in this period.</EmptyState> : (
            <div className="p-5 text-sm space-y-2">
              {Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1]).map(([m, v]) => <Row key={m} k={m} v={fmtMoney(v)} />)}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Labor by tech" />
          {byTech.size === 0 && unassignedLabor === 0 ? <EmptyState>No labor invoiced in this period.</EmptyState> : (
            <div className="p-5 text-sm space-y-2">
              {Array.from(byTech.entries()).sort((a, b) => b[1].revenue - a[1].revenue).map(([id, v]) => (
                <Row key={id} k={`${techName.get(id) ?? "Unknown"} · ${v.hours.toFixed(1)} hrs`} v={fmtMoney(v.revenue)} />
              ))}
              {unassignedLabor > 0 && <Row k="Unassigned" v={fmtMoney(unassignedLabor)} muted />}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Top customers" />
          {topCustomers.length === 0 ? <EmptyState>No invoices in this period.</EmptyState> : (
            <div className="p-5 text-sm space-y-2">
              {topCustomers.map((c) => <Row key={c.name} k={c.name} v={fmtMoney(c.total)} />)}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Accounts receivable — aging (all open invoices)" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-steel-100 border-b border-steel-100">
          {["0–30 days", "31–60 days", "61–90 days", "90+ days"].map((label, i) => (
            <div key={label} className="bg-white px-4 py-3 text-center">
              <div className="text-xs text-steel-500 font-semibold uppercase">{label}</div>
              <div className={`text-lg font-bold tabular-nums ${i >= 2 && buckets[i] > 0 ? "text-red-600" : "text-steel-900"}`}>{fmtMoney(buckets[i])}</div>
            </div>
          ))}
        </div>
        {aged.length === 0 ? <EmptyState>Nothing outstanding. 🎉</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <tbody className="divide-y divide-steel-100">
                {aged.map((r) => (
                  <tr key={r.number}>
                    <td className="px-5 py-2 font-mono text-steel-900">{r.number}</td>
                    <td className="px-3 py-2 text-steel-700">{r.name}</td>
                    <td className="px-3 py-2 text-steel-500">{fmtDate(r.date)}</td>
                    <td className={`px-3 py-2 ${r.days > 60 ? "text-red-600 font-semibold" : "text-steel-500"}`}>{r.days}d</td>
                    <td className="px-5 py-2 text-right font-medium tabular-nums">{fmtMoney(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-steel-200 shadow-sm px-4 py-3.5">
      <div className="text-xs font-semibold text-steel-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-steel-900 tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-xs text-steel-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-steel-400" : "text-steel-700"}`}>
      <span>{k}</span>
      <span className="tabular-nums font-medium">{v}</span>
    </div>
  );
}
