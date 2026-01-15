-- Add more company settings for payroll PDF customization
-- These will be stored as key-value pairs in the existing company_settings table

-- Insert default PDF settings if not exist
INSERT INTO company_settings (setting_key, setting_value) VALUES
  ('pdf_company_name', 'TALCO CREATIVE INDONESIA'),
  ('pdf_company_tagline', 'Creative Agency & Digital Marketing Solutions'),
  ('pdf_company_address', 'Jakarta, Indonesia'),
  ('pdf_document_title', 'SLIP GAJI KARYAWAN'),
  ('pdf_footer_text', 'Dokumen ini dicetak secara otomatis dan sah tanpa tanda tangan basah.'),
  ('pdf_giver_label', 'Pemberi,'),
  ('pdf_receiver_label', 'Penerima,'),
  ('pdf_giver_role', 'Human Resources'),
  ('pdf_receiver_role', 'Karyawan'),
  ('pdf_city', 'Jakarta'),
  ('pdf_logo_width', '35'),
  ('pdf_logo_height', '35'),
  ('pdf_primary_color', '41,128,185'),
  ('pdf_show_terbilang', 'true'),
  ('pdf_show_signature', 'true'),
  ('pdf_paper_size', 'a4'),
  ('pdf_orientation', 'portrait'),
  ('pdf_margin', '15'),
  ('pdf_header_font_size', '18'),
  ('pdf_body_font_size', '10')
ON CONFLICT (setting_key) DO NOTHING;