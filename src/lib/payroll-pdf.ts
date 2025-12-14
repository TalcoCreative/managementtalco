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
  totalGaji: number;
  payDate: string;
}

interface CompanySettings {
  logoUrl?: string | null;
  signatureUrl?: string | null;
  hrName?: string;
}

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

export const generatePayrollPDF = async (
  payroll: PayrollData,
  settings: CompanySettings
): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 15;

  // === KOP SURAT / LETTERHEAD ===
  
  // Load and place logo if available
  if (settings.logoUrl) {
    try {
      const logoData = await loadImage(settings.logoUrl);
      doc.addImage(logoData, "PNG", margin, yPos, 35, 35);
    } catch (error) {
      console.log("Failed to load logo:", error);
    }
  }

  // Company Name - positioned to the right of logo
  const textStartX = settings.logoUrl ? margin + 42 : margin;
  
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185); // Blue color
  doc.text("TALCO CREATIVE INDONESIA", textStartX, yPos + 12);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Creative Agency & Digital Marketing Solutions", textStartX, yPos + 20);
  doc.text("Jakarta, Indonesia", textStartX, yPos + 26);

  yPos = 55;

  // Separator line
  doc.setDrawColor(41, 128, 185);
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
  doc.text("SLIP GAJI KARYAWAN", pageWidth / 2, yPos, { align: "center" });
  yPos += 6;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Periode: ${payroll.periode}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // === EMPLOYEE DATA ===
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
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

  doc.setFillColor(41, 128, 185);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, yPos - 5, tableWidth, 10, "F");
  doc.setFontSize(10);
  doc.text("Komponen Gaji", margin + 5, yPos + 1);
  doc.text("Jumlah", margin + colWidth1 + 5, yPos + 1);
  yPos += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  // Salary rows
  const salaryItems = [
    { label: "Gaji Pokok", value: payroll.gajiPokok },
    { label: "Tunjangan Transport", value: payroll.tjTransport },
    { label: "Tunjangan Internet", value: payroll.tjInternet },
    { label: "Tunjangan KPI", value: payroll.tjKpi },
  ];

  salaryItems.forEach((item, index) => {
    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, yPos - 4, tableWidth, 8, "F");
    }
    
    doc.text(item.label, margin + 5, yPos);
    doc.text(formatCurrency(item.value), margin + colWidth1 + 5, yPos);
    yPos += 8;
  });

  // Total row
  doc.setFillColor(41, 128, 185);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, yPos - 4, tableWidth, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL GAJI", margin + 5, yPos + 1);
  doc.text(formatCurrency(payroll.totalGaji), margin + colWidth1 + 5, yPos + 1);
  yPos += 15;

  // Terbilang
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const terbilangText = `Terbilang: ${terbilang(payroll.totalGaji).trim()} Rupiah`;
  
  // Word wrap for terbilang
  const splitText = doc.splitTextToSize(terbilangText, tableWidth - 10);
  doc.text(splitText, margin + 5, yPos);
  yPos += splitText.length * 5 + 10;

  // === FOOTER ===
  // Print date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const printDate = format(new Date(), "dd MMMM yyyy", { locale: id });
  doc.text(`Jakarta, ${printDate}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 15;

  // Signature section
  const sigCol1 = margin + 20;
  const sigCol2 = pageWidth - margin - 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Pemberi,", sigCol1, yPos);
  doc.text("Penerima,", sigCol2, yPos);
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
  doc.text(settings.hrName || "HR Manager", sigCol1, yPos);
  doc.text(payroll.employeeName, sigCol2, yPos);
  
  // Underlines
  const hrNameWidth = doc.getTextWidth(settings.hrName || "HR Manager");
  const empNameWidth = doc.getTextWidth(payroll.employeeName);
  doc.line(sigCol1, yPos + 1, sigCol1 + hrNameWidth, yPos + 1);
  doc.line(sigCol2, yPos + 1, sigCol2 + empNameWidth, yPos + 1);
  
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Human Resources", sigCol1, yPos);
  doc.text("Karyawan", sigCol2, yPos);

  // === FOOTER NOTE ===
  yPos = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Dokumen ini dicetak secara otomatis dan sah tanpa tanda tangan basah.", pageWidth / 2, yPos, { align: "center" });

  // Save PDF
  const fileName = `SlipGaji_${payroll.employeeName.replace(/\s+/g, "_")}_${payroll.periode.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
};
