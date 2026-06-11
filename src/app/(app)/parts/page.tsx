import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { savePart, deletePart } from "@/lib/actions";
import { fmtMoney } from "@/lib/util";
import { Card, CardHeader, Field, inputCls, btnPrimary, btnSmall, EmptyState } from "@/components/ui";
import { AForm } from "@/components/aform";

export const dynamic = "force-dynamic";

export default async function PartsPage() {
  const { user } = await requireSession();
  const [parts, shop] = await Promise.all([
    prisma.partItem.findMany({ where: { shopId: user.shopId }, orderBy: { partNumber: "asc" } }),
    prisma.shop.findUniqueOrThrow({ where: { id: user.shopId } }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-steel-900">Parts</h1>
        <p className="text-sm text-steel-500 mt-0.5">Catalog with cost &amp; price — part numbers auto-fill on invoices. Leave “Qty on hand” blank to skip stock tracking.</p>
      </div>

      <Card>
        <CardHeader title="Add / update part" />
        <div className="p-5">
          <AForm action={savePart} submitLabel="Save Part" submitClass={btnPrimary}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Part # *"><input name="partNumber" className={inputCls} required placeholder="PF-1218" /></Field>
              <Field label="Description *"><input name="description" className={inputCls} required placeholder="Oil filter" /></Field>
              <Field label="Cost ($)"><input name="cost" className={inputCls} inputMode="decimal" placeholder="4.50" /></Field>
              <Field label={`Price ($) — default markup ${shop.partsMarkupPct}%`}><input name="price" className={inputCls} inputMode="decimal" placeholder="6.30" /></Field>
              <Field label="Qty on hand (blank = untracked)"><input name="qtyOnHand" className={inputCls} inputMode="numeric" placeholder="" /></Field>
            </div>
          </AForm>
        </div>
      </Card>

      <Card>
        <CardHeader title={`Catalog (${parts.length})`} />
        {parts.length === 0 ? (
          <EmptyState>No parts yet — add your common items above.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-steel-500 uppercase tracking-wide border-b border-steel-200">
                  <th className="px-5 py-2.5">Part #</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5 text-right">Cost</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-right">On hand</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {parts.map((p) => (
                  <tr key={p.id} className="hover:bg-steel-50">
                    <td className="px-5 py-2.5 font-mono text-steel-900">{p.partNumber}</td>
                    <td className="px-3 py-2.5 text-steel-700">{p.description}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-steel-500">{fmtMoney(p.costCents)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-steel-900">{fmtMoney(p.priceCents)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${p.qtyOnHand != null && p.qtyOnHand <= 2 ? "text-red-600 font-semibold" : "text-steel-600"}`}>
                      {p.qtyOnHand == null ? "—" : p.qtyOnHand}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {user.role === "OWNER" && (
                        <AForm action={deletePart} submitLabel="Delete" submitClass={btnSmall} confirm={`Delete part ${p.partNumber}?`} inline className="inline">
                          <input type="hidden" name="id" value={p.id} />
                        </AForm>
                      )}
                    </td>
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
