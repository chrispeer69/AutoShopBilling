import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderDocPdf } from "@/lib/pdf";
import { emailDocPdf } from "@/lib/mailer";
import { docTotals } from "@/lib/util";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.shopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.doc.findFirst({
    where: { id: params.id, shopId: session.user.shopId },
    include: { items: { orderBy: { sort: "asc" } }, payments: true, customer: true, vehicle: true, shop: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.customer.email) return NextResponse.json({ error: "Customer has no email on file." }, { status: 400 });

  try {
    const pdf = await renderDocPdf(doc);
    const t = docTotals(doc);
    await emailDocPdf({ doc, pdf, totalCents: t.total, balanceCents: t.balance });
    await prisma.doc.update({
      where: { id: doc.id },
      data: {
        emailedAt: new Date(),
        ...(doc.kind === "ESTIMATE" && doc.status === "DRAFT" ? { status: "SENT" } : {}),
      },
    });
    await audit({ shopId: doc.shopId, userId: session.user.id, userName: session.user.name, action: "doc.email", entity: "Doc", entityId: doc.id, meta: { number: doc.number, to: doc.customer.email } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Email failed:", e);
    return NextResponse.json({ error: e.message || "Email failed — check SMTP settings." }, { status: 500 });
  }
}
