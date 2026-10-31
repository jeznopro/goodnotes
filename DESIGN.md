# PaperNote

A local Windows notebook inspired by Goodnotes. The supplied image identifies the product but does not show its screens. Reference workflows: https://support.goodnotes.com/hc/en-us/articles/7378598719759-Get-Started-With-Goodnotes-for-Android-Windows-and-Web

## Direction
Content-first desktop workspace: narrow library navigation, generous notebook shelf, quiet page editor with a centered drawing toolbar and a thumbnail rail. No marketing hero. The design skill's generic landing-page pattern was rejected because this is an installed productivity application.

Colors: ink #203047, blue #1967d2, canvas #f6f8fb, white #ffffff, border #e3e8ef, teal #167b70. Cover colors are document identifiers. Segoe UI provides Vietnamese glyph coverage and native Windows readability. Titles 28px, section titles 18px, body 14px, supporting labels 12px.

Library: left aligned heading and search; notebook grid with real covers, favorite buttons and document menus. Editor: blue top bar, tool-specific controls, white A4 pages on a gray desk. Thumbnail controls remain outside paper. Tool state is shown by both background and aria-pressed. Touch drawing has pointer capture, pressure support, cancellation handling and undo. All toolbar controls have Vietnamese accessible labels and keyboard focus. Respect reduced motion.

This is an independently implemented application, without Goodnotes services or accounts, AI, OCR or proprietary source/assets.

## 2.3 optional Google Drive connection

Keep the existing rounded desktop controls and blue palette. Add Google Drive in Settings, with account, human-readable upload status, last confirmed upload, sync/restore/disconnect actions and a collapsible OAuth setup form. Use the existing cloud/restore icons. The password-style secret field is cleared after connection; tokens never enter the renderer. The in-app guide explains Desktop credentials and the external Google browser sign-in. A device owns its snapshot; restoring imports copies, with this behavior stated beside the controls.

## 2.2 interaction and icon refresh

Retain the paper workspace, Segoe UI and blue palette. Rebuild tool glyphs as consistent 24px vector outlines with 1.8px rounded strokes; distinguish fountain nib, ball pen, brush, pencil, marker and lasso. The local icon search returned no verified match; these choices use general icon guidance and the existing native SVG renderer rather than an unverified external asset.

Use an 11px control radius, 17px shelf/toolbar radius and 21px dialog radius. Paper retains a small 5px corner so it still reads as a sheet. Toolbar actions remain in their original order, with a rounded container and clear selected state. Preserve keyboard focus and scroll behavior on narrow windows. No new navigation, animation or marketing elements.

Ctrl plus/equal and numpad plus zoom the page; Ctrl minus and numpad minus zoom out using existing controls and limits. The writing cursor is a filled circle in the active ink color, with a black outline and a thin white contrast edge. Tool-specific cursors remain for hand/text/selection and the eraser has a hollow circle. The cursor is a native CSS cursor so it does not enter notebook data or exports.

## 2.4 supplied Windows editor reference

The supplied screenshot takes precedence over the earlier floating-light-toolbar design. Use a 48px dark navy tab row (#21325c), a 48px blue tool row (#2c4f80), a centered 46px dark palette (#222120), a teal selected nib (#2f8293) and a wide white dotted board. Keep Segoe UI and the existing vector icon system. Sidebar starts collapsed. Advanced tools move into the existing menu and settings; no decorative or nonfunctional buttons are added.

The main writing cursor is now an independent, pointer-transparent DOM circle. Its border-box diameter is nominal tool width times page zoom, with a black border and white contrast outline. This also handles brush diameters above the browser's native cursor bitmap limit. Hand and text tools keep system cursors. The tablet test pad still uses a small native cursor. Existing notebook dimensions remain unchanged; a new wide-board action creates a separate dotted notebook. GeoGebra work is paused and its entry points are hidden.

## 2.4.1 original toolbar glyphs

Use 31 original SVG assets from the static frontend resources of the user's installed Goodnotes for Windows 2.4.5.0. Preserve all path/shape coordinates and native view boxes. CSS paint variables reproduce monochrome inactive and colored selected states; root SVG paint defaults prevent the earlier generic icon stroke rules from thickening the original glyphs. Keep existing actions, tool ordering, labels, cursor behavior and layouts. Auxiliary icons without a matching source glyph retain their existing vector fallback. Provenance and geometry hashes are recorded beside the assets; no Goodnotes application logic is used.
