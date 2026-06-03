# Reorganisasi Navigasi & Header Page Immersive

Tiga perubahan besar yang saling terkait:

## 1. Hilangkan tombol "+" Floating (FAB)

- Hapus pemanggilan `<FloatingActionButton />` dari `src/components/layout/AppLayout.tsx` di semua page.
- File `FloatingActionButton.tsx` dibiarkan ada tapi tidak dipakai (agar event listener `fab-action` di page lain tetap aman).

## 2. Restrukturisasi Sidebar Navigation (`src/components/layout/nav-config.ts`)

Kategorisasi baru — setiap kategori utama buka subpage dengan tab di dalamnya, bukan sekadar list flat.

```text
Home
 ├─ Dashboard
 ├─ Schedule
 └─ Personal Notes

Chat

Work
 ├─ Clients
 ├─ Projects
 ├─ Tasks
 ├─ Shooting
 ├─ Meeting
 └─ Event

People                              ← di-breakdown jadi sub-grup
 ├─ Team           (Employee, HR Dashboard, HR Analytics)
 ├─ Time Off       (Leave, Holiday Calendar)
 ├─ Performance    (Performance, Asset, Reimburse)
 └─ Recruitment    (Recruitment, Recruitment Board, Recruitment Forms)

Marketing                           ← dipisah jadi 3 kategori top-level
Social Media        (Social Media, Editorial Plan)
Content             (Content Builder)
KOL                 (KOL Database, KOL Campaign)

Sales
 ├─ Prospects, My Prospects
 ├─ My Sales Dashboard, Sales Analytics
 ├─ My Commission, Sales Admin
 └─ Ads Budget

Finance
 ├─ Finance, Income Statement, Balance Sheet, Invoices

Reports                             ← khusus laporan klien
 ├─ Reports
 ├─ CEO Dashboard
 └─ Form Builder

Documents                           ← Letters dipisah dari Reports
 └─ Letters

Culture                             ← jadi subpage
 ├─ Monthly Team Review
 └─ Team Review Settings

System                              ← jadi subpage
 ├─ Profile Settings
 ├─ Email Settings
 ├─ WA Notification Log
 ├─ Role & Access
 ├─ Location Settings
 ├─ Invoice Templates
 └─ System Settings
```

## 3. Immersive Page Headers + Sub-Tab Navigation

Buat komponen baru `src/components/layout/PageHeader.tsx`:

- Hero-style header: gradient atmospheric (semantic tokens), icon tile berwarna sesuai kategori, judul besar, deskripsi, optional action slot di kanan.
- Tab sub-navigasi inline di bawah judul (pakai `NavLink` ke sibling routes dalam kategori yang sama).
- Mobile-friendly: scroll horizontal untuk tab, tetap pakai 100dvh / safe-area.

Tab dihitung otomatis dari `nav-config.ts`: header membaca kategori aktif berdasarkan `location.pathname` lalu render `cat.items` sebagai chip-tab.

Rollout: ganti header lama (heading + subtitle text manual) di page-page utama dengan `<PageHeader title="..." description="..." icon={...} />`. Page yang sudah punya header custom rumit (Dashboard, Reports lama) tetap dipertahankan; sisanya migrasi.

Page yang akan dimigrasi ke `PageHeader` (batch awal):
Schedule, Clients, Projects, Tasks, Shooting, Meeting, Event, Users, HRDashboard, HRAnalytics, Leave, MyReimbursement, Asset, Performance, Holiday, Recruitment, RecruitmentDashboard, RecruitmentForms, SocialMedia, EditorialPlan, ContentBuilder, KolDatabase, KolCampaign, Prospects, MyProspects, MySalesDashboard, SalesDashboard, MyCommission, SalesAdmin, AdsBudget, Finance, IncomeStatement, BalanceSheet, Invoices, Letters, Forms, CEODashboard, TeamReview, TeamReviewSettings, ProfileSettings, EmailSettings, NotificationLog, RoleManagement, SettingLocation, InvoiceTemplates, SystemSettings.

## Catatan Teknis

- Semua warna lewat semantic tokens (`hsl(var(--primary))`, dst).
- Kategori warna di `nav-config.ts` dipakai PageHeader untuk accent icon tile + underline tab aktif.
- Tidak ada perubahan logic bisnis — murni presentasi & routing tab.
- Permission filter (`filterCategoriesByPermission`) tetap dipakai; tab yang user tidak boleh view otomatis hilang.

## Files

- Edit: `src/components/layout/nav-config.ts`, `src/components/layout/AppLayout.tsx`
- Create: `src/components/layout/PageHeader.tsx`
- Edit (batch migrasi header): ±45 page di `src/pages/*.tsx`
