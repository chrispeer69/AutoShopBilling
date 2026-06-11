import nodemailer from "nodemailer";
import type { Doc, Customer, Shop } from "@prisma/client";
import { fmtMoney, fmtDate, appUrl } from "@/lib/util";
import { decrypt } from "@/lib/crypto";

/** Per-shop SMTP if configured, else platform env fallback. */
export function transportFor(shop: Shop) {
  const useShop = !!shop.smtpHost;
  const host = useShop ? shop.smtpHost : process.env.SMTP_HOST;
  const port = useShop ? shop.smtpPort : Number(process.env.SMTP_PORT || 587);
  const user = useShop ? shop.smtpUser : process.env.SMTP_USER;
  const pass = useShop ? decrypt(shop.smtpPassEnc) : process.env.SMTP_PASS;
  if (!host || !user) throw new Error("Email isn't set up. Add SMTP settings in Settings → Email.");
  return {
    transport: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }),
    from: (useShop ? shop.smtpFrom : process.env.SMTP_FROM) || user,
  };
}

export async function emailDocPdf(opts: {
  doc: Doc & { customer: Customer; shop: Shop };
  pdf: Buffer;
  totalCents: number;
  balanceCents: number;
}) {
  const { doc, pdf, totalCents, balanceCents } = opts;
  const to = doc.customer.email;
  if (!to) throw new Error("Customer has no email address on file.");

  const isInvoice = doc.kind === "INVOICE";
  const firstName = doc.customer.name.split(" ")[0];
  const shopName = doc.shop.name;
  const approveUrl = `${appUrl()}/approve/${doc.publicToken}`;

  const subject = isInvoice
    ? `Invoice ${doc.number} from ${shopName} — ${fmtMoney(totalCents)}`
    : `Estimate ${doc.number} from ${shopName} — please review & approve`;

  const lines = isInvoice
    ? [
        `Hi ${firstName},`,
        ``,
        `Thanks for trusting us with your vehicle — it was a pleasure having you in the shop.`,
        ``,
        `Your invoice ${doc.number} dated ${fmtDate(doc.date)} is attached as a PDF.`,
        `Total: ${fmtMoney(totalCents)}${balanceCents !== totalCents ? `  ·  Balance due: ${fmtMoney(balanceCents)}` : ""}`,
        ...(doc.paymentLinkUrl && balanceCents > 0 ? [``, `Pay online securely: ${doc.paymentLinkUrl}`] : []),
        ``,
        `If you have any questions about the work performed or the charges, just reply to this email or give us a call${doc.shop.phone ? ` at ${doc.shop.phone}` : ""} — we're happy to walk through it with you.`,
        ``,
        `We appreciate your business and look forward to seeing you next time.`,
        ``,
        `Warm regards,`,
        shopName,
        doc.shop.phone || "",
      ]
    : [
        `Hi ${firstName},`,
        ``,
        `Thanks for the opportunity to look at your vehicle.`,
        ``,
        `Your estimate ${doc.number} is attached as a PDF. The estimated total is ${fmtMoney(totalCents)}.`,
        ``,
        `To authorize the work, review and sign here: ${approveUrl}`,
        ``,
        `Nothing happens until you give us the go-ahead — if you have questions or want to talk through options, just reply to this email or call us${doc.shop.phone ? ` at ${doc.shop.phone}` : ""}.`,
        ``,
        `Warm regards,`,
        shopName,
        doc.shop.phone || "",
      ];

  const { transport, from } = transportFor(doc.shop);
  await transport.sendMail({
    from,
    to,
    subject,
    text: lines.join("\n"),
    html: lines.map((l) => (l === "" ? "<br/>" : `<p style="margin:0 0 2px 0;font-family:Arial,sans-serif;font-size:14px;color:#1A1D21;">${l.replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`)).join(""),
    attachments: [{ filename: `${doc.number}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
}

export async function emailStatement(opts: { shop: Shop; customer: Customer; pdf: Buffer; openCount: number; balanceCents: number }) {
  const { shop, customer, pdf, openCount, balanceCents } = opts;
  if (!customer.email) throw new Error("Customer has no email address on file.");
  const lines = [
    `Hi ${customer.name.split(" ")[0]},`,
    ``,
    `Attached is your current statement from ${shop.name}: ${openCount} open invoice${openCount === 1 ? "" : "s"}, total balance ${fmtMoney(balanceCents)}.`,
    ``,
    `If anything looks off or you'd like to arrange payment, just reply to this email or call us${shop.phone ? ` at ${shop.phone}` : ""}.`,
    ``,
    `Thank you for your business,`,
    shop.name,
  ];
  const { transport, from } = transportFor(shop);
  await transport.sendMail({
    from,
    to: customer.email,
    subject: `Statement from ${shop.name} — balance ${fmtMoney(balanceCents)}`,
    text: lines.join("\n"),
    html: lines.map((l) => (l === "" ? "<br/>" : `<p style="margin:0 0 2px 0;font-family:Arial,sans-serif;font-size:14px;">${l}</p>`)).join(""),
    attachments: [{ filename: `statement.pdf`, content: pdf, contentType: "application/pdf" }],
  });
}
