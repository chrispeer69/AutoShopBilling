import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { StatusBadge, EmptyState, btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import { docTotals, fmtMoney, fmtDate, vehicleLabel } from "@/lib/util";
import type { DocKind } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DocsPage({ searchParams }: { searchParams: { kind?: string; q?: string } }) {
  const { user } = await requireSession();
  const kind: DocKind = searchParams.kind === "ESTIMATE" ? "ESTIMATE" : searchParams.kind === "WORKORDER" ? "WORKORDER" : "INVOICE";
  const q = (searchParams.q || "").trim();

  const docs = await prisma.doc.findMany({
    where: {
      shopId: user.shopId,
      kind,
      ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    include: { customer: true, vehicle: true, items: true, payments: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const noun = kind === "INVOICE" ? "invoices" : kind === "WORKORDER" ? "work orders" : "estimates";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-steel-900">Invoices &amp; Work</h1>
        <div className="flex gap-2">
          <Link href="/docs/new?kind=ESTIMATE" className={btnSecondary}>+ Estimate</Link>
          <Link href="/docs/new?kind=INVOICE" className={btnPrimary}>+ Invoice</Link>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-steel-200 bg-white p-0.5">
          <Tab href="/docs?kind=INVOICE" active={kind === "INVOICE"} label="Invoices" />
          <Tab href="/docs?kind=WORKORDER" active={kind === "WORKORDER"} label="Work Orders" />
          <Tab href="/docs?kind=ESTIMATE" active={kind === "ESTIMATE"} label="Estimates" />
        </div>
        <form className="flex-1 min-w-[200px]">
          <input type="hidden" name="kind" value={kind} />
          <input name="q" defaultValue={q} placeholder="Search number or customer…" className={`${inputCls} max-w-md`} />
        </form>
      </div>

      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-steel-200"><EmptyState>No {noun} yet.</EmptyState></div>
      ) : (
        <div className="bg-white rounded-xl border border-steel-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b border-steel-200 bg-steel-50">
                <tr className="text-left text-xs font-semibold text-steel-500 uppercase tracking-wide">
                  <th className="px-5 py-2.5">Number</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Vehicle</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  {kind === "INVOICE" && <th className="px-3 py-2.5 text-right">Balance</th>}
                  <th className="px-5 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {docs.map((d) => {
                  const t = docTotals(d);
                  return (
                    <tr key={d.id} className="hover:bg-steel-50">
                      <td className="px-5 py-3"><Link href={`/docs/${d.id}`} className="font-mono font-semibold text-torque-700 hover:underline">{d.number}</Link></td>
                      <td className="px-3 py-3 text-steel-500 whitespace-nowrap">{fmtDate(d.date)}</td>
                      <td className="px-3 py-3 text-steel-900">{d.customer.name}</td>
                      <td className="px-3 py-3 text-steel-500">{vehicleLabel(d.vehicle)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{fmtMoney(t.total)}</td>
                      {kind === "INVOICE" && (
                        <td className={`px-3 py-3 text-right tabular-nums ${t.balance > 0 && d.status !== "VOID" ? "text-torque-700 font-semibold" : "text-steel-400"}`}>
                          {d.status === "VOID" ? "—" : fmtMoney(t.balance)}
                        </td>
                      )}
                      <td className="px-5 py-3 text-right"><StatusBadge status={d.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${active ? "bg-steel-900 text-white" : "text-steel-600 hover:bg-steel-100"}`}>
      {label}
    </Link>
  );
}
