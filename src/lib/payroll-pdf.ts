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
  let yPos = 20;

  // Load logo if available
  if (settings.logoUrl) {
    try {
      const logoData = await loadImage(settings.logoUrl);
      doc.addImage(logoData, "PNG", 15, 10, 30, 30);
    } catch (error) {
      console.log("Failed to load logo:", error);
    }
  }

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("HR Management – Payroll Sheets", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Rekapitulasi Gaji", pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Separator line
  doc.setLineWidth(0.5);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 15;

  // Employee Information
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DATA KARYAWAN", 15, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const infoLeft = 15;
  const infoRight = 55;
  
  doc.text("Nama", infoLeft, yPos);
  doc.text(`: ${payroll.employeeName}`, infoRight, yPos);
  yPos += 6;
  
  doc.text("Jabatan", infoLeft, yPos);
  doc.text(`: ${payroll.jabatan}`, infoRight, yPos);
  yPos += 6;
  
  doc.text("Periode", infoLeft, yPos);
  doc.text(`: ${payroll.periode}`, infoRight, yPos);
  yPos += 12;

  // Salary Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RINCIAN GAJI", 15, yPos);
  yPos += 8;

  // Table headers
  const tableStartY = yPos;
  const col1 = 15;
  const col2 = 120;
  const tableWidth = pageWidth - 30;

  doc.setFillColor(240, 240, 240);
  doc.rect(col1, yPos - 5, tableWidth, 8, "F");
  doc.setFontSize(10);
  doc.text("Komponen", col1 + 5, yPos);
  doc.text("Jumlah", col2 + 20, yPos);
  yPos += 10;

  doc.setFont("helvetica", "normal");
  
  // Salary components
  const components = [
    { name: "Gaji Pokok", value: payroll.gajiPokok },
    { name: "Tunjangan Transport", value: payroll.tjTransport },
    { name: "Tunjangan Internet", value: payroll.tjInternet },
    { name: "Tunjangan KPI", value: payroll.tjKpi },
  ];

  components.forEach((comp) => {
    doc.text(comp.name, col1 + 5, yPos);
    doc.text(formatCurrency(comp.value), col2 + 20, yPos);
    yPos += 7;
  });

  // Total line
  doc.setLineWidth(0.3);
  doc.line(col1, yPos, col1 + tableWidth, yPos);
  yPos += 6;

  doc.setFont("helvetica", "bold");
  doc.text("TOTAL GAJI", col1 + 5, yPos);
  doc.text(formatCurrency(payroll.totalGaji), col2 + 20, yPos);
  yPos += 10;

  // Terbilang
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const terbilangText = `Terbilang: ${terbilang(payroll.totalGaji).trim()} Rupiah`;
  doc.text(terbilangText, col1 + 5, yPos);
  yPos += 15;

  // Print date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const printDate = format(new Date(), "dd MMMM yyyy", { locale: id });
  doc.text(`Tanggal Cetak: ${printDate}`, col1, yPos);
  yPos += 20;

  // Signature section
  const sigCol1 = 30;
  const sigCol2 = pageWidth - 70;

  doc.setFont("helvetica", "bold");
  doc.text("Pemberi,", sigCol1, yPos);
  doc.text("Penerima,", sigCol2, yPos);
  yPos += 5;

  // HR Signature
  if (settings.signatureUrl) {
    try {
      const sigData = await loadImage(settings.signatureUrl);
      doc.addImage(sigData, "PNG", sigCol1 - 10, yPos, 40, 20);
    } catch (error) {
      console.log("Failed to load signature:", error);
    }
  }

  yPos += 25;

  doc.setFont("helvetica", "normal");
  doc.text(settings.hrName || "HR Manager", sigCol1, yPos);
  doc.text(payroll.employeeName, sigCol2, yPos);
  yPos += 5;
  
  doc.setFontSize(9);
  doc.text("Human Resources", sigCol1, yPos);

  // Save PDF
  const fileName = `Slip_Gaji_${payroll.employeeName.replace(/\s+/g, "_")}_${payroll.periode.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
};
