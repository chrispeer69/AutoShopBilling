"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { saveVehicle, type ActionState } from "@/lib/actions";
import { Field, inputCls, btnPrimary, btnSmall } from "@/components/ui";
import { FormError, FormOk, SubmitButton } from "@/components/aform";

type V = { id?: string; year: string; make: string; model: string; engine: string; vin: string; plate: string; mileage: string; notes: string };

export function VehicleForm({ customerId, existing, compact }: { customerId: string; existing?: V; compact?: boolean }) {
  const [state, formAction] = useFormState<ActionState, FormData>(saveVehicle, null);
  const [v, setV] = useState<V>(existing ?? { year: "", make: "", model: "", engine: "", vin: "", plate: "", mileage: "", notes: "" });
  const [decoding, setDecoding] = useState(false);
  const set = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function decodeVin() {
    const vin = v.vin.trim();
    if (vin.length < 11) return;
    setDecoding(true);
    try {
      const res = await fetch(`/api/vin/${encodeURIComponent(vin)}`);
      if (res.ok) {
        const d = await res.json();
        setV((s) => ({
          ...s,
          year: d.year || s.year,
          make: d.make || s.make,
          model: d.model || s.model,
          engine: d.engine || s.engine,
        }));
      }
    } catch { /* best-effort */ }
    setDecoding(false);
  }

  return (
    <form action={formAction} className="space-y-3">
      <FormError state={state} />
      <FormOk state={state} />
      {existing?.id && <input type="hidden" name="id" value={existing.id} />}
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="VIN" className="col-span-2">
          <div className="flex gap-1.5">
            <input name="vin" value={v.vin} onChange={set("vin")} className={inputCls} placeholder="17-char VIN" />
            <button type="button" onClick={decodeVin} disabled={decoding || v.vin.trim().length < 11} className={`${btnSmall} whitespace-nowrap`} title="Auto-fill year/make/model from VIN (free NHTSA lookup)">
              {decoding ? "…" : "Decode"}
            </button>
          </div>
        </Field>
        <Field label="Plate"><input name="plate" value={v.plate} onChange={set("plate")} className={inputCls} /></Field>
        <Field label="Mileage"><input name="mileage" value={v.mileage} onChange={set("mileage")} className={inputCls} inputMode="numeric" /></Field>
        <Field label="Year"><input name="year" value={v.year} onChange={set("year")} className={inputCls} /></Field>
        <Field label="Make"><input name="make" value={v.make} onChange={set("make")} className={inputCls} /></Field>
        <Field label="Model"><input name="model" value={v.model} onChange={set("model")} className={inputCls} /></Field>
        <Field label="Engine"><input name="engine" value={v.engine} onChange={set("engine")} className={inputCls} placeholder="2.5L 4-cyl" /></Field>
        {!compact && (
          <Field label="Notes" className="col-span-2 sm:col-span-4"><input name="notes" value={v.notes} onChange={set("notes")} className={inputCls} /></Field>
        )}
      </div>
      <SubmitButton className={btnPrimary}>{existing?.id ? "Save Vehicle" : "Add Vehicle"}</SubmitButton>
    </form>
  );
}
