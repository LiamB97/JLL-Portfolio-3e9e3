# Broker brochures and development videos

## Brochures

Every signed-in staff role can open Broker workspace → PDF brochures. Select 1–20 published developments, optionally starting from a collection owned by that broker. Add a title (100 characters), introduction (1,600 characters), and per-development notes (1,600 characters). Reorder homes inside each note panel. Generate a PDF, inspect the preview, then download or share the file. A WhatsApp number is required so enquiry links have a working broker contact.

The brochure uses portrait A4 pages: a selectable cover, a dark introduction headed **Your handpicked collection**, exactly one page per development and a contact page. Brokers can edit the page-one headline and optional job title. Footer branding and the former lower-right JLL Residential label have been removed.

Each development includes up to three available photos, up to six key features, pricing and bedroom facts, an overview, broker notes and an enquiry link. It never creates a continuation page. Longer content is fitted to the available space; notes that still exceed it are shortened with an ellipsis and explicitly listed in a warning before sharing. Photos preserve their original aspect ratio and are cropped within their frames.

PDFs are generated on the device with jsPDF, locally drawn QR codes and bundled SIL-licensed Source Sans 3 fonts. Choose the shared default London cover or an image from a selected development. The bundled skyline is an original illustration. Admins can upload approved JPEG/PNG/WebP photography to replace the team default; this affects newly generated PDFs only.

Save brochure stores its private settings in the workspace. Generate & save PDF also stores the generated PDF when it is at most 3.5 MB. Each broker can retain up to 50 brochures and 100 MB of PDFs. Larger PDFs remain downloadable in the current tab; settings are saved but the UI explicitly reports that the file was not stored. Saved settings and files survive refresh, logout and deployment. A PDF is a dated snapshot: regenerate it for current stock, prices and broker details. Changing saved settings invalidates its older PDF. Version checks reject concurrent overwrites.

Metadata is held in the existing private portfolio object; binaries are separate objects in `jll-brochure-files`. Production downloads require an active session belonging to the brochure owner. Neither buyer pages nor other brokers expose these private files. Local development uses separate SQLite metadata and private files under DATA_DIR/brochure-files. Remove brochure deletes its metadata and associated binary; downloaded copies remain outside the app.

Outlook draft · PDF attached downloads an RFC 822 `.eml` draft with `X-Unsent: 1`, a UTF-8 body and the actual PDF MIME attachment. Open it in Outlook, enter the recipient and review before sending. Outlook editions may handle draft opening differently; the separate Download PDF action remains available. No mailbox connection is required and no email is sent automatically. WhatsApp opens the sharing service and downloads the PDF for manual attachment. Share file uses supported device share sheets.

Photo loading is limited to seven seconds per image. Missing or cross-origin-blocked images produce placeholders and a visible warning. No scrape or source text is invented to fill missing bedroom prices.

## Videos

Development details support direct HTTPS MP4/WebM/OGG/M4V files and allowlisted YouTube, Vimeo, Brightcove player and bcove.video URLs. Players load only after a buyer clicks Play. Preview cards use YouTube thumbnails where available, with the development cover photo and a local illustration as fallbacks. Direct video players also receive a poster image. YouTube watch, short and embed URLs are normalised to privacy-enhanced embeds. Vimeo unlisted hashes are preserved. Brightcove autoplay parameters are stripped. Unknown providers receive an explicit original-video fallback; arbitrary pages and scripts are never inserted as iframe HTML.

Provider-owned playback restrictions, regional rules or disabled embedding can still stop a video. The original-video link remains available. Live playback and native share-sheet checks require a browser/device; the current app settings disable browser access.

## Validation

Regression tests cover all bundled development video URLs, unsafe URL rejection, provider URL normalisation, PDF pagination, empty selections, filenames and broker/collection link attribution. Sample PDF pages were rendered with Poppler and inspected, including a 20-development long-notes case. Text margins and PDF link annotations were checked with pdfplumber and pypdf. QA artifacts remain in tmp/pdfs and are not committed.

## Saved circular broker photos

Manage → Your broker photo accepts JPEG, PNG and WebP uploads up to 12 MB. The broker can position and zoom the circular preview before saving. The browser decodes the image, removes source metadata through a canvas redraw, and submits a 384 × 384 JPEG. Only the currently signed-in profile can be changed. The server rejects external image URLs, SVG, invalid JPEGs, images above 180,000 data-URL characters, and non-square or excessive dimensions. Portraits are stored with the staff profile, displayed as circles on buyer links, and clipped with a true circular PDF clipping path on the cover and contact page. Removing a photo affects future brochures; existing downloaded PDFs remain unchanged.

Photo edits invalidate an already generated in-tab PDF so it must be regenerated. The original reference’s person, phone numbers, institutional copy and static map are not copied into generated brochures. They use the sharing broker and selected developments. Photo-grid tiles link to the live map instead. Browser interaction checks remain unavailable under the current app settings; PDF pages were rendered and visually reviewed, with pixel-level checks confirming all four portrait corners are clipped away.

## A4 verification

A 20-development stress brochure with three images per home, long names, six long features and maximum-length notes remains 23 pages (cover, introduction, 20 development pages, contact). PDF annotations confirm that each development appears on exactly one dedicated page. Poppler rendering and pdfplumber checks confirm readable layouts with all text inside A4 boundaries. The portfolio title is London New Homes Portfolio and broker-name text is explicitly dark on the green contact button in both themes.
