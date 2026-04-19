import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Invoice, InvoiceTemplate, PaymentMethod, formatIDR, INVOICE_STATUS_META } from "./invoice-types";

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(v, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInvoicePDF(invoice: Invoice, template: InvoiceTemplate | Partial<InvoiceTemplate>) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const primary = hexToRgb(template.primary_color || "#0f172a");
  const secondary = hexToRgb(template.secondary_color || "#64748b");

  // Header band
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, pageWidth, 38, "F");

  // Logo (custom override > template logo)
  const logoUrl = invoice.custom_logo_url || template.logo_url || null;
  if (logoUrl) {
    const dataUrl = await loadImageAsDataUrl(logoUrl);
    if (dataUrl) {
      try {
        // Fixed container 24x24mm, contained
        doc.addImage(dataUrl, "PNG", margin, 7, 24, 24, undefined, "FAST");
      } catch {
        /* ignore */
      }
    }
  }

  // Entity name + tagline
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(template.entity_name || template.name || "INVOICE", margin + 28, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const ci = template.company_info || {};
  const headerLines = [ci.address, [ci.email, ci.phone].filter(Boolean).join(" • "), ci.website]
    .filter(Boolean)
    .join("  |  ");
  if (headerLines) doc.text(headerLines, margin + 28, 22, { maxWidth: pageWidth - margin - 28 - 50 });

  // Right side: INVOICE label + number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("INVOICE", pageWidth - margin, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(invoice.invoice_number, pageWidth - margin, 22, { align: "right" });
  const meta = INVOICE_STATUS_META[invoice.status];
  doc.text(meta.label.toUpperCase(), pageWidth - margin, 28, { align: "right" });

  // Body start
  let y = 50;

  // Bill To + Dates
  doc.setTextColor(secondary[0], secondary[1], secondary[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("BILL TO", margin, y);
  doc.text("ISSUE DATE", pageWidth - margin - 50, y);
  doc.text("DUE DATE", pageWidth - margin, y, { align: "right" });

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(invoice.bill_to_name, margin, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let bty = y + 11;
  if (invoice.bill_to_company) {
    doc.text(invoice.bill_to_company, margin, bty);
    bty += 5;
  }
  if (invoice.bill_to_address) {
    const addrLines = doc.splitTextToSize(invoice.bill_to_address, 90);
    doc.text(addrLines, margin, bty);
    bty += addrLines.length * 4;
  }
  if (invoice.bill_to_email) {
    doc.text(invoice.bill_to_email, margin, bty);
    bty += 4.5;
  }
  if (invoice.bill_to_phone) {
    doc.text(invoice.bill_to_phone, margin, bty);
    bty += 4.5;
  }

  doc.setFontSize(10);
  doc.text(invoice.issue_date, pageWidth - margin - 50, y + 6);
  doc.text(invoice.due_date || "-", pageWidth - margin, y + 6, { align: "right" });

  y = Math.max(bty, y + 30) + 4;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: invoice.items.map((it) => [
      it.description,
      String(it.quantity),
      formatIDR(it.unit_price),
      formatIDR(it.amount),
    ]),
    theme: "striped",
    headStyles: { fillColor: primary, textColor: 255, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  });

  let afterTable = (doc as any).lastAutoTable.finalY + 6;

  // Totals box
  const totalsX = pageWidth - margin - 70;
  const drawRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9);
    doc.text(label, totalsX, afterTable);
    doc.text(value, pageWidth - margin, afterTable, { align: "right" });
    afterTable += bold ? 7 : 5.5;
  };
  doc.setTextColor(20, 20, 20);
  drawRow("Subtotal", formatIDR(invoice.subtotal));
  if (invoice.discount_amount > 0) drawRow("Discount", `- ${formatIDR(invoice.discount_amount)}`);
  if (invoice.tax_amount > 0) drawRow(`Tax (${invoice.tax_percent}%)`, formatIDR(invoice.tax_amount));
  // Divider
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.5);
  doc.line(totalsX, afterTable - 2, pageWidth - margin, afterTable - 2);
  afterTable += 2;
  drawRow("TOTAL", formatIDR(invoice.total), true);

  let blockY = afterTable + 8;

  // Payment methods
  const enabledIds = new Set(invoice.enabled_payment_method_ids || []);
  const allMethods: PaymentMethod[] = (template.payment_methods || []) as PaymentMethod[];
  const methods = allMethods.filter((m) => m.enabled && (enabledIds.size === 0 || enabledIds.has(m.id)));

  if (methods.length > 0) {
    doc.setTextColor(secondary[0], secondary[1], secondary[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("PAYMENT METHODS", margin, blockY);
    blockY += 5;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    methods.forEach((m) => {
      let line = `• ${m.label}`;
      if (m.type === "bank") {
        const parts = [m.bank_name, m.account_number, m.account_name].filter(Boolean).join(" - ");
        if (parts) line += `: ${parts}`;
      } else if (m.notes) {
        line += `: ${m.notes}`;
      }
      const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
      doc.text(wrapped, margin, blockY);
      blockY += wrapped.length * 4.5 + 1;
    });
    blockY += 3;
  }

  // Notes
  if (invoice.notes) {
    if (blockY > pageHeight - 40) {
      doc.addPage();
      blockY = 20;
    }
    doc.setTextColor(secondary[0], secondary[1], secondary[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("NOTES", margin, blockY);
    blockY += 5;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(lines, margin, blockY);
    blockY += lines.length * 4.5 + 4;
  }

  // Terms
  if (invoice.terms) {
    if (blockY > pageHeight - 30) {
      doc.addPage();
      blockY = 20;
    }
    doc.setTextColor(secondary[0], secondary[1], secondary[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("TERMS & CONDITIONS", margin, blockY);
    blockY += 5;
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(invoice.terms, pageWidth - margin * 2);
    doc.text(lines, margin, blockY);
  }

  // Footer
  const footerY = pageHeight - 8;
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(secondary[0], secondary[1], secondary[2]);
  doc.text(
    `${template.entity_name || ""}  •  Generated by Talco Management System`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  doc.save(`${invoice.invoice_number.replace(/\//g, "-")}.pdf`);
}
