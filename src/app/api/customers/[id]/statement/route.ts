import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { renderStatementPdf } from "@/lib/pdf";
import { emailStatement } from "@/lib/mailer";
import { docTotals } from "@/lib/util";

export const dynamic = "force-dynamic";

async function buildStatement(shopId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, shopId }, include: { shop: true } });
  if (!customer) return null;
  const docs = await prisma.doc.findMany({
    where: { customerId, shopId, kind: "INVOICE", status: { in: ["OPEN", "PARTIAL"] } },
    include: { items: true, payments: true },
    orderBy: { date: "asc" },
  });
  const rows = docs.map((d) => {
    const t = docTotals(d);
    return { number: d.number, date: d.date, total: t.total, paid: t.paid, balance: t.balance };
  });
  const pdf = await renderStatementPdf({ shop: customer.shop, customer, rows });
  return { customer, rows, pdf };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  let shopId: string;
  try {
    shopId = (await requireSession()).user.shopId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const s = await buildStatement(shopId, params.id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(s.pdf as any, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="statement.pdf"` },
  });
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  let shopId: string;
  try {
    shopId = (await requireSession()).user.shopId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const s = await buildStatement(shopId, params.id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.rows.length === 0) return NextResponse.json({ error: "No open invoices for this customer." }, { status: 400 });
  try {
    await emailStatement({
      shop: s.customer.shop,
      customer: s.customer,
      pdf: s.pdf,
      openCount: s.rows.length,
      balanceCents: s.rows.reduce((sum, r) => sum + r.balance, 0),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Send failed" }, { status: 500 });
  }
}
