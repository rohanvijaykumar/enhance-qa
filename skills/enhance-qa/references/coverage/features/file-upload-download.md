---
module: file-upload-download
kind: feature
title: File upload and download
checked: 2026-11-16
---
# File upload and download

Uploading, storing, processing and serving files: avatars, attachments, documents, media, exports. Covers limits, hostile files, storage permissions and download behavior. Import of data files is in `data-import-export.md`; playback is in `media-playback.md`. Usually goes with `security.md`, `web-app.md` and `accounts-auth.md`.

## Signals

- `<input type="file">`, drag-and-drop zones, `multipart/form-data`, presigned URLs.
- Dependencies: `multer`, `formidable`, `busboy`, `uploadthing`, `tus`, `uppy`, `dropzone`, `sharp`, `Pillow`, `ImageMagick`, `ffmpeg`, `ClamAV`, `@aws-sdk/client-s3`, Supabase Storage, Firebase Storage, Cloudinary.
- Storage config: S3, GCS, Azure Blob, R2, local `uploads/` folder, bucket policies.
- UI: "attach", "upload photo", "download PDF", "export".

## Kickoff questions

1. Which file types and maximum size are promised? (best guess: images and PDFs up to 10 MB)
2. Where do files live, and who may open them by URL? (best guess: a cloud bucket, private, served by signed URL)
3. Is anything processed after upload (resize, thumbnails, transcoding, scanning, OCR)? (best guess: image resize only)

## Drivers

1. **HTTP client with generated files.** Best for limits and hostile files. Make test files with a script: zero byte, 1 byte, exactly the limit, limit plus 1, a sparse large file, a renamed file (`.exe` named `.jpg`), a double extension, a very long name. Send them with curl or Playwright's request API.
2. **Playwright `setInputFiles` and download events.** Drives the real UI, including progress and cancel. Use route interception or network throttling for slow connections. Read the download's suggested filename and bytes.
3. **File inspection tools.** `file`, `exiftool`, `sha256sum`, ImageMagick `identify`, `ffprobe`, `unzip -t`, `pdfinfo` to confirm what was stored and served (type, size, metadata, integrity).
4. **Storage CLI or console (read-only).** `aws s3api get-bucket-policy` or `get-public-access-block`, `gsutil iam get`, Supabase and Firebase storage rules viewers. Confirm public access and rules.
5. **The EICAR test string** (the harmless antivirus test file) for scanner hooks. Never use real malware.
6. **Local S3-compatible store** (MinIO, LocalStack) for presigned-URL and failure tests without a cloud account.

**Can't be driven here:** the native OS file picker on mobile (use device or simulator for camera and photo library access), huge multi-gigabyte files over real networks, and a real antivirus vendor's behavior. These become device or human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | upload one valid file, see it, download it, bytes match |
| check | smoke, plus limit, wrong type and cancel |
| full | file type x size x name x network x signed-in role |
| release | all of full, storage permission audit, scanner hook, human device checks |

Dimensions: file type, size (0, 1 byte, limit-1, limit, limit+1, huge), name (ASCII, unicode, spaces, long), network (fast, throttled, dropped), role, browser, device.

## Check catalogue

### Accepted types and limits
- [high · agent] Upload one valid file of each promised type → accepted, listed with the right name, size and type, and opens {smoke}
- [high · auto] Upload a file one byte over the size limit → rejected with a clear message before or after upload; nothing stored; limit enforced by the server, not only by the browser {security}
- [medium · auto] Upload exactly at the limit, and one byte under → accepted
- [high · auto] Upload a type that is not allowed (`.exe`, `.html`, `.svg` if not promised, `.php`, `.js`) → rejected with a clear message; nothing stored {security}
- [medium · agent] The "accepted types" hint and the file picker filter → match what the server really accepts
- [medium · agent] Number of files limit, and total size across multiple files → enforced with a message that says which files failed

### Edge files
- [high · auto] Zero-byte file → rejected with a message, or accepted and handled; never a crash or a ghost record
- [medium · auto] A huge file (sparse, GBs) against the stated limit → refused early (Content-Length or streaming check); the server doesn't run out of memory or disk {security}
- [medium · auto] Corrupt file with a valid extension (truncated PNG, broken PDF, bad zip) → rejected or handled; processing failure is shown, not a broken thumbnail forever
- [medium · auto] Compressed bombs (a tiny zip that expands huge) and pixel bombs (a 30000x30000 PNG), if the product unpacks or resizes files → refused or limited; no resource exhaustion {security}
- [medium · agent] Same file uploaded twice → documented behavior (deduplicated, renamed `file (1).pdf`, or replaced); not a silent overwrite of another user's file
- [medium · agent] Files with only metadata (EXIF GPS in photos) → stripped if privacy is promised; otherwise noted {security}

### Wrong extensions and sniffing
- [high · auto] A script or HTML file renamed to `.jpg` or `.png` → the server checks the content (magic bytes), not only the name or the client-sent MIME type; it is rejected or stored inert {security}
- [high · auto] An SVG with a `<script>` element, and an HTML file, served back → downloaded or sandboxed; never executed in the app's origin {security}
- [medium · auto] Double extensions (`photo.jpg.exe`, `doc.pdf.html`), null byte and trailing dots/spaces in names → refused or sanitized
- [medium · auto] Served files carry the correct `Content-Type` and `X-Content-Type-Options: nosniff` → browser doesn't guess a dangerous type {security}
- [medium · auto] Polyglot files (valid image that is also valid HTML or JS) → not executable when served

### File names and paths
- [high · auto] Names with `../`, `..\`, absolute paths, `%2e%2e`, and reserved names (`CON`, `NUL`) → stored under a safe generated name; no file written outside the upload folder {security}
- [medium · agent] Names with spaces, unicode, emoji, accents, RTL marks, quotes, very long names (255+) → shown correctly; download name is right; storage doesn't break
- [medium · agent] Names that clash by case (`A.pdf` vs `a.pdf`) on case-insensitive storage → no overwrite
- [low · agent] Names containing `<script>` or HTML → escaped everywhere they are shown {security}

### Progress, cancel and resume
- [high · agent] Upload a large-ish file on a throttled network → a progress bar or state shows real progress; the page stays responsive {smoke}
- [high · agent] Cancel mid-upload → upload stops; no partial file left in the list or storage; the user can retry
- [medium · agent] Lose the connection mid-upload and restore → resumes (if resumable, such as tus or multipart) or fails with a clear retry; no corrupt stored file
- [medium · agent] Navigate away or close the tab during upload → the user is warned, or the upload is safe to abandon
- [medium · agent] Several files at once: one fails → the others complete; per-file status is clear
- [medium · agent] Resumable or chunked uploads: kill and restart → the final file's checksum matches the original; chunk order and duplicates handled
- [medium · agent] Upload timeouts at the proxy or CDN (large file behind a gateway limit) → clear error, not an endless spinner

### Scanning and processing hooks
- [high · auto] Upload the EICAR test file where a scanner is promised → rejected or quarantined; the user sees a safe message; the file can't be downloaded by others {security}
- [medium · agent] Scanner unavailable (stop it in test) → uploads wait, fail closed, or are marked unscanned per the docs; never silently served as "clean"
- [medium · auto] Image processing: resize, crop, rotate by EXIF orientation, thumbnails, format conversion (HEIC, WebP, animated GIF) → output dimensions, orientation and format right; color and transparency preserved; originals kept or deleted as documented
- [medium · agent] Processing is asynchronous → a "processing" state, then the final state; failure surfaces; the user is not left with a permanent placeholder
- [low · auto] Metadata and size of processed output → within limits; no huge outputs from small inputs

### Storage and permissions
- [high · auto] Request an uploaded file's URL without signing in, as another user, and with an expired signed URL → refused (401, 403 or 404) for private files {security}
- [high · auto] Inspect the bucket or storage rules (read-only) → no public listing; no public read or write unless files are meant to be public; blocks "all users" write {security}
- [high · auto] Guess or enumerate file URLs (sequential IDs, predictable names) → can't reach others' files; names are random or authorization is checked {security}
- [medium · auto] Signed URL lifetime, and what the URL allows (read vs write, which object, which content type) → short expiry; scoped to one object; can't upload a different type or size than allowed {security}
- [medium · agent] Delete a file or an account → the stored object is removed (or queued) and its URL stops working; CDN caches are purged as promised
- [medium · agent] Quotas per user or plan → enforced on the server; a clear message at the limit

### Download
- [high · agent] Download a stored file → bytes match the original (compare hashes); name, extension and size are right {smoke}
- [medium · auto] `Content-Disposition` and `Content-Type` → right filename (quoted, unicode-safe via `filename*`), right type; inline vs attachment as designed {security}
- [medium · agent] Download names with unicode, spaces, commas and quotes → saved name is correct in major browsers; no header injection
- [medium · agent] Range requests and resuming a large download → work for media and big files
- [medium · agent] Download while the file is still processing, deleted or access revoked → clear message, no empty file
- [medium · agent] Generated downloads (PDF, ZIP, CSV) → open in the standard viewer; size is sensible; the file is not truncated; contents match the screen
- [low · agent] Download link in email or shared link → works for the intended person, expires if promised, and doesn't expose other files

## Gates

- Server enforces type, size and count limits; content-sniffing rejects renamed files.
- Private files are not reachable without authorization; bucket is not world-listable or writable.
- Uploaded HTML, SVG and scripts can't execute on the app's origin.
- Path traversal in names is blocked.
- Round trip: uploaded bytes equal downloaded bytes.

## Human-only checks

- [human] Upload a photo from a real phone camera (HEIC, rotated, large) → shows upright, the right size, no weirdness
- [human] Upload and open files in the viewers real users use (Word, Preview, mobile PDF viewer) → open without warnings
- [human] Try a document with real private content from your own account on staging → access control feels right; links do not leak when shared

## Known pitfalls

- **Browser size limits** (`maxlength`, `accept`) can be bypassed on purpose; report only server-side gaps as security, and UI mismatches as usability.
- **Presigned URLs** are meant to work without cookies; test their scope and expiry, not "works without login".
- **Proxy limits.** A 413 from a reverse proxy before reaching the app is a config limit; the product should still show a human message.
- **Antivirus tests.** EICAR is detected by design; a file named `eicar.com` blocked by your own antivirus is not a product bug.
- **CDN caching** can serve a deleted file for a while; check the documented purge time first.
- **Windows file names.** Reserved names and trailing dots behave differently across operating systems.
- Never use real malware, real customer files or huge uploads against third-party storage you don't own.

## Sources

1. [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — validation, storage, scanning (checked 2026-11-16)
2. [OWASP Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload) — risk and tests (checked 2026-11-16)
3. [EICAR test file](https://www.eicar.org/download-anti-malware-testfile/) — harmless scanner test (checked 2026-11-16)
4. [MDN: Content-Disposition](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition) — download names, `filename*` (checked 2026-11-16)
5. [MDN: X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options) — nosniff (checked 2026-11-16)
6. [tus resumable upload protocol](https://tus.io/protocols/resumable-upload) — resumable uploads (checked 2026-11-16)
7. [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control) — storage policies for AI-built apps (checked 2026-11-16)
8. Research notes: `11-vibe-coders.md` (public buckets and missing storage policies in AI-built apps)
