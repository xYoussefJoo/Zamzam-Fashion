# Zamzam Fashion — Frontend Integration Guide

For connecting the Next.js app in `frontend/` to the .NET API. The full detail of every endpoint is in
[`API-CONTRACT.md`](API-CONTRACT.md); this guide is the short path through it.

> **Until launch, everything runs on your own PC.** The API is deployed to MonsterASP only at the end.

---

## 1. Run the API locally (once)

You need the **.NET 10 SDK** (`dotnet --version` → 10.x).

```powershell
cd backend
# Asks for the dev database and storage settings. Youssef sends you the values privately (never in git or chat).
powershell -ExecutionPolicy Bypass -File .\scripts\set-secrets.ps1
dotnet run --project src/Zamzam.Api
```

- The API listens on **http://localhost:5055**. Check it: http://localhost:5055/health → `{"status":"Healthy",...}`.
- `next.config.ts` already forwards `/api/*` to it, so the browser only ever calls **`/api/...` on your own site**
  (`http://localhost:3000/api/...`). Never call `localhost:5055` from the browser: the login cookie would not work.
- The dev database is **shared** with Youssef. Products, orders and photos you create are seen by both of you.
- Admin login: the owner account of the dev database (Youssef sends the email and password privately).

## 2. Generate the TypeScript types (and after every API change)

```bash
cd frontend
npm i openapi-fetch
npm i -D openapi-typescript
npx openapi-typescript ../docs/openapi.json -o src/types/api.ts
```

Keep the **relative** path `../docs/openapi.json`: the repo folder has a space in its name ("Zamzam Fashion"),
and the generator fails on an absolute path with a space.

`src/types/api.ts` is generated: never edit it by hand. When the backend changes, `docs/openapi.json` is
re-exported and you run the last command again; TypeScript then shows every place that needs a change.

## 3. One API client for the whole app

Create `src/lib/api.ts`. Every call goes through it, so the rules in section 4 are applied automatically.

```ts
import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "@/types/api";

// Same origin: Next.js forwards /api to the .NET API, so the auth cookie stays first-party.
export const api = createClient<paths>({ baseUrl: "" });

const zamzam: Middleware = {
  onRequest({ request }) {
    const path = new URL(request.url).pathname;
    const changesData = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    // CSRF guard: required on every admin/auth write, otherwise 400 MISSING_CSRF_HEADER.
    if (changesData && (path.startsWith("/api/admin") || path.startsWith("/api/auth")))
      request.headers.set("X-Requested-With", "zamzam-admin");
    return request;
  },
  onResponse({ response }) {
    // Session expired or never signed in: let the admin layout send the owner to the login screen.
    if (response.status === 401 && new URL(response.url).pathname.startsWith("/api/admin"))
      window.dispatchEvent(new Event("zamzam:signed-out"));
    return response;
  },
};
api.use(zamzam);

// Every error is RFC 9457 ProblemDetails with a machine-readable code, except 401/403/429 (empty body).
export type Problem = { status?: number; code?: string; title?: string; detail?: string;
                        errors?: Record<string, string[]>; [extra: string]: unknown };
export const problem = (error: unknown, response: Response): Problem =>
  ({ status: response.status, ...(typeof error === "object" && error ? (error as Problem) : {}) });

export type Schemas = components["schemas"];
```

Using it (typed request, typed response, typed path):

```ts
const { data, error, response } = await api.GET("/api/products", {
  params: { query: { category: "dresses", page: 1, pageSize: 20 } },
});
if (error) { const p = problem(error, response); /* show p.detail */ }
else data.items.forEach((card) => console.log(card.nameEn, card.minPrice));
```

These files are `"use client"` code. A **server** component can't use a relative `/api` URL: give it
`baseUrl: process.env.API_URL` instead (no cookie there, so public endpoints only).

## 4. The 8 rules

| # | Rule | Where |
|---|---|---|
| 1 | Admin/auth **writes** send `X-Requested-With: zamzam-admin` | Automatic (client above) |
| 2 | Checkout and tailoring requests send **`Idempotency-Key: <uuid>`**: one new `crypto.randomUUID()` per attempt; reuse the **same** key when the customer retries after a network error | `POST /api/orders`, `POST /api/tailoring/requests` |
| 3 | After checkout, **keep `number` + `trackingToken`** (localStorage list = "My orders"). Tracking sends the token in the **`X-Tracking-Token`** header, never in the API URL. The page URL `/track/ZF-10234?t=…` is what the email links to | #11, #15, #16 |
| 4 | **401, 403 and 429 have an empty body**: read `response.status`. 429 also has `Retry-After` (seconds) | Everywhere |
| 5 | Other errors: switch on **`code`**, not on the message: `OUT_OF_STOCK` (with `items[]`), `PRICE_CHANGED` (with the new `total`), `VALIDATION_FAILED` (with `errors{field: [...]}`), `DUPLICATE`, `IN_USE`, `CONCURRENCY_CONFLICT`, `INVALID_STATUS_TRANSITION`, `QUOTE_EXPIRED`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `NOT_FOUND` | Appendix B of the contract |
| 6 | Enums are **strings**: `"PendingConfirmation"`, `"Ready"`, `"CashOnDelivery"`… | Section 6 below |
| 7 | Images: use **`url`** (800 px) as `src` and **`srcSet`** (400/800/1600) with `sizes`; thumbnails in admin tables use the 400 px file | Product cards, gallery |
| 8 | Text comes **in both languages** (`nameAr` + `nameEn`, `descriptionAr`…): pick by the current language; money is a number in EGP (format it with `Intl.NumberFormat`) | Everywhere |

## 5. From the mock store to the API

The mock types in `src/types/zamzam.ts` and the API types differ in a few places that matter:

| Mock (today) | API | What changes |
|---|---|---|
| `Product.sizes[]` + `colors[]` (text) + `stock` | `variants[]`: each `{ id, sku, size, color{ id, nameAr, nameEn, hex }, price, inStock, stock }` | The picker chooses a **variant**. The cart keeps `variantId` + `qty`; checkout sends `lines: [{ variantId, qty }]` |
| `Product.price` | `minPrice` / `maxPrice` on cards, `price` per variant | A variant can cost more than the base price |
| `Product.stock` | `variant.stock` is **`null` when more than 5** are left | Show "only N left" only when `stock` is a number |
| `Product.visible` | `isVisible` (admin endpoints only) | The storefront only ever receives visible products |
| `Category { ar, en }` | `{ id, slug, nameAr, nameEn, imageUrl, sortOrder, children[] }` (a tree) | Filter the shop with `?category={slug}` (includes sub-categories) |
| `settings.deliveryFee` (one fee) | `GET /api/delivery-zones`: a fee and delivery time **per governorate** | Checkout shows a governorate list; the server adds the fee |
| `checkout()` computes the total | The server re-prices; you send `expectedTotal` | On `409 PRICE_CHANGED` show the new total and ask again |
| `login(passcode)` | `POST /api/auth/login { email, password }` → cookie; `GET /api/auth/me` | Check `/me` when the admin opens; `mustChangePassword: true` → show change-password first |
| `settings.whatsapp` / `tiktok` | `contact.whatsApp` / `social.tikTok` | Note the capitals |
| `CustomOrder.total: null` | `estimatedPrice` at once (from `/estimate`), later `quotedPrice` | The customer sees a price before sending |

### Order status names

| Mock | API | Order type |
|---|---|---|
| — | `PendingConfirmation` → `Confirmed` | Ready |
| `review` | `AwaitingQuote` | Custom |
| `quoted` | `QuoteSent` | Custom |
| `approved` | `QuoteApproved` | Custom |
| `production` | `InProduction` | Custom |
| `quality` | `QualityCheck` | Custom |
| — | `Packing` | Both |
| `shipping` | `Shipped` | Both |
| `done` | `Delivered` | Both |
| `cancelled` | `Cancelled` | Both |

The allowed moves are in Appendix A of the contract; the server refuses any other move with `409 INVALID_STATUS_TRANSITION`.

## 6. View → endpoints

### Storefront

| View | Calls |
|---|---|
| `TopBanner`, `Navbar`, `Footer`, `HomeView` | #8 `GET /api/site-settings` · #5 `GET /api/categories` · #6 `GET /api/products?sort=newest&pageSize=8` |
| `ShopView` + `ProductCard` | #6 `GET /api/products` (category, q, size, color, minPrice, maxPrice, inStock, sort, page) |
| Product details (`VariantPicker`) | #7 `GET /api/products/{slug}` |
| `CartView` (checkout) | #9 `GET /api/delivery-zones` · #10 `POST /api/orders` (+ `Idempotency-Key`) |
| `OrdersView` (my orders / tracking) | #11 `GET /api/orders/{number}` (+ `X-Tracking-Token`) · #15/#16 quote approve / reject |
| `CustomTailoringView` | #12 `GET /api/tailoring/catalog` · #13 `POST /api/tailoring/estimate` (as the form changes) · #14 `POST /api/tailoring/requests` (multipart: `data` = the JSON, `referenceImage` = optional photo; + `Idempotency-Key`) |

### Admin

| View | Calls |
|---|---|
| Login (new) | #1 login · #3 me · #4 change-password · #2 logout |
| `AdminOverview` | #47 `GET /api/admin/dashboard` |
| `AdminCategories` | #17–20 |
| `AdminProducts` | #21 (`?q=&categoryId=&isVisible=&lowStock=true&page=`) · #25 delete |
| `AdminProductEditor` | #22 get · #23 create · #24 update (incl. `isVisible`) · #26–28 variants (send `version` on update) · #29–30 photos (multipart: `file`, `altAr`, `altEn`) |
| `AdminOrders` | #35 board · #36 details · #37 status · #38 quote (custom orders) |
| `AdminSettings` | #43–44 site settings |

### Admin screens that don't exist yet

The API is ready for these; the mock app has no screen for them:

1. **Colors**: #31–34 (name AR/EN + hex; delete is refused while a variant uses it).
2. **Delivery zones**: #41–42 (27 governorates: fee, delivery days, active).
3. **Tailoring catalog**: #39–40 (garments, styles, fabrics, fits, measurement fields).
4. **Price rules**: #45–46 (base prices, fabric extras, lining, size extras, options).
5. **Quote** form on a custom order: #38.
6. **Photo upload** and **variant** editing in the product editor: #26–30.
7. **Change password**: #4.
8. **Login** screen with email + password: #1.

## 7. Suggested order of work

Each step works and can be checked on its own:

1. Types + `src/lib/api.ts` (sections 2–3).
2. **Read-only storefront**: settings, categories, shop, product details.
3. **Checkout + tracking**: cart on variants, delivery zones, place order, "My orders".
4. **Tailoring**: catalog, live estimate, request with photo, quote approve/reject.
5. **Admin login** + session check + change password.
6. **Existing admin screens**: overview, categories, products + editor, orders, settings.
7. **New admin screens** from the list above.

## 8. When something doesn't match

- The contract or `openapi.json` is wrong, or you need a field or filter that isn't there: tell Youssef with the
  endpoint number and an example. The backend changes, `openapi.json` is re-exported, you regenerate the types.
- An error you don't understand: the response has a `traceId`; the API console shows the same id with the cause.
- Limits to know while testing: login 5/min, order + tailoring requests 10 per 10 minutes (together),
  estimate 60/min, every request 300/min — all per IP. Hitting one returns `429`; wait for `Retry-After`.
