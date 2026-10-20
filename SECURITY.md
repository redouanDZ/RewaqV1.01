# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover any security-related issues, please do not open a public issue. Instead, report it privately by sending an email to `security@rewaq.dz` or by creating a Private Vulnerability Report on GitHub Security tab.

## Content Security Policy (CSP)

This application implements a strict CSP via Helmet to mitigate XSS attacks:
- `script-src` relies entirely on external scripts without `'unsafe-inline'`.
- Form actions, framed ancestors, and objects are strictly limited.

**Technical Debt (`style-src`):**
Currently, `style-src` still includes `'unsafe-inline'` because there are approximately 585 instances of inline `style=""` attributes within the application templates. Removing them is deferred to a future UI refactoring phase. This is an accepted risk for now.

## Content-Security-Policy

- No page loads inline `<script>` blocks or inline event handlers anymore (UI actions use `data-action` delegation).
- By default the compatible policy is enforced and the **strict** policy (no `'unsafe-inline'` for scripts, `script-src-attr 'none'`) is sent as `Content-Security-Policy-Report-Only`.
- Set `CSP_STRICT=true` to enforce the strict policy after verifying the browser console is clean.
- Known technical debt: `style-src` still allows `'unsafe-inline'` (many inline `style=""` attributes).

