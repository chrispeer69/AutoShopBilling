"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { customerAuthorize, type ActionState } from "@/lib/actions";
import { SignaturePad } from "@/components/signature-pad";
import { Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/aform";

export function ApproveForm({ token, total }: { token: string; total: string }) {
  const [state, formAction] = useFormState<ActionState, FormData>(customerAuthorize, null);
  const [mode, setMode] = useState<"approve" | "decline">("approve");

  if (state?.ok === "approved")
    return <div className="rounded-xl bg-emerald-50 text-emerald-700 px-5 py-4 text-center text-sm font-medium">Thank you — work is authorized. We&apos;ll be in touch when it&apos;s done.</div>;
  if (state?.ok === "declined")
    return <div className="rounded-xl bg-steel-50 text-steel-600 px-5 py-4 text-center text-sm font-medium">No problem — we&apos;ve noted it. If you change your mind, just call us.</div>;

  return (
    <div className="bg-white rounded-xl border border-steel-200 shadow-sm p-5">
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setMode("approve")} className={mode === "approve" ? btnPrimary : btnSecondary}>Approve work</button>
        <button type="button" onClick={() => setMode("decline")} className={mode === "decline" ? btnPrimary : btnSecondary}>Decline</button>
      </div>
      <form action={formAction} className="space-y-4">
        <FormError state={state} />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="decision" value={mode} />
        <Field label="Your full name *">
          <input name="name" className={inputCls} placeholder="Type your name" required />
        </Field>
        {mode === "approve" ? (
          <>
            <Field label="Signature *">
              <SignaturePad name="signature" />
            </Field>
            <p className="text-xs text-steel-500">
              By signing, I authorize the work described above at the estimated total of {total}. I understand the shop will contact me for approval before performing any additional work.
            </p>
            <SubmitButton className={`${btnPrimary} w-full`}>Authorize Work — {total}</SubmitButton>
          </>
        ) : (
          <>
            <Field label="Anything you'd like us to know? (optional)">
              <textarea name="declineNote" rows={2} className={inputCls} placeholder="e.g. holding off until next month" />
            </Field>
            <SubmitButton className={`${btnSecondary} w-full`}>Decline Estimate</SubmitButton>
          </>
        )}
      </form>
    </div>
  );
}
