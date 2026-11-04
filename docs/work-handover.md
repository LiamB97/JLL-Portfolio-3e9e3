# Work GitHub, Netlify and Claude handover

Prepared 29 October 2026. Intended GitHub owner: **LiamB97**. The destination Netlify team has not yet been supplied. This document describes the handover; verify actual ownership in the services before marking the transfer complete.

## Current project

| Resource | Location before transfer |
| --- | --- |
| Canonical source | https://github.com/LiamBayford123/JLL-Portfolio |
| Deployment mirror | https://github.com/LiamBayford123/JLL-Portfolio-3e9e3 |
| Live project | https://subtle-malabi-144145.netlify.app/ |
| Intended canonical work repository | https://github.com/LiamB97/JLL-Portfolio |

Both current repositories are public. A repository ownership transfer does not itself make the code private. Repository IDs before transfer are `1434976721` (canonical) and `1435002122` (mirror); use those IDs and commit history to distinguish a transfer from an unrelated new repository.

The latest application change is the explicit **Save assignment & notes** action in Pending input. It saves metadata without replacing development edits, enforces revision/role checks, and leaves publishing separate. The build and 106 automated tests passed for that change.

## Preferred transfer sequence

1. Accept ownership of the canonical repository as `LiamB97` if GitHub sends a transfer invitation. Transfers between personal accounts require the recipient's acceptance; GitHub documents a one-day expiry. Check its stable repository ID, history and `main` before proceeding.
2. In the existing Netlify project, record its Project ID, current linked repository and Functions environment-variable names. Make an approved private backup of the critical stores below. Do not copy secret values or backup contents into this repository or a chat.
3. Transfer the **existing** Netlify project to the work team. Preserve its Project ID and existing `subtle-malabi-144145.netlify.app` hostname. Check the transfer warnings for the specific account plans and connections. If the accounts lack the required cross-team permissions, use Netlify Support rather than creating a replacement site and assuming its data will follow.
4. Authorise the Netlify GitHub App for the work repository, then change the existing project's linked repository to `LiamB97/JLL-Portfolio`, branch `main`. Confirm the account actually linking it can access the repository. The goal is one canonical work repository driving deployment.
5. Build using the checked-in Netlify configuration. Confirm `/release.json` identifies the intended commit. Check public stock, existing broker/collection links, staff login, saved collections, Pending input assignments and a draft save. Compare the critical stores and Project ID before and after transfer.
6. Open the work repository in the approved Claude setup and read `CLAUDE.md`. Update this checkout's `origin` to the verified new repository URL. After Netlify is confirmed to build from the work repository, stop double-pushing to the old deployment mirror. Transfer or archive the obsolete mirror separately under the agreed ownership policy; do not delete it during cutover.

GitHub redirects old repository URLs after a transfer, but Netlify's GitHub App permissions and linked-repository configuration still need verification. Do not create a replacement at the old GitHub path while relying on its redirect.

## Production data

Netlify Blobs are scoped to the Netlify project. Keeping the existing project identity is preferable to copying source into a new site. Confirm data retention with the actual transfer and maintain a private backup; a source archive is not a production database backup.

| Store | Keys/content | Treatment |
| --- | --- | --- |
| `jll-brochure-files` | `pdf/…` saved brochure files and `cover/…` shared cover photography; keys referenced by portfolio metadata | Preserve binaries together with the matching portfolio object |
| `jll-london-portfolio` | `portfolio`: published developments, accounts/password hashes, broker photos, profiles, collections, drafts, pending inputs/assignments, analytics configuration and staff activity | Critical; preserve the complete object and identifiers |
| `jll-team-engagement` | Daily date-keyed anonymous reporting aggregates | Preserve if reporting history is required; enumerate all pages of keys |
| `jll-transport` | TfL network and per-development route caches | Rebuildable cache |
| `jll-translations` | Translated copy caches | Rebuildable cache |
| Netlify build cache | Pending-source extraction cache | Rebuildable; the code preserves edited pending records |

The local SQLite database under `.data` is a separate development environment. `server/data/initial-portfolio.json` and prepared intake JSON do not contain the live staff accounts, saved work or full current stock. Do not restore those files over production to complete a migration.

If a new Netlify project is unavoidable, treat this as a separate data migration: preserve the old site, freeze changes during the final copy, export the critical stores privately, restore and validate them on the new project, then verify links and ownership before changing traffic. Preserve all IDs/slugs. Existing sessions may need a new sign-in, and browser favourites/consent do not move to a new origin. Keep existing shared URLs working deliberately; PDFs and sent WhatsApp links cannot be rewritten after delivery. No automatic cross-site restore endpoint has been added.

## Build and runtime

- Node: **24**, matching `netlify.toml`.
- Install: `npm ci`.
- Netlify build: `npm run build && node scripts/check-source-imports.mjs`.
- Publish: `dist`; Functions: `netlify/functions`.
- The local build plugin prepares source candidates without publishing them or placing them in `dist`.
- API routing and response headers are defined in `netlify.toml`.
- Stock refresh: scheduled function `refresh-stock`, every six hours.
- Keep `ADMIN_PASSWORD` configured as a server-side Functions secret. After owner setup, staff use their individual account passwords. Do not reset/rebootstrap production to transfer hosting.
- Netlify injects its own Blobs context for deployed functions. Do not hard-code a personal token or old Site ID into the application.
- Image URLs generally reference external JLL/developer media. Broker portraits are stored inside the private profile data. Saved brochure settings are in portfolio metadata; saved PDFs and the shared cover image are in the separate jll-brochure-files store. Preserve both when transferring the project.

## Continue in Claude

Use this prompt with the work repository:

> Read CLAUDE.md and docs/work-handover.md. Verify the GitHub owner, the Netlify Project ID and linked repository, and the deployed release before changing anything. Preserve the existing Netlify Blobs data and stable buyer links. Run the appropriate tests/build for changes and describe what was actually verified. Do not recreate accounts, overwrite production with seed data, or expose secrets.

No account password, token, live database export or staff session is included in this handover.

## Official references

- GitHub repository transfers: https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository
- Netlify project transfers: https://docs.netlify.com/manage/projects/transfer-project/
- Netlify repository linking: https://docs.netlify.com/build/git-workflows/repo-permissions-linking/
- Netlify Blobs: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
