import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request) {
  let shopId: string;
  try {
    shopId = (await requireSession()).user.shopId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pn = new URL(req.url).searchParams.get("pn")?.trim().toUpperCase() || "";
  if (!pn) return NextResponse.json(null);
  const part = await prisma.partItem.findFirst({ where: { shopId, partNumber: pn } });
  return NextResponse.json(part ? { description: part.description, costCents: part.costCents, priceCents: part.priceCents, qtyOnHand: part.qtyOnHand } : null);
}
