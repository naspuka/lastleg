# Privacy Policy (DRAFT — needs UK DPA review)

**Effective: [Date]**
**Version: 0.1 (draft)**

This Policy explains how LastLeg, operated by [Company Name] ("we"),
collects, uses, and protects your personal data. It complies with UK
GDPR and the Data Protection Act 2018.

## 1. Data controller

[Company Name], [Address], registered in [Jurisdiction]. Contact:
privacy@lastleg.app.

## 2. What data we collect

| Category | Source | Purpose |
|---|---|---|
| Email, phone | You, at signup | Account auth + transactional notifications |
| Display handle | You / derived from email | Public identifier |
| Buy/sell role | You, at signup | Personalising the dashboard |
| Stripe Connect account ref | You + Stripe, on first listing | Payouts |
| Stripe Identity record (passport / driving licence) | You + Stripe | KYC per FCA rules |
| Coach ticket PDFs | You, when listing | Verification + delivery to buyer |
| First name + initial (extracted from ticket PDF) | Parsed from PDF | Named-ticket disclosure (D016) |
| Booking reference, route, departure time | Parsed from PDF | Marketplace metadata |
| IP address, browser fingerprint | Vercel / PostHog | Fraud detection, debugging |
| Page view + click events | PostHog | Product analytics |

We **do not** store:
- Full passenger names (we extract first name + initial only — D016).
- Card details (Stripe handles them entirely).
- Government IDs (Stripe holds these via their Identity product).

## 3. Legal bases

- **Contract** (Article 6(1)(b)): processing necessary to operate your
  account and fulfil transactions.
- **Legitimate interests** (Article 6(1)(f)): fraud detection, security,
  analytics, marketing emails to existing customers.
- **Legal obligation** (Article 6(1)(c)): retention of transactional
  records for tax / audit (typically 7 years).

## 4. Third-party processors

| Processor | Region | Purpose |
|---|---|---|
| Clerk | US | Auth |
| Neon | EU | Database |
| Stripe | Global | Payments + KYC |
| Vercel | Global | Hosting + blob storage |
| Resend | Global | Transactional email |
| Twilio | Global | SMS (UK numbers only) |
| Inngest | Global | Background job orchestration |
| PostHog (EU instance) | EU | Product analytics |
| Sentry | EU | Error tracking |

Standard Contractual Clauses (SCCs) are in place with each processor that
is outside the UK / EEA.

## 5. Your rights

Under UK GDPR you have the right to:
- **Access** your data (Article 15)
- **Rectify** inaccuracies (Article 16)
- **Erase** your data (Article 17, subject to legal-hold exceptions)
- **Restrict** processing (Article 18)
- **Port** your data (Article 20)
- **Object** to legitimate-interest processing (Article 21)
- **Withdraw consent** (Article 7), where consent is the basis

To exercise any of these, email privacy@lastleg.app.

## 6. Retention

- Account data: retained while your account is active + 7 years post
  closure for transactional records.
- Coach ticket PDFs: retained 30 days after the trip departs; longer if
  required for an open dispute.
- Audit logs: retained 7 years.
- Soft-deleted accounts retain only the minimum data needed to preserve
  referential integrity (transactional history) and have PII redacted.

## 7. Cookies

We use:
- **Essential** session cookies (Clerk) — no consent required.
- **Analytics** cookies (PostHog) — consent required via banner.

You can withdraw cookie consent at any time via your browser settings or
the in-app cookie banner.

## 8. Security

- TLS for all client / server connections.
- Database encryption at rest via Neon.
- PII access limited to engineering and support roles, audit-logged.
- Webhook signatures verified on every Stripe / Clerk event.

## 9. Children

LastLeg is not for users under 18.

## 10. Complaints

If you believe we have mishandled your data, contact us first at
privacy@lastleg.app. You also have the right to complain to the UK
Information Commissioner's Office: https://ico.org.uk.

## 11. Changes

Material changes will be notified by email and posted here with a new
version number + effective date.
