import * as XLSX from 'xlsx';
import { toast } from 'sonner';

// Export data to Excel
export const exportToExcel = (
  data: any[],
  columns: { key: string; header: string }[],
  filename: string
) => {
  if (data.length === 0) {
    toast.error("Tidak ada data untuk diekspor");
    return;
  }

  // Transform data to include only specified columns with headers
  const exportData = data.map(item => {
    const row: Record<string, any> = {};
    columns.forEach(col => {
      row[col.header] = item[col.key] ?? '';
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');

  // Auto-fit column widths
  const colWidths = columns.map(col => ({
    wch: Math.max(col.header.length, 15)
  }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast.success("Data berhasil diekspor ke Excel");
};

// Download template Excel
export const downloadTemplate = (
  columns: { key: string; header: string; example?: string }[],
  filename: string
) => {
  // Create template with headers and one example row
  const templateData = [
    columns.reduce((acc, col) => {
      acc[col.header] = col.example || '';
      return acc;
    }, {} as Record<string, any>)
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');

  // Auto-fit column widths
  const colWidths = columns.map(col => ({
    wch: Math.max(col.header.length, col.example?.length || 0, 20)
  }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `template_${filename}.xlsx`);
  toast.success("Template berhasil didownload");
};

// Parse Excel file and return data
export const parseExcelFile = (
  file: File,
  columns: { key: string; header: string }[]
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Map headers back to keys
        const headerToKey: Record<string, string> = {};
        columns.forEach(col => {
          headerToKey[col.header] = col.key;
        });

        const mappedData = jsonData.map((row: any) => {
          const mappedRow: Record<string, any> = {};
          Object.keys(row).forEach(header => {
            const key = headerToKey[header];
            if (key) {
              mappedRow[key] = row[header];
            }
          });
          return mappedRow;
        });

        resolve(mappedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsBinaryString(file);
  });
};

// Column definitions for each entity
export const USER_COLUMNS = [
  { key: 'full_name', header: 'Nama Lengkap', example: 'John Doe' },
  { key: 'email', header: 'Email', example: 'john@example.com' },
  { key: 'phone', header: 'No. Telepon', example: '081234567890' },
  { key: 'address', header: 'Alamat', example: 'Jl. Contoh No. 123' },
  { key: 'ktp_number', header: 'No. KTP', example: '3201234567890001' },
  { key: 'bank_account_name', header: 'Nama Bank', example: 'BCA' },
  { key: 'bank_account_number', header: 'No. Rekening', example: '1234567890' },
  { key: 'gaji_pokok', header: 'Gaji Pokok', example: '5000000' },
  { key: 'tj_transport', header: 'Tj. Transport', example: '500000' },
  { key: 'tj_internet', header: 'Tj. Internet', example: '200000' },
  { key: 'tj_kpi', header: 'Tj. KPI', example: '300000' },
  { key: 'contract_start', header: 'Tanggal Mulai Kontrak', example: '2024-01-01' },
  { key: 'contract_end', header: 'Tanggal Selesai Kontrak', example: '2025-01-01' },
  { key: 'emergency_contact', header: 'Kontak Darurat', example: '081234567891' },
  { key: 'status', header: 'Status', example: 'active' },
];

export const CANDIDATE_COLUMNS = [
  { key: 'full_name', header: 'Nama Lengkap', example: 'John Doe' },
  { key: 'email', header: 'Email', example: 'john@example.com' },
  { key: 'phone', header: 'No. Telepon', example: '081234567890' },
  { key: 'position', header: 'Posisi', example: 'Graphic Designer' },
  { key: 'division', header: 'Divisi', example: 'Creative' },
  { key: 'location', header: 'Lokasi', example: 'Jakarta' },
  { key: 'cv_url', header: 'Link CV', example: 'https://drive.google.com/...' },
  { key: 'portfolio_url', header: 'Link Portfolio', example: 'https://portfolio.com/...' },
  { key: 'status', header: 'Status', example: 'applied' },
];

export const PROSPECT_COLUMNS = [
  { key: 'contact_name', header: 'Nama Kontak', example: 'John Doe' },
  { key: 'company', header: 'Perusahaan', example: 'PT. Example' },
  { key: 'email', header: 'Email', example: 'john@example.com' },
  { key: 'phone', header: 'No. Telepon', example: '081234567890' },
  { key: 'location', header: 'Lokasi', example: 'Jakarta' },
  { key: 'source', header: 'Sumber', example: 'referral' },
  { key: 'product_service', header: 'Produk/Jasa', example: 'Social Media Management' },
  { key: 'needs', header: 'Kebutuhan', example: 'Butuh pengelolaan sosmed' },
  { key: 'status', header: 'Status', example: 'new' },
];

export const ATTENDANCE_COLUMNS = [
  { key: 'employee_name', header: 'Nama Karyawan', example: 'John Doe' },
  { key: 'date', header: 'Tanggal', example: '2024-01-15' },
  { key: 'clock_in', header: 'Jam Masuk', example: '08:00' },
  { key: 'clock_out', header: 'Jam Keluar', example: '17:00' },
  { key: 'notes', header: 'Catatan', example: 'WFH' },
];

export const PAYROLL_COLUMNS = [
  { key: 'employee_name', header: 'Nama Karyawan', example: 'John Doe' },
  { key: 'month', header: 'Bulan', example: '2024-01-01' },
  { key: 'amount', header: 'Gaji Pokok', example: '5000000' },
  { key: 'bonus', header: 'Bonus', example: '500000' },
  { key: 'potongan_terlambat', header: 'Potongan Terlambat', example: '0' },
  { key: 'potongan_kasbon', header: 'Potongan Kasbon', example: '0' },
  { key: 'adjustment_lainnya', header: 'Adjustment Lainnya', example: '0' },
  { key: 'reimburse', header: 'Reimburse', example: '0' },
  { key: 'status', header: 'Status', example: 'pending' },
];
