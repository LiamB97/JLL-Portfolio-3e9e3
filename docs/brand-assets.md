# JLL Residential brand implementation

The supplied **JLL Residential Guidelines — 2026, Version 01** is the source for the Residential identity. The application contains the logo artwork needed for the portfolio, not the confidential guideline document.

- The positive and negative horizontal product lockups in `/public/images/jll-residential-light.svg` and `jll-residential-dark.svg` are extracted vector paths from page 5. The Worldmark, JLL monogram and Residential lettering retain the original geometry, proportions and colours. There is no HTML typesetting or substituted font in these logos, and no external logo request. The preferred red Worldmark remains intact; it has not been recoloured to match the interface.
- Page 9 specifies half a Worldmark height of clear space and a minimum digital logo width of 150 px. The header reserves that space and keeps the lockup at or above the minimum size.
- Pages 23–24 specify Source Sans Pro: Light for headlines/body, SemiBold for subheadings. Full Latin/Turkish Light, Regular, SemiBold and Light/Regular Italic files are self-hosted under `/public/fonts`. The UI uses Regular/SemiBold where small controls need extra clarity. Noto Sans Arabic is a self-hosted regional fallback; Chinese uses the device's native CJK fallback. OpenFreeMap labels continue to use the map provider's own glyphs.
- Sand is `#E0C6AD` (page 25), Midnight is `#131E29` (page 59), and White is `#FFFFFF`. **Space `#003E51` was supplied directly by the portfolio owner.** These are defined centrally in `src/brand.css`. Light theme uses White and Sand tints with Space controls. Dark theme uses Midnight surfaces with Sand accents. TfL route colours keep their transport meaning. No Journey Line has been added, as requested.
- Source Sans Pro font files were obtained from Google Fonts' `sourcesanspro/v24` distribution; Noto Sans Arabic from `notosansarabic/v33`. Both are served from this application. Their SIL Open Font Licences are included beside the fonts. WhatsApp's monochrome glyph comes from Simple Icons (CC0) and is bundled locally in `src/WhatsAppIcon.tsx`.

Re-extraction should select only the 15 filled logo paths inside each page-5 logo boundary, not embed a full guideline page or add a new Residential word label. Compare a rendering against the original before replacing either asset.

## Browser icons and sharing preview

- `/public/favicon.svg` uses the original red Worldmark path from `jll-logo.svg`, centred on a white tile. `favicon-32.png`, `favicon.ico` (16/32/48 px) and `apple-touch-icon.png` (180 px) are raster derivatives of the same artwork. The Worldmark geometry and colour are preserved.
- `/public/images/social-preview.jpg` is a generic 1200 × 630 preview for shared portfolio links. It uses the official Residential lockup, bundled Source Sans 3 and the established Space/Midnight/Sand palette. It contains no broker contact details, buyer details, development picks or password-protected information.
- The document metadata uses the public `https://digitalportfolio.live.jll.com/` address. Canonical/social metadata does not redirect visitors or remove the broker, collection or development context from their links.
