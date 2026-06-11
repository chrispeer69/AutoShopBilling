// Stripe via REST (no SDK). Per-shop secret key. Persistent payment link per invoice.
import type { Doc, Shop } from "@prisma/client";
import { decrypt } from "@/lib/crypto";
import { createHmac, timingSafeEqual } from "crypto";

async function stripeReq(secret: string, path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

export function stripeConfigured(shop: Shop) {
  return !!shop.stripeSecretEnc;
}

/** Creates a price + persistent payment link for the invoice balance. */
export async function createPaymentLink(shop: Shop, doc: Doc, amountCents: number): Promise<string> {
  const secret = decrypt(shop.stripeSecretEnc);
  const price = await stripeReq(secret, "prices", {
    currency: "usd",
    unit_amount: String(amountCents),
    "product_data[name]": `${shop.name} — Invoice ${doc.number}`,
  });
  const link = await stripeReq(secret, "payment_links", {
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": "1",
    "metadata[docId]": doc.id,
    "metadata[shopId]": shop.id,
  });
  return link.url as string;
}

/** Verify Stripe webhook signature (v1 scheme). */
export function verifyStripeSignature(payload: string, sigHeader: string, webhookSecret: string, toleranceSec = 300): boolean {
  const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const expected = createHmac("sha256", webhookSecret).update(`${t}.${payload}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}
