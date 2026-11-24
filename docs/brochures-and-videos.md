# Broker brochures and development videos

## Brochures

Open Broker workspace → PDF brochures. Choose 1–20 published developments or start from your own saved collection. Use the controls in each development's note panel to reorder the homes. The cover headline allows 100 characters. The optional client name, introduction and development notes allow 100, 600 and 280 characters respectively. Saved drafts retain older notes and introductions. The preview flags copy shortened to fit the new layout.

The A4 design uses Midnight, Space and Sand with Source Sans 3 and Source Serif 4. The shared London skyline appears on the cover and contact page. Admins can replace it with approved photography. The cover uses the broker's introduction and contact details. The mapped shortlist gives each home a clickable named pin and matching list row. Longer selections continue the list on extra pages. Each development then has its own photograph, summary, bedroom prices, optional broker note and viewing CTA. The brochure closes with next steps and the broker's contact card.

The shortlist uses the portfolio's OpenFreeMap basemap, styled in light grey for print, and fits the map around the selected homes. The PDF draws the pins and their links over the map image. If the map fails, retry generation. A failed generation leaves the saved PDF available. Missing photographs produce placeholders and a warning. Preview the brochure and check prices and availability before sharing.

The current broker profile supplies the name, job title, photograph, work email and WhatsApp number. A WhatsApp number is required to generate a PDF. Its WhatsApp links prefill a viewing message and point to the same broker throughout. Development links preserve the selected collection or broker attribution. The brochure reads prices from published stock. When a bedroom price is unavailable, the brochure says “Speak to your broker”.

Save brochure stores private settings. Generate & save PDF stores the PDF if it is at most 3.5 MB. Each broker can retain up to 50 brochures and 100 MB of PDFs. Download larger PDFs from the preview. Saved PDFs are snapshots. Regenerate them for the new design or to refresh stock, prices and profile details. Saving edited settings clears the older snapshot. Version checks guard against concurrent overwrites.

Metadata is held in the private portfolio object and PDFs are separate objects in `jll-brochure-files`. The brochure owner must be signed in to download a saved PDF. Local development uses SQLite metadata and private files under DATA_DIR/brochure-files.

Outlook draft · PDF attached downloads an `.eml` draft with the PDF attached. Open it in Outlook, enter the recipient and review before sending. Share via WhatsApp opens WhatsApp and downloads the PDF for you to attach. Share file uses your device's share sheet where available.

## Videos

Development details support direct HTTPS MP4/WebM/OGG/M4V files and allowlisted YouTube, Vimeo, Brightcove player and bcove.video URLs. Players load only after a buyer clicks Play. Preview cards use YouTube thumbnails where available, with the development cover photo and a local illustration as fallbacks. Direct video players also receive a poster image. YouTube watch, short and embed URLs are normalised to privacy-enhanced embeds. Vimeo unlisted hashes are preserved. Brightcove autoplay parameters are stripped. Unknown providers receive an explicit original-video fallback; arbitrary pages and scripts are never inserted as iframe HTML.

Provider-owned playback restrictions, regional rules or disabled embedding can still stop a video. The original-video link remains available. Live playback and native share-sheet checks require a browser/device; the current app settings disable browser access.

## Saved circular broker photos

Manage → Your broker photo accepts JPEG, PNG and WebP uploads up to 12 MB. The broker can position and zoom the circular preview before saving. The browser decodes the image, removes source metadata through a canvas redraw, and submits a 384 × 384 JPEG. Only the currently signed-in profile can be changed. The server rejects external image URLs, SVG, invalid JPEGs, images above 180,000 data-URL characters, and non-square or excessive dimensions. Portraits are stored with the staff profile, displayed as circles on buyer links, and clipped with a true circular PDF clipping path on the cover and contact page. Removing a photo affects future brochures; existing downloaded PDFs remain unchanged.

Photo edits invalidate the in-tab PDF preview so the broker can regenerate it with their current photo. Portraits use circular clipping on the cover, in development notes and on the contact page.
