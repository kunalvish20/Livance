# LIVANCE — Exact original UI + Supabase / email integration

This package upgrades the supplied `Livance-Exact-UIUX-React-Project` without replacing the two original 2.1 MB HTML interfaces. The **customer website and admin interface retain their original CSS, layouts, image assets and screen templates**; their database, login, enquiry, booking-request and email hooks are connected to a Node/Express + Supabase backend. The site is served by React/Vite with the original interfaces embedded in a same-origin iframe. **This is not a native React component-for-component rewrite.**

> **Scope transparency:** The database and email integrations are implemented and their static code checks pass. No user's Supabase or Resend credentials were supplied, so a live API, actual delivery, `npm install`/Vite build, and deployment could not be verified here. Completing the instructions below and an end-to-end live acceptance test is necessary before launch.

## Fast start (Windows PowerShell)

1. Install Node.js 20.19+ or 22.12+.
2. Create a Supabase project and run these files in **Supabase SQL Editor**, in order:
   - `sql/001_schema.sql`
   - `sql/002_make_admin.sql` **after** the admin Auth user exists; set email in that file if needed
   - `sql/003_live_bridge.sql`
3. In Supabase **Authentication > Users > Add user**, create your admin with a new private strong password. `002_make_admin.sql` promotes that user to `admin` in `public.profiles` (check its final SELECT). Never deploy the demo password as a real credential. Other users can sign up through the actual Supabase Auth flow.
4. Copy `.env.example` to `.env` and fill **all four** Supabase variables with your project URL and publishable/anon key. Do **not** use a service role key in any `VITE_*` variable.
5. For real email sending, set `RESEND_API_KEY`, `EMAIL_FROM` (a verified sender), `NOTIFY_EMAIL`, and `PUBLIC_SITE_URL`. For Supabase Auth signup/verification mail, also configure custom SMTP under Supabase Auth settings if the built-in mail quota is insufficient.
6. Install and run:

```powershell
Copy-Item .env.example .env
# Edit .env, then:
npm install
npm run check
npm run dev
```

| Address | Use |
|---|---|
| `http://localhost:5173/` | Original public website, backed by Supabase where integrated |
| `http://localhost:5173/admin` | Original admin portal — real Supabase administrator login required |
| `http://localhost:3001/api/v2/health` | API configuration/status (never returns secrets) |
| `http://localhost:5173/connected.html` | Legacy independent starter, **not** the primary app / not in production build |

With missing `.env` keys, the original UI still opens as an explicitly labeled **preview**. Preview transactions, credentials, and sample data are not live database operations.

## What is connected

| Feature | Status / behavior |
|---|---|
| Public and admin look, layout, colors, forms, popups, photos | Original HTML/CSS preserved; source scripts receive integration hooks |
| Sign in, sign up, sign out | Real Supabase Auth; signup email verification follows Supabase settings |
| Admin permissions | Server validates JWT using `auth.getUser` and `profiles.role`; protected by Supabase RLS |
| Admin website data: centres, rooms, posts, page content, coupons, CRM records, docs templates | Admin changes save to Supabase JSONB state, with version-based conflict protection; safe catalogue published separately |
| Public contact/lead form | Validated, rate-limited request stored in `livance_enquiries`, listed in the admin CRM; optional notification to `NOTIFY_EMAIL` |
| Booking UI | Member can submit **booking requests** to Supabase; separate from payment; requests visible to member and admin |
| Booking confirmation | Admin can update connected booking statuses; DB prevents overlapping **confirmed** room slots |
| Individual CRM emails, proposal emails, KYC notifications, support emails triggered by admin | Real server-side Resend API when configured; status/error surfaced. Proposal emails are **text summaries**, not attached PDFs |
| Marketing campaigns | Only explicitly opted-in contact submissions; capped at 20 per action; unsubscribe token links; provider acceptance recorded |
| Secret handling | Resend key is server-only, JWT-validated administrative email endpoint; no service-role key in frontend |
| Older connected React starter | Preserved as source for reference, not part of current primary UI |

## Not yet production-complete

- **Online payment processing is NOT enabled.** Original simulated payment success was replaced with an explicit booking request that takes **no money**. No real Razorpay orders, verified payments, refunds, settlements, or invoice generation are implemented. Do not charge customers or display a paid status without verified settlement.
- **Zoho Books/API integration is NOT implemented.** The original screens are retained for design comparison, but invoices and tax/accounting synchronization are not authoritative.
- **Real KYC document storage and handling is NOT implemented.** Configure secure Supabase Storage and document access policies before accepting any sensitive uploads. Demo KYC screens should not be treated as an operational verification system.
- **Staff Auth provisioning / employee role policies are NOT complete.** The UI no longer creates fake staff invitations in connected mode. The current backend authorizes true admins for admin modules; team access needs separate provisioning and permission/RLS logic.
- **Member support tickets, credits ledger, subscriptions, signed document generation, proposal client acceptance, and invoice files** are not fully normalized and integrated across accounts/devices. Their historical demo UI is retained, but do not use these modules for live financial/legal decisions until implemented.
- The exact-interface iframe has **SEO/accessibility drawbacks** compared with server-rendered native React components. Search engine indexing and analytics for in-frame routes are not equivalent to ordinary standalone routes.
- In-memory API rate limiting is a development safeguard, **not** reliable distributed/serverless anti-bot protection. Add Turnstile and a shared rate limiter (e.g., Redis/Upstash) before public marketing campaigns.
- Admin state sync uses one versioned JSONB document; it is suitable for getting the exact admin demo data connected, **not** a long-term replacement for separate normalized relational modules, audit trails, and background jobs. Admin edits from concurrent sessions fail with a conflict rather than overwriting silently.

## Supabase tables

Original starter (`001`): `profiles`, `locations`, `rooms`, `bookings`, `leads`, `tickets`, `content`, `coupons`.

New live bridge (`003`): `livance_state` (admin-only original UI state), `livance_public_state` (public catalogue fields only), `livance_enquiries`, `livance_booking_requests`, `livance_email_logs`, `livance_suppressions`, and `livance_unsubscribe_tokens`. All have RLS. A database trigger publishes only safe catalogue fields after an admin updates state. New public enquiries and authenticated booking requests are stored as first-class rows.

**First-time admin bootstrap:** The first real admin login initializes the new JSONB state from original catalogue, published blog/demo content, and templates, stripping dummy users, sample bookings, fake payments, and demo CRM contacts. The admin must review and publish legitimate prices, coupons, and page copy before launch.

## Real email checklist

1. Create a verified sender domain at [Resend](https://resend.com/); add their DNS records.
2. Set `RESEND_API_KEY`, `EMAIL_FROM` and `NOTIFY_EMAIL` on the Node server and Vercel. **Do not** prefix secrets with `VITE_`.
3. Log into the `/admin` interface using the Supabase admin account.
4. Create a test enquiry from the public Contact page. Verify it appears in **CRM** and that the notification is accepted by your mail provider.
5. From an admin CRM lead, enter email subject + message and click **Send email**. API checks admin auth, sends via Resend, and stores a status log. Mail accepted by Resend does not guarantee inbox delivery; inspect Resend activity, DNS/SPF/DKIM and recipient spam folder.
6. Marketing campaigns only send to users who checked the **optional offers email consent** box. An unsubscribe link is sent with every marketing email when `PUBLIC_SITE_URL` is set.

## Vercel + Supabase deployment

The repo includes `api/index.js` and `vercel.json`, with Vercel routes for Express APIs and the SPA admin entry. Vercel project: **Framework Vite**, root directory repository root, build command `npm run build`, output `dist`. Under Project Settings > Environment Variables set:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
RESEND_API_KEY
EMAIL_FROM
NOTIFY_EMAIL
PUBLIC_SITE_URL=https://YOUR-VERCEL-DOMAIN
CLIENT_ORIGIN=https://YOUR-VERCEL-DOMAIN
```

After deployment, update Supabase **Authentication > URL Configuration**: add your deployed site URL and valid redirect URLs. For custom SMTP email verification links, verify allowed redirect URLs. Deploy and verify `https://YOUR-VERCEL-DOMAIN/api/v2/health` and an authenticated CRM email request before accepting real enquiries. Domain and provider setup cannot be completed from a ZIP alone.

## Minimum acceptance checks

- Open `/` and `/admin`: CSS, images, responsive nav match both supplied HTML originals.
- Try `/admin` without login and with a regular member: should show login/access denial; administrator can enter.
- Create and verify user signup, logout, and login; private credentials never stored in original demo DB.
- Send enquiry; refresh admin CRM in another browser; verify newly inserted row appears.
- Send individual CRM email with provider enabled; verify `livance_email_logs` and Resend event details.
- Make a booking request; check member + admin views; confirm no payment charge or paid receipt.
- Update a centre or room from admin; reload a separate browser and confirm persisted changes.
- Inspect Supabase table RLS as anon and user: `livance_state` and admin email logs must not be readable.
- Run `npm run check`; then `npm run build` with dependencies installed and inspect browser console.

## Source map

- `client/public/reference/livance-public.html` — original public HTML, patched integration hooks
- `client/public/reference/livance-admin.html` — original admin HTML, patched integration hooks
- `client/src/live-bridge.js` — in-browser authenticated bridge to backend
- `client/src/main.jsx` — invisible React iframe host and configuration/errors
- `server/live.js` — secured new API: snapshots, leads, booking requests, emails, unsubscribes
- `server/index.js` — legacy starter APIs and the new Express router
- `sql/003_live_bridge.sql` — migrations and RLS for the exact UI bridge
- `reference/` — pristine original HTML files retained for design comparison
- `tests/static-check.mjs` — syntax/contract checks (not an end-to-end live API test)
