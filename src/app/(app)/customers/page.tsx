import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { saveCustomer } from "@/lib/actions";
import { vehicleLabel } from "@/lib/util";
import { Card, CardHeader, Field, inputCls, btnPrimary, EmptyState } from "@/components/ui";
import { AForm } from "@/components/aform";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const { user } = await requireSession();
  const q = (searchParams.q || "").trim();

  const customers = await prisma.customer.findMany({
    where: {
      shopId: user.shopId,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { vehicles: { some: { plate: { contains: q.toUpperCase() } } } }] } : {}),
    },
    include: { vehicles: true, _count: { select: { docs: true } } },
    orderBy: { name: "asc" },
    take: 300,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-steel-900">Customers</h1>

      <Card>
        <CardHeader title="Add customer" />
        <div className="p-5">
          <AForm action={saveCustomer} submitLabel="Add Customer" submitClass={btnPrimary}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Name *"><input name="name" className={inputCls} required /></Field>
              <Field label="Phone"><input name="phone" className={inputCls} /></Field>
              <Field label="Email"><input name="email" type="email" className={inputCls} /></Field>
              <Field label="Address"><input name="address" className={inputCls} /></Field>
            </div>
          </AForm>
        </div>
      </Card>

      <form>
        <input name="q" defaultValue={q} placeholder="Search name, phone, or plate…" className={`${inputCls} max-w-md`} />
      </form>

      <Card>
        <CardHeader title={`Customers (${customers.length})`} />
        {customers.length === 0 ? (
          <EmptyState>{q ? "No matches." : "No customers yet — add your first one above."}</EmptyState>
        ) : (
          <div className="divide-y divide-steel-100">
            {customers.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-steel-50 gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-steel-900">{c.name}</div>
                  <div className="text-xs text-steel-500 truncate">
                    {[c.phone, c.vehicles.map((v) => vehicleLabel(v)).filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="text-xs text-steel-400 whitespace-nowrap">{c._count.docs} doc{c._count.docs === 1 ? "" : "s"}</div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
