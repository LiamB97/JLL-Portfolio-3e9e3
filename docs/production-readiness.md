# Portfolio production readiness

Reviewed 27 October 2026. This is a code review and launch handover, not a penetration-test certification.

## Current safeguards

- Staff sign-up is invitation-only after the one-time owner setup. Passwords use salted scrypt hashes; invitations and session tokens are stored as hashes.
- Sessions expire after eight hours. Production cookies are HttpOnly, Secure and SameSite=Strict. Administrative writes validate the session, current role, origin and CSRF token. Account access changes revoke sessions; the final active Admin cannot be disabled.
- Persistent per-account failed-login limits protect password attempts. Netlify functions also have a best-effort per-instance request limit; this is not a distributed firewall or complete denial-of-service defence.
- Stock editing requires Admin or Broker admin access. Team activity, account administration and analytics settings require Admin access. Collection ownership is checked on the server.
- Website imports validate public HTTPS destinations and redirects, reject private IPs and credentials, and bound response sizes and durations. Imported records require review before ordinary publication. HTML is rendered as text rather than executed.
- Portfolio updates use conditional writes and retry conflicts. Public responses exclude account email, passwords, invitations, sessions and private stock provenance. Disabled brokers' links stop resolving.
- Buyer favourites stay in their browser. Buyer analytics require consent and use anonymous counts; no buyer email addresses, raw searches, commute destinations or WhatsApp message text are recorded by these events.
- Email sharing generates copy/mailto links; brochure email also offers an Outlook .eml draft containing the PDF attachment. Sending happens in the broker's email app; the portfolio never accepts recipient addresses or delivers messages. Share-button activity is not proof of a delivered message.

## Data and storage

Staff names, email addresses, WhatsApp numbers, password hashes, invitations, sessions, collection ownership and activity are personal or security-sensitive data. A buyer visiting a personal link sees the owning broker's name and WhatsApp number. Public links are intentionally shareable, not private buyer data rooms.

Production currently uses Netlify Blobs, with strongly consistent reads and conditional writes. This is suitable for the present small shared portfolio. Development uses SQLite. The production app does not yet provide scheduled independent backups or a tested point-in-time restore workflow. A source-code deploy rollback does **not** restore the live database.

Before a wider launch, agree an owner, retention policy and an encrypted backup/restore procedure for the production store with IT. Include accounts, collections, unpublished drafts, saved brochure metadata, the jll-brochure-files binaries and anonymous reporting aggregates; restrict backup access and rehearse restoration to an isolated environment. Do not commit database exports or credentials to Git.

If stock, staff counts or simultaneous writes grow substantially, assess a managed PostgreSQL database with automated backups and restore support. The present shared portfolio document serialises updates across stock and staff activity, so it should not be described as an unlimited-scale database. Moving data requires a planned migration preserving development IDs, collection links and account access.

## IT launch decisions

1. Prefer JLL-managed staff identity / SSO with MFA, especially for Admins. Current application login does not offer MFA. Enable MFA on the GitHub and Netlify owner/team accounts now through those services.
2. Confirm approved Netlify/GitHub organisation ownership, least-privilege team access, billing owner, incident contact, dependency-update ownership and a pre-launch security review. Keep server secrets in Netlify Functions environment variables, never frontend VITE variables.
3. Approve the staff/buyer privacy notices, analytics settings, retention periods and use of externally hosted development images. Source sites may remove or change image URLs; establish an approved durable media-storage process if required.
4. Configure the custom hostname in Netlify before IT creates the required DNS record. Netlify should issue and validate HTTPS for the hostname; test sign-in, broker links, collections and analytics there. Existing shared Netlify links continue to refer to their original hostname until a redirect is deliberately configured.
5. Keep the legacy hostname during transition. Verify whether any cookie scope, analytics property/domain settings, source-service allowlists or corporate policies need updating. Use a staging deploy to test headers/content-security policy before enforcing new restrictions that could break maps, photos or analytics.
6. Set up uptime/error monitoring and decide who responds when website imports, automatic stock refresh or external media fail. Review inactive staff accounts regularly and disable departed colleagues promptly.

These are operational decisions for IT and the product owner. No identity provider, paid database, new data processor or email delivery service has been introduced by this update.
