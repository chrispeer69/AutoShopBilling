"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { sendCustomerSms, type ActionState } from "@/lib/actions";
import { btnSecondary, btnPrimary, inputCls } from "@/components/ui";
import { FormError, FormOk, SubmitButton } from "@/components/aform";

export function SmsButton({ customerId, customerName, defaultBody }: { customerId: string; customerName: string; defaultBody: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState<ActionState, FormData>(sendCustomerSms, null);

  if (!open) {
    return <button onClick={() => setOpen(true)} className={btnSecondary}>💬 Text Customer</button>;
  }
  return (
    <div className="w-full bg-steel-50 rounded-xl p-4 mt-2">
      <form action={formAction} className="space-y-2">
        <FormError state={state} />
        <FormOk state={state} />
        <input type="hidden" name="customerId" value={customerId} />
        <div className="text-xs font-semibold text-steel-500 uppercase tracking-wide">Text to {customerName}</div>
        <textarea name="body" rows={3} className={inputCls} defaultValue={defaultBody} />
        <div className="flex gap-2">
          <SubmitButton className={btnPrimary}>Send Text</SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>Close</button>
        </div>
      </form>
    </div>
  );
}
