import { prisma } from "@/lib/prisma";

export async function audit(opts: {
  shopId: string;
  userId?: string;
  userName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        shopId: opts.shopId,
        userId: opts.userId ?? "",
        userName: opts.userName ?? "",
        action: opts.action,
        entity: opts.entity ?? "",
        entityId: opts.entityId ?? "",
        meta: opts.meta ? JSON.stringify(opts.meta) : "",
      },
    });
  } catch (e) {
    console.error("audit failed", e); // never block the operation
  }
}
