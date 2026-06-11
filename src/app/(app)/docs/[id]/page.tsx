import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { docTotals, fmtMoney, fmtDate, vehicleLabel, appUrl } from "@/lib/util";
import { setDocStatus, convertDoc, deleteDoc, addPayment, deletePayment, generatePaymentLink, saveFollowUp } from "@/lib/actions";
import { Card, CardHeader, StatusBadge, Field, inputCls, btnPrimary, btnSecondary, btnSmall, btnDanger } from "@/components/ui";
import { AForm } from "@/components/aform";
import { EmailButton } from "@/components/email-button";
import { SmsButton } from "@/components/sms-button";

export const dynamic = "force-dynamic";

export default async function DocDetailPage({ params }: { params: { id: string } }) {
  const { user } = await requireSession();
  const doc = await prisma.doc.findFirst({
    where: { id: params.id, shopId: user.shopId },
    include: {
      items: { orderBy: { sort: "asc" }, include: { tech: true } },
      payments: { orderBy: { date: "asc" } },
      customer: true,
      vehicle: true,
      shop: true,
      convertedTo: true,
      convertedFrom: true,
    },
  });
  if (!doc) notFound();

  const t = docTotals(doc);
  const isInvoice = doc.kind === "INVOICE";
  const isWO = doc.kind === "WORKORDER";
  const isEstimate = doc.kind === "ESTIMATE";
  const editable = doc.status !== "PAID" && doc.status !== "VOID" && doc.status !== "CONVERTED";
  const noun = isInvoice ? "Invoice" : isWO ? "Work Order" : "Estimate";
  const active = doc.items.filter((i) => !i.declined);
  const declined = doc.items.filter((i) => i.declined);
  const smsConfigured = !!(doc.shop.twilioSid && doc.shop.twilioFrom);
  const approveUrl = `${appUrl()}/approve/${doc.publicToken}`;

  const preset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-steel-900 font-mono">{noun} {doc.number}</h1>
            <StatusBadge status={doc.status} />
          </div>
          <div className="text-sm text-steel-500 mt-1">
            {fmtDate(doc.date)} · <Link href={`/customers/${doc.customerId}`} className="text-torque-700 hover:underline">{doc.customer.name}</Link>
            {doc.vehicle && <> · {vehicleLabel(doc.vehicle)}{doc.mileage != null && ` @ ${doc.mileage.toLocaleString()} mi`}</>}
          </div>
          {doc.convertedFrom && <div className="text-xs text-steel-400 mt-1">From {doc.convertedFrom.number}</div>}
          {doc.convertedTo && <div className="text-xs text-steel-400 mt-1">Became <Link href={`/docs/${doc.convertedTo.id}`} className="text-torque-700 hover:underline font-mono">{doc.convertedTo.number}</Link></div>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {editable && <Link href={`/docs/${doc.id}/edit`} className={btnSecondary}>Edit</Link>}
          <a href={`/api/docs/${doc.id}/pdf`} target="_blank" className={btnSecondary}>⬇ PDF</a>
          <EmailButton docId={doc.id} disabled={!doc.customer.email} disabledReason="Customer has no email on file" />
        </div>
      </div>

      {/* Workflow actions */}
      <div className="flex gap-2 flex-wrap items-center">
        {isEstimate && doc.status !== "CONVERTED" && doc.status !== "VOID" && (
          <>
            <a href={approveUrl} target="_blank" className={btnSecondary}>✍ Open signing page</a>
            <AForm action={convertDoc} submitLabel="→ Start Work Order" submitClass={btnPrimary} inline className="inline">
              <input type="hidden" name="id" value={doc.id} />
              <input type="hidden" name="target" value="WORKORDER" />
            </AForm>
            <AForm action={convertDoc} submitLabel="→ Invoice" submitClass={btnSecondary} inline className="inline">
              <input type="hidden" name="id" value={doc.id} />
              <input type="hidden" name="target" value="INVOICE" />
            </AForm>
          </>
        )}
        {isWO && doc.status !== "CONVERTED" && doc.status !== "VOID" && (
          <AForm action={convertDoc} submitLabel="✓ Work done → Invoice" submitClass={btnPrimary} inline className="inline">
            <input type="hidden" name="id" value={doc.id} />
            <input type="hidden" name="target" value="INVOICE" />
          </AForm>
        )}
        {smsConfigured && doc.customer.phone && (
          <SmsButton
            customerId={doc.customerId}
            customerName={doc.customer.name}
            defaultBody={
              isInvoice
                ? `${doc.shop.name}: your vehicle is ready for pickup. Total ${fmtMoney(t.balance > 0 ? t.balance : t.total)}. ${doc.shop.phone}`
                : `${doc.shop.name}: your estimate ${doc.number} is ready — review & approve here: ${approveUrl}`
            }
          />
        )}
      </div>

      {/* Authorization record */}
      {doc.approvedAt && (
        <div className={`rounded-xl px-4 py-3 text-sm ${doc.status === "DECLINED" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
          {doc.status === "DECLINED" ? (
            <>Declined by <b>{doc.approvedName}</b> on {fmtDate(doc.approvedAt)}{doc.declineNote && <> — “{doc.declineNote}”</>}</>
          ) : (
            <span className="flex items-center gap-3 flex-wrap">
              <span>✓ Authorized by <b>{doc.approvedName}</b> on {fmtDate(doc.approvedAt)}{doc.approvedIp && <span className="text-emerald-600"> · IP {doc.approvedIp}</span>}</span>
              {doc.signaturePng && <img src={doc.signaturePng} alt="signature" className="h-9 bg-white rounded border border-emerald-200 px-2" />}
            </span>
          )}
        </div>
      )}

      {/* Line items */}
      <Card>
        <CardHeader title="Line items" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-steel-200 bg-steel-50">
              <tr className="text-left text-xs font-semibold text-steel-500 uppercase tracking-wide">
                <th className="px-5 py-2">Type</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Tech</th>
                <th className="px-3 py-2 text-right">Qty/Hrs</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-5 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-100">
              {active.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-2.5 text-steel-500">{i.type === "LABOR" ? "Labor" : i.type === "FEE" ? "Fee" : "Part"}</td>
                  <td className="px-3 py-2.5 text-steel-900">
                    {i.description}
                    {i.partNumber && <span className="text-steel-400 font-mono text-xs ml-2">PN {i.partNumber}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-steel-500">{i.tech?.name ?? ""}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-steel-600">{i.type === "FEE" ? "" : i.qty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-steel-600">{i.type === "FEE" ? "" : fmtMoney(i.unitPriceCents)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-medium">{fmtMoney(Math.round(i.qty * i.unitPriceCents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-steel-100 flex flex-col items-end gap-1 text-sm">
          <Row k="Subtotal" v={fmtMoney(t.subtotal)} />
          {doc.suppliesEnabled && t.supplies > 0 && <Row k={`Shop supplies (${doc.suppliesPct}%)`} v={fmtMoney(t.supplies)} />}
          {doc.taxEnabled && <Row k={`Tax (${doc.taxRate}%)`} v={fmtMoney(t.tax)} />}
          <div className="flex justify-between w-56 font-bold text-base text-steel-900 border-t border-steel-200 pt-1.5 mt-1">
            <span>Total</span><span className="tabular-nums">{fmtMoney(t.total)}</span>
          </div>
          {isInvoice && (
            <>
              <Row k="Paid" v={`-${fmtMoney(t.paid)}`} />
              <div className={`flex justify-between w-56 font-bold ${t.balance > 0 ? "text-torque-700" : "text-emerald-700"}`}>
                <span>Balance due</span><span className="tabular-nums">{fmtMoney(t.balance)}</span>
              </div>
            </>
          )}
          {user.role === "OWNER" && t.partsCost > 0 && (
            <div className="text-xs text-steel-400 mt-1">Parts profit: {fmtMoney(t.partsProfit)} on {fmtMoney(t.partsCost)} cost</div>
          )}
        </div>
      </Card>

      {declined.length > 0 && (
        <Card>
          <CardHeader title="Declined recommendations (kept on record)" />
          <div className="divide-y divide-steel-100">
            {declined.map((i) => (
              <div key={i.id} className="px-5 py-2.5 flex justify-between text-sm text-steel-400">
                <span className="line-through">{i.description}</span>
                <span className="tabular-nums">{fmtMoney(Math.round(i.qty * i.unitPriceCents))}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {doc.notes && (
        <Card>
          <CardHeader title="Notes" />
          <p className="px-5 py-4 text-sm text-steel-700 whitespace-pre-wrap">{doc.notes}</p>
        </Card>
      )}

      {/* Payments (invoices) */}
      {isInvoice && (
        <Card>
          <CardHeader
            title="Payments"
            action={
              doc.shop.stripeSecretEnc && t.balance > 0 ? (
                <AForm action={generatePaymentLink} submitLabel={doc.paymentLinkUrl ? "↻ Refresh payment link" : "🔗 Create payment link"} submitClass={btnSmall} inline className="inline">
                  <input type="hidden" name="docId" value={doc.id} />
                </AForm>
              ) : undefined
            }
          />
          {doc.paymentLinkUrl && t.balance > 0 && (
            <div className="px-5 py-2.5 border-b border-steel-100 text-xs text-steel-500 break-all">
              Pay online: <a href={doc.paymentLinkUrl} target="_blank" className="text-torque-700 hover:underline">{doc.paymentLinkUrl}</a>
            </div>
          )}
          {doc.payments.length > 0 && (
            <div className="divide-y divide-steel-100">
              {doc.payments.map((p) => (
                <div key={p.id} className="px-5 py-2.5 flex items-center justify-between text-sm gap-3 flex-wrap">
                  <span className="text-steel-700">
                    <b className="tabular-nums">{fmtMoney(p.amountCents)}</b> · {p.method} · {fmtDate(p.date)}
                    {p.note && <span className="text-steel-400"> — {p.note}</span>}
                  </span>
                  {user.role === "OWNER" && (
                    <AForm action={deletePayment} submitLabel="Remove" submitClass={btnSmall} confirm="Remove this payment? This is logged." inline className="inline">
                      <input type="hidden" name="id" value={p.id} />
                    </AForm>
                  )}
                </div>
              ))}
            </div>
          )}
          {doc.status !== "VOID" && t.balance > 0 && (
            <div className="px-5 py-4 border-t border-steel-100">
              <AForm action={addPayment} submitLabel="Record Payment" submitClass={btnPrimary}>
                <input type="hidden" name="docId" value={doc.id} />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <Field label="Amount ($)"><input name="amount" className={inputCls} defaultValue={(t.balance / 100).toFixed(2)} inputMode="decimal" /></Field>
                  <Field label="Method">
                    <select name="method" className={inputCls}>
                      <option>Cash</option><option>Check</option><option>Card</option><option>Other</option>
                    </select>
                  </Field>
                  <Field label="Note"><input name="note" className={inputCls} placeholder="check #, last 4…" /></Field>
                  {doc.shop.cardSurchargePct > 0 && (
                    <label className="flex items-center gap-2 text-sm font-medium text-steel-700 pb-2.5">
                      <input type="checkbox" name="applySurcharge" className="h-4 w-4 rounded border-steel-300 text-torque-600" />
                      Add {doc.shop.cardSurchargePct}% card surcharge
                    </label>
                  )}
                </div>
              </AForm>
            </div>
          )}
        </Card>
      )}

      {/* Follow-up quick add */}
      <Card>
        <CardHeader title="Schedule a follow-up" />
        <div className="px-5 py-4">
          <AForm action={saveFollowUp} submitLabel="Add Follow-up" submitClass={btnSecondary}>
            <input type="hidden" name="customerId" value={doc.customerId} />
            {doc.vehicleId && <input type="hidden" name="vehicleId" value={doc.vehicleId} />}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Due date">
                <input type="date" name="dueDate" className={inputCls} defaultValue={preset(90)} />
              </Field>
              <Field label="Note" className="sm:col-span-2">
                <input name="note" className={inputCls} defaultValue={doc.mileage != null ? `Next service due (~${(doc.mileage + 5000).toLocaleString()} mi) — call ${doc.customer.name.split(" ")[0]}` : `Check in with ${doc.customer.name.split(" ")[0]}`} />
              </Field>
            </div>
            <p className="text-xs text-steel-400 mt-2">Typical: 30 days (declined work) · 90 days (oil/rotation) · 180 days (seasonal)</p>
          </AForm>
        </div>
      </Card>

      {/* Danger zone */}
      <div className="flex gap-2 flex-wrap">
        {user.role === "OWNER" && doc.status !== "VOID" && doc.status !== "CONVERTED" && (
          <AForm action={setDocStatus} submitLabel={`Void ${noun}`} submitClass={btnDanger} confirm={`Void ${doc.number}? It stays on record but counts for nothing.`} inline className="inline">
            <input type="hidden" name="id" value={doc.id} />
            <input type="hidden" name="status" value="VOID" />
          </AForm>
        )}
        {user.role === "OWNER" && isEstimate && doc.status === "DRAFT" && !doc.emailedAt && (
          <AForm action={deleteDoc} submitLabel="Delete draft" submitClass={btnDanger} confirm="Delete this unsent draft estimate? This can't be undone." inline className="inline">
            <input type="hidden" name="id" value={doc.id} />
          </AForm>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between w-56 text-steel-600">
      <span>{k}</span><span className="tabular-nums">{v}</span>
    </div>
  );
}
