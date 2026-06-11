import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { deleteCannedJob } from "@/lib/actions";
import { fmtMoney } from "@/lib/util";
import { Card, CardHeader, btnPrimary, btnSmall, EmptyState } from "@/components/ui";
import { AForm } from "@/components/aform";

export const dynamic = "force-dynamic";

export default async function CannedJobsPage() {
  const { user } = await requireSession();
  const jobs = await prisma.cannedJob.findMany({
    where: { shopId: user.shopId },
    include: { items: { orderBy: { sort: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-steel-900">Canned Jobs</h1>
          <p className="text-sm text-steel-500 mt-0.5">Saved parts + labor bundles — drop a whole job onto an estimate in one click.</p>
        </div>
        <Link href="/canned-jobs/edit" className={btnPrimary}>+ New Canned Job</Link>
      </div>

      <Card>
        <CardHeader title={`Jobs (${jobs.length})`} />
        {jobs.length === 0 ? (
          <EmptyState>No canned jobs yet. Build your common services — “Front brakes”, “Oil change”, “Coolant flush”.</EmptyState>
        ) : (
          <div className="divide-y divide-steel-100">
            {jobs.map((j) => {
              const total = j.items.reduce((s, i) => s + Math.round(i.qty * i.unitPriceCents), 0);
              return (
                <div key={j.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium text-steel-900">{j.name}</div>
                    <div className="text-xs text-steel-500">{j.items.length} line{j.items.length === 1 ? "" : "s"} · {fmtMoney(total)}</div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/canned-jobs/edit?id=${j.id}`} className={btnSmall}>Edit</Link>
                    <AForm action={deleteCannedJob} submitLabel="Delete" submitClass={btnSmall} confirm={`Delete "${j.name}"?`} inline className="inline">
                      <input type="hidden" name="id" value={j.id} />
                    </AForm>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
