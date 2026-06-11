"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { saveCannedJob, type ActionState } from "@/lib/actions";
import { Field, inputCls, btnPrimary, btnSmall } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/aform";

type Row = { type: "PART" | "LABOR" | "FEE"; description: string; partNumber: string; qty: string; unitPrice: string; cost: string };
const empty = (type: Row["type"]): Row => ({ type, description: "", partNumber: "", qty: "1", unitPrice: "", cost: "" });

export function CannedJobEditor({ laborRateDollars, existing }: { laborRateDollars: string; existing?: { id: string; name: string; items: Row[] } }) {
  const [state, formAction] = useFormState<ActionState, FormData>(saveCannedJob, null);
  const [items, setItems] = useState<Row[]>(existing?.items?.length ? existing.items : [empty("LABOR"), empty("PART")]);
  const update = (i: number, patch: Partial<Row>) => setItems((r) => r.map((row, x) => (x === i ? { ...row, ...patch } : row)));

  return (
    <form action={formAction} className="space-y-4">
      <FormError state={state} />
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <Field label="Job name *">
        <input name="name" defaultValue={existing?.name ?? ""} className={inputCls} placeholder='e.g. "Front Brake Job" or "Full Synthetic Oil Change"' required />
      </Field>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-steel-500 uppercase tracking-wide border-b border-steel-200">
              <th className="py-2 pr-2 w-24">Type</th><th className="py-2 pr-2">Description</th><th className="py-2 pr-2 w-32">Part #</th>
              <th className="py-2 pr-2 w-16">Qty/Hrs</th><th className="py-2 pr-2 w-24">Cost</th><th className="py-2 pr-2 w-24">Price</th><th className="py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={i} className="border-b border-steel-100">
                <td className="py-1.5 pr-2">
                  <select value={row.type} onChange={(e) => update(i, { type: e.target.value as Row["type"], ...(e.target.value === "LABOR" && !row.unitPrice ? { unitPrice: laborRateDollars } : {}) })} className={inputCls}>
                    <option value="PART">Part</option><option value="LABOR">Labor</option><option value="FEE">Fee</option>
                  </select>
                </td>
                <td className="py-1.5 pr-2"><input value={row.description} onChange={(e) => update(i, { description: e.target.value })} className={inputCls} /></td>
                <td className="py-1.5 pr-2">{row.type === "PART" && <input value={row.partNumber} onChange={(e) => update(i, { partNumber: e.target.value })} className={inputCls} />}</td>
                <td className="py-1.5 pr-2"><input value={row.qty} onChange={(e) => update(i, { qty: e.target.value })} className={`${inputCls} text-right`} inputMode="decimal" /></td>
                <td className="py-1.5 pr-2">{row.type === "PART" && <input value={row.cost} onChange={(e) => update(i, { cost: e.target.value })} className={`${inputCls} text-right`} inputMode="decimal" placeholder="0.00" />}</td>
                <td className="py-1.5 pr-2"><input value={row.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} className={`${inputCls} text-right`} inputMode="decimal" placeholder="0.00" /></td>
                <td className="py-1.5 text-right"><button type="button" onClick={() => setItems((r) => r.filter((_, x) => x !== i))} className="text-steel-300 hover:text-red-500 font-bold px-1">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setItems((r) => [...r, empty("PART")])} className={btnSmall}>+ Part</button>
        <button type="button" onClick={() => setItems((r) => [...r, { ...empty("LABOR"), unitPrice: laborRateDollars }])} className={btnSmall}>+ Labor</button>
      </div>
      <SubmitButton className={btnPrimary}>{existing ? "Save Changes" : "Create Canned Job"}</SubmitButton>
    </form>
  );
}
