import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderDocPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.shopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.doc.findFirst({
    where: { id: params.id, shopId: session.user.shopId },
    include: { items: { orderBy: { sort: "asc" } }, payments: true, customer: true, vehicle: true, shop: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderDocPdf(doc);
  return new NextResponse(pdf as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.number}.pdf"`,
    },
  });
}
