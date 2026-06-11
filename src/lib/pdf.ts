import PDFDocument from "pdfkit";
import type { Doc, LineItem, Customer, Vehicle, Shop, Payment } from "@prisma/client";
import { fmtMoney, fmtDate, docTotals, vehicleLabel } from "@/lib/util";

type FullDoc = Doc & {
  items: LineItem[];
  payments: Payment[];
  customer: Customer;
  vehicle: Vehicle | null;
  shop: Shop;
};

const GRAY = "#5B6470";
const DARK = "#1A1D21";
const LIGHT = "#E7EAEE";
const ACCENT = "#C2410C";

function docToBuffer(build: (doc: InstanceType<typeof PDFDocument>) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

function header(pdf: InstanceType<typeof PDFDocument>, shop: Shop, title: string, subtitle: string[]) {
  pdf.fontSize(20).fillColor(DARK).font("Helvetica-Bold").text(shop.name, 50, 50);
  pdf.fontSize(9).fillColor(GRAY).font("Helvetica");
  let y = 76;
  for (const line of [shop.address, [shop.phone, shop.email].filter(Boolean).join("  ·  ")].filter(Boolean)) {
    pdf.text(line, 50, y);
    y += 12;
  }
  pdf.fontSize(22).fillColor(ACCENT).font("Helvetica-Bold").text(title, 350, 50, { width: 212, align: "right" });
  pdf.fontSize(10).fillColor(DARK).font("Helvetica");
  let ry = 78;
  for (const s of subtitle) {
    pdf.text(s, 350, ry, { width: 212, align: "right" });
    ry += 14;
  }
  return Math.max(y, ry) + 16;
}

export async function renderDocPdf(d: FullDoc): Promise<Buffer> {
  const t = docTotals(d);
  const title = d.kind === "INVOICE" ? "INVOICE" : d.kind === "WORKORDER" ? "WORK ORDER" : "ESTIMATE";

  return docToBuffer((pdf) => {
    let y = header(pdf, d.shop, title, [`# ${d.number}`, fmtDate(d.date)]);

    // Customer / vehicle blocks
    pdf.roundedRect(50, y, 250, 86, 6).fillAndStroke("#F7F8FA", LIGHT);
    pdf.roundedRect(312, y, 250, 86, 6).fillAndStroke("#F7F8FA", LIGHT);
    pdf.fontSize(8).fillColor(GRAY).font("Helvetica-Bold").text("BILL TO", 62, y + 10).text("VEHICLE", 324, y + 10);
    pdf.fontSize(10).fillColor(DARK).font("Helvetica-Bold").text(d.customer.name, 62, y + 24, { width: 226 });
    pdf.fontSize(9).font("Helvetica").fillColor(GRAY);
    let cy = y + 38;
    for (const line of [d.customer.phone, d.customer.email, d.customer.address].filter(Boolean).slice(0, 3)) {
      pdf.text(line, 62, cy, { width: 226 });
      cy += 12;
    }
    if (d.vehicle) {
      pdf.fontSize(10).fillColor(DARK).font("Helvetica-Bold").text(vehicleLabel(d.vehicle) || "—", 324, y + 24, { width: 226 });
      pdf.fontSize(9).font("Helvetica").fillColor(GRAY);
      let vy = y + 38;
      const vLines = [
        d.vehicle.engine && `Engine: ${d.vehicle.engine}`,
        d.vehicle.vin && `VIN: ${d.vehicle.vin}`,
        [d.vehicle.plate && `Plate: ${d.vehicle.plate}`, d.mileage != null && `Mileage: ${d.mileage.toLocaleString()}`].filter(Boolean).join("   "),
      ].filter(Boolean) as string[];
      for (const line of vLines.slice(0, 3)) {
        pdf.text(line, 324, vy, { width: 226 });
        vy += 12;
      }
    } else if (d.mileage != null) {
      pdf.fontSize(9).fillColor(GRAY).text(`Mileage: ${d.mileage.toLocaleString()}`, 324, y + 24);
    }
    y += 102;

    // Items table (active lines)
    const drawTableHeader = () => {
      pdf.rect(50, y, 512, 20).fill(DARK);
      pdf.fontSize(8).fillColor("#FFFFFF").font("Helvetica-Bold");
      pdf.text("TYPE", 58, y + 6).text("DESCRIPTION", 110, y + 6).text("QTY/HRS", 380, y + 6, { width: 50, align: "right" }).text("RATE", 440, y + 6, { width: 50, align: "right" }).text("AMOUNT", 500, y + 6, { width: 54, align: "right" });
      y += 24;
    };
    drawTableHeader();

    const active = d.items.filter((i) => !i.declined);
    pdf.font("Helvetica").fontSize(9);
    for (const item of active) {
      if (y > 660) { pdf.addPage(); y = 50; drawTableHeader(); pdf.font("Helvetica").fontSize(9); }
      const amount = Math.round(item.qty * item.unitPriceCents);
      const desc = item.partNumber ? `${item.description}  (PN ${item.partNumber})` : item.description;
      const h = Math.max(pdf.heightOfString(desc, { width: 262 }), 10) + 8;
      pdf.fillColor(GRAY).text(item.type === "LABOR" ? "Labor" : item.type === "FEE" ? "Fee" : "Part", 58, y + 4);
      pdf.fillColor(DARK).text(desc, 110, y + 4, { width: 262 });
      pdf.text(item.type === "FEE" ? "" : String(item.qty), 380, y + 4, { width: 50, align: "right" });
      pdf.text(item.type === "FEE" ? "" : fmtMoney(item.unitPriceCents), 440, y + 4, { width: 50, align: "right" });
      pdf.text(fmtMoney(amount), 500, y + 4, { width: 54, align: "right" });
      y += h;
      pdf.moveTo(50, y).lineTo(562, y).strokeColor(LIGHT).stroke();
    }

    // Totals
    y += 10;
    const totalsRow = (label: string, value: string, bold = false, color = DARK) => {
      pdf.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9).fillColor(bold ? color : GRAY);
      pdf.text(label, 380, y, { width: 110, align: "right" });
      pdf.fillColor(color).text(value, 494, y, { width: 60, align: "right" });
      y += bold ? 18 : 14;
    };
    totalsRow("Subtotal", fmtMoney(t.subtotal));
    if (d.suppliesEnabled && t.supplies > 0) totalsRow(`Shop supplies (${d.suppliesPct}%)`, fmtMoney(t.supplies));
    if (d.taxEnabled) totalsRow(`Tax (${d.taxRate}%)`, fmtMoney(t.tax));
    totalsRow("TOTAL", fmtMoney(t.total), true, ACCENT);
    if (d.kind === "INVOICE" && d.payments.length > 0) {
      totalsRow("Paid", `-${fmtMoney(t.paid)}`);
      totalsRow("BALANCE DUE", fmtMoney(t.balance), true, t.balance > 0 ? ACCENT : "#047857");
    }

    // Declined recommendations
    const declined = d.items.filter((i) => i.declined);
    if (declined.length > 0) {
      y += 8;
      if (y > 640) { pdf.addPage(); y = 50; }
      pdf.font("Helvetica-Bold").fontSize(9).fillColor(GRAY).text("RECOMMENDED — DECLINED AT THIS TIME", 50, y);
      y += 14;
      pdf.font("Helvetica").fontSize(8.5).fillColor(GRAY);
      for (const item of declined) {
        pdf.text(`• ${item.description} — ${fmtMoney(Math.round(item.qty * item.unitPriceCents))}`, 58, y, { width: 480 });
        y += 12;
      }
    }

    // Notes
    if (d.notes) {
      y += 10;
      if (y > 640) { pdf.addPage(); y = 50; }
      pdf.font("Helvetica-Bold").fontSize(9).fillColor(GRAY).text("NOTES", 50, y);
      pdf.font("Helvetica").fontSize(9).fillColor(DARK).text(d.notes, 50, y + 14, { width: 512 });
      y += 14 + pdf.heightOfString(d.notes, { width: 512 }) + 6;
    }

    // Authorization block
    if (d.approvedAt && d.approvedName) {
      y += 8;
      if (y > 620) { pdf.addPage(); y = 50; }
      pdf.roundedRect(50, y, 512, d.signaturePng ? 78 : 36, 6).strokeColor(LIGHT).stroke();
      pdf.font("Helvetica-Bold").fontSize(8).fillColor(GRAY).text("CUSTOMER AUTHORIZATION", 62, y + 8);
      pdf.font("Helvetica").fontSize(9).fillColor(DARK).text(
        `Authorized by ${d.approvedName} on ${fmtDate(d.approvedAt)}${d.approvedIp ? ` (IP ${d.approvedIp})` : ""}`,
        62, y + 20, { width: 488 }
      );
      if (d.signaturePng) {
        try {
          const b64 = d.signaturePng.split(",")[1];
          if (b64) pdf.image(Buffer.from(b64, "base64"), 62, y + 34, { fit: [180, 38] });
        } catch { /* corrupt signature shouldn't kill the PDF */ }
      }
      y += (d.signaturePng ? 78 : 36) + 6;
    } else if (d.kind === "ESTIMATE") {
      y += 8;
      if (y > 640) { pdf.addPage(); y = 50; }
      pdf.font("Helvetica").fontSize(8).fillColor(GRAY).text(
        "This estimate is valid for 30 days. Work will not begin without your authorization. Final invoice may vary if additional issues are found — we will contact you for approval before any added work.",
        50, y, { width: 512 }
      );
      y += 30;
      pdf.moveTo(50, y + 18).lineTo(280, y + 18).strokeColor(GRAY).stroke();
      pdf.moveTo(320, y + 18).lineTo(440, y + 18).strokeColor(GRAY).stroke();
      pdf.fontSize(8).text("Customer signature", 50, y + 22).text("Date", 320, y + 22);
      y += 40;
    }

    // Footer
    if (d.kind === "INVOICE" && d.paymentLinkUrl && t.balance > 0) {
      pdf.font("Helvetica").fontSize(8.5).fillColor(DARK).text(`Pay online: ${d.paymentLinkUrl}`, 50, 716, { width: 512, align: "center" });
    }
    pdf.font("Helvetica-Oblique").fontSize(9).fillColor(GRAY).text(d.shop.invoiceFooter || "", 50, 730, { width: 512, align: "center" });
  });
}

export async function renderStatementPdf(opts: {
  shop: Shop;
  customer: Customer;
  rows: { number: string; date: Date; total: number; paid: number; balance: number }[];
}): Promise<Buffer> {
  const { shop, customer, rows } = opts;
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  return docToBuffer((pdf) => {
    let y = header(pdf, shop, "STATEMENT", [fmtDate(new Date())]);
    pdf.fontSize(8).fillColor(GRAY).font("Helvetica-Bold").text("FOR", 50, y);
    pdf.fontSize(11).fillColor(DARK).font("Helvetica-Bold").text(customer.name, 50, y + 12);
    y += 40;

    pdf.rect(50, y, 512, 20).fill(DARK);
    pdf.fontSize(8).fillColor("#FFFFFF").font("Helvetica-Bold");
    pdf.text("INVOICE #", 58, y + 6).text("DATE", 200, y + 6).text("TOTAL", 330, y + 6, { width: 60, align: "right" }).text("PAID", 410, y + 6, { width: 60, align: "right" }).text("BALANCE", 494, y + 6, { width: 60, align: "right" });
    y += 26;
    pdf.font("Helvetica").fontSize(9);
    for (const r of rows) {
      pdf.fillColor(DARK).text(r.number, 58, y).text(fmtDate(r.date), 200, y);
      pdf.text(fmtMoney(r.total), 330, y, { width: 60, align: "right" });
      pdf.text(fmtMoney(r.paid), 410, y, { width: 60, align: "right" });
      pdf.fillColor(ACCENT).text(fmtMoney(r.balance), 494, y, { width: 60, align: "right" });
      y += 16;
      pdf.moveTo(50, y - 4).lineTo(562, y - 4).strokeColor(LIGHT).stroke();
    }
    y += 8;
    pdf.font("Helvetica-Bold").fontSize(12).fillColor(ACCENT);
    pdf.text("TOTAL BALANCE DUE", 300, y, { width: 190, align: "right" });
    pdf.text(fmtMoney(totalBalance), 494, y, { width: 60, align: "right" });
    pdf.font("Helvetica-Oblique").fontSize(9).fillColor(GRAY).text(shop.invoiceFooter || "", 50, 730, { width: 512, align: "center" });
  });
}
