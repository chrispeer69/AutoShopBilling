# ShopDesk

Invoicing + CRM for small auto repair shops (1–5 people). Multi-tenant from day one — every shop's data is isolated by `shopId`, so one deployment can serve many shops.

**Stack:** Next.js 14 (App Router) · Prisma + PostgreSQL · NextAuth · Tailwind · pdfkit · nodemailer. Stripe/Twilio via REST (no SDKs).

---

## The workflow

**Estimate → customer signs → Work Order → Invoice → paid.**

1. Write an **estimate** (drop in a canned job, parts auto-fill from your catalog by part number).
2. Email it — the customer gets a PDF plus a **signing link**. They approve with a finger/mouse signature (name, timestamp, IP recorded) or decline with a note. You can also open the signing page on a shop tablet.
3. One click converts it to a **work order** (RO-MMDDYY-NN) while the car's on the lift, then to an **invoice** (MMDDYY-NN) when done. Authorization and signature carry through and print on the invoice.
4. Record payments (cash/check/card — optional card surcharge), or send a **Stripe payment link**. With the webhook configured, online payments mark the invoice paid automatically.
5. Declined lines stay on record and surface on the customer page as upsell opportunities. Schedule follow-ups in one click.

## Feature list

- **Documents:** estimates, work orders, invoices; daily-reset numbering per type; frozen tax/supplies snapshots (changing shop rates never alters existing paperwork); per-invoice tax toggle; shop supplies fee (% of labor, capped); void-not-delete policy — only unsent draft estimates can be hard-deleted.
- **Line items:** parts (with cost → profit tracking + default markup), labor (hourly or flat), fees; tech assigned per labor line; per-line declined flag.
- **Parts:** catalog with cost/price; part-number auto-fill on invoices; optional stock tracking with decrement on invoicing and low-stock alerts on the dashboard.
- **Canned jobs:** reusable parts+labor bundles inserted in one click.
- **CRM:** customers, vehicles (free **VIN decode** via NHTSA — fills year/make/model/engine), plate/mileage, full history, open balances, declined-work list, follow-ups with due dates, **statements** (PDF + email) for customers with open invoices.
- **Comms:** warm-toned emails with PDF attached from **your own SMTP** (per-shop, set in Settings; encrypted at rest); optional **Twilio texting** ("vehicle ready", approval links).
- **Payments:** Stripe payment links per invoice (per-shop keys); webhook auto-reconciliation; card surcharge support.
- **Reports (owner):** sales, **tax collected** (for filing), payments by method, revenue mix, parts profit, labor by tech, top customers, **A/R aging** (0-30/31-60/61-90/90+).
- **Ops:** OWNER vs TECH roles; activity/audit log; login throttling (5 fails / 15 min); password change + owner resets; mobile-responsive; inline error messages on every form; unit-tested money math (`npm test`).

## Deploy (Railway)

1. Push this repo to GitHub; create a Railway project from it + add a PostgreSQL plugin.
2. Set env vars from `.env.example` (`DATABASE_URL` is provided by the plugin; set `NEXTAUTH_URL` to your public URL — signing + payment links depend on it).
3. Deploy. `npm start` runs `prisma migrate deploy` automatically — schema is applied via committed migrations, no manual pushes.
4. Run once: `npm run db:seed` (Railway shell) → creates your shop + owner login. **Change the password immediately** (Account page).

### Local dev

```bash
cp .env.example .env   # fill in DATABASE_URL etc.
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Schema changes: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name your_change` (creates a new migration; deploys apply it automatically).

## Per-shop integrations (Settings → Integrations)

| Integration | What you enter | What it unlocks |
|---|---|---|
| SMTP | host/port/user/pass/from | Invoices & estimates email from the shop's own address |
| Stripe | secret key + webhook signing secret | "Pay online" links; auto-mark-paid via webhook at `/api/stripe/webhook` |
| Twilio | SID / auth token / from number | Text customers from invoice & customer pages |

Secrets are AES-256-GCM encrypted with `APP_ENCRYPTION_KEY`. Each shop points its own Stripe webhook at `https://your-domain/api/stripe/webhook` (event: `checkout.session.completed`).

## Notes & known limits

- Login throttle is in-memory — fine for a single instance (Railway default).
- Voiding an invoice does **not** restock consumed inventory; adjust qty on the Parts page.
- Stripe payment links are per-balance snapshots; regenerate after partial payments ("Refresh payment link").
- The tech role can do day-to-day work; voiding, deleting, settings, reports, and payment removal are owner-only.
