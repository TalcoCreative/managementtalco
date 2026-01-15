import jsPDF from "jspdf";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface PayrollData {
  employeeName: string;
  jabatan: string;
  periode: string;
  gajiPokok: number;
  tjTransport: number;
  tjInternet: number;
  tjKpi: number;
  reimburse?: number;
  bonus?: number;
  potonganTerlambat?: number;
  potonganKasbon?: number;
  adjustmentLainnya?: number;
  totalGaji: number;
  payDate: string;
}

interface PdfSettings {
  // Company Info
  logoUrl?: string | null;
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  city: string;
  
  // Document
  documentTitle: string;
  footerText: string;
  showTerbilang: boolean;
  
  // Signature
  signatureUrl?: string | null;
  hrName: string;
  giverLabel: string;
  receiverLabel: string;
  giverRole: string;
  receiverRole: string;
  showSignature: boolean;
  
  // Styling
  logoWidth: number;
  logoHeight: number;
  primaryColor: [number, number, number];
  headerFontSize: number;
  bodyFontSize: number;
  margin: number;
  
  // Paper
  paperSize: "a4" | "letter" | "legal";
  orientation: "portrait" | "landscape";
}

// Default settings - logo size in mm for PDF
const defaultPdfSettings: PdfSettings = {
  companyName: "TALCO CREATIVE INDONESIA",
  companyTagline: "Creative Agency & Digital Marketing Solutions",
  companyAddress: "Jakarta, Indonesia",
  city: "Jakarta",
  documentTitle: "SLIP GAJI KARYAWAN",
  footerText: "Dokumen ini dicetak secara otomatis dan sah tanpa tanda tangan basah.",
  showTerbilang: true,
  hrName: "HR Manager",
  giverLabel: "Pemberi,",
  receiverLabel: "Penerima,",
  giverRole: "Human Resources",
  receiverRole: "Karyawan",
  showSignature: true,
  logoWidth: 40,  // Larger default for better visibility
  logoHeight: 40,
  primaryColor: [41, 128, 185],
  headerFontSize: 18,
  bodyFontSize: 10,
  margin: 15,
  paperSize: "a4",
  orientation: "portrait",
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

const terbilang = (num: number): string => {
  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  
  if (num < 12) return satuan[num];
  if (num < 20) return satuan[num - 10] + " Belas";
  if (num < 100) return satuan[Math.floor(num / 10)] + " Puluh " + satuan[num % 10];
  if (num < 200) return "Seratus " + terbilang(num - 100);
  if (num < 1000) return satuan[Math.floor(num / 100)] + " Ratus " + terbilang(num % 100);
  if (num < 2000) return "Seribu " + terbilang(num - 1000);
  if (num < 1000000) return terbilang(Math.floor(num / 1000)) + " Ribu " + terbilang(num % 1000);
  if (num < 1000000000) return terbilang(Math.floor(num / 1000000)) + " Juta " + terbilang(num % 1000000);
  if (num < 1000000000000) return terbilang(Math.floor(num / 1000000000)) + " Miliar " + terbilang(num % 1000000000);
  return terbilang(Math.floor(num / 1000000000000)) + " Triliun " + terbilang(num % 1000000000000);
};

const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
};

// Helper to parse RGB color from settings
const parseColorFromSettings = (colorStr?: string): [number, number, number] => {
  if (!colorStr) return [41, 128, 185];
  const parts = colorStr.split(",").map(p => parseInt(p.trim()));
  if (parts.length === 3 && parts.every(p => !isNaN(p))) {
    return [parts[0], parts[1], parts[2]];
  }
  return [41, 128, 185];
};

// Convert company settings map to PdfSettings
export const mapCompanySettingsToPdfSettings = (
  settingsMap: Record<string, string | null>
): PdfSettings => {
  return {
    logoUrl: settingsMap.company_logo,
    companyName: settingsMap.pdf_company_name || defaultPdfSettings.companyName,
    companyTagline: settingsMap.pdf_company_tagline || defaultPdfSettings.companyTagline,
    companyAddress: settingsMap.pdf_company_address || defaultPdfSettings.companyAddress,
    city: settingsMap.pdf_city || defaultPdfSettings.city,
    documentTitle: settingsMap.pdf_document_title || defaultPdfSettings.documentTitle,
    footerText: settingsMap.pdf_footer_text || defaultPdfSettings.footerText,
    showTerbilang: settingsMap.pdf_show_terbilang !== "false",
    signatureUrl: settingsMap.hr_signature,
    hrName: settingsMap.hr_name || defaultPdfSettings.hrName,
    giverLabel: settingsMap.pdf_giver_label || defaultPdfSettings.giverLabel,
    receiverLabel: settingsMap.pdf_receiver_label || defaultPdfSettings.receiverLabel,
    giverRole: settingsMap.pdf_giver_role || defaultPdfSettings.giverRole,
    receiverRole: settingsMap.pdf_receiver_role || defaultPdfSettings.receiverRole,
    showSignature: settingsMap.pdf_show_signature !== "false",
    logoWidth: Number(settingsMap.pdf_logo_width) || defaultPdfSettings.logoWidth,
    logoHeight: Number(settingsMap.pdf_logo_height) || defaultPdfSettings.logoHeight,
    primaryColor: parseColorFromSettings(settingsMap.pdf_primary_color ?? undefined),
    headerFontSize: Number(settingsMap.pdf_header_font_size) || defaultPdfSettings.headerFontSize,
    bodyFontSize: Number(settingsMap.pdf_body_font_size) || defaultPdfSettings.bodyFontSize,
    margin: Number(settingsMap.pdf_margin) || defaultPdfSettings.margin,
    paperSize: (settingsMap.pdf_paper_size as "a4" | "letter" | "legal") || defaultPdfSettings.paperSize,
    orientation: (settingsMap.pdf_orientation as "portrait" | "landscape") || defaultPdfSettings.orientation,
  };
};

export const generatePayrollPDF = async (
  payroll: PayrollData,
  settingsMap: Record<string, string | null>
): Promise<void> => {
  const settings = mapCompanySettingsToPdfSettings(settingsMap);
  const [r, g, b] = settings.primaryColor;
  
  const doc = new jsPDF({
    format: settings.paperSize,
    orientation: settings.orientation,
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = settings.margin;
  let yPos = margin;

  // === KOP SURAT / LETTERHEAD ===
  
  // Load and place logo if available
  if (settings.logoUrl) {
    try {
      const logoData = await loadImage(settings.logoUrl);
      doc.addImage(logoData, "PNG", margin, yPos, settings.logoWidth, settings.logoHeight);
    } catch (error) {
      console.log("Failed to load logo:", error);
    }
  }

  // Company Name - positioned to the right of logo
  const textStartX = settings.logoUrl ? margin + settings.logoWidth + 7 : margin;
  
  doc.setFontSize(settings.headerFontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(r, g, b);
  doc.text(settings.companyName, textStartX, yPos + 12);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(settings.companyTagline, textStartX, yPos + 20);
  
  // Handle multi-line address
  const addressLines = settings.companyAddress.split("\n");
  let addressY = yPos + 26;
  addressLines.forEach(line => {
    doc.text(line, textStartX, addressY);
    addressY += 5;
  });

  yPos = Math.max(margin + settings.logoHeight, addressY) + 10;

  // Separator line
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(1);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 3;
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // === DOCUMENT TITLE ===
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(settings.documentTitle, pageWidth / 2, yPos, { align: "center" });
  yPos += 6;
  
  doc.setFontSize(settings.bodyFontSize);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Periode: ${payroll.periode}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // === EMPLOYEE DATA ===
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(settings.bodyFontSize);
  
  // Box for employee info
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(margin, yPos - 5, pageWidth - (margin * 2), 28, 3, 3, "F");
  
  const col1 = margin + 5;
  const col2 = margin + 45;
  
  doc.setFont("helvetica", "normal");
  doc.text("Nama Karyawan", col1, yPos + 3);
  doc.setFont("helvetica", "bold");
  doc.text(`: ${payroll.employeeName}`, col2, yPos + 3);
  
  doc.setFont("helvetica", "normal");
  doc.text("Jabatan", col1, yPos + 11);
  doc.setFont("helvetica", "bold");
  doc.text(`: ${payroll.jabatan}`, col2, yPos + 11);
  
  doc.setFont("helvetica", "normal");
  doc.text("Periode Gaji", col1, yPos + 19);
  doc.setFont("helvetica", "bold");
  doc.text(`: ${payroll.periode}`, col2, yPos + 19);

  yPos += 35;

  // === SALARY TABLE ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RINCIAN GAJI", margin, yPos);
  yPos += 8;

  // Table header
  const tableWidth = pageWidth - (margin * 2);
  const colWidth1 = tableWidth * 0.6;
  const colWidth2 = tableWidth * 0.4;

  doc.setFillColor(r, g, b);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, yPos - 5, tableWidth, 10, "F");
  doc.setFontSize(settings.bodyFontSize);
  doc.text("Komponen Gaji", margin + 5, yPos + 1);
  doc.text("Jumlah", margin + colWidth1 + 5, yPos + 1);
  yPos += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  // Salary rows - Income
  const incomeItems = [
    { label: "Gaji Pokok", value: payroll.gajiPokok },
    { label: "Tunjangan Transport", value: payroll.tjTransport },
    { label: "Tunjangan Internet", value: payroll.tjInternet },
    { label: "Tunjangan KPI", value: payroll.tjKpi },
  ];

  // Add optional income items
  if (payroll.reimburse && payroll.reimburse > 0) {
    incomeItems.push({ label: "Reimburse", value: payroll.reimburse });
  }
  if (payroll.bonus && payroll.bonus > 0) {
    incomeItems.push({ label: "Bonus", value: payroll.bonus });
  }
  if (payroll.adjustmentLainnya && payroll.adjustmentLainnya > 0) {
    incomeItems.push({ label: "Adjustment Lainnya (+)", value: payroll.adjustmentLainnya });
  }

  let rowIndex = 0;
  incomeItems.forEach((item) => {
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, yPos - 4, tableWidth, 8, "F");
    }
    
    doc.text(item.label, margin + 5, yPos);
    doc.text(formatCurrency(item.value), margin + colWidth1 + 5, yPos);
    yPos += 8;
    rowIndex++;
  });

  // Deductions
  const deductionItems: { label: string; value: number }[] = [];
  if (payroll.potonganTerlambat && payroll.potonganTerlambat > 0) {
    deductionItems.push({ label: "Potongan Terlambat", value: -payroll.potonganTerlambat });
  }
  if (payroll.potonganKasbon && payroll.potonganKasbon > 0) {
    deductionItems.push({ label: "Potongan Kasbon", value: -payroll.potonganKasbon });
  }

  if (deductionItems.length > 0) {
    deductionItems.forEach((item) => {
      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, yPos - 4, tableWidth, 8, "F");
      }
      
      doc.setTextColor(200, 0, 0);
      doc.text(item.label, margin + 5, yPos);
      doc.text(formatCurrency(item.value), margin + colWidth1 + 5, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 8;
      rowIndex++;
    });
  }

  // Total row
  doc.setFillColor(r, g, b);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, yPos - 4, tableWidth, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL GAJI", margin + 5, yPos + 1);
  doc.text(formatCurrency(payroll.totalGaji), margin + colWidth1 + 5, yPos + 1);
  yPos += 15;

  // Terbilang
  if (settings.showTerbilang) {
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const terbilangText = `Terbilang: ${terbilang(payroll.totalGaji).trim()} Rupiah`;
    
    const splitText = doc.splitTextToSize(terbilangText, tableWidth - 10);
    doc.text(splitText, margin + 5, yPos);
    yPos += splitText.length * 5 + 10;
  } else {
    yPos += 5;
  }

  // === FOOTER ===
  // Print date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const printDate = format(new Date(), "dd MMMM yyyy", { locale: id });
  doc.setTextColor(0, 0, 0);
  doc.text(`${settings.city}, ${printDate}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 15;

  // Signature section
  if (settings.showSignature) {
    const sigCol1 = margin + 20;
    const sigCol2 = pageWidth - margin - 50;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(settings.bodyFontSize);
    doc.text(settings.giverLabel, sigCol1, yPos);
    doc.text(settings.receiverLabel, sigCol2, yPos);
    yPos += 5;

    // HR Signature image
    if (settings.signatureUrl) {
      try {
        const sigData = await loadImage(settings.signatureUrl);
        doc.addImage(sigData, "PNG", sigCol1 - 10, yPos, 45, 22);
      } catch (error) {
        console.log("Failed to load signature:", error);
      }
    }

    yPos += 28;

    // Names with underline
    doc.setFont("helvetica", "bold");
    doc.text(settings.hrName, sigCol1, yPos);
    doc.text(payroll.employeeName, sigCol2, yPos);
    
    // Underlines
    const hrNameWidth = doc.getTextWidth(settings.hrName);
    const empNameWidth = doc.getTextWidth(payroll.employeeName);
    doc.line(sigCol1, yPos + 1, sigCol1 + hrNameWidth, yPos + 1);
    doc.line(sigCol2, yPos + 1, sigCol2 + empNameWidth, yPos + 1);
    
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(settings.giverRole, sigCol1, yPos);
    doc.text(settings.receiverRole, sigCol2, yPos);
  }

  // === FOOTER NOTE ===
  yPos = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(settings.footerText, pageWidth / 2, yPos, { align: "center" });

  // Save PDF
  const fileName = `SlipGaji_${payroll.employeeName.replace(/\s+/g, "_")}_${payroll.periode.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
};
