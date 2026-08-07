# Talent Management (/talent)

Modul baru untuk mengelola database talent (model/talent shooting), mirip pola KOL: data lengkap, satu harga, bisa di-assign ke jadwal shooting, ada form publik untuk pendaftaran mandiri, dan halaman publik untuk dikirim ke klien.

## 1. Database Talent

Tabel baru `talents` dengan field:

- Identitas: nama, nomor HP, email (opsional), kota/domisili, gender, tanggal lahir, instagram, link portfolio
- Foto: foto utama + galeri foto (multi foto, disimpan di storage bucket baru `talent-photos`, publik)
- Ukuran: tinggi (cm), berat (kg), ukuran sepatu, ukuran baju, ukuran celana, lingkar pinggang/dada (opsional semua)
- Komersial: satu field `rate` (harga per hari/job) + catatan
- Operasional: kategori/spesialisasi (mis. Model, Talent Iklan, Host, Dancer), status (active / inactive), notes, `source` (manual / form publik)

Semua field selain nama bersifat opsional supaya form publik ringan.

## 2. Halaman /talent (internal)

- Tabel/grid talent dengan foto thumbnail, nama, kontak, ukuran ringkas, rate, kategori, status
- Search (nama/HP/instagram) + filter kategori, status, dan rentang rate
- Tambah / edit / arsip talent, upload foto (multi)
- Detail talent: semua data diri, galeri foto, link porto, riwayat shooting yang pernah dia ikuti
- Menu masuk grup navigasi yang sama dengan KOL, dengan feature key `talent` di sistem RBAC (Super Admin bypass seperti biasa)

## 3. Assign talent ke shooting

- Tabel pivot `shooting_talents` (shooting_id, talent_id, role/keterangan, fee aktual opsional yang default-nya diisi dari rate talent)
- Di dialog Create/Edit Shooting: section "Talent" untuk memilih satu atau lebih talent (searchable, menampilkan foto + rate)
- Di detail shooting: daftar talent yang terlibat beserta kontak dan fee
- Di detail talent: daftar shooting yang pernah/akan dia ikuti

## 4. Form publik pendaftaran talent

- Tambah template form baru `talent` di Form Builder (sejajar dengan template `kol` yang sudah ada)
- Saat memilih template ini, pertanyaan otomatis di-seed: nama lengkap, nomor HP, email, kota, instagram, link portfolio, upload foto, tinggi, berat, ukuran sepatu, ukuran baju, ukuran celana, kategori, catatan — hanya nama dan nomor HP wajib, sisanya opsional
- Submit dari publik langsung membuat record di `talents` (status active, source = form publik), sama seperti alur KOL sekarang
- Foto yang diupload lewat form ikut tersimpan sebagai foto talent

## 5. Halaman publik talent (shareable)

- Rute publik `/talent-list/:token` (token per link, bisa digenerate dari halaman /talent) menampilkan katalog talent read-only: foto, nama, kategori, ukuran, rate (opsional bisa disembunyikan), link porto
- Tanpa login, dibaca lewat edge function service-role seperti pola halaman publik lain
- Tombol "Share" di /talent untuk copy link (domain `ms.talco.id`)

## Catatan teknis

- Migrasi: `talents`, `shooting_talents`, plus GRANT untuk `authenticated`/`service_role`, RLS (authenticated boleh kelola; publik tidak baca langsung — pembacaan publik lewat edge function), trigger `set_updated_at`
- Insert dari form publik dilakukan di edge function `talent-form-submit` memakai service role (mengikuti pola `kol-form-submit`), jadi tidak perlu melonggarkan RLS untuk anon
- Bucket storage baru `talent-photos` (publik) untuk foto talent, dipakai baik dari admin maupun form publik
- Edge function baru `public-talents` untuk katalog publik berbasis token
- File baru utama: `src/pages/Talent.tsx`, `src/components/talent/*` (CreateTalentDialog, EditTalentDialog, TalentDetailDialog, TalentPicker), `src/pages/PublicTalentList.tsx`
- File yang disentuh: `src/App.tsx` (rute), `src/components/layout/nav-config.ts`, `src/pages/Forms.tsx` + `src/pages/PublicForm.tsx` (template talent), dialog Create/Edit/Detail Shooting
- Verifikasi sebelum selesai: buat talent manual, submit form publik sebagai anon, assign ke shooting, dan buka link publik tanpa sesi login
