"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "@/components/ui";

export function EmailButton({ docId, disabled, disabledReason }: { docId: string; disabled?: boolean; disabledReason?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/docs/${docId}/email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setMsg({ ok: true, text: "Emailed to customer ✓" });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed to send" });
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <button onClick={send} disabled={busy || disabled} className={btnSecondary} title={disabled ? disabledReason : undefined}>
        {busy ? "Sending…" : "✉ Email to Customer"}
      </button>
      {msg && <span className={`text-xs font-medium ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
    </span>
  );
}
