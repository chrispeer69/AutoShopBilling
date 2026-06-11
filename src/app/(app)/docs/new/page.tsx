import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { DocEditor } from "@/components/doc-editor";
import { vehicleLabel } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function NewDocPage({ searchParams }: { searchParams: { kind?: string; customerId?: string } }) {
  const { user } = await requireSession();
  const kind = searchParams.kind === "INVOICE" ? "INVOICE" : searchParams.kind === "WORKORDER" ? "WORKORDER" : "ESTIMATE";

  const [customers, shop, techs, cannedJobs] = await Promise.all([
    prisma.customer.findMany({ where: { shopId: user.shopId }, include: { vehicles: true }, orderBy: { name: "asc" } }),
    prisma.shop.findUniqueOrThrow({ where: { id: user.shopId } }),
    prisma.user.findMany({ where: { shopId: user.shopId }, orderBy: { name: "asc" } }),
    prisma.cannedJob.findMany({ where: { shopId: user.shopId }, include: { items: { orderBy: { sort: "asc" } } }, orderBy: { name: "asc" } }),
  ]);

  const noun = kind === "INVOICE" ? "Invoice" : kind === "WORKORDER" ? "Work Order" : "Estimate";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-steel-900">New {noun}</h1>
      <div className="bg-white rounded-xl border border-steel-200 shadow-sm p-4 sm:p-5">
        <DocEditor
          kind={kind}
          customers={customers.map((c) => ({
            id: c.id, name: c.name,
            vehicles: c.vehicles.map((v) => ({ id: v.id, label: vehicleLabel(v) || "Vehicle", mileage: v.mileage })),
          }))}
          techs={techs.map((t) => ({ id: t.id, name: t.name }))}
          cannedJobs={cannedJobs.map((j) => ({
            id: j.id, name: j.name,
            items: j.items.map((i) => ({
              type: i.type, description: i.description, partNumber: i.partNumber, qty: i.qty,
              unitPrice: (i.unitPriceCents / 100).toFixed(2),
              cost: i.costCents != null ? (i.costCents / 100).toFixed(2) : "",
            })),
          }))}
          laborRateDollars={(shop.laborRate / 100).toFixed(2)}
          taxRatePct={shop.taxRate}
          partsMarkupPct={shop.partsMarkupPct}
          supplies={{ pct: shop.suppliesPct, capDollars: (shop.suppliesCapCents / 100).toFixed(2) }}
        />
      </div>
    </div>
  );
}
