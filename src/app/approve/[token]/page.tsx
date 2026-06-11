import { prisma } from "@/lib/prisma";
import { fmtMoney, fmtDate, docTotals, vehicleLabel } from "@/lib/util";
import { ApproveForm } from "./approve-form";

export const dynamic = "force-dynamic";

export default async function ApprovePage({ params }: { params: { token: string } }) {
  const doc = await prisma.doc.findUnique({
    where: { publicToken: params.token },
    include: { items: { orderBy: { sort: "asc" } }, payments: true, customer: true, vehicle: true, shop: true },
  });

  if (!doc || doc.kind !== "ESTIMATE") {
    return <Shell><p className="text-steel-500 text-center py-10">This link is no longer valid.</p></Shell>;
  }

  const t = docTotals(doc);
  const active = doc.items.filter((i) => !i.declined);
  const closed = doc.status === "CONVERTED" || doc.status === "VOID";
  const already = doc.status === "APPROVED" || doc.status === "DECLINED";

  return (
    <Shell>
      <div className="text-center mb-6">
        <div className="font-mono text-2xl font-bold text-steel-900">{doc.shop.name}</div>
        <div className="text-sm text-steel-500 mt-1">{[doc.shop.phone, doc.shop.email].filter(Boolean).join(" · ")}</div>
      </div>

      <div className="bg-white rounded-xl border border-steel-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-steel-100 flex items-center justify-between">
          <div>
            <div className="font-semibold text-steel-900">Estimate {doc.number}</div>
            <div className="text-xs text-steel-500">{fmtDate(doc.date)} · {doc.customer.name}{doc.vehicle ? ` · ${vehicleLabel(doc.vehicle)}` : ""}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-steel-400 uppercase font-semibold">Estimated total</div>
            <div className="text-xl font-bold text-torque-600">{fmtMoney(t.total)}</div>
          </div>
        </div>
        <div className="divide-y divide-steel-100">
          {active.map((i) => (
            <div key={i.id} className="px-5 py-2.5 flex justify-between text-sm gap-4">
              <span className="text-steel-700">{i.description}{i.type === "LABOR" ? " (labor)" : ""}</span>
              <span className="text-steel-900 font-medium whitespace-nowrap tabular-nums">{fmtMoney(Math.round(i.qty * i.unitPriceCents))}</span>
            </div>
          ))}
          {(t.supplies > 0 || doc.taxEnabled) && (
            <div className="px-5 py-2.5 text-xs text-steel-500 space-y-1">
              {t.supplies > 0 && <div className="flex justify-between"><span>Shop supplies</span><span className="tabular-nums">{fmtMoney(t.supplies)}</span></div>}
              {doc.taxEnabled && <div className="flex justify-between"><span>Tax ({doc.taxRate}%)</span><span className="tabular-nums">{fmtMoney(t.tax)}</span></div>}
            </div>
          )}
        </div>
        {doc.notes && <div className="px-5 py-3 bg-steel-50 text-sm text-steel-600 border-t border-steel-100">{doc.notes}</div>}
      </div>

      <div className="mt-6">
        {closed ? (
          <p className="text-center text-steel-500 text-sm">This estimate is no longer open. Call the shop with any questions.</p>
        ) : already ? (
          <div className={`rounded-xl px-5 py-4 text-center text-sm font-medium ${doc.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {doc.status === "APPROVED"
              ? <>Approved by {doc.approvedName} on {fmtDate(doc.approvedAt!)} — we&apos;ll get started. Thank you!</>
              : <>Declined on {fmtDate(doc.approvedAt!)}. If you change your mind, just give us a call.</>}
          </div>
        ) : (
          <ApproveForm token={doc.publicToken} total={fmtMoney(t.total)} />
        )}
      </div>

      <p className="text-center text-xs text-steel-400 mt-8">Powered by ShopDesk</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-steel-100 py-8 px-4">
      <div className="max-w-xl mx-auto">{children}</div>
    </div>
  );
}
