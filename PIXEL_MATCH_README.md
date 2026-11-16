# Exact UI preservation / integration note

Both originally supplied HTML/CSS demos are preserved in `reference/` for comparisons.

The runnable Vite/React app serves the integrated copies at:
- `client/public/reference/livance-public.html`
- `client/public/reference/livance-admin.html`

**CSS and visuals remain identical to the originals; the embedded JavaScript has been patched to use authenticated Supabase-backed operations, real email requests, and an explicit no-payment booking-request flow.** They are displayed in a same-origin iframe controlled by `client/src/main.jsx` and `client/src/live-bridge.js`.

This is an original-interface integration, **not a full native React rewrite**. It needs `.env`, SQL setup and a live integration smoke test; see `README.md` and `QUICK_START_HINDI.md`.
