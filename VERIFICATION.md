# Verification — PaperNote 2.0

28 October 2026.

27 existing browser workflow checks and 41 V2 checks passed in Microsoft Edge, with no uncaught errors and no external service calls. Geometry/schema self-checks passed for pressure response, smoothing, repeated partial erasure, lasso, transforms, shape recognition, legacy data and invalid backup rejection.

V2 workflow checks cover four pen styles and synthetic pressure, tablet diagnostics, highlighter opacity/straightness, partial erasure and undo, lasso, clipboard, recolor/scale/rotate, reusable elements, tape, laser, ruler, draw-and-hold, read-only mode, bookmarks, layers, additional paper templates, PNG export, image crop, arrow/triangle shapes, dashed ink, cancellation, tabs and searchable PDF round trips. The PDF fixture includes an internal link and a rotated/cropped page.

The actual x64 Windows executable opened through WebView2 156.0.4314.50 with its library, canvas and 12 tools. A 1.0 profile upgraded to release 2, retained four notebooks and kept its original before-2 disk copy. A fresh profile with a damaged primary JSON recovered all four notebooks from its previous revision. The installer extracted successfully; executable, JavaScript and stylesheet hashes matched the portable build.

Evidence is in tests/results/report.json, v2-report.json, native-v2-report.json, native-v2-migration.json, native-v2-fallback-summary.json, PDF fixtures and screenshots. Run npm test after building the UI.

## Limits

No physical Wacom/Huion/XP-Pen was exercised. Synthetic pen events do not prove driver compatibility or hardware latency. No original Goodnotes stroke samples were supplied; no pixel-for-pixel or latency parity is claimed. This is an independently implemented pen engine.

AI and cloud services were excluded following the user's clarification. Handwriting recognition/reflow, tilt shading, scribble-to-erase, dedicated zoom-writing, continuous multipage scrolling and audio remain unimplemented. New PDF annotations are raster overlays; original text survives for newly imported PDFs. Files imported by 1.0 require reimporting the original PDF for that benefit.

The app is unsigned. Graphical installation, shortcuts and Windows uninstall registration were not exercised; installer payload extraction was checked. Test profiles are isolated under tests/ and excluded from the installer.


## 2.1 smoothing fix — 28 October 2026

A regression test failed before the fix: an alternating 1.25px input wobble produced 0.84205px RMS residual. The same fixture now produces 0.05745px RMS. This measures synthetic geometry, not physical tablet performance. Regression checks also cover sparse/dense sampling equivalence, duplicate input, endpoint preservation, pressure-noise filtering and retained circles.

All 68 prior browser checks and 8 new checks passed. New browser checks confirm one paint per frame for input bursts, preserved pressure and pointer-up coordinates, identical pixels after save/reload, graphite caps without overdraw, and a rendered before/after comparison. The shared renderer is used by the page, thumbnails, tablet test pad and PDF/PNG export. Ink/schema tests also pass. Evidence: tests/results/smoothing-report.json and smoothing-comparison.png. No physical graphics tablet was exercised.

## Installer fix 2.1.1 — 28 October 2026

The reported exception was reproduced under the same .NET Framework runtime: the first Start Menu shortcut saved, while saving the filename Gỡ PaperNote.lnk raised FileNotFoundException from Windows Script Host. The installer now uses an ASCII uninstall-shortcut filename and shows the underlying exception message if another operation fails.

The shared installation routine completed the existing partial installation on this machine. Registry version 2.1.1, installed payload, Start Menu launch/uninstall links, Desktop link, target paths and uninstall arguments were verified. The installed executable opened its library and editor through a separate test profile; the user's existing portable window stayed running. No notebook data was moved or deleted. An isolated regression test exercises the actual shortcut-generation routine under .NET Framework and checks all three links; run npm run test:installer.

Evidence: tests/results/installation-2.1.1.json and installed-2.1.1-smoke.json. The uninstall action itself was not executed.

## 2.2 interface update — 28 October 2026

All 100 browser checks passed, including 24 new checks for Ctrl plus/equal/minus, numpad shortcuts, toolbar focus, zoom limits, text-editing isolation, cursor color/outline pixels and hotspot, tool/read-only cursor states, rounded controls/dialogs, distinct pen icons and compact layout. The existing smoothing, notebook, backup, PDF and image-editing checks remain passing.

Six additional checks passed inside the installed Windows WebView: Ctrl plus/minus events changed paper size without changing viewport scale; the colored cursor and rounded toolbar/icons loaded; the isolated test closed successfully. Installer extraction/shortcut checks and the actual per-user update to 2.2.0 also passed. The user's existing portable window was not closed or reloaded; restart it to load the update. Notebook data was not changed by installation.

Evidence: tests/results/ui22-report.json, ui22-editor.png, ui22-pen-settings.png, native-ui22-report.json and native-ui22.png. The SVG cursor asset was raster checked for its colored center and black outline; physical graphics-tablet hover behavior was not tested.

## 2.3 Google Drive upload sync — 28 October 2026

The existing 100 browser checks pass after extracting the shared backup-import helper. Twenty-one additional browser checks use a simulated native bridge to exercise credential validation, cleared secrets, connection state, offline/online retry, safe restore, malformed backup rejection, merged-library limits, revoked permissions, disconnect and compact layout. Restore validates the staged combined library before changing the live library. The actual native bridge and offline disk persistence pass seven checks with an isolated Windows profile; six existing zoom/cursor checks also pass inside the installed app.

The .NET Framework Drive probe exercises production DriveSync with an in-memory HTTP handler: RFC 7636 PKCE vector, OAuth state checks, a real TCP loopback callback, Windows DPAPI encryption/reload, no secrets in renderer status, debounce, offline retry, exact upload bytes, refresh tokens, generated file IDs, existing-file updates, concurrent edits, deleted-file recreation, untrusted upload-location rejection, restore validation, revoked permission handling, disconnect and interrupted first upload. The fixture uses synthetic credentials and sends no data to Google.

Actual Google consent and Drive API success have not been tested: the user's OAuth credentials will be entered directly in PaperNote. Sync uploads one library snapshot per device while the app is open; restore imports copies and does not automatically merge devices. Cloud library limit is 512 MB; no background process runs after closing the app. Evidence: tests/DriveProbe.cs, tests/results/drive-ui-report.json, native-drive-report.json and native-drive-settings.png.

Installer extraction and all three shortcuts pass. The actual per-user installation registration is 2.3.0; the user's library.json hash was identical before and after updating. The release includes the new System.Net.Http/System.Security references and DriveSync.cs in the native build.

## 2.4 supplied editor reference and cursor sizing — 28 October 2026

The editor now follows the supplied screenshot's navy tabs, blue tools, floating dark palette, compact undo cluster and optional wide dotted board. Twenty-five new browser checks cover reference geometry/colors, preserving old notebooks, sidebar access, quick nib selection, exact nominal cursor sizing at current zoom, width/settings changes, cursor raster pixels, hiding on leave, wide highlighter/eraser sizes, text/hand modes, export-pixel isolation and compact layout. Existing 24 zoom/tool/icon checks were adapted to the new cursor and toolbar. The 27 notebook/PDF checks, 41 drawing-feature checks, 8 smoothing checks and 21 Drive UI checks also pass.

Evidence: tests/results/reference24-report.json, reference24-editor.png, reference24-compact.png, ui22-report.json, report.json, v2-report.json, smoothing-report.json and drive-ui-report.json. GeoGebra is explicitly paused at the user's request; its work in progress is retained, and no opening control is exposed. No physical graphics tablet was tested. The cursor shows nominal selected width; pressure-dependent pen strokes retain their existing width variation.

Nine checks passed inside the installed Windows app for keyboard zoom, cursor color/diameter, the reference toolbar, wide board and paused GeoGebra entry. Seven native Drive/disk checks remain passing. Actual per-user installation is registered as 2.4.0, all shortcuts/payload checks pass, and the user's library.json hash was identical before and after installation. Native visual evidence: tests/results/native-reference24.png.

## 2.4.1 original icon assets — 29 October 2026

Thirteen new checks confirm that all 31 prepared SVGs retain the original Goodnotes shape coordinates, contain static shapes only, display the original selected pen colors and inactive eraser outlines, and preserve tool/nib selection and compact layout. The source assets were recovered from static frontend resources of the installed Goodnotes application; no user notebook data or application behavior was copied. Existing 24 zoom/cursor/interface checks and 25 reference-editor checks were rerun. Evidence: tests/results/original-icons-report.json, original-icons-editor.png, original-icons-pens.png and original-icons-compact.png.

These checks establish original glyph geometry, not pixel-for-pixel identity for every control at every Windows display scale. Auxiliary controls that have no matching original glyph keep the existing fallback. GeoGebra remains paused.
