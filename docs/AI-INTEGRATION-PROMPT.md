# Prompt: connect the Zamzam Fashion frontend to the API

> Give this whole file to your AI coding agent as its task. It is written for the agent.
> Run the agent from the repository root, so it can read `docs/` and `frontend/`.

---

## Your role and goal

You are working in the **frontend** of Zamzam Fashion, a bilingual (Arabic RTL default, English) fashion and
custom-tailoring shop. The frontend in `frontend/` is a Next.js 16 + React 19 + Tailwind 4 + zustand app that
today runs entirely on **mock data** (`src/data/seed.ts` + `src/store/useZamzamStore.ts`, saved in localStorage).

The backend, a .NET 10 API with **47 endpoints**, is **finished and tested**. Your job is to **replace every
mock with real API calls**, add the pages and admin screens the API needs, and keep the existing look.

When you are done: a customer can browse, order, track an order and request a tailored piece; the owner can log
in and manage **everything** (catalog, photos, stock, orders, quotes, delivery zones, tailoring catalog, price
rules, site content) from the admin panel. No mock data is left.

## Read these first, in this order

1. `frontend/AGENTS.md`: **this Next.js version has breaking changes**. Read the relevant guides in
   `frontend/node_modules/next/dist/docs/` before writing routing or data code. Don't trust your memory of Next.js.
2. `docs/FRONTEND-INTEGRATION.md`: setup, the API client to use, the 8 rules, mock → API mapping. **It is binding.**
3. `docs/API-CONTRACT.md`: every endpoint with payloads, responses, rules and error codes (look up by `#number`).
4. `docs/openapi.json`: the machine-readable source for the generated types.
5. The current frontend: `src/app/page.tsx`, `src/store/useZamzamStore.ts`, `src/types/zamzam.ts`, and the views
   in `src/components/views/`.

## Hard rules

1. **Don't change anything outside `frontend/`.** Not the backend, not `docs/`, not `openapi.json`. If the API is
   missing something or the docs are wrong, **stop that task and report it** (format at the end). Don't work
   around it with a hack, a fake value or a second data source.
2. **The browser calls only `/api/...` on its own origin.** `next.config.ts` already forwards it to the API.
   Never call `http://localhost:5055` from browser code. (Server components may use `process.env.API_URL` for
   public GET endpoints only.)
3. **All requests go through the one typed client** in `src/lib/api.ts` (section 3 of the integration guide).
   Types come only from the generated `src/types/api.ts`. Never hand-write API types, never edit the generated file,
   no `any` for API data.
4. **Keep the design.** Same components, Tailwind classes, colors, fonts and animations. New screens copy the
   style of the existing admin screens. Don't add a UI library.
5. **Both languages everywhere.** Every new text has Arabic and English (use the store's `t(ar, en)`), RTL
   layout stays correct, and API text is shown from the field of the current language (`nameAr` / `nameEn`).
6. **No secrets in the frontend.** No keys, passwords or connection strings in code or committed `.env` files.
7. **Every screen handles 4 states:** loading, empty, error (a readable message, not a crash) and data.
   Buttons that send a request are disabled while it runs (no double orders).
8. **Small steps.** One phase = one git branch (`feature/fe-phase-N-…`) with small commits. After each phase run
   `npm run lint` and `npm run build`; both must pass before the next phase.
9. **Don't delete the mock store first.** Move one area at a time to the API; delete `src/data/seed.ts` and the
   mock actions only in phase 9, when nothing uses them.

## Setup (phase 0)

Follow `docs/FRONTEND-INTEGRATION.md` sections 1–3:

- The API runs locally (`dotnet run --project backend/src/Zamzam.Api` on port 5055); the owner gave you the dev
  settings and the owner login separately.
- `npm i openapi-fetch` · `npm i -D openapi-typescript` · add a script
  `"api:types": "openapi-typescript ../docs/openapi.json -o src/types/api.ts"` and run it (keep the **relative** path).
- Create `src/lib/api.ts` exactly as in section 3 of the guide (CSRF header, `zamzam:signed-out` event, `problem()`).
- Put the calls for each area in its own small module: `src/lib/catalog.ts`, `orders.ts`, `tailoring.ts`,
  `auth.ts`, `admin/*.ts`. Components call these functions, not `api.GET` directly.

**State:** keep zustand for UI state (language, current view, toasts) and for the **cart** and the
**"my orders" list** (both persist in localStorage). Server data is fetched by the area modules and held in the
store slices or component state with loading/error flags. Don't add another state or data-fetching library.

**Done when:** `npm run api:types` generates the types, `npm run build` passes, and a test call to
`GET /api/site-settings` through `src/lib/api.ts` returns data.

---

## Phase 1: storefront, read only

| Screen | Endpoints |
|---|---|
| `TopBanner`, `Navbar`, `Footer`, contact and social links | #8 `GET /api/site-settings` (note `contact.whatsApp`, `social.tikTok`) |
| `HomeView` (hero, new collection, categories, latest products) | #8, #5 `GET /api/categories`, #6 `GET /api/products?sort=newest&pageSize=8` |
| `ShopView` + `ProductCard` (filters, search, sort, paging) | #6 with `category` (slug), `q`, `size`, `color`, `minPrice`, `maxPrice`, `inStock`, `sort`, `page`, `pageSize` |
| Product details (`VariantPicker`) | #7 `GET /api/products/{slug}` |

- Categories are a **tree** (`children[]`, depth 2); filtering by a parent includes its children.
- Images: `image.url` as `src`, `image.srcSet` + a `sizes` attribute; `image` can be `null` (show the existing placeholder).
- A product page needs a shareable address: add the route **`/products/[slug]`** (read the Next 16 routing docs).
  The shop cards link to it.

**Done when:** home, shop (every filter and sort) and product pages show the dev database's products in both languages.

## Phase 2: cart on variants + checkout

| Step | Endpoints |
|---|---|
| Variant choice | From #7: the customer picks size + color → that is **one variant** (`variants[].id`). Disable combinations that don't exist or have `inStock: false` |
| Cart | Store `{ variantId, qty }` plus display data (name, size, color, price, image) |
| Delivery | #9 `GET /api/delivery-zones`: governorate list with `fee` and `etaDaysMin`–`etaDaysMax`; replaces the single `settings.deliveryFee` |
| Place order | #10 `POST /api/orders` with header `Idempotency-Key` |

- Body: `customer { name, phone, email?, deliveryZoneId, city, address, notes? }`, `lines [{ variantId, qty }]`,
  `paymentMethod: "CashOnDelivery"`, `expectedTotal` (cart subtotal + zone fee), `acceptTerms: true`.
  Validation limits are in the contract (#10); show field errors from `errors{}` on `400 VALIDATION_FAILED`.
- **Idempotency:** create the key with `crypto.randomUUID()` when the customer presses "Place order"; if the request
  fails on the network, retry with the **same** key; a new attempt after editing the cart gets a **new** key.
- `409 OUT_OF_STOCK` → show which items (`items[]` with `available`) and let the customer fix the cart.
  `409 PRICE_CHANGED` → show the new `total` and ask to confirm (send again with the new `expectedTotal`).
- Show "only N left" only when `variant.stock` is a number (it is `null` when more than 5 remain).
- After `201`: clear the cart, **save `{ number, trackingToken, createdAt }` to the "my orders" list**, show the
  order number and go to its tracking page.

**Done when:** an order placed in the UI appears in the dev database with the right lines, zone fee and total, and
each error above is shown correctly (test `OUT_OF_STOCK` by ordering more than the stock).

## Phase 3: tracking, "my orders", quote answers

| Screen | Endpoints |
|---|---|
| Route **`/track/[number]`** reading `?t=` (the token) | #11 `GET /api/orders/{number}` with header `X-Tracking-Token` |
| `OrdersView` ("my orders") | #11 for each saved `{ number, trackingToken }` |
| Quote answer on a custom order in `QuoteSent` | #15 `POST /api/orders/{number}/quote/approve` · #16 `.../quote/reject` (`{ reason }`) |

- **The route is required**: order and quote emails link to `/track/{number}?t={token}`. Opening that link on any
  device must show the order without logging in. Also save it to "my orders" on that device.
- Show the `timeline[]` (status history), masked name and phone, lines, totals and payment status.
  For a Custom order show `tailoring` (estimate, quoted price, note, `quoteValidUntil`) and the Approve/Decline
  buttons only in `QuoteSent`. `422 QUOTE_EXPIRED` → explain the quote has expired.
- `404` means a wrong number **or** token: one message for both ("Order not found; check the link").
- Status names and labels: section 5 of the guide (the old mock names like `review` no longer exist).

**Done when:** the tracking link of a real order works in a private window, and approving a quote moves the
order to `QuoteApproved`.

## Phase 4: custom tailoring

| Step | Endpoints |
|---|---|
| Form options | #12 `GET /api/tailoring/catalog`: garments, styles, fabrics, fits, measurement groups, standard sizes, extras, lining price |
| Live price | #13 `POST /api/tailoring/estimate`: call it (debounced, ~400 ms) whenever garment, style, fabric, fit, lining, sizing mode, size or extras change |
| Send | #14 `POST /api/tailoring/requests`: **multipart**: `data` = the request as a JSON string, `referenceImage` = optional photo; header `Idempotency-Key` |

- The measurement fields to show depend on the chosen garment's `measurementGroups`; values are cm (1–300).
  In `StandardSize` mode send `standardSize` and no measurements.
- Show `estimatedPrice` and its `items[]` (`labelAr`/`labelEn`, `amount`) and the note (`noteAr`/`noteEn`).
- Photo: JPEG/PNG/WebP, max 5 MB (check before sending); `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FILE_TYPE`.
- On `201`: save `{ number, trackingToken }` to "my orders" like an order and go to its tracking page
  (status `AwaitingQuote`).

**Done when:** a request with and without a photo is created, the estimate matches the price shown on the
tracking page, and the owner sees it in the admin board (phase 6).

## Phase 5: admin login and session

| Step | Endpoints |
|---|---|
| Login screen (replaces the passcode) | #1 `POST /api/auth/login { email, password, rememberMe }` |
| Session check when the admin opens | #3 `GET /api/auth/me` (401 → show login) |
| Change password | #4 `POST /api/auth/change-password { currentPassword, newPassword }` (min 10 characters) |
| Logout | #2 `POST /api/auth/logout` |

- The session is an **httpOnly cookie**: never store a token or the password anywhere.
- `mustChangePassword: true` from login or `/me` → show the change-password screen before anything else.
- `401 INVALID_CREDENTIALS` → one message for wrong email or password; `423 LOCKED_OUT` → show
  `retryAfterSeconds`; `429` (5 tries/min) → "too many attempts, wait a minute".
- Listen for the `zamzam:signed-out` event from `src/lib/api.ts` and go back to the login screen.
- Add the route **`/admin/orders/[id]`**: the owner's new-order emails link to it. It opens the admin panel on
  that order (after login if needed).

**Done when:** login, wrong password, lockout, logout and an expired session all behave as described, and
`/admin/orders/{id}` opens the right order.

## Phase 6: existing admin screens

| Screen | Endpoints |
|---|---|
| `AdminOverview` | #47 `GET /api/admin/dashboard`: today's orders, waiting counts (`pendingConfirmation`, `awaitingQuote`, `waitingForCustomer`, `inProduction`, `readyToShip`), 30-day delivered revenue, `lowStock[]`, `latestOrders[]` |
| `AdminCategories` | #17 tree with `productCount` and hidden ones · #18 create · #19 update (same body) · #20 delete (`409 IN_USE` when it has products or sub-categories) |
| `AdminProducts` | #21 table (`q`, `categoryId`, `isVisible`, `lowStock=true`, `sort`, `page`, `pageSize`) · #25 delete (soft delete if it was ever ordered) · show/hide = #24 with `isVisible` |
| `AdminOrders` | #35 board (`status` can repeat, `type`, `q` = number/phone/name, `from`, `to`, paging) · #36 details (unmasked customer, lines, tailoring spec with a 10-minute photo link, history with who changed it) · #37 change status `{ to, note }` |
| `AdminSettings` | #43 get · #44 save (announcement, hero, collection, contact, social; social links must start with `https://`) |

- Status buttons offer only the **allowed next moves** (contract Appendix A); `409 INVALID_STATUS_TRANSITION`
  → reload the order.
- `409 DUPLICATE` (slug) → show it on the slug/name field.

**Done when:** every action on these screens changes the dev database and the storefront shows the change.

## Phase 7: product editor (variants and photos)

| Part | Endpoints |
|---|---|
| Load / create / save product | #22 get (real stock and `version` per variant) · #23 create (optionally with first variants) · #24 update |
| Variants (size × color, stock, price override, SKU) | #26 add · #27 update **with `version`** · #28 delete |
| Photos | #29 upload (**multipart**: `file`, `altAr`, `altEn`; max 5 MB, 10 per product) · #30 delete |

- `409 CONCURRENCY_CONFLICT` on #27 → "someone changed this, reload" and reload the product.
- `409 DUPLICATE` on #26 → that size + color already exists.
- The first photo is the main photo; show uploads with a progress/disabled state.

**Done when:** the owner can build a complete product (photos, 3 sizes × 2 colors with stock) from an empty form
and it appears correctly in the shop.

## Phase 8: new admin screens

The API is ready; the mock app has no screen. Add each as a new admin tab, styled like the existing ones.

| Screen | Endpoints | Notes |
|---|---|---|
| **Colors** | #31 list (`usageCount`) · #32 add · #33 update · #34 delete | Name AR/EN + hex with a color swatch; delete is refused (`409 IN_USE`) while a variant uses it |
| **Delivery zones** | #41 list (27 governorates, incl. inactive) · #42 save (bulk: `[{ id, fee, etaDaysMin, etaDaysMax, isActive }]`) | One editable table with one Save button |
| **Tailoring catalog** | #39 get · #40 replace whole catalog | Garments, styles, fabrics, fits, measurement groups and fields, each with `isActive` |
| **Price rules** | #45 get · #46 replace | `garmentBasePrices`, `styleBasePrices` (optional overrides), `fabrics[].extra`, `liningPrice`, `sizeExtras`, `extras` |
| **Quote** (inside a Custom order's details) | #38 `POST /api/admin/orders/{id}/quote { price, note, validDays }` | Same price as the estimate → goes straight to `QuoteApproved`; a different price → `QuoteSent` and the customer is emailed the approval link |

**Done when:** each screen saves and the change is visible where it's used (zone fee at checkout, catalog and
prices in the tailoring form, quote on the tracking page).

## Phase 9: clean-up and final check

- Delete `src/data/seed.ts`, the mock actions and the old mock types that nothing uses. `grep` for `seed` and
  `localStorage` (only the cart, language and "my orders" may stay).
- `npm run lint` and `npm run build` with no errors.
- Run the **test list** below in both languages, on a phone width (~400 px) and on desktop.

## Test list (all must pass)

1. Home, shop (each filter, sort and page), product page, in Arabic and English.
2. Order 2 items → order number shown, cart empty, order in "my orders", tracking page works.
3. Order more than the stock → `OUT_OF_STOCK` message, nothing ordered.
4. Tailoring request with photo → estimate shown, request created, appears in admin.
5. Admin: login, wrong password, logout, change password.
6. Admin: create category → product with 2 photos and 4 variants → visible in shop → hide it → gone from shop.
7. Admin: move an order Confirmed → Packing → Shipped → Delivered; cancel another and check its stock came back.
8. Admin: quote a custom order with a new price → customer approves from the tracking link → `QuoteApproved`.
9. Admin: change a zone fee, a color, a price rule and the site banner → each shows on the storefront.
10. Open `/track/{number}?t={token}` and `/admin/orders/{id}` directly in a new tab.

## If the API doesn't fit

Stop that task, continue with another one, and add an entry to `frontend/API-GAPS.md`:

```
### <short title>
- Endpoint: #NN METHOD /api/...
- Screen: <view or component>
- Expected: <what the screen needs>
- Actual: <what the API returns or refuses, with the response body and traceId>
```

The backend developer fixes it, re-exports `docs/openapi.json`; you run `npm run api:types` and continue.

## Final report

When all phases are done, reply with:

1. A table: phase → branch → status → anything left out.
2. Every entry in `frontend/API-GAPS.md` and whether it was resolved.
3. The test list with pass/fail for each item.
4. Anything you changed in the design and why.
