"use client";

// Generic form wrapper: server-action errors render inline instead of crashing to an error page.
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/actions";

export function FormError({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 my-2" role="alert">
      {state.error}
    </div>
  );
}

export function FormOk({ state }: { state: ActionState }) {
  if (!state?.ok) return null;
  return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 my-2">
      {state.ok}
    </div>
  );
}

export function SubmitButton({ className, children, confirm }: { className: string; children: React.ReactNode; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function AForm({
  action,
  children,
  className = "",
  submitLabel,
  submitClass = "",
  confirm,
  inline = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: React.ReactNode;
  submitClass?: string;
  confirm?: string;
  inline?: boolean;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className={className}>
      <FormError state={state} />
      <FormOk state={state} />
      {children}
      {submitLabel != null && (
        <div className={inline ? "inline" : "mt-3"}>
          <SubmitButton className={submitClass} confirm={confirm}>
            {submitLabel}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
