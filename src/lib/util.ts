// Server-side helpers (Prisma-dependent). Pure helpers re-exported from money.ts.
import { prisma } from "@/lib/prisma";
import type { DocKind } from "@prisma/client";
import { dateKey, formatDocNumber } from "@/lib/money";

export * from "@/lib/money";

/**
 * MMDDYY-NN (invoice) / RO-MMDDYY-NN / EST-MMDDYY-NN. Per shop, resets daily.
 * Atomic: single INSERT ... ON CONFLICT ... RETURNING — safe under concurrent techs.
 */
export async function nextDocNumber(shopId: string, kind: DocKind, d: Date = new Date()): Promise<string> {
  const key = dateKey(d);
  const id = `dc_${shopId}_${kind}_${key}`;
  const rows = await prisma.$queryRaw<{ seq: number }[]>`
    INSERT INTO "DailyCounter" ("id", "shopId", "kind", "dateKey", "seq")
    VALUES (${id}, ${shopId}, ${kind}::"DocKind", ${key}, 1)
    ON CONFLICT ("shopId", "kind", "dateKey")
    DO UPDATE SET "seq" = "DailyCounter"."seq" + 1
    RETURNING "seq"`;
  return formatDocNumber(kind, key, rows[0].seq);
}

export function appUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}
