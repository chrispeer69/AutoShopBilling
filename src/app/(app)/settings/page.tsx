import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { saveShopSettings, saveIntegrations, createUser, deleteUser, resetUserPassword } from "@/lib/actions";
import { SECRET_KEEP } from "@/lib/constants";
import { fmtDate } from "@/lib/util";
import { Card, CardHeader, Field, inputCls, btnPrimary, btnSecondary, btnSmall, EmptyState } from "@/components/ui";
import { AForm } from "@/components/aform";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await requireOwner();
  const [shop, users, auditLogs] = await Promise.all([
    prisma.shop.findUniqueOrThrow({ where: { id: user.shopId } }),
    prisma.user.findMany({ where: { shopId: user.shopId }, orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ where: { shopId: user.shopId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="space-y-5 max-w-4xl">
      <h1 className="text-2xl font-bold text-steel-900">Settings</h1>

      <Card>
        <CardHeader title="Shop info & rates" />
        <div className="p-5">
          <AForm action={saveShopSettings} submitLabel="Save Settings" submitClass={btnPrimary}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Shop name"><input name="name" defaultValue={shop.name} className={inputCls} /></Field>
              <Field label="Phone"><input name="phone" defaultValue={shop.phone} className={inputCls} /></Field>
              <Field label="Address" className="sm:col-span-2"><input name="address" defaultValue={shop.address} className={inputCls} /></Field>
              <Field label="Shop email"><input name="email" defaultValue={shop.email} className={inputCls} /></Field>
              <Field label="Invoice footer"><input name="invoiceFooter" defaultValue={shop.invoiceFooter} className={inputCls} /></Field>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4 pt-4 border-t border-steel-100">
              <Field label="Labor rate ($/hr)"><input name="laborRate" defaultValue={(shop.laborRate / 100).toFixed(2)} className={inputCls} inputMode="decimal" /></Field>
              <Field label="Sales tax rate (%)"><input name="taxRate" defaultValue={shop.taxRate} className={inputCls} inputMode="decimal" /></Field>
              <Field label="Default parts markup (%)"><input name="partsMarkupPct" defaultValue={shop.partsMarkupPct} className={inputCls} inputMode="decimal" /></Field>
              <Field label="Shop supplies fee (% of labor)"><input name="suppliesPct" defaultValue={shop.suppliesPct} className={inputCls} inputMode="decimal" /></Field>
              <Field label="Supplies cap ($, 0 = none)"><input name="suppliesCap" defaultValue={(shop.suppliesCapCents / 100).toFixed(2)} className={inputCls} inputMode="decimal" /></Field>
              <Field label="Card surcharge (%, 0 = off)"><input name="cardSurchargePct" defaultValue={shop.cardSurchargePct} className={inputCls} inputMode="decimal" /></Field>
            </div>
            <p className="text-xs text-steel-400 mt-3">Tax &amp; supplies rates are snapshotted onto each document when it&apos;s created — changing them here never alters existing paperwork.</p>
          </AForm>
        </div>
      </Card>

      <Card>
        <CardHeader title="Integrations — email, online payments, texting" />
        <div className="p-5">
          <AForm action={saveIntegrations} submitLabel="Save Integrations" submitClass={btnPrimary}>
            <div className="text-xs font-bold text-steel-500 uppercase tracking-wide mb-2">Email (your SMTP — invoices send from your address)</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="SMTP host"><input name="smtpHost" defaultValue={shop.smtpHost} className={inputCls} placeholder="smtp.gmail.com" /></Field>
              <Field label="Port"><input name="smtpPort" defaultValue={shop.smtpPort} className={inputCls} inputMode="numeric" /></Field>
              <Field label="Username"><input name="smtpUser" defaultValue={shop.smtpUser} className={inputCls} /></Field>
              <Field label="Password"><input name="smtpPass" type="password" defaultValue={shop.smtpPassEnc ? SECRET_KEEP : ""} className={inputCls} /></Field>
              <Field label='"From" address' className="col-span-2"><input name="smtpFrom" defaultValue={shop.smtpFrom} className={inputCls} placeholder="Mike's Garage <mike@gmail.com>" /></Field>
            </div>
            <div className="text-xs font-bold text-steel-500 uppercase tracking-wide mt-5 mb-2">Stripe (optional — "pay online" links on invoices)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Secret key (sk_live_…)"><input name="stripeSecret" type="password" defaultValue={shop.stripeSecretEnc ? SECRET_KEEP : ""} className={inputCls} /></Field>
              <Field label="Webhook signing secret (whsec_…) — auto-marks invoices paid"><input name="stripeWebhookSecret" type="password" defaultValue={shop.stripeWebhookSecretEnc ? SECRET_KEEP : ""} className={inputCls} /></Field>
            </div>
            <div className="text-xs font-bold text-steel-500 uppercase tracking-wide mt-5 mb-2">Twilio (optional — text customers)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Account SID"><input name="twilioSid" defaultValue={shop.twilioSid} className={inputCls} /></Field>
              <Field label="Auth token"><input name="twilioToken" type="password" defaultValue={shop.twilioTokenEnc ? SECRET_KEEP : ""} className={inputCls} /></Field>
              <Field label="From number"><input name="twilioFrom" defaultValue={shop.twilioFrom} className={inputCls} placeholder="+16145551234" /></Field>
            </div>
            <p className="text-xs text-steel-400 mt-3">Secrets are encrypted at rest. Leave a saved secret untouched to keep it; clear the field to remove it.</p>
          </AForm>
        </div>
      </Card>

      <Card>
        <CardHeader title="Team" />
        <div className="divide-y divide-steel-100">
          {users.map((u) => (
            <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <span className="font-medium text-steel-900">{u.name}</span>
                <span className="text-steel-400"> · {u.email} · {u.role === "OWNER" ? "Owner" : "Tech"}</span>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <AForm action={resetUserPassword} submitLabel="Reset password" submitClass={btnSmall} inline className="inline-flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <input name="password" type="password" placeholder="New password" className={`${inputCls} !w-40 !py-1 !text-xs`} minLength={8} />
                </AForm>
                {u.id !== user.id && (
                  <AForm action={deleteUser} submitLabel="Remove" submitClass={btnSmall} confirm={`Remove ${u.name}?`} inline className="inline">
                    <input type="hidden" name="id" value={u.id} />
                  </AForm>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-steel-100">
          <div className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Add team member</div>
          <AForm action={createUser} submitLabel="Add" submitClass={btnSecondary}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Name"><input name="name" className={inputCls} required /></Field>
              <Field label="Email"><input name="email" type="email" className={inputCls} required /></Field>
              <Field label="Password (8+)"><input name="password" type="password" className={inputCls} required minLength={8} /></Field>
              <Field label="Role">
                <select name="role" className={inputCls}>
                  <option value="TECH">Tech</option>
                  <option value="OWNER">Owner</option>
                </select>
              </Field>
            </div>
          </AForm>
        </div>
      </Card>

      <Card>
        <CardHeader title="Activity log (last 50)" />
        {auditLogs.length === 0 ? <EmptyState>No activity yet.</EmptyState> : (
          <div className="divide-y divide-steel-100 text-sm">
            {auditLogs.map((l) => (
              <div key={l.id} className="px-5 py-2 flex items-center justify-between gap-3">
                <span className="text-steel-600">
                  <span className="font-mono text-xs text-steel-400">{l.action}</span>
                  {l.userName && <span className="text-steel-500"> · {l.userName}</span>}
                  {l.meta && <span className="text-steel-400 text-xs"> · {l.meta.length > 80 ? l.meta.slice(0, 80) + "…" : l.meta}</span>}
                </span>
                <span className="text-xs text-steel-400 whitespace-nowrap">{fmtDate(l.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
