import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { saveCustomer, deleteCustomer, deleteVehicle, saveFollowUp, toggleFollowUp } from "@/lib/actions";
import { docTotals, fmtMoney, fmtDate, vehicleLabel } from "@/lib/util";
import { Card, CardHeader, StatusBadge, Field, inputCls, btnPrimary, btnSecondary, btnSmall, btnDanger, EmptyState } from "@/components/ui";
import { AForm } from "@/components/aform";
import { VehicleForm } from "@/components/vehicle-form";
import { SmsButton } from "@/components/sms-button";
import { StatementButtons } from "./statement-buttons";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { user } = await requireSession();
  const customer = await prisma.customer.findFirst({
    where: { id: params.id, shopId: user.shopId },
    include: {
      shop: true,
      vehicles: { orderBy: { createdAt: "asc" } },
      docs: { include: { items: true, payments: true, vehicle: true }, orderBy: { createdAt: "desc" } },
      followUps: { where: { status: "OPEN" }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!customer) notFound();

  const openBalance = customer.docs
    .filter((d) => d.kind === "INVOICE" && (d.status === "OPEN" || d.status === "PARTIAL"))
    .reduce((s, d) => s + docTotals(d).balance, 0);

  const declinedWork = customer.docs
    .flatMap((d) => d.items.filter((i) => i.declined).map((i) => ({ doc: d, item: i })))
    .slice(0, 10);

  const smsConfigured = !!(customer.shop.twilioSid && customer.shop.twilioFrom);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-steel-900">{customer.name}</h1>
          <div className="text-sm text-steel-500 mt-1">{[customer.phone, customer.email, customer.address].filter(Boolean).join(" · ")}</div>
          {openBalance > 0 && <div className="text-sm font-semibold text-torque-700 mt-1">Open balance: {fmtMoney(openBalance)}</div>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/docs/new?kind=ESTIMATE`} className={btnSecondary}>+ Estimate</Link>
          <Link href={`/docs/new?kind=INVOICE`} className={btnPrimary}>+ Invoice</Link>
          {openBalance > 0 && <StatementButtons customerId={customer.id} hasEmail={!!customer.email} />}
        </div>
      </div>

      {smsConfigured && customer.phone && (
        <SmsButton customerId={customer.id} customerName={customer.name} defaultBody={`${customer.shop.name}: `} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Details" />
          <div className="p-5">
            <AForm action={saveCustomer} submitLabel="Save" submitClass={btnSecondary}>
              <input type="hidden" name="id" value={customer.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name *"><input name="name" defaultValue={customer.name} className={inputCls} required /></Field>
                <Field label="Phone"><input name="phone" defaultValue={customer.phone} className={inputCls} /></Field>
                <Field label="Email"><input name="email" type="email" defaultValue={customer.email} className={inputCls} /></Field>
                <Field label="Address"><input name="address" defaultValue={customer.address} className={inputCls} /></Field>
                <Field label="Notes" className="col-span-2"><textarea name="notes" defaultValue={customer.notes} rows={2} className={inputCls} /></Field>
              </div>
            </AForm>
          </div>
        </Card>

        <Card>
          <CardHeader title="Open follow-ups" />
          {customer.followUps.length === 0 ? (
            <EmptyState>None open.</EmptyState>
          ) : (
            <div className="divide-y divide-steel-100">
              {customer.followUps.map((f) => (
                <div key={f.id} className="px-5 py-2.5 flex items-center justify-between text-sm gap-3">
                  <span className="text-steel-700"><b>{fmtDate(f.dueDate)}</b> — {f.note}</span>
                  <AForm action={toggleFollowUp} submitLabel="Done" submitClass={btnSmall} inline className="inline">
                    <input type="hidden" name="id" value={f.id} />
                  </AForm>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-4 border-t border-steel-100">
            <AForm action={saveFollowUp} submitLabel="Add" submitClass={btnSmall}>
              <input type="hidden" name="customerId" value={customer.id} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" name="dueDate" className={inputCls} />
                <input name="note" className={inputCls} placeholder="What for?" />
              </div>
            </AForm>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={`Vehicles (${customer.vehicles.length})`} />
        {customer.vehicles.map((v) => (
          <details key={v.id} className="border-b border-steel-100 group">
            <summary className="px-5 py-3 cursor-pointer hover:bg-steel-50 flex items-center justify-between text-sm list-none">
              <span>
                <span className="font-medium text-steel-900">{vehicleLabel(v) || "Vehicle"}</span>
                <span className="text-steel-400 text-xs ml-2">
                  {[v.engine, v.plate && `Plate ${v.plate}`, v.mileage != null && `${v.mileage.toLocaleString()} mi`, v.vin && `VIN ${v.vin}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="text-steel-300 group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="px-5 pb-4 pt-1 bg-steel-50/50">
              <VehicleForm
                customerId={customer.id}
                existing={{
                  id: v.id, year: v.year, make: v.make, model: v.model, engine: v.engine,
                  vin: v.vin, plate: v.plate, mileage: v.mileage != null ? String(v.mileage) : "", notes: v.notes,
                }}
              />
              <div className="mt-2">
                <AForm action={deleteVehicle} submitLabel="Delete vehicle" submitClass={btnDanger} confirm="Delete this vehicle?" inline className="inline">
                  <input type="hidden" name="id" value={v.id} />
                </AForm>
              </div>
            </div>
          </details>
        ))}
        <div className="px-5 py-4">
          <div className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Add vehicle</div>
          <VehicleForm customerId={customer.id} compact />
        </div>
      </Card>

      {declinedWork.length > 0 && (
        <Card>
          <CardHeader title="Previously declined work — upsell opportunities" />
          <div className="divide-y divide-steel-100">
            {declinedWork.map(({ doc, item }) => (
              <div key={item.id} className="px-5 py-2.5 flex items-center justify-between text-sm gap-3 flex-wrap">
                <span className="text-steel-700">
                  {item.description} <span className="text-steel-400">· {fmtMoney(Math.round(item.qty * item.unitPriceCents))} · from <Link href={`/docs/${doc.id}`} className="font-mono text-torque-700 hover:underline">{doc.number}</Link> {fmtDate(doc.date)}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Service history" />
        {customer.docs.length === 0 ? (
          <EmptyState>No history yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <tbody className="divide-y divide-steel-100">
                {customer.docs.map((d) => {
                  const t = docTotals(d);
                  return (
                    <tr key={d.id} className="hover:bg-steel-50">
                      <td className="px-5 py-2.5"><Link href={`/docs/${d.id}`} className="font-mono font-semibold text-torque-700 hover:underline">{d.number}</Link></td>
                      <td className="px-3 py-2.5 text-steel-500 whitespace-nowrap">{fmtDate(d.date)}</td>
                      <td className="px-3 py-2.5 text-steel-500">{vehicleLabel(d.vehicle)}{d.mileage != null && ` @ ${d.mileage.toLocaleString()}`}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{fmtMoney(t.total)}</td>
                      <td className="px-5 py-2.5 text-right"><StatusBadge status={d.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {user.role === "OWNER" && customer.docs.length === 0 && (
        <AForm action={deleteCustomer} submitLabel="Delete customer" submitClass={btnDanger} confirm={`Delete ${customer.name}?`} inline className="inline">
          <input type="hidden" name="id" value={customer.id} />
        </AForm>
      )}
    </div>
  );
}
