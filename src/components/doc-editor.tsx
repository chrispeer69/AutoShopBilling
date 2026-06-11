"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveDoc, type ActionState } from "@/lib/actions";
import { Field, inputCls, btnPrimary, btnSmall } from "@/components/ui";
import { FormError } from "@/components/aform";

type ItemRow = {
  type: "PART" | "LABOR" | "FEE";
  description: string;
  partNumber: string;
  qty: string;
  unitPrice: string;
  cost: string;
  techId: string;
  declined: boolean;
};

type CustomerOpt = { id: string; name: string; vehicles: { id: string; label: string; mileage: number | null }[] };
type TechOpt = { id: string; name: string };
type CannedJobOpt = {
  id: string;
  name: string;
  items: { type: "PART" | "LABOR" | "FEE"; description: string; partNumber: string; qty: number; unitPrice: string; cost: string }[];
};

const emptyRow = (type: ItemRow["type"] = "PART"): ItemRow => ({
  type, description: "", partNumber: "", qty: "1", unitPrice: "", cost: "", techId: "", declined: false,
});

function money(s: string): number {
  const n = parseFloat(String(s).replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}

function SaveBtn({ isNew, kind }: { isNew: boolean; kind: string }) {
  const { pending } = useFormStatus();
  const noun = kind === "INVOICE" ? "Invoice" : kind === "WORKORDER" ? "Work Order" : "Estimate";
  return (
    <button type="submit" className={btnPrimary} disabled={pending}>
      {pending ? "Saving…" : isNew ? `Create ${noun}` : "Save Changes"}
    </button>
  );
}

export function DocEditor({
  kind,
  customers,
  techs,
  cannedJobs,
  laborRateDollars,
  taxRatePct,
  partsMarkupPct,
  supplies,
  existing,
}: {
  kind: "ESTIMATE" | "WORKORDER" | "INVOICE";
  customers: CustomerOpt[];
  techs: TechOpt[];
  cannedJobs: CannedJobOpt[];
  laborRateDollars: string;
  taxRatePct: number; // for NEW docs this is the shop rate; for existing it's the frozen snapshot
  partsMarkupPct: number;
  supplies: { pct: number; capDollars: string };
  existing?: {
    id: string;
    customerId: string;
    vehicleId: string;
    mileage: string;
    notes: string;
    taxEnabled: boolean;
    suppliesEnabled: boolean;
    items: ItemRow[];
  };
}) {
  const [state, formAction] = useFormState<ActionState, FormData>(saveDoc, null);
  const [customerId, setCustomerId] = useState(existing?.customerId ?? "");
  const [vehicleId, setVehicleId] = useState(existing?.vehicleId ?? "");
  const [mileage, setMileage] = useState(existing?.mileage ?? "");
  const [taxEnabled, setTaxEnabled] = useState(existing?.taxEnabled ?? false);
  const [suppliesEnabled, setSuppliesEnabled] = useState(existing?.suppliesEnabled ?? supplies.pct > 0);
  const [items, setItems] = useState<ItemRow[]>(existing?.items?.length ? existing.items : [emptyRow("LABOR"), emptyRow("PART")]);
  const [pnBusy, setPnBusy] = useState<number | null>(null);

  const customer = customers.find((c) => c.id === customerId);

  function update(idx: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function setType(idx: number, type: ItemRow["type"]) {
    const patch: Partial<ItemRow> = { type };
    if (type === "LABOR" && !items[idx].unitPrice) patch.unitPrice = laborRateDollars;
    if (type !== "PART") { patch.partNumber = ""; patch.cost = ""; }
    if (type !== "LABOR") patch.techId = "";
    update(idx, patch);
  }

  function onCostBlur(idx: number) {
    const r = items[idx];
    if (r.type === "PART" && r.cost && !r.unitPrice) {
      const suggested = money(r.cost) * (1 + partsMarkupPct / 100);
      update(idx, { unitPrice: suggested.toFixed(2) });
    }
  }

  async function onPartNumberBlur(idx: number) {
    const pn = items[idx].partNumber.trim();
    if (!pn || items[idx].type !== "PART") return;
    setPnBusy(idx);
    try {
      const res = await fetch(`/api/parts/lookup?pn=${encodeURIComponent(pn)}`);
      if (res.ok) {
        const p = await res.json();
        if (p) {
          update(idx, {
            description: items[idx].description || p.description,
            cost: items[idx].cost || (p.costCents / 100).toFixed(2),
            unitPrice: items[idx].unitPrice || (p.priceCents / 100).toFixed(2),
          });
        }
      }
    } catch { /* lookup is best-effort */ }
    setPnBusy(null);
  }

  function insertCannedJob(jobId: string) {
    const job = cannedJobs.find((j) => j.id === jobId);
    if (!job) return;
    const newRows: ItemRow[] = job.items.map((i) => ({
      type: i.type, description: i.description, partNumber: i.partNumber,
      qty: String(i.qty), unitPrice: i.unitPrice, cost: i.cost, techId: "", declined: false,
    }));
    setItems((rows) => [...rows.filter((r) => r.description.trim() || r.unitPrice), ...newRows]);
  }

  const totals = useMemo(() => {
    const active = items.filter((i) => !i.declined);
    const line = (i: ItemRow) => money(i.unitPrice) * (parseFloat(i.qty) || 0);
    const subtotal = active.reduce((s, i) => s + line(i), 0);
    const labor = active.filter((i) => i.type === "LABOR").reduce((s, i) => s + line(i), 0);
    const declined = items.filter((i) => i.declined).reduce((s, i) => s + line(i), 0);
    let supp = 0;
    if (suppliesEnabled && supplies.pct > 0) {
      supp = labor * (supplies.pct / 100);
      const cap = money(supplies.capDollars);
      if (cap > 0) supp = Math.min(supp, cap);
    }
    const tax = taxEnabled ? (subtotal + supp) * (taxRatePct / 100) : 0;
    return { subtotal, supp, tax, total: subtotal + supp + tax, declined };
  }, [items, taxEnabled, suppliesEnabled, taxRatePct, supplies]);

  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const itemsJson = JSON.stringify(items.map((i) => ({ ...i })));

  return (
    <form action={formAction} className="space-y-5">
      <FormError state={state} />
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="items" value={itemsJson} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Customer *">
          <select name="customerId" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }} className={inputCls} required>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Vehicle">
          <select
            name="vehicleId"
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              const v = customer?.vehicles.find((v) => v.id === e.target.value);
              if (v?.mileage && !mileage) setMileage(String(v.mileage));
            }}
            className={inputCls}
            disabled={!customer}
          >
            <option value="">{customer ? "Select vehicle…" : "Pick customer first"}</option>
            {customer?.vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Mileage in">
          <input name="mileage" value={mileage} onChange={(e) => setMileage(e.target.value)} className={inputCls} placeholder="e.g. 87,450" inputMode="numeric" />
        </Field>
        <div className="flex items-end gap-4 pb-1 flex-wrap">
          <label className="flex items-center gap-2 text-sm font-medium text-steel-700">
            <input type="checkbox" name="taxEnabled" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} className="h-4 w-4 rounded border-steel-300 text-torque-600 focus:ring-torque-500" />
            Tax ({taxRatePct}%)
          </label>
          {supplies.pct > 0 && (
            <label className="flex items-center gap-2 text-sm font-medium text-steel-700">
              <input type="checkbox" name="suppliesEnabled" checked={suppliesEnabled} onChange={(e) => setSuppliesEnabled(e.target.checked)} className="h-4 w-4 rounded border-steel-300 text-torque-600 focus:ring-torque-500" />
              Shop supplies
            </label>
          )}
        </div>
      </div>

      {cannedJobs.length > 0 && (
        <div className="flex items-center gap-2">
          <select className={`${inputCls} max-w-xs`} value="" onChange={(e) => { if (e.target.value) insertCannedJob(e.target.value); e.target.value = ""; }}>
            <option value="">+ Insert canned job…</option>
            {cannedJobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <span className="text-xs text-steel-400 hidden sm:inline">Adds the job's parts &amp; labor below</span>
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-steel-500 uppercase tracking-wide border-b border-steel-200">
              <th className="py-2 pr-2 w-24">Type</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 w-36">Part # / Tech</th>
              <th className="py-2 pr-2 w-16">Qty/Hrs</th>
              <th className="py-2 pr-2 w-24">Cost</th>
              <th className="py-2 pr-2 w-24">Price</th>
              <th className="py-2 pr-2 w-24 text-right">Amount</th>
              <th className="py-2 w-20 text-center">Decl.</th>
              <th className="py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const amount = money(row.unitPrice) * (parseFloat(row.qty) || 0);
              return (
                <tr key={i} className={`border-b border-steel-100 ${row.declined ? "opacity-50" : ""}`}>
                  <td className="py-1.5 pr-2">
                    <select value={row.type} onChange={(e) => setType(i, e.target.value as ItemRow["type"])} className={inputCls}>
                      <option value="PART">Part</option>
                      <option value="LABOR">Labor</option>
                      <option value="FEE">Fee</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={row.description} onChange={(e) => update(i, { description: e.target.value })} className={`${inputCls} ${row.declined ? "line-through" : ""}`} placeholder={row.type === "LABOR" ? "Work performed…" : row.type === "FEE" ? "Fee description…" : "Part description…"} />
                  </td>
                  <td className="py-1.5 pr-2">
                    {row.type === "LABOR" ? (
                      <select value={row.techId} onChange={(e) => update(i, { techId: e.target.value })} className={inputCls}>
                        <option value="">— tech —</option>
                        {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    ) : row.type === "PART" ? (
                      <input
                        value={row.partNumber}
                        onChange={(e) => update(i, { partNumber: e.target.value })}
                        onBlur={() => onPartNumberBlur(i)}
                        className={inputCls}
                        placeholder={pnBusy === i ? "Looking up…" : "Part #"}
                      />
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={row.qty} onChange={(e) => update(i, { qty: e.target.value })} className={`${inputCls} text-right`} inputMode="decimal" />
                  </td>
                  <td className="py-1.5 pr-2">
                    {row.type === "PART" ? (
                      <input value={row.cost} onChange={(e) => update(i, { cost: e.target.value })} onBlur={() => onCostBlur(i)} className={`${inputCls} text-right`} placeholder="0.00" inputMode="decimal" />
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={row.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} className={`${inputCls} text-right`} placeholder="0.00" inputMode="decimal" />
                  </td>
                  <td className="py-1.5 pr-2 text-right font-medium text-steel-700 tabular-nums">{fmt(amount)}</td>
                  <td className="py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.declined}
                      onChange={(e) => update(i, { declined: e.target.checked })}
                      title="Customer declined this work — kept on record, not charged"
                      className="h-4 w-4 rounded border-steel-300 text-red-500 focus:ring-red-400"
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button type="button" onClick={() => setItems((rows) => rows.filter((_, x) => x !== i))} className="text-steel-300 hover:text-red-500 font-bold px-1" title="Remove line">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setItems((r) => [...r, emptyRow("PART")])} className={btnSmall}>+ Part</button>
        <button type="button" onClick={() => setItems((r) => [...r, { ...emptyRow("LABOR"), unitPrice: laborRateDollars }])} className={btnSmall}>+ Labor</button>
        <button type="button" onClick={() => setItems((r) => [...r, emptyRow("FEE")])} className={btnSmall}>+ Fee</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Field label="Notes (printed on the document)">
          <textarea name="notes" defaultValue={existing?.notes ?? ""} rows={3} className={inputCls} placeholder="Recommendations, warranty info, next service…" />
        </Field>
        <div className="bg-steel-50 rounded-xl p-4 space-y-1.5 text-sm self-end">
          <div className="flex justify-between text-steel-600"><span>Subtotal</span><span className="tabular-nums">{fmt(totals.subtotal)}</span></div>
          {suppliesEnabled && supplies.pct > 0 && (
            <div className="flex justify-between text-steel-600"><span>Shop supplies ({supplies.pct}%{money(supplies.capDollars) > 0 ? `, cap ${fmt(money(supplies.capDollars))}` : ""})</span><span className="tabular-nums">{fmt(totals.supp)}</span></div>
          )}
          <div className="flex justify-between text-steel-600"><span>Tax {taxEnabled ? `(${taxRatePct}%)` : "(off)"}</span><span className="tabular-nums">{fmt(totals.tax)}</span></div>
          <div className="flex justify-between font-bold text-steel-900 text-base border-t border-steel-200 pt-2"><span>Total</span><span className="tabular-nums">{fmt(totals.total)}</span></div>
          {totals.declined > 0 && (
            <div className="flex justify-between text-xs text-steel-400 pt-1"><span>Declined work (not charged)</span><span className="tabular-nums">{fmt(totals.declined)}</span></div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <SaveBtn isNew={!existing} kind={kind} />
      </div>
    </form>
  );
}
