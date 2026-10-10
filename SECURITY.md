# Security notes — tedet.partnerx.asia

Static site on GitHub Pages: no login, no forms, no backend. Profiles and scores stay in the browser's localStorage.

Source: PartnerScan external self-test 2026-10-08 (engagement 2026-10-partnerx-selftest).

| Finding | Decision |
|---|---|
| `readme-md` | **Accepted.** README.md is a parent-facing intro and holds nothing private. The repo is public, so the same text is on GitHub anyway. |
| `missing-sri` (Google Fonts) | **Fixed.** Fonts are self-hosted in `fonts/` (Thai + Latin subsets, SIL OFL 1.1). The pages make no third-party requests. |
| `http-missing-security-headers` | **Partly mitigated, rest accepted.** Every page has a `<meta>` CSP (no outside fetch/fonts/scripts, `object-src`/`base-uri`/`form-action` none) and `<meta name="referrer">`. GitHub Pages cannot send HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, COOP/CORP/COEP or X-Permitted-Cross-Domain-Policies. With no login and no state-changing actions, the risk (mainly clickjacking) is low. HTTPS is enforced in the Pages settings. |
| `fastly-debug-headers` | **Accepted.** GitHub's CDN adds this header; we cannot change it. |

If full headers are ever needed, put the domain behind a Cloudflare proxy (DNS change by Boon) and set them there.

CSP note: `'unsafe-inline'` is needed because each page is one self-contained HTML file. If a new page loads anything from another origin, update the CSP line in `exam-bank-template.html` and `index.html`.
