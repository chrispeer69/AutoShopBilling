import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { docTotals, fmtMoney, fmtDate, vehicleLabel } from "@/lib/util";
import { Card, CardHeader, StatusBadge, btnPrimary, btnSecondary, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user } = await requireSession();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59);

  const [openWork, monthInvoices, openInvoices, dueFollowUps, lowStock] = await Promise.all([
    prisma.doc.findMany({
      where: { shopId: user.shopId, kind: "WORKORDER", status: "OPEN" },
      include: { customer: true, vehicle: true, items: true, payments: true },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    prisma.doc.findMany({
      where: { shopId: user.shopId, kind: "INVOICE", status: { not: "VOID" }, date: { gte: monthStart } },
      include: { items: true, payments: true },
    }),
    prisma.doc.findMany({
      where: { shopId: user.shopId, kind: "INVOICE", status: { in: ["OPEN", "PARTIAL"] } },
      include: { customer: true, items: true, payments: true },
      orderBy: { date: "asc" },
      take: 10,
    }),
    prisma.followUp.findMany({
      where: { shopId: user.shopId, status: "OPEN", dueDate: { lte: todayEnd } },
      include: { customer: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.partItem.findMany({
      where: { shopId: user.shopId, qtyOnHand: { not: null, lte: 2 } },
      orderBy: { qtyOnHand: "asc" },
      take: 6,
    }),
  ]);

  const monthSales = monthInvoices.reduce((s, d) => s + docTotals(d).total, 0);
  const outstanding = openInvoices.reduce((s, d) => s + docTotals(d).balance, 0);
  const estsAwaiting = await prisma.doc.count({ where: { shopId: user.shopId, kind: "ESTIMATE", status: "SENT" } });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-steel-900">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/docs/new?kind=ESTIMATE" className={btnSecondary}>+ Estimate</Link>
          <Link href="/docs/new?kind=INVOICE" className={btnPrimary}>+ Invoice</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Sales this month" value={fmtMoney(monthSales)} />
        <Stat label="Outstanding" value={fmtMoney(outstanding)} accent={outstanding > 0} />
        <Stat label="Open work orders" value={String(openWork.length)} />
        <Stat label="Estimates awaiting approval" value={String(estsAwaiting)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="On the lifts — open work orders" action={<Link href="/docs?kind=WORKORDER" className="text-xs font-semibold text-torque-700 hover:underline">All →</Link>} />
          {openWork.length === 0 ? <EmptyState>No open work orders.</EmptyState> : (
            <div className="divide-y divide-steel-100">
              {openWork.map((d) => (
                <Link key={d.id} href={`/docs/${d.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-steel-50 text-sm gap-3">
                  <span><span className="font-mono font-semibold text-torque-700">{d.number}</span> <span className="text-steel-600">· {d.customer.name}</span>
                    {d.vehicle && <span className="text-steel-400 text-xs"> · {vehicleLabel(d.vehicle)}</span>}</span>
                  <span className="tabular-nums font-medium">{fmtMoney(docTotals(d).total)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Unpaid invoices" action={<Link href="/docs?kind=INVOICE" className="text-xs font-semibold text-torque-700 hover:underline">All →</Link>} />
          {openInvoices.length === 0 ? <EmptyState>Everything is paid. 🎉</EmptyState> : (
            <div className="divide-y divide-steel-100">
              {openInvoices.map((d) => (
                <Link key={d.id} href={`/docs/${d.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-steel-50 text-sm gap-3">
                  <span><span className="font-mono font-semibold text-torque-700">{d.number}</span> <span className="text-steel-600">· {d.customer.name}</span> <span className="text-steel-400 text-xs">· {fmtDate(d.date)}</span></span>
                  <span className="flex items-center gap-2"><span className="tabular-nums font-semibold text-torque-700">{fmtMoney(docTotals(d).balance)}</span><StatusBadge status={d.status} /></span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Follow-ups due" action={<Link href="/followups" className="text-xs font-semibold text-torque-700 hover:underline">All →</Link>} />
          {dueFollowUps.length === 0 ? <EmptyState>Nothing due today.</EmptyState> : (
            <div className="divide-y divide-steel-100">
              {dueFollowUps.map((f) => (
                <Link key={f.id} href={`/customers/${f.customerId}`} className="block px-5 py-2.5 hover:bg-steel-50 text-sm">
                  <span className="font-semibold text-steel-900">{f.customer.name}</span>
                  <span className="text-steel-600"> — {f.note}</span>
                  <span className="text-xs text-red-600 ml-1">{fmtDate(f.dueDate)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Low stock" action={<Link href="/parts" className="text-xs font-semibold text-torque-700 hover:underline">Parts →</Link>} />
          {lowStock.length === 0 ? <EmptyState>No tracked parts running low.</EmptyState> : (
            <div className="divide-y divide-steel-100">
              {lowStock.map((p) => (
                <div key={p.id} className="px-5 py-2.5 flex justify-between text-sm">
                  <span className="text-steel-700"><span className="font-mono">{p.partNumber}</span> · {p.description}</span>
                  <span className="font-semibold text-red-600 tabular-nums">{p.qtyOnHand} left</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-steel-200 shadow-sm px-4 py-3.5">
      <div className="text-xs font-semibold text-steel-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-0.5 ${accent ? "text-torque-700" : "text-steel-900"}`}>{value}</div>
    </div>
  );
}
