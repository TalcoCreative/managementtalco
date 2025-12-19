import jsPDF from "jspdf";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

interface MOMItem {
  no: number;
  keterangan: string;
  hasil: string;
}

interface MeetingData {
  title: string;
  meeting_date: string;
  start_time: string;
  end_time: string;
  location?: string;
  meeting_link?: string;
  mode: string;
  client?: { name: string };
  project?: { title: string };
  creator?: { full_name: string };
}

interface Participant {
  user?: { full_name: string };
  status: string;
}

interface ExternalParticipant {
  name: string;
  company?: string;
}

export const generateMOMPDF = (
  meeting: MeetingData,
  momItems: MOMItem[],
  participants: Participant[],
  externalParticipants: ExternalParticipant[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MINUTES OF MEETING", pageWidth / 2, y, { align: "center" });
  y += 15;

  // Meeting Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const meetingDate = format(parseISO(meeting.meeting_date), "EEEE, dd MMMM yyyy", { locale: id });
  const meetingTime = `${meeting.start_time.slice(0, 5)} - ${meeting.end_time.slice(0, 5)}`;

  // Info table
  const infoLines = [
    ["Judul Meeting", meeting.title],
    ["Tanggal", meetingDate],
    ["Waktu", meetingTime],
    ["Mode", meeting.mode === "online" ? "Online" : "Offline"],
  ];

  if (meeting.mode === "online" && meeting.meeting_link) {
    infoLines.push(["Link Meeting", meeting.meeting_link]);
  }
  if (meeting.mode === "offline" && meeting.location) {
    infoLines.push(["Lokasi", meeting.location]);
  }
  if (meeting.client) {
    infoLines.push(["Client", meeting.client.name]);
  }
  if (meeting.project) {
    infoLines.push(["Project", meeting.project.title]);
  }

  infoLines.forEach((row) => {
    doc.setFont("helvetica", "bold");
    doc.text(row[0] + ":", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(row[1], margin + 40, y);
    y += 6;
  });

  y += 10;

  // Participants Section
  doc.setFont("helvetica", "bold");
  doc.text("Peserta Meeting:", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  const attendedParticipants = participants.filter(p => p.status === "accepted");
  attendedParticipants.forEach((p) => {
    doc.text(`• ${p.user?.full_name || "Unknown"}`, margin + 5, y);
    y += 5;
  });

  if (externalParticipants.length > 0) {
    y += 3;
    doc.text("External:", margin + 5, y);
    y += 5;
    externalParticipants.forEach((p) => {
      const text = p.company ? `• ${p.name} (${p.company})` : `• ${p.name}`;
      doc.text(text, margin + 10, y);
      y += 5;
    });
  }

  y += 10;

  // MOM Table Header
  doc.setFont("helvetica", "bold");
  doc.text("Notulen Meeting:", margin, y);
  y += 8;

  // Table
  const colWidths = [15, 80, 70];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableWidth, 8, "F");
  doc.setDrawColor(0);
  doc.rect(margin, y, tableWidth, 8, "S");

  let xPos = margin;
  const headers = ["No.", "Keterangan", "Hasil"];
  headers.forEach((header, i) => {
    doc.rect(xPos, y, colWidths[i], 8, "S");
    doc.text(header, xPos + 2, y + 5.5);
    xPos += colWidths[i];
  });
  y += 8;

  // Data rows
  doc.setFont("helvetica", "normal");
  momItems.forEach((item) => {
    // Calculate row height based on text
    const keteranganLines = doc.splitTextToSize(item.keterangan, colWidths[1] - 4);
    const hasilLines = doc.splitTextToSize(item.hasil, colWidths[2] - 4);
    const maxLines = Math.max(keteranganLines.length, hasilLines.length, 1);
    const rowHeight = Math.max(8, maxLines * 5 + 3);

    // Check if we need a new page
    if (y + rowHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }

    xPos = margin;
    
    // No column
    doc.rect(xPos, y, colWidths[0], rowHeight, "S");
    doc.text(String(item.no), xPos + 2, y + 5.5);
    xPos += colWidths[0];

    // Keterangan column
    doc.rect(xPos, y, colWidths[1], rowHeight, "S");
    doc.text(keteranganLines, xPos + 2, y + 5);
    xPos += colWidths[1];

    // Hasil column
    doc.rect(xPos, y, colWidths[2], rowHeight, "S");
    doc.text(hasilLines, xPos + 2, y + 5);

    y += rowHeight;
  });

  y += 15;

  // Footer
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(`Dibuat oleh: ${meeting.creator?.full_name || "Unknown"}`, margin, y);
  y += 5;
  doc.text(`Tanggal cetak: ${format(new Date(), "dd MMMM yyyy HH:mm", { locale: id })}`, margin, y);

  // Save
  const fileName = `MOM_${meeting.title.replace(/[^a-zA-Z0-9]/g, "_")}_${format(parseISO(meeting.meeting_date), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
};
