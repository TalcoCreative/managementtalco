# Move uploaded files to Google Drive

## Goal
New uploads (PDFs, photos, documents) are stored in the company's Google Drive instead of Lovable Cloud storage. The database itself stays in Lovable Cloud.

## What changes for users
- Uploading works the same as today, and files are still compressed first.
- Files land in a "Talco Management System" folder in the connected Google Drive, with subfolders per area (Tasks, Clients, Forms, Talent, Recruitment, Editorial Plan, Invoices, Avatars, Company).
- Links and previews keep working, including on public pages (Client Hub, public forms, talent registration).
- Old files stay where they are and keep working. An optional one-time migration can move them later.

## Steps
1. Connect Google Drive (one company account) through the connector card.
2. Add a backend upload function that receives a file, puts it in the right Drive folder, makes it viewable by anyone with the link, and returns the file ID and link.
3. Add a backend function that serves or redirects to Drive files so images display inside the app.
4. Add one shared upload helper and switch all 16 upload points to it (compression first, then Drive).
5. Store the Drive link and ID in the same fields the app already reads, so pages need no other changes.
6. Test uploads from a signed-in page and a public form, and confirm the files open.

## Trade-offs
- Drive has rate limits, and uploads are slightly slower because they pass through the backend.
- Files become "anyone with the link" on Drive. Confidential items (payslips, candidate documents) stay private and are only served through the backend.
- Attendance selfies are saved in the database itself, not as files. They stay as they are (already compressed).

## Technical details
- Edge function `drive-upload`: multipart upload through the connector gateway (`upload/drive/v3/files?uploadType=multipart`), folder lookup or creation cached in a `drive_folders` table, and a permission `role=reader,type=anyone` for non-confidential files.
- Edge function `drive-file`: streams `files/{id}?alt=media` for private or confidential files and for inline images.
- `src/lib/storage-upload.ts` `uploadFile(file, area, {confidential})` returns `{url, driveId}`; it replaces `supabase.storage.from(...).upload` and `getPublicUrl` calls.
- Signed-URL flows (recruitment documents) switch to `drive-file` with an auth check.
