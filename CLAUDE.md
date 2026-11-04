# JLL London New Homes Portfolio

This is a working React/TypeScript portfolio with a broker workspace, backed by Netlify Functions and Netlify Blobs. The application is not dependent on Codex; use the repository and the handover below to continue in the approved work Claude environment.

Read [docs/work-handover.md](docs/work-handover.md) before changing hosting, ownership or storage.

## Commands

Use Node 24.5 or newer, within Node 24 for the current Netlify configuration.

```sh
npm ci
npm test
npm run build
npm run dev
```

On this macOS checkout, Vite's default configuration loader has sometimes hung. The verified alternative is `npm run build -- --configLoader runner`. Build before running the full tests, because the API smoke test serves `dist/index.html`.

`npm run dev` runs Vite and the local Express API. Local stock refresh is enabled by default. Set `AUTO_SYNC_HOURS=0` if an isolated local session should not refresh its own stock automatically. Local SQLite is separate from production Netlify data.

## Where things live

- `src/main.tsx`: buyer discovery, filters, shortlist state and top-level navigation.
- `src/PortfolioHeader.tsx`, `src/discovery.css`: header, mobile map space and public responsive layout.
- `src/Map.tsx`, `src/map-style.ts`: Leaflet/MapLibre map, subtle park/water colours, overlays, framing and provider credits.
- `src/Detail.tsx`, `src/DevelopmentVideo.tsx`: development details, viewing requests and media.
- `src/StaffPortal.tsx`, `src/workspace.ts`, `src/workspace.css`: staff navigation and workspace layout. My profile is available to every staff role, with the photo editor first.
- `src/readability.css`: final reading-size and wrapping rules. Body copy is 16px, development descriptions 18px and compact UI labels at least 14px.
- `src/Admin.tsx`, `src/PendingInput.tsx`, `server/pending-input.mjs`: stock entry, review, assignment and publishing.
- `src/StaffCollections.tsx`, `src/TransportDefaults.tsx`: featured collections and their transport defaults.
- `src/StaffBrochures.tsx`, `src/BrochureCover.tsx`, `src/brochure.ts`, `src/brochure-assets.ts`: saved A4 brochures, cover selection and Outlook drafts with attached PDFs. `server/brochures.mjs` enforces private ownership/version/quota; `server/brochure-files.mjs` stores binaries separately.
- `server/source-review.mjs`: protect manual stock edits across website refreshes and resolve explicit field differences. Never replace manually supplied bedroom prices with the website’s aggregate starting price.
- `shared/pricing.ts`: bedroom-specific budget/display/sort rules; missing per-bedroom prices do not fall back to another unit type’s aggregate price.
- `server/netlify-api.mjs`: shared HTTP API; `server/access.mjs`: staff authentication, roles, profiles and collection ownership.
- `server/netlify-store.mjs`, `server/engagement-store.mjs`: production persistent stores.
- `server/index.mjs`: local Express API and SQLite repository.
- `netlify.toml`, `netlify/functions/`: build, API and scheduled stock refresh.

## Behaviour to preserve

- Buyers need no account. Preserve broker/collection attribution on enquiries, friend links, PDF links and email copy.
- Admins manage accounts and reporting. Admins and Broker admins manage stock and Pending input. Regular Brokers manage their own collections and cannot access the stock work queue. Do not broaden these roles as a side effect of a UI change.
- Pending assignment and notes have a separate save action at the top of an entry. Metadata-only saves must preserve development data, enforce the current revision and permissions, and never publish a development. The development draft button saves the form separately.
- Collection transport defaults apply only to collections. General/personal links open with optional transport and landmark overlays off. Explicit station choices contribute to collection framing; entire routes do not.
- The mobile Map canvas fills the area beneath a 56px header. Search and small commute/result controls float over it. Desktop and List/Split controls stay in normal flow. Mobile view choices and full collection context are in the menu; broker contact remains one tap away.
- Map framing reads the actual floating toolbar bounds. Preserve map provider attribution; the optional Leaflet badge has been removed.
- Commutes use TfL journey durations, not distance estimates. Unconfirmed routes do not qualify as matches.
- Brochures are A4, with exactly one page per selected development, up to three photos and six key features. Circular portraits use actual PDF clipping. Long notes may be shortened with a visible warning.
- WhatsApp/email buttons prepare a request or open an app. They do not send messages, confirm bookings or automatically attach a downloaded PDF.

## Data and working practices

Production accounts, password hashes, broker photos, collections, unpublished drafts, saved brochure metadata/PDFs, pending assignments and staff activity are in Netlify Blobs, not the checked-in seed JSON. A Git clone or deploy does not migrate that data.

Do not put credentials, data exports, cookies, `.env`, `.data`, `.netlify`, `node_modules`, `dist` or this checkout's temporary QA files into Git. Do not print secret values while diagnosing deployment. The Functions secret is named `ADMIN_PASSWORD`; its value belongs in Netlify, not a frontend `VITE_` variable or this file.

Keep stable development IDs, broker slugs, collection slugs and user IDs. Preserve conditional writes and revision checks. Do not overwrite the live store with fixtures or recreate production accounts to make a test pass. Use isolated storage in tests.

Follow the established design tokens and themes. Check narrow widths, native date inputs and 44px touch controls for mobile changes. Automated tests and rendered markup do not prove native Safari layout. Browser tooling in the previous session continued to report disabled after the user changed its setting; recheck current availability rather than assuming it works or remains disabled.

The last application change before this handover was `026d1b0` (pending assignment save), with the production build and 106 tests passing. The live deployment exposes `/release.json` with the deployed commit for verification. A source rollback does not roll back the live database.
