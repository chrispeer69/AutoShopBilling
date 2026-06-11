import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { CannedJobEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function EditCannedJobPage({ searchParams }: { searchParams: { id?: string } }) {
  const { user } = await requireSession();
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: user.shopId } });
  const job = searchParams.id
    ? await prisma.cannedJob.findFirst({ where: { id: searchParams.id, shopId: user.shopId }, include: { items: { orderBy: { sort: "asc" } } } })
    : null;

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold text-steel-900">{job ? `Edit: ${job.name}` : "New Canned Job"}</h1>
      <div className="bg-white rounded-xl border border-steel-200 shadow-sm p-5">
        <CannedJobEditor
          laborRateDollars={(shop.laborRate / 100).toFixed(2)}
          existing={job ? {
            id: job.id,
            name: job.name,
            items: job.items.map((i) => ({
              type: i.type, description: i.description, partNumber: i.partNumber,
              qty: String(i.qty), unitPrice: (i.unitPriceCents / 100).toFixed(2),
              cost: i.costCents != null ? (i.costCents / 100).toFixed(2) : "",
            })),
          } : undefined}
        />
      </div>
    </div>
  );
}
