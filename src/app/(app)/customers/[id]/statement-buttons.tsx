"use client";

import { useState } from "react";
import { btnSecondary } from "@/components/ui";

export function StatementButtons({ customerId, hasEmail }: { customerId: string; hasEmail: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function email() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/statement`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMsg({ ok: true, text: "Statement emailed ✓" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Send failed" });
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <a href={`/api/customers/${customerId}/statement`} target="_blank" className={btnSecondary}>📄 Statement</a>
      {hasEmail && (
        <button onClick={email} disabled={busy} className={btnSecondary}>
          {busy ? "Sending…" : "✉ Email Statement"}
        </button>
      )}
      {msg && <span className={`text-xs font-medium ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
    </span>
  );
}
