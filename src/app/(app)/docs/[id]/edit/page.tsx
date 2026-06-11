import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { DocEditor } from "@/components/doc-editor";
import { vehicleLabel } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function EditDocPage({ params }: { params: { id: string } }) {
  const { user } = await requireSession();
  const doc = await prisma.doc.findFirst({
    where: { id: params.id, shopId: user.shopId },
    include: { items: { orderBy: { sort: "asc" } } },
  });
  if (!doc) notFound();
  if (doc.status === "PAID" || doc.status === "VOID" || doc.status === "CONVERTED") redirect(`/docs/${doc.id}`);

  const [customers, shop, techs, cannedJobs] = await Promise.all([
    prisma.customer.findMany({ where: { shopId: user.shopId }, include: { vehicles: true }, orderBy: { name: "asc" } }),
    prisma.shop.findUniqueOrThrow({ where: { id: user.shopId } }),
    prisma.user.findMany({ where: { shopId: user.shopId }, orderBy: { name: "asc" } }),
    prisma.cannedJob.findMany({ where: { shopId: user.shopId }, include: { items: { orderBy: { sort: "asc" } } }, orderBy: { name: "asc" } }),
  ]);

  const noun = doc.kind === "INVOICE" ? "Invoice" : doc.kind === "WORKORDER" ? "Work Order" : "Estimate";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-steel-900 font-mono">Edit {noun} {doc.number}</h1>
      <div className="bg-white rounded-xl border border-steel-200 shadow-sm p-4 sm:p-5">
        <DocEditor
          kind={doc.kind}
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
          taxRatePct={doc.taxRate /* frozen snapshot — NOT current shop rate */}
          partsMarkupPct={shop.partsMarkupPct}
          supplies={{ pct: doc.suppliesPct, capDollars: (doc.suppliesCapCents / 100).toFixed(2) }}
          existing={{
            id: doc.id,
            customerId: doc.customerId,
            vehicleId: doc.vehicleId ?? "",
            mileage: doc.mileage != null ? String(doc.mileage) : "",
            notes: doc.notes,
            taxEnabled: doc.taxEnabled,
            suppliesEnabled: doc.suppliesEnabled,
            items: doc.items.map((i) => ({
              type: i.type, description: i.description, partNumber: i.partNumber,
              qty: String(i.qty), unitPrice: (i.unitPriceCents / 100).toFixed(2),
              cost: i.costCents != null ? (i.costCents / 100).toFixed(2) : "",
              techId: i.techId ?? "", declined: i.declined,
            })),
          }}
        />
      </div>
    </div>
  );
}
