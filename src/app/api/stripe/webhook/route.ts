import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { verifyStripeSignature } from "@/lib/stripe";
import { docTotals } from "@/lib/util";
import { audit } from "@/lib/audit";

// Multi-tenant: locate shop via metadata.docId, THEN verify with that shop's webhook secret.
export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") || "";

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  if (event?.type !== "checkout.session.completed") return NextResponse.json({ received: true });

  const session = event.data?.object ?? {};
  const docId = session.metadata?.docId;
  if (!docId) return NextResponse.json({ received: true });

  const doc = await prisma.doc.findUnique({ where: { id: docId }, include: { shop: true, items: true, payments: true } });
  if (!doc) return NextResponse.json({ received: true });

  const secret = decrypt(doc.shop.stripeWebhookSecretEnc);
  if (!secret || !verifyStripeSignature(payload, sig, secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  const ref = String(session.payment_intent || session.id || "");
  const dupe = await prisma.payment.findFirst({ where: { docId, stripeRef: ref } });
  if (dupe) return NextResponse.json({ received: true });

  const amountCents = Number(session.amount_total || 0);
  if (amountCents > 0) {
    await prisma.payment.create({
      data: { docId, amountCents, method: "Online", note: "Stripe payment link", stripeRef: ref },
    });
    const fresh = await prisma.doc.findUniqueOrThrow({ where: { id: docId }, include: { items: true, payments: true } });
    const t = docTotals(fresh);
    await prisma.doc.update({
      where: { id: docId },
      data: { status: t.balance <= 0 ? "PAID" : "PARTIAL" },
    });
    await audit({ shopId: doc.shopId, action: "payment.online", entity: "Doc", entityId: docId, meta: { number: doc.number, amountCents, ref } });
  }
  return NextResponse.json({ received: true });
}
