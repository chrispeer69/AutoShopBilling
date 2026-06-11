"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession, requireOwner } from "@/lib/auth";
import { nextDocNumber, toCents, docTotals, surchargeFor } from "@/lib/util";
import { audit } from "@/lib/audit";
import { encrypt } from "@/lib/crypto";
import { SECRET_KEEP } from "@/lib/constants";
import { sendSms } from "@/lib/sms";
import { createPaymentLink, stripeConfigured } from "@/lib/stripe";
import type { DocKind, DocStatus, ItemType, Prisma } from "@prisma/client";

export type ActionState = { error?: string; ok?: string } | null;

/** All actions: (prevState, formData) => ActionState. Errors return, never throw (redirects re-throw). */
function fail(e: unknown): ActionState {
  if (e && typeof e === "object" && "digest" in e && String((e as any).digest).startsWith("NEXT_REDIRECT")) throw e;
  console.error(e);
  return { error: e instanceof Error ? e.message : "Something went wrong." };
}

// ---------- Customers ----------
export async function saveCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const id = String(formData.get("id") || "");
    const data = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
    };
    if (!data.name) return { error: "Name is required." };
    if (id) {
      const r = await prisma.customer.updateMany({ where: { id, shopId: user.shopId }, data });
      if (r.count === 0) return { error: "Customer not found." };
      revalidatePath(`/customers/${id}`);
      return { ok: "Saved." };
    }
    const c = await prisma.customer.create({ data: { ...data, shopId: user.shopId } });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "customer.create", entity: "Customer", entityId: c.id, meta: { name: data.name } });
    revalidatePath("/customers");
    redirect(`/customers/${c.id}`);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireOwner();
    const id = String(formData.get("id"));
    const docCount = await prisma.doc.count({ where: { customerId: id, shopId: user.shopId } });
    if (docCount > 0) return { error: "Customer has billing history — can't be deleted. History is permanent." };
    const c = await prisma.customer.findFirst({ where: { id, shopId: user.shopId } });
    if (!c) return { error: "Not found." };
    await prisma.customer.delete({ where: { id } });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "customer.delete", entity: "Customer", entityId: id, meta: { name: c.name } });
    revalidatePath("/customers");
    redirect("/customers");
  } catch (e) {
    return fail(e);
  }
}

// ---------- Vehicles ----------
export async function saveVehicle(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const id = String(formData.get("id") || "");
    const customerId = String(formData.get("customerId"));
    const mileageRaw = String(formData.get("mileage") || "").replace(/\D/g, "");
    const data = {
      year: String(formData.get("year") || "").trim(),
      make: String(formData.get("make") || "").trim(),
      model: String(formData.get("model") || "").trim(),
      engine: String(formData.get("engine") || "").trim(),
      vin: String(formData.get("vin") || "").trim().toUpperCase(),
      plate: String(formData.get("plate") || "").trim().toUpperCase(),
      mileage: mileageRaw ? parseInt(mileageRaw) : null,
      notes: String(formData.get("notes") || "").trim(),
    };
    const cust = await prisma.customer.findFirst({ where: { id: customerId, shopId: user.shopId } });
    if (!cust) return { error: "Customer not found." };
    if (id) {
      const r = await prisma.vehicle.updateMany({ where: { id, shopId: user.shopId }, data });
      if (r.count === 0) return { error: "Vehicle not found." };
    } else {
      await prisma.vehicle.create({ data: { ...data, customerId, shopId: user.shopId } });
    }
    revalidatePath(`/customers/${customerId}`);
    return { ok: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteVehicle(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const id = String(formData.get("id"));
    const v = await prisma.vehicle.findFirst({ where: { id, shopId: user.shopId } });
    if (!v) return { error: "Not found." };
    const docCount = await prisma.doc.count({ where: { vehicleId: id } });
    if (docCount > 0) return { error: "Vehicle has history — can't be deleted." };
    await prisma.vehicle.delete({ where: { id } });
    revalidatePath(`/customers/${v.customerId}`);
    return { ok: "Deleted." };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Docs ----------
type ItemInput = {
  type: ItemType;
  description: string;
  partNumber: string;
  qty: number;
  unitPriceCents: number;
  costCents: number | null;
  techId: string | null;
  declined: boolean;
};

function parseItems(json: string): ItemInput[] {
  const arr = JSON.parse(json) as any[];
  return arr
    .filter((i) => (i.description || "").trim())
    .map((i) => ({
      type: (["PART", "LABOR", "FEE"].includes(i.type) ? i.type : "PART") as ItemType,
      description: String(i.description).trim(),
      partNumber: String(i.partNumber || "").trim(),
      qty: Math.max(0, parseFloat(i.qty) || 0),
      unitPriceCents: toCents(i.unitPrice),
      costCents: i.cost !== "" && i.cost != null ? toCents(i.cost) : null,
      techId: i.techId ? String(i.techId) : null,
      declined: !!i.declined,
    }));
}

/** Decrement tracked inventory for active PART lines that match the catalog. */
async function consumeInventory(tx: Prisma.TransactionClient, shopId: string, items: ItemInput[]) {
  for (const it of items.filter((i) => i.type === "PART" && i.partNumber && !i.declined)) {
    await tx.partItem.updateMany({
      where: { shopId, partNumber: it.partNumber, qtyOnHand: { not: null } },
      data: { qtyOnHand: { decrement: Math.round(it.qty) } },
    });
  }
}

export async function saveDoc(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const id = String(formData.get("id") || "");
    const kindRaw = String(formData.get("kind"));
    const kind = (["ESTIMATE", "WORKORDER", "INVOICE"].includes(kindRaw) ? kindRaw : "ESTIMATE") as DocKind;
    const customerId = String(formData.get("customerId") || "");
    const vehicleId = String(formData.get("vehicleId") || "") || null;
    const mileageRaw = String(formData.get("mileage") || "").replace(/\D/g, "");
    const taxEnabled = formData.get("taxEnabled") === "on";
    const suppliesEnabled = formData.get("suppliesEnabled") === "on";
    const notes = String(formData.get("notes") || "").trim();
    const items = parseItems(String(formData.get("items") || "[]"));

    if (!customerId) return { error: "Pick a customer." };
    if (items.filter((i) => !i.declined).length === 0) return { error: "Add at least one active line item." };
    const cust = await prisma.customer.findFirst({ where: { id: customerId, shopId: user.shopId } });
    if (!cust) return { error: "Customer not found." };

    const mileage = mileageRaw ? parseInt(mileageRaw) : null;
    let docId = id;

    if (id) {
      // Tax/supplies RATES stay frozen at creation — only the toggles move on edit.
      const existing = await prisma.doc.findFirst({ where: { id, shopId: user.shopId } });
      if (!existing) return { error: "Not found." };
      if (existing.status === "PAID" || existing.status === "VOID") return { error: `This document is ${existing.status} — it can't be edited.` };
      await prisma.$transaction([
        prisma.lineItem.deleteMany({ where: { docId: id } }),
        prisma.doc.update({
          where: { id },
          data: {
            customerId, vehicleId, mileage, notes, taxEnabled, suppliesEnabled,
            items: { create: items.map((it, i) => ({ ...it, sort: i })) },
          },
        }),
      ]);
      await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "doc.update", entity: "Doc", entityId: id, meta: { number: existing.number } });
    } else {
      const shop = await prisma.shop.findUniqueOrThrow({ where: { id: user.shopId } });
      const number = await nextDocNumber(user.shopId, kind);
      const created = await prisma.$transaction(async (tx) => {
        const doc = await tx.doc.create({
          data: {
            shopId: user.shopId, kind, number,
            status: kind === "ESTIMATE" ? "DRAFT" : "OPEN",
            customerId, vehicleId, mileage, notes,
            taxEnabled, taxRate: shop.taxRate, // frozen snapshot
            suppliesEnabled, suppliesPct: shop.suppliesPct, suppliesCapCents: shop.suppliesCapCents,
            items: { create: items.map((it, i) => ({ ...it, sort: i })) },
          },
        });
        if (kind === "INVOICE") await consumeInventory(tx, user.shopId, items);
        return doc;
      });
      docId = created.id;
      await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "doc.create", entity: "Doc", entityId: created.id, meta: { number, kind } });
    }
    revalidatePath("/docs");
    redirect(`/docs/${docId}`);
  } catch (e) {
    return fail(e);
  }
}

export async function setDocStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const id = String(formData.get("id"));
    const status = String(formData.get("status")) as DocStatus;
    const allowed: DocStatus[] = ["DRAFT", "SENT", "APPROVED", "DECLINED", "OPEN", "VOID"];
    if (!allowed.includes(status)) return { error: "Invalid status." };
    if (status === "VOID" && user.role !== "OWNER") return { error: "Only the owner can void." };
    const doc = await prisma.doc.findFirst({ where: { id, shopId: user.shopId } });
    if (!doc) return { error: "Not found." };
    await prisma.doc.update({ where: { id }, data: { status } });
    if (status === "VOID")
      await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "doc.void", entity: "Doc", entityId: id, meta: { number: doc.number } });
    revalidatePath(`/docs/${id}`);
    return null;
  } catch (e) {
    return fail(e);
  }
}

/** Estimate → Work Order, or Estimate/Work Order → Invoice. Carries authorization, lines, snapshots. */
export async function convertDoc(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const id = String(formData.get("id"));
    const target = (formData.get("target") === "WORKORDER" ? "WORKORDER" : "INVOICE") as DocKind;
    const src = await prisma.doc.findFirst({ where: { id, shopId: user.shopId }, include: { items: true } });
    if (!src) return { error: "Not found." };
    if (src.status === "CONVERTED") return { error: "Already converted." };
    if (src.status === "VOID") return { error: "This document is void." };
    if (src.kind === "INVOICE") return { error: "Invoices are the final stage." };
    if (target === "WORKORDER" && src.kind !== "ESTIMATE") return { error: "Only estimates become work orders." };

    const number = await nextDocNumber(user.shopId, target);
    const itemsData: ItemInput[] = src.items.map((i) => ({
      type: i.type, description: i.description, partNumber: i.partNumber,
      qty: i.qty, unitPriceCents: i.unitPriceCents, costCents: i.costCents,
      techId: i.techId, declined: i.declined,
    }));
    const created = await prisma.$transaction(async (tx) => {
      const doc = await tx.doc.create({
        data: {
          shopId: user.shopId, kind: target, number, status: "OPEN",
          customerId: src.customerId, vehicleId: src.vehicleId, mileage: src.mileage,
          notes: src.notes,
          taxEnabled: src.taxEnabled, taxRate: src.taxRate,
          suppliesEnabled: src.suppliesEnabled, suppliesPct: src.suppliesPct, suppliesCapCents: src.suppliesCapCents,
          approvedName: src.approvedName, approvedAt: src.approvedAt, approvedIp: src.approvedIp, signaturePng: src.signaturePng,
          convertedFromId: src.id,
          items: { create: itemsData.map((it, i) => ({ ...it, sort: i })) },
        },
      });
      await tx.doc.update({ where: { id: src.id }, data: { status: "CONVERTED" } });
      if (target === "INVOICE") await consumeInventory(tx, user.shopId, itemsData);
      return doc;
    });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "doc.convert", entity: "Doc", entityId: created.id, meta: { from: src.number, to: created.number } });
    revalidatePath("/docs");
    redirect(`/docs/${created.id}`);
  } catch (e) {
    return fail(e);
  }
}

/** Hard delete only for never-sent draft estimates. Everything else: VOID — the trail stays. */
export async function deleteDoc(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireOwner();
    const id = String(formData.get("id"));
    const doc = await prisma.doc.findFirst({ where: { id, shopId: user.shopId } });
    if (!doc) return { error: "Not found." };
    const deletable = doc.kind === "ESTIMATE" && doc.status === "DRAFT" && !doc.emailedAt;
    if (!deletable) return { error: "Billing records are permanent — void it instead. Only unsent draft estimates can be deleted." };
    await prisma.doc.delete({ where: { id } });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "doc.delete", entity: "Doc", entityId: id, meta: { number: doc.number } });
    revalidatePath("/docs");
    redirect("/docs?kind=ESTIMATE");
  } catch (e) {
    return fail(e);
  }
}

// ---------- Customer authorization (public, token-gated) ----------
export async function customerAuthorize(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const token = String(formData.get("token"));
    const decision = String(formData.get("decision"));
    const name = String(formData.get("name") || "").trim();
    const signature = String(formData.get("signature") || "");
    const declineNote = String(formData.get("declineNote") || "").trim();
    if (!name) return { error: "Please type your full name." };

    const doc = await prisma.doc.findUnique({ where: { publicToken: token } });
    if (!doc || doc.kind !== "ESTIMATE") return { error: "This link is no longer valid." };
    if (doc.status === "CONVERTED" || doc.status === "VOID") return { error: "This estimate is no longer open." };

    const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    if (decision === "approve") {
      if (!signature) return { error: "Please sign in the box to authorize the work." };
      await prisma.doc.update({
        where: { id: doc.id },
        data: { status: "APPROVED", approvedName: name, approvedAt: new Date(), approvedIp: ip, signaturePng: signature },
      });
      await audit({ shopId: doc.shopId, action: "doc.approved", entity: "Doc", entityId: doc.id, meta: { number: doc.number, name, ip } });
      return { ok: "approved" };
    }
    await prisma.doc.update({
      where: { id: doc.id },
      data: { status: "DECLINED", approvedName: name, approvedAt: new Date(), approvedIp: ip, declineNote },
    });
    await audit({ shopId: doc.shopId, action: "doc.declined", entity: "Doc", entityId: doc.id, meta: { number: doc.number, name, ip } });
    return { ok: "declined" };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Payments ----------
async function refreshInvoiceStatus(docId: string) {
  const doc = await prisma.doc.findUniqueOrThrow({ where: { id: docId }, include: { items: true, payments: true } });
  if (doc.kind !== "INVOICE" || doc.status === "VOID") return;
  const t = docTotals(doc);
  const status: DocStatus = t.balance <= 0 && t.total > 0 ? "PAID" : t.paid > 0 ? "PARTIAL" : "OPEN";
  await prisma.doc.update({ where: { id: docId }, data: { status } });
}

export async function addPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const docId = String(formData.get("docId"));
    const doc = await prisma.doc.findFirst({ where: { id: docId, shopId: user.shopId }, include: { items: true, payments: true, shop: true } });
    if (!doc) return { error: "Not found." };
    if (doc.status === "VOID") return { error: "Invoice is void." };
    const method = String(formData.get("method") || "Cash");
    const applySurcharge = formData.get("applySurcharge") === "on";
    let amountCents = toCents(String(formData.get("amount") || "0"));
    if (amountCents <= 0) return { error: "Enter an amount." };

    await prisma.$transaction(async (tx) => {
      if (method === "Card" && applySurcharge && doc.shop.cardSurchargePct > 0) {
        const fee = surchargeFor(amountCents, doc.shop.cardSurchargePct);
        if (fee > 0) {
          const maxSort = doc.items.reduce((m, i) => Math.max(m, i.sort), -1);
          await tx.lineItem.create({
            data: { docId, type: "FEE", description: `Card processing fee (${doc.shop.cardSurchargePct}%)`, unitPriceCents: fee, qty: 1, sort: maxSort + 1 },
          });
          amountCents += fee;
        }
      }
      await tx.payment.create({
        data: { docId, amountCents, method, note: String(formData.get("note") || "").trim() },
      });
    });
    await refreshInvoiceStatus(docId);
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "payment.add", entity: "Doc", entityId: docId, meta: { number: doc.number, amountCents, method } });
    revalidatePath(`/docs/${docId}`);
    return { ok: "Payment recorded." };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePayment(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireOwner();
    const id = String(formData.get("id"));
    const p = await prisma.payment.findUnique({ where: { id }, include: { doc: true } });
    if (!p || p.doc.shopId !== user.shopId) return { error: "Not found." };
    await prisma.payment.delete({ where: { id } });
    await refreshInvoiceStatus(p.docId);
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "payment.delete", entity: "Doc", entityId: p.docId, meta: { number: p.doc.number, amountCents: p.amountCents, method: p.method } });
    revalidatePath(`/docs/${p.docId}`);
    return { ok: "Payment removed." };
  } catch (e) {
    return fail(e);
  }
}

export async function generatePaymentLink(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const docId = String(formData.get("docId"));
    const doc = await prisma.doc.findFirst({ where: { id: docId, shopId: user.shopId }, include: { items: true, payments: true, shop: true } });
    if (!doc) return { error: "Not found." };
    if (!stripeConfigured(doc.shop)) return { error: "Stripe isn't connected. Add your secret key in Settings → Integrations." };
    const t = docTotals(doc);
    if (t.balance <= 0) return { error: "Nothing due on this invoice." };
    const url = await createPaymentLink(doc.shop, doc, t.balance);
    await prisma.doc.update({ where: { id: docId }, data: { paymentLinkUrl: url } });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "paylink.create", entity: "Doc", entityId: docId, meta: { number: doc.number, amountCents: t.balance } });
    revalidatePath(`/docs/${docId}`);
    return { ok: "Payment link ready — it's included when you email the invoice." };
  } catch (e) {
    return fail(e);
  }
}

// ---------- SMS ----------
export async function sendCustomerSms(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const customerId = String(formData.get("customerId"));
    const body = String(formData.get("body") || "").trim();
    if (!body) return { error: "Type a message." };
    const cust = await prisma.customer.findFirst({ where: { id: customerId, shopId: user.shopId }, include: { shop: true } });
    if (!cust) return { error: "Customer not found." };
    if (!cust.phone) return { error: "Customer has no phone number on file." };
    await sendSms(cust.shop, cust.phone, body);
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "sms.send", entity: "Customer", entityId: customerId, meta: { to: cust.phone } });
    return { ok: "Text sent." };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Follow-ups ----------
export async function saveFollowUp(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const customerId = String(formData.get("customerId"));
    const vehicleId = String(formData.get("vehicleId") || "") || null;
    const cust = await prisma.customer.findFirst({ where: { id: customerId, shopId: user.shopId } });
    if (!cust) return { error: "Customer not found." };
    const due = new Date(String(formData.get("dueDate")));
    if (isNaN(due.getTime())) return { error: "Pick a due date." };
    const note = String(formData.get("note") || "").trim();
    if (!note) return { error: "What's the follow-up for?" };
    await prisma.followUp.create({ data: { shopId: user.shopId, customerId, vehicleId, dueDate: due, note } });
    revalidatePath("/followups");
    revalidatePath(`/customers/${customerId}`);
    return { ok: "Follow-up added." };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleFollowUp(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const id = String(formData.get("id"));
    const f = await prisma.followUp.findFirst({ where: { id, shopId: user.shopId } });
    if (!f) return { error: "Not found." };
    await prisma.followUp.update({ where: { id }, data: { status: f.status === "OPEN" ? "DONE" : "OPEN" } });
    revalidatePath("/followups");
    revalidatePath("/dashboard");
    return null;
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFollowUp(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    await prisma.followUp.deleteMany({ where: { id: String(formData.get("id")), shopId: user.shopId } });
    revalidatePath("/followups");
    return null;
  } catch (e) {
    return fail(e);
  }
}

// ---------- Parts catalog ----------
export async function savePart(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const id = String(formData.get("id") || "");
    const qtyRaw = String(formData.get("qtyOnHand") ?? "").trim();
    const data = {
      partNumber: String(formData.get("partNumber") || "").trim().toUpperCase(),
      description: String(formData.get("description") || "").trim(),
      costCents: toCents(String(formData.get("cost") || "0")),
      priceCents: toCents(String(formData.get("price") || "0")),
      qtyOnHand: qtyRaw === "" ? null : Math.max(0, parseInt(qtyRaw) || 0),
    };
    if (!data.partNumber || !data.description) return { error: "Part number and description are required." };
    if (id) {
      const r = await prisma.partItem.updateMany({ where: { id, shopId: user.shopId }, data });
      if (r.count === 0) return { error: "Not found." };
    } else {
      const dupe = await prisma.partItem.findFirst({ where: { shopId: user.shopId, partNumber: data.partNumber } });
      if (dupe) return { error: `Part ${data.partNumber} already exists.` };
      await prisma.partItem.create({ data: { ...data, shopId: user.shopId } });
    }
    revalidatePath("/parts");
    return { ok: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePart(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireOwner();
    await prisma.partItem.deleteMany({ where: { id: String(formData.get("id")), shopId: user.shopId } });
    revalidatePath("/parts");
    return null;
  } catch (e) {
    return fail(e);
  }
}

// ---------- Canned jobs ----------
export async function saveCannedJob(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    if (!name) return { error: "Give the job a name." };
    const items = parseItems(String(formData.get("items") || "[]"));
    if (items.length === 0) return { error: "Add at least one line." };
    const itemsData = items.map((it, i) => ({
      type: it.type, description: it.description, partNumber: it.partNumber,
      qty: it.qty, unitPriceCents: it.unitPriceCents, costCents: it.costCents, sort: i,
    }));
    if (id) {
      const existing = await prisma.cannedJob.findFirst({ where: { id, shopId: user.shopId } });
      if (!existing) return { error: "Not found." };
      await prisma.$transaction([
        prisma.cannedJobItem.deleteMany({ where: { jobId: id } }),
        prisma.cannedJob.update({ where: { id }, data: { name, items: { create: itemsData } } }),
      ]);
    } else {
      await prisma.cannedJob.create({ data: { shopId: user.shopId, name, items: { create: itemsData } } });
    }
    revalidatePath("/canned-jobs");
    redirect("/canned-jobs");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCannedJob(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    await prisma.cannedJob.deleteMany({ where: { id: String(formData.get("id")), shopId: user.shopId } });
    revalidatePath("/canned-jobs");
    return null;
  } catch (e) {
    return fail(e);
  }
}

// ---------- Settings / users ----------
export async function saveShopSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireOwner();
    const num = (k: string) => parseFloat(String(formData.get(k) || "0")) || 0;
    await prisma.shop.update({
      where: { id: user.shopId },
      data: {
        name: String(formData.get("name") || "").trim() || "My Shop",
        address: String(formData.get("address") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        taxRate: num("taxRate"),
        laborRate: toCents(String(formData.get("laborRate") || "0")),
        partsMarkupPct: num("partsMarkupPct"),
        suppliesPct: num("suppliesPct"),
        suppliesCapCents: toCents(String(formData.get("suppliesCap") || "0")),
        cardSurchargePct: num("cardSurchargePct"),
        invoiceFooter: String(formData.get("invoiceFooter") || "").trim(),
      },
    });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "settings.update" });
    revalidatePath("/settings");
    return { ok: "Saved. New rates apply to new documents — existing ones keep the rates they were written with." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveIntegrations(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireOwner();
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: user.shopId } });
    const enc = (input: string, existing: string) => (input === "" ? "" : input === SECRET_KEEP ? existing : encrypt(input));
    await prisma.shop.update({
      where: { id: user.shopId },
      data: {
        smtpHost: String(formData.get("smtpHost") || "").trim(),
        smtpPort: parseInt(String(formData.get("smtpPort") || "587")) || 587,
        smtpUser: String(formData.get("smtpUser") || "").trim(),
        smtpFrom: String(formData.get("smtpFrom") || "").trim(),
        smtpPassEnc: enc(String(formData.get("smtpPass") || ""), shop.smtpPassEnc),
        stripeSecretEnc: enc(String(formData.get("stripeSecret") || ""), shop.stripeSecretEnc),
        stripeWebhookSecretEnc: enc(String(formData.get("stripeWebhookSecret") || ""), shop.stripeWebhookSecretEnc),
        twilioSid: String(formData.get("twilioSid") || "").trim(),
        twilioFrom: String(formData.get("twilioFrom") || "").trim(),
        twilioTokenEnc: enc(String(formData.get("twilioToken") || ""), shop.twilioTokenEnc),
      },
    });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "integrations.update" });
    revalidatePath("/settings");
    return { ok: "Integrations saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function createUser(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireOwner();
    const email = String(formData.get("email") || "").toLowerCase().trim();
    const password = String(formData.get("password") || "");
    if (password.length < 8) return { error: "Password must be 8+ characters." };
    const dupe = await prisma.user.findUnique({ where: { email } });
    if (dupe) return { error: "That email is already in use." };
    const created = await prisma.user.create({
      data: {
        shopId: user.shopId,
        name: String(formData.get("name") || "").trim(),
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: formData.get("role") === "OWNER" ? "OWNER" : "TECH",
      },
    });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "user.create", entity: "User", entityId: created.id, meta: { email } });
    revalidatePath("/settings");
    return { ok: "Team member added." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteUser(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireOwner();
    const id = String(formData.get("id"));
    if (id === user.id) return { error: "You can't delete yourself." };
    const target = await prisma.user.findFirst({ where: { id, shopId: user.shopId } });
    if (!target) return { error: "Not found." };
    await prisma.user.delete({ where: { id } });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "user.delete", entity: "User", entityId: id, meta: { email: target.email } });
    revalidatePath("/settings");
    return { ok: "Removed." };
  } catch (e) {
    return fail(e);
  }
}

export async function resetUserPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireOwner();
    const id = String(formData.get("id"));
    const password = String(formData.get("password") || "");
    if (password.length < 8) return { error: "Password must be 8+ characters." };
    const r = await prisma.user.updateMany({
      where: { id, shopId: user.shopId },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    if (r.count === 0) return { error: "Not found." };
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "user.password_reset", entity: "User", entityId: id });
    return { ok: "Password reset." };
  } catch (e) {
    return fail(e);
  }
}

export async function changeMyPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { user } = await requireSession();
    const current = String(formData.get("current") || "");
    const next = String(formData.get("next") || "");
    if (next.length < 8) return { error: "New password must be 8+ characters." };
    const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await bcrypt.compare(current, me.passwordHash))) return { error: "Current password is wrong." };
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
    await audit({ shopId: user.shopId, userId: user.id, userName: user.name, action: "user.password_change", entity: "User", entityId: user.id });
    return { ok: "Password changed." };
  } catch (e) {
    return fail(e);
  }
}
