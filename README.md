# JLL London residential portfolio

For work-account transfer and Claude continuation, read [CLAUDE.md](CLAUDE.md) and [the work handover](docs/work-handover.md).

A first working prototype: one shared, London-only portfolio for brokers to send to buyers. React/TypeScript + Vite, Leaflet + MapLibre vector map, Express API and persistent SQLite storage. No buyer accounts or enquiry forms. Destinations entered in development details are not saved in the portfolio database. Optional GA4 usage analytics requires visitor consent.

## Run

Use the existing checkout in `/workspace/JLL-Portfolio`; cloud tasks are already isolated and do not need a worktree.

Requires Node **24.5+** (uses built-in `node:sqlite`) and npm. The Node SQLite API is currently experimental. Startup scripts enable Node’s environment-proxy support for website imports.

```sh
cd /workspace/JLL-Portfolio
npm ci
npm run dev
```

Vite serves the interface on port 5173 and proxies API calls to the server on port 3001. For a production build, use `npm run build` then `npm start` (serves the build and API on port 3001). The server binds to loopback by default. Set `HOST=0.0.0.0` only behind a suitable authenticated HTTPS reverse proxy when deploying. Do not expose the development server publicly.

`npm test` runs validation/import tests and a real API integration test using an isolated temporary database. `npm run build` performs strict TypeScript checking and produces the browser bundle.

## Development review reminders

In the staff workspace, open **Development reviews**. An admin can assign each published development to an active staff account. The assigned consultant can open the published details and confirm the review. Assigning a development or confirming its details starts a 14-day review period. Due developments are grouped into one reminder per consultant when the scheduled job next runs.

To enable delivery, set `DEVELOPMENT_REVIEW_RESEND_API_KEY` as a secret and `DEVELOPMENT_REVIEW_FROM` to a [verified Resend sender](https://resend.com/docs/dashboard/domains/introduction) in Netlify's production Functions environment, then deploy. The schedule checks for due reviews every hour on the published production site. Emails link to the signed-in staff workspace, and assignments and confirmations work before delivery is configured.

## Staff accounts and roles

Open **Manage** in the header. Buyers never need an account. Staff use individual email/password accounts with these roles:

| Role | Developments | Buyer collections | Accounts |
| --- | --- | --- | --- |
| Admin | Manage all stock; refresh JLL website stock | Manage all collections | Invite any role, reset passwords, change roles, enable/disable access |
| Broker admin | Manage all stock, including imports, edits, removals and refresh | Manage their own collections | Invite new regular brokers only; revoke their own invitations |
| Broker | Browse published stock; cannot add, extract, edit, remove, upload or refresh | Manage their own collections using any published stock | Invite new regular brokers only; revoke their own invitations |

For the first owner account, configure `ADMIN_PASSWORD` (12+ characters) in Netlify environment variables with Functions scope, then redeploy. Visit Manage and enter that value once as the **owner setup code**, together with your name, email and a new account password. It does not create an account automatically. After setup, the shared bootstrap password no longer grants API access. A fresh local server generates its setup code in ignored `.data/admin-password` if `ADMIN_PASSWORD` is unset. Never commit or log this file or credential values.

Staff create **one-use invitation links** that expire after seven days. Copy and send them privately; the app does not send email or WhatsApp messages automatically. Invite links keep the token in the URL fragment rather than a query string. Staff choose their password when accepting. Only Admins may invite elevated roles or reinvite an existing email to reset an account password. Other roles cannot replace pending invitations, reset accounts or modify existing users. Acceptance rechecks the issuer is still active and allowed to issue that role. Pending invitations can be revoked. Disabling an account or changing its role revokes its sessions and pending invitations; the last active admin cannot be disabled or demoted.

Passwords use salted scrypt hashes. Session tokens are random, stored as hashes server-side, and delivered in HttpOnly, SameSite=Strict cookies (Secure on HTTPS); sessions expire after eight hours. Mutations require CSRF protection and matching Origin when present. Permissions and ownership are enforced by the server and rechecked inside mutations, including conditional-write retries. Repeated failed logins trigger a temporary account lock. Passwords/session tokens are never placed in browser localStorage. Role/permission, invite expiry, CSRF, revocation and restart-persistence tests cover these flows.

Netlify stores private staff state alongside portfolio state in its private Blobs store, using conditional ETag writes. Local SQLite stores the access state in private database metadata. Public APIs strip staff ownership metadata and never expose user records, password hashes or session data. Keep backups private. No production staff account has been fabricated or automatically activated.

## Managing developments

- Use the ordinary manual-entry form for name, area, description, GBP starting price, coordinates, bedroom choices, property types, amenities and media URLs.
- **Refresh website stock** fetches the JLL new-homes search page, reads its publicly embedded structured data, filters London sale developments and updates records using stable JLL identifiers. It does not need a private API or credentials. A successful source fetch returned 71 developments; 69 passed validation. The Albion Nord Penthouse at SEVEN has ambiguous bedroom metadata; The Lanes has no positive starting price. Both are skipped for manual review rather than guessed. Image links point to JLL's existing Cloudinary media. No broker contact data is copied into the portfolio.
- Website refresh runs automatically five seconds after server startup and every six hours while the server runs. Set `AUTO_SYNC_HOURS=0` to disable it, or another positive number (minimum hourly) to change the interval. Manual entries are preserved, and incomplete/failed source fetches keep existing stock. Website refresh overwrites edits to website-managed records; missing website listings are retained for review, not automatically withdrawn. Deleting an imported listing does not block it from coming back on refresh. Stock withdrawal and curated exclusions need a fuller workflow before launch.
- **Import a website listing** accepts public HTTPS development pages from JLL, other agents or developers. It extracts available JSON-LD/Open Graph property facts into an unpublished editable form, strips detected contact details and agency/developer sentences, and excludes detected logo media. Source pages never auto-publish. Staff must fill missing required fields and confirm the review checkbox before publishing; extracted drafts are also checked for review confirmation by the API. Photo thumbnails support visual checks for watermarks/branding. Automatic text cleanup is best effort; reviewers remain responsible for factual accuracy, branding and media permissions. External source links are not displayed in buyer details. Sites that block requests, require JavaScript or omit metadata need manual entry. HTTPS-only public-host checks, validated redirect targets, a 3MB/15-second fetch limit and direct-production DNS pinning limit server-side fetch risks. Cloud workspace egress/DNS may block real external-source checks even when deployed Netlify Functions can reach them.
- Upload a JSON array of records for bulk additions (up to 200 records / 2MB); review before publishing. Repeated imports add records rather than silently replacing them. Use the advanced editor/form as the schema template. Development photography uses HTTPS image URLs. Broker portraits and the shared brochure cover use separately uploaded images. Direct video files play in the portfolio; externally hosted player URLs, including Brightcove, open in a separate tab.
- Edit prices, media, availability and other details in place, or remove records from the published collection in the admin screen. CSV and uploaded image-file storage are future work.

SQLite database and generated local password live in ignored `.data/`. `DATA_DIR` can move these to a persistent volume. Back up this directory. No database migration or user stock is cleared on restart; sample seeding happens only once. Do not delete a database with real stock to refresh samples.

## Buyer favourites and featured links

Buyers save developments with the heart button in details or list cards. Favourites persist in `localStorage` on that browser/device; no buyer profile or server-side shortlist is created. If browser storage is unavailable, the app explicitly says the shortlist lasts only for the visit. The favourites drawer creates a WhatsApp message containing the selected names, areas and direct development links. Copy the message into an existing broker conversation, or open WhatsApp and choose a recipient. Nothing is sent automatically. A message link opens the requested development via `?development=<id>` and keeps a known collection context when applicable; invitation fragments and arbitrary URL parameters are never copied into buyer messages.

Brokers use **Buyer collections** to choose 1–50 developments and create a stable share link (`?collection=<opaque slug>`). The chosen properties appear as featured pins above clusters, with a collection title and broker display name. The rest of the portfolio remains available, and buyers may optionally switch to featured-only results. These links are readable without sign-in by anyone possessing them; use general titles, not buyer details. A broker can edit or remove only their own collections; admins can manage any collection. Disabling the owning staff account makes its collection links unavailable. Removed developments are omitted from the public collection.

The maximum-price filter and price sorting have been removed. Development-level **prices from** remain in cards/details as guidance. Accurate unit-budget filtering requires unit-level prices and availability, not just the starting price of a development.

## Honest prototype data and transport

A fresh empty database initially contains six clearly labelled fictional collections. The first successful website refresh removes those samples and populates the verified JLL collection. The current database contains 69 website-sourced developments. Original architectural illustrations remain as fallbacks when images are unavailable.

The Residential positive/negative logos are official vector artwork extracted from the supplied 2026 guidelines. Source Sans Pro is self-hosted, and the Space/Midnight/Sand palette follows the owner’s direction and the supplied guidelines. See docs/brand-assets.md for provenance. Development photography uses the original website image URLs; verify media use and long-term URL stability before launch.

The default map uses OpenFreeMap's clean Positron vector style through MapLibre, with university/college labels from zoom 13 and more local place labels from zoom 16. It needs no Google account or key. Development pins use a simple pin with a centre dot, without a building/office icon or price. Prices remain in details/list cards. Basic OpenStreetMap raster tiles provide a fallback if WebGL or vector-style loading fails.

**Stations** shows the TfL rail network: 511 unique stops across 21 lines in the verified snapshot, including Tube, DLR, Elizabeth line, the six named Overground lines, trams and the cable car. This is the TfL-operated rail network, not London's entire bus or National Rail network. **TfL lines** overlays official geographic route geometry, with a colour-coded legend, multiple line selection and station popups naming every serving line. Stations use a dedicated pane above the line geometry so their markers remain visible. It is not a reproduction of TfL's schematic Tube map.

The public TfL Unified API supplies the network. `server/data/tfl-network.json` is a verified initial snapshot so deployment doesn't depend on an external cold fetch. The backend refreshes topology after seven days and retains stale data if a refresh fails. Netlify caches topology in the separate `jll-transport` Blobs store; local development keeps it in memory. Run `node --use-env-proxy scripts/refresh-transport.mjs` to refresh the bundled snapshot deliberately. Requests identify the application with a User-Agent; default scraper user agents may be denied.

Nearby station cards request actual walking and cycling routes from TfL Journey Planner, showing routed metres/kilometres and minutes. Successful station route results are cached for 24 hours, keyed by the public development ID and coordinates. These are route-planning estimates, not guarantees of current conditions. If no route can be obtained, the card explicitly offers **Check route** and labels any fallback distance as straight-line; it never invents a walking/cycling duration. Six route requests (three stations × two modes) are made per uncached development. No Google routing key is required.

Walk/Cycle links and the existing postcode journey form open Google Maps separately. The development-detail journey form sends its destination directly to Google and does not save it. The former map journey-time filter has been removed. JLL listing descriptions are displayed without an added editorial heading; existing media URLs still point to JLL's Cloudinary assets.

## Appearance, language and simpler search

The header’s globe/appearance button offers **English, Arabic, Simplified Chinese and Turkish**, plus **Light, Dark and Automatic** themes. Preferences persist on the current browser. Arabic uses a right-to-left buyer layout; staff management stays in English. Both themes use a matching JLL Residential lockup and OpenFreeMap vector style. Map positions survive theme changes. The listing photographs are not inverted or recoloured.

Interface and WhatsApp shortlist messages use bundled authored translations. Public development descriptions and amenities use a cached, no-key Google translation endpoint; no API account, billing setup, AI extraction provider or secret is required. The no-key endpoint has no service guarantee and may throttle or become unavailable. The interface labels automatic translations as guidance, offers the original English, and tries a browser-direct translation if the hosted translation request is unavailable, and explicitly falls back to English if both paths fail. Cache read/write failures do not prevent translation. Only the public listing copy is sent to that translation service, never staff accounts, broker email/phone or buyer-entered destinations. The backend accepts a published development ID and a fixed language, not arbitrary submitted text. Netlify caches results in its private `jll-translations` store using a source-copy hash; changing source text invalidates the cache. Staff can optionally save reviewed translations in the development editor; these take precedence. Editing English copy in that editor clears reviewed translations to avoid stale claims.

The former natural-language journey-time search, progress panel and batch routing endpoints have been removed. The map search matches development names, areas and postcodes. Nearby station Walk/Cycle links and the destination form inside development details continue to open Google Maps separately.

Filters include approximate London sectors and 40 named-area centres, such as Knightsbridge, Mayfair and Battersea. Named-area filters use a clearly labelled 2 km radius. Landmarks add subtle points from zoom 12 and labels from zoom 13 for Harrods, Harvey Nichols, Selfridges, Westfield, parks and cultural destinations.

## Reviewed imports and drafts

The single-page JLL importer reads the full publicly embedded property record. Existing JLL URLs load their saved portfolio record directly for a reviewed update, so they do not depend on the website allowing another request. New JLL URLs fall back to the JLL search stock feed when the individual page cannot be read. Warnings identify saved/feed data and ask reviewers to check freshness. Verified against One Thames Quay: 30 gallery images, nine amenities, GBP starting price, 1/2/3-bedroom options and full listing description are available. Other websites use structured metadata, matched embedded property records, visible property paragraphs, feature lists and lazy-loaded gallery/background images. Embedded galleries exclude related listings and agent/contact records. A complete postcode can fill missing coordinates using a clearly labelled postcode-centre lookup; reviewers must still check the development’s precise location. The Angel Village homepage can supplement its draft from up to two relevant same-site pages, within a 25-second overall fetch budget. No LLM or AI processing API is used. A source may still block automated access or omit data from its HTML. Blocked/challenge-only and unreadable pages produce a clear paste-text fallback instead of an empty draft. Missing fields stay blank for review rather than being invented.

The paste-text fallback reads a development name on the first line, followed by listing copy, features, prices and bedroom options. Image URLs can be added separately. Staff may look up coordinates for a full postcode; these are explicitly labelled as the postcode centre and need position checks. The source page URL is retained privately as import provenance and removed from public development responses.

Staff can choose the cover image, remove photos, preview an unpublished draft as a buyer, and save incomplete drafts to finish later. Drafts live in private portfolio state, survive server restarts/deployments and cannot appear in public stock. Admins see all drafts; broker admins see their own. Regular brokers cannot use stock or draft tools. Publishing still requires review confirmation. Duplicate names or matching source URLs are rejected atomically, including within bulk imports. The editor offers a reviewed update to the existing record, preserving its public ID, buyer links and collection references.

The Netlify build runs `scripts/check-source-imports.mjs` against the owner-supplied Angel Village, Savills and One Thames Quay URLs, plus small translation checks. `dist/import-check.json` contains only public-source metadata counts and check statuses; raw HTML, page scripts, credentials and staff data are never published there. These checks do not publish any development or create staff records.

## Broker-specific WhatsApp links

Invitation acceptance requires the invited **email address**, a password and an international **WhatsApp number** (for example +447900123456). Numbers are normalized and format-checked; the app does not claim to verify ownership by SMS. Existing staff can add or update their own number in their workspace without recreating an account.

Signed-in staff can copy a personal portfolio URL (`?broker=<opaque slug>`) after adding their number. Anonymous buyers opening that link see the broker’s name and a WhatsApp button for that broker. Featured-collection links always use the collection owner’s current contact details. A conflicting `broker` parameter cannot override the collection owner. The generic portfolio URL has no broker assigned and no WhatsApp recipient button; buyers can still copy a favourites message into their existing broker conversation. Buyer messages preserve known collection/broker context in individual development links. No message is ever sent automatically.

The public broker lookup exposes only the display name, WhatsApp number and opaque share slug to someone holding the corresponding link; staff email, role, internal ID and account records remain private. There is no public broker directory or recipient chosen from whoever happens to be signed in on the buyer’s browser. Disabled users’ personal and collection links stop resolving. Updating a broker’s number updates the contact shown on their existing links.

## Buyer and staff guides

The public header’s **How it works** link opens `#how-it-works`, a buyer guide available in all four languages. It explains map/list views, development details and starting prices, transport, local favourites, WhatsApp shortlists and preferences. Back-to-map links preserve any broker or collection query parameters.

Signed-in staff have a separate **How it works** workspace tab. Its instructions are returned by authenticated `/api/admin/guide`, not embedded in the public buyer guide. Content follows the role: Brokers see sharing, collections, access and invitations; stock-management instructions are available to Admins/Broker admins; analytics instructions are Admin-only. Anonymous requests cannot read this guide.

Development details use a labelled definition list for **Prices from**, **Bedrooms** and **Property type**. Desktop labels align across three columns; on mobile, price has its own row above bedroom/type fields. Both layouts support dark mode and Arabic direction without running text into the price.

## Google Analytics 4

An Admin can configure GA4 in **Manage → Analytics**. The integration is disabled by default and needs a public GA4 Measurement ID (`G-…`), not a password, API secret or Google Cloud project. Create a GA4 property in the Google account that should own reporting, add a Web stream for the live portfolio URL, and **switch Enhanced measurement off** in that stream before enabling the integration. Automatic outbound tracking can otherwise send WhatsApp URLs containing contact details/message text. The setup screen requires confirmation of that setting. The app emits selected events itself.

Save the Measurement ID, confirm manual-only tracking and enable analytics. Settings persist privately alongside portfolio state and apply to new visits immediately, without a redeploy. Only Admins can read/change settings; Broker admins and Brokers cannot. The public config endpoint returns only enabled status and the active public Measurement ID. An Admin can disable analytics again from the same screen. A current open tab picks up saved changes on refresh; the Admin's own tab also receives the updated setting immediately.

Visitors receive a translated **Accept analytics / Decline analytics** choice. The Google script, analytics cookies and event queue are not created before consent. This is basic consent gating, with no pre-consent Google/cookieless analytics pings. Preferences includes **Analytics preferences** while tracking is configured. Declining or withdrawing stops app events, disables the Google property, removes the script and clears GA cookies on the portfolio hostname. The choice lasts up to 180 days; no advertising/personalization or user-provided-data features are enabled. GA cookies are scoped to the portfolio hostname. Consent changes synchronize across tabs. Staff management and invitation routes are excluded, including when a visitor previously accepted analytics. Actual collector delivery can still be blocked by browser privacy tools.

The tracked events are `page_view`, `development_view`, `favourite_add`, `favourite_remove`, `shortlist_open`, `shortlist_copy`, `whatsapp_click`, `portfolio_link_open`, `collection_open`, `view_change`, `filter_apply`, `search_used`, `language_change` and `web_vital`. Core Web Vitals report numeric LCP/INP/CLS values and quality ratings after opt-in. Only a development currently open when consent is given is counted; earlier clicks are not replayed. A WhatsApp click does **not** confirm that the buyer sent a message, made an enquiry or completed a sale.

All app event parameters pass through an allowlist. Page URLs lose every query parameter and hash, and referrers are reduced to their origin. Search text/postcodes, journey destinations, email addresses, phone numbers, message text, collection titles and invitation tokens are not sent. Development IDs and verified opaque broker/collection link identifiers support attribution without sending staff contact data. No automatic click listener sends raw link URLs. Keep Enhanced measurement disabled in the GA stream to preserve that constraint.

Use **Reports → Realtime** in GA4 to check setup and **Engagement → Events** for activity. Standard reports may take 24–48 hours. For broker/development breakdowns, create event-scoped custom dimensions for `development_id`, `broker_link_id`, `collection_id` and `surface`. For page-speed explorations, also register `metric_name` and `metric_rating` as dimensions and `metric_value` as an event-scoped custom metric. Filter by metric name: LCP/INP are milliseconds, CLS is unitless. Optionally mark `whatsapp_click` as a key event for contact intent; it still measures clicks rather than sent messages. Visitors who decline analytics or block Google are excluded from these counts. Analytics is not connected to any production GA property until the owner supplies/configures a Measurement ID.

## Network requirements

JLL source pages: `digitalportfolio.live.jll.com`, `residential.jll.co.uk`.
Browser vector styles/tiles/fonts: `tiles.openfreemap.org`; raster fallback: `tile.openstreetmap.org`. Backend transport and routing: `api.tfl.gov.uk`. The map opens full-screen by default; Split and List are optional header views. Nearby developments are clustered until zoomed in.
JLL image hosting: `res.cloudinary.com`. Interface fonts and logos are self-hosted; Google Fonts is not contacted by the browser. OpenFreeMap still serves its own map glyphs.
The Google Maps journey action opens `www.google.com` in the buyer's browser. Staff website imports need outbound HTTPS/DNS to each supplied public source host. Imported media URLs need their own source access. Automatic descriptions use `translate.googleapis.com`; optional postcode lookup uses `api.postcodes.io`. No-key services can be unavailable and have explicit fallback paths. Opt-in GA4 uses `www.googletagmanager.com` and Google Analytics collection hosts; neither is contacted before analytics consent. Review those destinations when real listing media is available.

## Before public launch

The collection importer has been exercised against the live JLL site. Establish ongoing permission/reliability for website extraction and media use, and agree stock withdrawal and price-update rules. Review the two skipped listings, verify the imported stock. Continue reviewing stock freshness, durable backups and production access controls. The prototype is deployed at https://subtle-malabi-144145.netlify.app/.

## Netlify deployment

`netlify.toml` builds the frontend and bundles two serverless functions. The API uses **Netlify Blobs** for a site-wide persistent collection, with strong reads and conditional ETag writes so simultaneous administrator edits do not silently overwrite each other. SQLite remains available for ordinary local development. Netlify functions never use the local SQLite file.

The deployment includes a public-data seed of 69 website-sourced London developments in `server/data/initial-portfolio.json`. Administrator credentials and `.data/` are excluded. The first storage mutation persists that seed; subsequent deployments preserve existing site storage. The `refresh-stock` scheduled function runs every six hours on a published production deployment; scheduled functions are not ordinary public API endpoints. Scheduled refresh execution should be checked in Netlify logs; the live public API and existing storage reads have been exercised.

Use Netlify's Git import / Deploy to Netlify flow for this repository, with build command `npm run build` and publish directory `dist` (configured automatically). Set `ADMIN_PASSWORD` securely in Netlify environment variables, scoped to Functions, to enable first-owner setup. Choose a password at least 12 characters long. No password is embedded in the build; if it is missing, owner setup remains disabled while public browsing stays available. Manage explains the exact setup steps. Website imports use public JLL content and require no API key. Netlify provides the Blobs runtime credentials automatically.

The one-click deployment flow may ask to connect GitHub and confirm a new project/repository. It does not replace any existing Netlify site. Review any hosting limits or plan information presented by Netlify; no paid plan has been purchased by this project.

Before sharing the resulting `netlify.app` URL, verify: the home page and all 69 initial developments load, photos and map tiles load, admin login works, a test manual entry survives a new deployment, administrator changes remain private, and a scheduled refresh completes in Netlify's function logs. Remove only your temporary test record. Existing transport and stock-withdrawal limitations above still apply.

The Netlify production project builds from `LiamBayford123/JLL-Portfolio-3e9e3/main` (the template-created copy). The primary source repository is `LiamBayford123/JLL-Portfolio/main`. Publish authorized updates to both while they remain in sync; do not force-push over divergent user changes.


### Team activity and map favourites

Admins have a **Team activity** workspace tab, with date/role/staff filters, equal-length previous-period comparisons, configurable inactivity flags, individual breakdowns, a retained activity timeline, and CSV summary/timeline downloads. Brokers and Broker admins cannot read these reports. Staff sign-ins (including activation), collection changes, stock mutations and invitations are recorded in the same atomic transaction as the action. Successful clipboard button uses and WhatsApp share-button clicks are reported by authenticated, CSRF-protected requests. Idle visible tabs do not continuously refresh last activity; active workspace interaction is sampled at most every five minutes. Manual copies, actual WhatsApp sends/forwards, and historical sign-ins cannot be measured. Existing collections appear as current saved/active counts without invented historical events; disabling an owner preserves saved maps while deactivating their links.

Buyer engagement works without a Google Analytics account. The visitor must accept the translated analytics prompt before anonymous visit/view/favourite/shortlist/WhatsApp counters are sent. Consent can be withdrawn in Preferences; pre-consent actions are not replayed. Older accepted consent is renewed for this additional first-party purpose, while a previous decline remains respected. No buyer IDs, IP addresses, browser fingerprints, search text, message text or contact details are stored by the collector. Counts measure actions, not unique buyers or current favourite balances. Attribution resolves collection ownership server-side before considering any broker slug. General links are counted separately. Staff previews may count if the viewer accepts analytics.

Netlify uses a separate private, strongly consistent `jll-team-engagement` Blobs store with daily per-broker totals and conditional writes. This keeps buyer traffic away from portfolio stock/account writes. SQLite development stores daily aggregates in separate metadata rows. Scheduled stock-refresh maintenance prunes anonymous daily aggregates older than 400 days; SQLite prunes them on writes. Staff daily counts cover 400 days, lifetime staff totals persist, and the timeline retains at most the latest 5,000 events within 400 days. Reports allow up to 180 days per selection within the past year; comparison periods before tracking or retention are incomplete. Dates use UTC; displayed timestamps use London time. No external analytics API or secret is needed. GA4 remains optional and separate.

Saved homes appear as heart pins above ordinary clusters, retaining a featured ring when applicable. **Show favourites only** applies across Map, Split and List and intersects the existing filters. Favourites remain on the current browser/device and are not staff account records.


### Residential branding and responsive browsing

The portfolio now uses the owner-provided Space `#003E51`, guideline Midnight `#131E29`, Sand `#E0C6AD` and White. Source Sans Pro and both official Residential logo variants are self-hosted. The logos are original vector paths extracted from page 5 of the supplied 2026 guidelines, with their red Worldmark and lockup geometry preserved. The journey-line artwork is not used. Asset origins, licences and logo spacing are documented in [docs/brand-assets.md](docs/brand-assets.md).

List controls scroll naturally with listings. Desktop Split keeps controls in a separate toolbar above its map/list workspace; mobile Split uses one scroll area, a taller map and a nearby collection heading. On mobile, **Map tools** expands the landmark/station/TfL controls without changing active layers when collapsed. Photo counters, card overlays and View development buttons have explicit theme-aware contrast. Broker WhatsApp actions include a locally bundled WhatsApp icon and spacing around their explanatory copy.


### London New Homes refinements

The public heading is **London New Homes**. The redundant property-type filter and generic “New homes” facts are hidden; specific unit types remain visible when supplied. Buyer links show a compact WhatsApp icon/name link. Mobile Split includes a **View homes below** action that scrolls to and focuses the listing heading. Cluster icon layout explicitly centres the number within its halo.

The curated landmark layer contains 75 London shopping destinations, markets, cultural sites, parks and major sights. Fifteen key points appear from zoom 11, other points from zoom 12; detailed labels appear on zooming and are checked for overlap. Coordinates represent locations for orientation, rather than designated entrances or walking-route destinations. Map-provider POIs and university labels remain available independently.

Team activity distinguishes recorded sign-in events from currently unexpired sessions. A session started before audit reporting can remain valid with no recorded historical sign-in. Refreshes/resumed sessions are not counted as new logins. New password sign-ins and activations are recorded atomically; session counts are computed from current, enabled accounts and do not imply that every browser tab is online. The Admin-only CSV includes this count. Broker and Broker-admin guides exclude the Team activity and Analytics chapters, and both reporting APIs enforce Admin access.

### Team review improvements

- Developments now store optional `unitPrices` by bedroom count (`0` = studio). Enter confirmed full purchase prices in the editor. Bedroom-and-budget filters exclude unconfirmed prices rather than substituting a smaller home’s price. Missing prices are flagged in published stock.
- Website refreshes keep manual edits. Admins and Broker admins review current-vs-website field differences in **Developments → Website changes needing review**. Keeping a value suppresses that same incoming value until it changes again.
- **PDF brochures → Saved brochures** stores private settings and PDFs across sessions. Select the shared skyline cover or a development photo; Admins can replace the default cover. Each broker has a 50-brochure / 100MB limit, with PDFs up to 3.5MB.
- **Outlook draft · PDF attached** downloads an .eml file with the PDF attachment. Open it in Outlook and add the recipient; nothing is emailed automatically.
