import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { toggleFollowUp, deleteFollowUp } from "@/lib/actions";
import { fmtDate, vehicleLabel } from "@/lib/util";
import { Card, CardHeader, btnSmall, EmptyState } from "@/components/ui";
import { AForm } from "@/components/aform";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage({ searchParams }: { searchParams: { show?: string } }) {
  const { user } = await requireSession();
  const showDone = searchParams.show === "done";
  const followUps = await prisma.followUp.findMany({
    where: { shopId: user.shopId, status: showDone ? "DONE" : "OPEN" },
    include: { customer: true, vehicle: true },
    orderBy: { dueDate: "asc" },
    take: 200,
  });
  const today = new Date();
  today.setHours(23, 59, 59);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-steel-900">Follow-ups</h1>
        <div className="flex rounded-lg border border-steel-200 bg-white p-0.5">
          <Link href="/followups" className={`rounded-md px-3 py-1.5 text-sm font-semibold ${!showDone ? "bg-steel-900 text-white" : "text-steel-600"}`}>Open</Link>
          <Link href="/followups?show=done" className={`rounded-md px-3 py-1.5 text-sm font-semibold ${showDone ? "bg-steel-900 text-white" : "text-steel-600"}`}>Done</Link>
        </div>
      </div>
      <Card>
        <CardHeader title={showDone ? "Completed" : "Open follow-ups"} />
        {followUps.length === 0 ? (
          <EmptyState>{showDone ? "Nothing completed yet." : "Nothing scheduled. Add follow-ups from a customer or invoice page."}</EmptyState>
        ) : (
          <div className="divide-y divide-steel-100">
            {followUps.map((f) => {
              const overdue = !showDone && f.dueDate < today;
              return (
                <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm">
                    <span className={`font-semibold ${overdue ? "text-red-600" : "text-steel-900"}`}>{fmtDate(f.dueDate)}{overdue && " · overdue"}</span>
                    <span className="text-steel-600"> — {f.note}</span>
                    <div className="text-xs text-steel-400 mt-0.5">
                      <Link href={`/customers/${f.customerId}`} className="text-torque-700 hover:underline">{f.customer.name}</Link>
                      {f.vehicle && <> · {vehicleLabel(f.vehicle)}</>}
                      {f.customer.phone && <> · {f.customer.phone}</>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <AForm action={toggleFollowUp} submitLabel={showDone ? "Reopen" : "✓ Done"} submitClass={btnSmall} inline className="inline">
                      <input type="hidden" name="id" value={f.id} />
                    </AForm>
                    <AForm action={deleteFollowUp} submitLabel="Delete" submitClass={btnSmall} confirm="Delete this follow-up?" inline className="inline">
                      <input type="hidden" name="id" value={f.id} />
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
