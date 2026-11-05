# Zamzam Fashion — API Contract

> **Version** 1.1 · 2026-11-05 · Generated from the same source as `Zamzam-API-Plan.docx` and `Zamzam-API-Specifications.docx`.
> The backend is built against this file, and the Next.js UI uses the same file. Change the route or shape here and in the docs together.

**47 endpoints:** 12 public · 4 auth · 31 admin (+ `GET /health`)

## 0. Conventions

| Topic | Rule |
|---|---|
| Stack | ASP.NET Core 10 Web API (Controllers) · Clean Architecture · PostgreSQL 17 · EF Core migrations · Next.js frontend |
| Routing | `/api/{resource}`, admin under `/api/admin/{resource}`. The browser calls `/api/*` on the site's own domain; Next.js forwards to the API |
| Users | **One Owner account.** Customers never log in (guest checkout). The role system stays in the code so staff can be added later |
| Auth | ASP.NET Identity httpOnly cookie `zz.auth` (Secure, SameSite=Strict, 8 h sliding). Lockout after 5 failed logins |
| CSRF guard | Every admin POST/PUT/PATCH/DELETE sends `X-Requested-With: zamzam-admin` |
| Customer access | Order number + `X-Tracking-Token` header (never in an API query string) |
| Format | JSON camelCase · money in EGP with 2 decimals · ISO-8601 UTC dates · bilingual fields `nameAr` + `nameEn` · phones stored as `+201xxxxxxxxx` |
| Pagination | `?page=1&pageSize=20` (max 100) → `{ items, page, pageSize, totalCount, totalPages }` |
| Errors | RFC 9457 ProblemDetails with `code` and `traceId` (see Appendix B) |
| Idempotency | `POST /api/orders` and `POST /api/tailoring/requests` require `Idempotency-Key: <uuid>` |
| Rate limits (per IP) | login 5/min · order and tailoring creation 10 per 10 min · tracking/quotes 30/min · estimate 60/min · other public GETs 120/min |


---

## 1. Identity & Auth APIs (`/api/auth`)

_Owner login. Customers never log in. One Owner account today; the role system stays in place so employees can be added later._

### #1 `POST /api/auth/login`

Authenticates the owner and sets the auth cookie.

- **Access:** Public · rate limit 5/min per IP · **Day 1**

**Payload**

```json
{
  "email": "owner@zamzam.com",
  "password": "Password123!",
  "rememberMe": false
}
```

**Response 200 OK**

```json
{
  "id": "a1b2c3",
  "fullName": "Owner Name",
  "email": "owner@zamzam.com",
  "role": "Owner",
  "mustChangePassword": false
}
```

**Errors**
- 401 INVALID_CREDENTIALS — same message whether the email or the password is wrong
- 423 LOCKED_OUT — after 5 failed attempts, with retryAfterSeconds

### #2 `POST /api/auth/logout`

Signs the user out and clears the cookie.

- **Access:** Owner · **Day 1**

**Response 204 No Content**

### #3 `GET /api/auth/me`

Returns the signed-in user. The Next.js admin layout calls it to protect routes.

- **Access:** Owner · **Day 1**

**Response 200 OK**

```json
{
  "id": "a1b2c3",
  "fullName": "Owner Name",
  "email": "owner@zamzam.com",
  "role": "Owner",
  "mustChangePassword": false
}
```

**Errors**
- 401 Unauthorized when not signed in

### #4 `POST /api/auth/change-password`

Changes the current user's password and clears mustChangePassword.

- **Access:** Owner · **Day 1**

**Payload**

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response 204 No Content**

**Rules**
- Minimum 10 characters, and not on the common-passwords list.

**Errors**
- 400 VALIDATION_FAILED


---

## 2. Storefront Catalog APIs (`/api`)

_Public, cacheable reads that power the home page, the shop and the product pages._

### #5 `GET /api/categories`

Returns the visible category tree, sorted by sortOrder.

- **Access:** Public · cache 5 min · **Day 2**

**Response 200 OK**

```json
[
  {
    "id": 1,
    "slug": "dresses",
    "nameAr": "فساتين",
    "nameEn": "Dresses",
    "imageUrl": "https://cdn…/dresses.webp",
    "sortOrder": 0,
    "children": [
      {
        "id": 7,
        "slug": "abayas",
        "nameAr": "عبايات",
        "nameEn": "Abayas",
        "imageUrl": null,
        "sortOrder": 0,
        "children": []
      }
    ]
  }
]
```

### #6 `GET /api/products`

Paged product list with filters, search and sorting. Only visible products in visible categories are returned.

- **Access:** Public · **Day 2**
- **Query:** `?category={slug}&q={text}&size=M&size=L&color={id}&minPrice=&maxPrice=&inStock=true&sort=newest|price_asc|price_desc|name&page=1&pageSize=20`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": 12,
      "slug": "modest-abaya",
      "nameAr": "عباية محتشمة",
      "nameEn": "Modest Abaya",
      "category": {
        "id": 3,
        "slug": "dresses",
        "nameAr": "فساتين",
        "nameEn": "Dresses"
      },
      "minPrice": 1250,
      "maxPrice": 1250,
      "image": {
        "url": "https://cdn…/12-800.webp"
      },
      "colors": [
        {
          "id": 3,
          "nameEn": "Beige",
          "hex": "#d6b995"
        }
      ],
      "sizes": [
        "M",
        "L",
        "XL"
      ],
      "inStock": true
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 134,
  "totalPages": 7
}
```

**Rules**
- A category filter includes all of its sub-categories.
- q searches the Arabic name, English name and SKU (minimum 2 characters).

### #7 `GET /api/products/{slug}`

Product page: gallery, description and every variant with its price and stock.

- **Access:** Public · **Day 2**

**Response 200 OK**

```json
{
  "id": 12,
  "slug": "modest-abaya",
  "nameAr": "عباية محتشمة",
  "nameEn": "Modest Abaya",
  "descriptionAr": "…",
  "descriptionEn": "…",
  "images": [
    {
      "id": 40,
      "url": "…-800.webp",
      "srcSet": "…-400.webp 400w, …-800.webp 800w",
      "altEn": "Front view"
    }
  ],
  "variants": [
    {
      "id": 501,
      "sku": "ZF-12-M-beige",
      "size": "M",
      "color": {
        "id": 3,
        "nameEn": "Beige",
        "hex": "#d6b995"
      },
      "price": 1250,
      "inStock": true,
      "stock": 3
    }
  ]
}
```

**Rules**
- Public stock is null when there are more than 5 pieces; the UI shows "only N left" when 5 or fewer remain.

**Errors**
- 404 Not Found if missing or hidden

### #8 `GET /api/site-settings`

Editable home page content: announcement bar, hero, new collection, contacts and social links.

- **Access:** Public · cache 5 min · **Day 2**

**Response 200 OK**

```json
{
  "announcementAr": "توصيل لجميع المحافظات",
  "announcementEn": "Delivery across Egypt",
  "hero": {
    "titleAr": "",
    "titleEn": "",
    "subtitleAr": "",
    "subtitleEn": "",
    "imageUrl": ""
  },
  "collection": {
    "enabled": true,
    "titleAr": "الكولكشن الجديد",
    "titleEn": "New collection"
  },
  "contact": {
    "phone": "",
    "whatsapp": "",
    "email": "",
    "addressAr": "",
    "addressEn": ""
  },
  "social": {
    "facebook": "",
    "instagram": "",
    "tiktok": ""
  }
}
```


---

## 3. Checkout & Order Tracking APIs (`/api/orders`)

_Guest checkout with cash on delivery. The customer gets an order number and a private tracking token._

### #9 `GET /api/delivery-zones`

Lists the active governorates with their delivery fee and delivery time.

- **Access:** Public · **Day 3**

**Response 200 OK**

```json
[
  {
    "id": 1,
    "key": "cairo",
    "nameAr": "القاهرة",
    "nameEn": "Cairo",
    "fee": 65,
    "etaDaysMin": 1,
    "etaDaysMax": 3
  }
]
```

### #10 `POST /api/orders`

Places a ready-made order. The server re-prices it and reserves stock in a single transaction.

- **Access:** Public · 10 per 10 min per IP · **Day 3**
- **Headers:** Idempotency-Key: <uuid> (required; a repeated key returns the original response)

**Payload**

```json
{
  "customer": {
    "name": "Mona Ahmed",
    "phone": "01012345678",
    "deliveryZoneId": 1,
    "city": "Nasr City",
    "address": "12 Abbas El Akkad St, building 4, floor 3, apt 7",
    "notes": "Call before arrival"
  },
  "lines": [
    {
      "variantId": 501,
      "qty": 2
    }
  ],
  "paymentMethod": "CashOnDelivery",
  "expectedTotal": 1765,
  "acceptTerms": true
}
```

**Response 201 Created**

```json
{
  "number": "ZF-10234",
  "trackingToken": "q8Zx…",
  "trackingUrl": "/track/ZF-10234?t=q8Zx…",
  "status": "PendingConfirmation",
  "subtotal": 1700,
  "deliveryFee": 65,
  "total": 1765,
  "lines": [
    "…"
  ]
}
```

**Rules**
- Prices from the client are never trusted. The server calculates every line again.
- Stock is reserved with a concurrency token; on a conflict it retries up to 3 times.
- Emails to the owner and the customer are sent after the commit.
- Validation: name 3–100, address 10–500, lines 1–30, qty 1–10, acceptTerms = true, phone is an Egyptian mobile number.

**Errors**
- 409 OUT_OF_STOCK — { items: [{ variantId, requested, available }] }
- 409 PRICE_CHANGED — { subtotal, deliveryFee, total } when expectedTotal no longer matches
- 400 VALIDATION_FAILED

### #11 `GET /api/orders/{number}`

Public order tracking page data. Personal data is masked.

- **Access:** Tracking token · 30/min · **Day 3**
- **Headers:** X-Tracking-Token: <token> (the UI reads it from ?t= in the page URL)

**Response 200 OK**

```json
{
  "number": "ZF-10234",
  "type": "Ready",
  "status": "Shipped",
  "createdAt": "2026-11-05T14:30:00Z",
  "customer": {
    "name": "Mona A.",
    "phone": "+20101****678",
    "zone": {
      "nameEn": "Cairo"
    }
  },
  "total": 1765,
  "paymentStatus": "Unpaid",
  "timeline": [
    {
      "from": null,
      "to": "PendingConfirmation",
      "at": "…"
    }
  ],
  "tailoring": null
}
```

**Errors**
- 404 Not Found for an unknown number or a wrong token (never reveal which)


---

## 4. Tailoring (Made-to-Measure) APIs (`/api/tailoring`)

_Custom orders: instant price estimate → request → owner confirms or adjusts the price → customer approval (only if the price changed) → production._

### #12 `GET /api/tailoring/catalog`

Returns the styles, garment types, fabrics, fits and measurement fields used by the request form.

- **Access:** Public · **Day 4**

**Response 200 OK**

```json
{
  "garments": [
    {
      "key": "pants",
      "nameAr": "بناطيل",
      "nameEn": "Trousers",
      "measurementGroups": [
        "common",
        "pants"
      ]
    }
  ],
  "styles": [
    {
      "id": "wide_pants",
      "garment": "pants",
      "nameEn": "Wide-leg trousers",
      "defaultFabric": "linen",
      "defaultFit": "Relaxed"
    }
  ],
  "fabrics": [
    {
      "key": "linen",
      "nameAr": "كتان",
      "nameEn": "Linen"
    }
  ],
  "fits": [
    {
      "key": "Relaxed",
      "nameEn": "Relaxed"
    }
  ],
  "measurementGroups": {
    "common": [
      {
        "key": "bust",
        "nameAr": "محيط الصدر",
        "nameEn": "Bust circumference",
        "required": false
      }
    ]
  },
  "standardSizes": [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "3XL",
    "FreeSize"
  ]
}
```

**Rules**
- Seeded from the old demo: 6 garment types, 12 styles and about 45 fields.

### #13 `POST /api/tailoring/estimate`

Instant price estimate from the price rules while the customer fills in the form.

- **Access:** Public · 60/min · **Day 4**

**Payload**

```json
{
  "styleId": "abaya",
  "garment": "dress",
  "fabric": "crepe",
  "lining": true,
  "sizingMode": "StandardSize",
  "standardSize": "XL",
  "extras": [
    "embroidery"
  ]
}
```

**Response 200 OK**

```json
{
  "basePrice": 1400,
  "items": [
    {
      "label": "Crepe fabric",
      "amount": 250
    },
    {
      "label": "Lining",
      "amount": 150
    },
    {
      "label": "Size XL+",
      "amount": 100
    },
    {
      "label": "Embroidery",
      "amount": 300
    }
  ],
  "estimatedPrice": 2200,
  "currency": "EGP",
  "note": "Final price is confirmed by the owner."
}
```

**Rules**
- Calculated on the server from the active price rules; the same function prices the request in POST /api/tailoring/requests.

### #14 `POST /api/tailoring/requests`

Submits a tailoring request with an optional reference photo.

- **Access:** Public · 10 per 10 min per IP · **Day 4**
- **Headers:** Idempotency-Key: <uuid> · Content-Type: multipart/form-data
- **Form data:** data (JSON string, below) · referenceImage (file, optional: jpeg/png/webp, max 5 MB)

**Payload**

```json
{
  "customer": {
    "name": "",
    "phone": "",
    "deliveryZoneId": 1,
    "city": "",
    "address": ""
  },
  "styleId": "wide_pants",
  "garment": "pants",
  "fabric": "linen",
  "color": "Beige",
  "fit": "Relaxed",
  "sizingMode": "Measurements",
  "standardSize": null,
  "measurements": {
    "waist": 72,
    "hips": 98,
    "inseam": 76
  },
  "notes": "Side pockets",
  "acceptTerms": true
}
```

**Response 201 Created**

```json
{
  "number": "ZF-10235",
  "trackingToken": "…",
  "trackingUrl": "…",
  "status": "AwaitingQuote",
  "estimatedPrice": 2200
}
```

**Rules**
- Measurement keys must belong to the chosen garment's groups; values are 1–300 cm.
- In StandardSize mode, standardSize is required and measurements must be empty.
- The photo's real file type is checked, it is re-encoded to WebP with EXIF removed, and it is stored in a private bucket.

**Errors**
- 400 VALIDATION_FAILED
- 413 file too large
- 415 unsupported file type

### #15 `POST /api/orders/{number}/quote/approve`

The customer accepts the price adjusted by the owner from the secure link.

- **Access:** Tracking token · **Day 4**
- **Headers:** X-Tracking-Token: <token>

**Response 200 OK — public order view with status QuoteApproved; the owner is emailed**

**Errors**
- 409 INVALID_STATUS_TRANSITION unless the order is a Custom order in QuoteSent
- 422 QUOTE_EXPIRED

### #16 `POST /api/orders/{number}/quote/reject`

The customer declines the quote. The order becomes Cancelled.

- **Access:** Tracking token · **Day 4**
- **Headers:** X-Tracking-Token: <token>

**Payload**

```json
{
  "reason": "Too expensive"
}
```

**Response 200 OK — public order view with status Cancelled**


---

## 5. Admin · Category APIs (`/api/admin/categories`)

_Access: Owner. Supports two levels: main category → sub-category._

### #17 `GET /api/admin/categories`

Full tree including hidden categories, with productCount on each one.

- **Access:** Owner · **Day 2**

**Response 200 OK — CategoryNode[] + isVisible, productCount**

### #18 `POST /api/admin/categories`

Creates a main category or a sub-category.

- **Access:** Owner · **Day 2**

**Payload**

```json
{
  "parentId": null,
  "nameAr": "بناطيل كتان",
  "nameEn": "Linen Pants",
  "slug": null,
  "imageUrl": null,
  "isVisible": true,
  "sortOrder": 0
}
```

**Response 201 Created — CategoryNode**

**Rules**
- The slug is generated from nameEn when empty and must be unique.
- Maximum depth is 2. A category can't be its own parent.

**Errors**
- 409 DUPLICATE (slug)

### #19 `PUT /api/admin/categories/{id}`

Updates a category, including its parent and menu order (same body as POST).

- **Access:** Owner · **Day 2**

**Response 200 OK**

### #20 `DELETE /api/admin/categories/{id}`

Deletes an empty category.

- **Access:** Owner · **Day 2**

**Response 204 No Content**

**Errors**
- 409 IN_USE if it has products or sub-categories


---

## 6. Admin · Product APIs (`/api/admin/products`)

_Access: Owner._

### #21 `GET /api/admin/products`

Paged product table for the dashboard.

- **Access:** Owner · **Day 2**
- **Query:** `?categoryId=&q=&isVisible=&lowStock=true&sort=&page=1`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": 12,
      "slug": "modest-abaya",
      "nameEn": "Modest Abaya",
      "categoryName": "Dresses",
      "basePrice": 1250,
      "totalStock": 9,
      "variantCount": 6,
      "isVisible": true,
      "thumbnailUrl": "…-400.webp",
      "lowStock": true
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 15,
  "totalPages": 1
}
```

**Rules**
- lowStock = at least one variant has 3 pieces or fewer.

### #22 `GET /api/admin/products/{id}`

Full product for the edit form, with the real stock and version of every variant.

- **Access:** Owner · **Day 2**

**Response 200 OK — ProductDetail + isVisible**

### #23 `POST /api/admin/products`

Creates a product, optionally with its first variants.

- **Access:** Owner · **Day 2**

**Payload**

```json
{
  "categoryId": 3,
  "nameAr": "عباية محتشمة",
  "nameEn": "Modest Abaya",
  "slug": null,
  "descriptionAr": "",
  "descriptionEn": "",
  "basePrice": 1250,
  "isVisible": true,
  "variants": [
    {
      "size": "M",
      "colorId": 3,
      "stock": 4,
      "priceOverride": null
    }
  ]
}
```

**Response 201 Created — ProductDetail**

**Errors**
- 400 VALIDATION_FAILED
- 409 DUPLICATE (slug)

### #24 `PUT /api/admin/products/{id}`

Updates the product fields, including show/hide (isVisible). Variants are managed separately.

- **Access:** Owner · **Day 2**

**Response 200 OK**

### #25 `DELETE /api/admin/products/{id}`

Deletes a product.

- **Access:** Owner · **Day 2**

**Response 204 No Content**

**Rules**
- Soft delete if the product was ever ordered (order history stays intact); otherwise a hard delete.


---

## 7. Admin · Variant APIs (`/api/admin/variants`)

_Stock is tracked per size × color._

### #26 `POST /api/admin/products/{id}/variants`

Adds a size/color combination to a product.

- **Access:** Owner · **Day 2**

**Payload**

```json
{
  "size": "L",
  "colorId": 3,
  "stock": 5,
  "priceOverride": null,
  "sku": null
}
```

**Response 201 Created — Variant**

**Rules**
- (productId, size, colorId) must be unique.
- The SKU is generated when empty: ZF-{productId}-{size}-{colorKey}.

**Errors**
- 409 DUPLICATE

### #27 `PUT /api/admin/variants/{id}`

Updates size, color, stock or price.

- **Access:** Owner · **Day 2**

**Payload**

```json
{
  "size": "L",
  "colorId": 3,
  "stock": 2,
  "priceOverride": 1300,
  "version": 4182
}
```

**Response 200 OK**

**Errors**
- 409 CONCURRENCY_CONFLICT — someone else changed it; reload and try again

### #28 `DELETE /api/admin/variants/{id}`

Removes a variant (a soft delete if it was ever ordered).

- **Access:** Owner · **Day 2**

**Response 204 No Content**


---

## 8. Admin · Product Image APIs (`/api/admin/images`)

_Images are stored in Cloudflare R2 and served through the CDN._

### #29 `POST /api/admin/products/{id}/images`

Uploads a product photo.

- **Access:** Owner · **Day 2**
- **Form data:** file (binary) · altAr (string) · altEn (string)

**Response 201 Created**

```json
{
  "id": 40,
  "url": "https://cdn…/12/40-800.webp",
  "srcSet": "…-400.webp 400w, …-800.webp 800w, …-1600.webp 1600w",
  "altAr": "",
  "altEn": "",
  "sortOrder": 0
}
```

**Rules**
- jpeg/png/webp only, max 5 MB, max 10 images per product.
- The server creates 400 / 800 / 1600 px WebP versions.
- The first uploaded photo is the main photo; deleting it promotes the next one.

**Errors**
- 413 too large
- 415 unsupported type

### #30 `DELETE /api/admin/images/{id}`

Deletes an image and its stored files.

- **Access:** Owner · **Day 2**

**Response 204 No Content**


---

## 9. Admin · Color APIs (`/api/admin/colors`)

_Seeded with the 10 colors from the old demo (Black, White, Beige, Navy, Brown, Pink, Olive, Gray, Cream, Off-white)._

### #31 `GET /api/admin/colors`

Lists colors with usageCount.

- **Access:** Owner · **Day 2**

**Response 200 OK**

```json
[
  {
    "id": 3,
    "nameAr": "بيج",
    "nameEn": "Beige",
    "hex": "#d6b995",
    "usageCount": 14
  }
]
```

### #32 `POST /api/admin/colors`

Adds a color.

- **Access:** Owner · **Day 2**

**Payload**

```json
{
  "nameAr": "زيتي",
  "nameEn": "Olive",
  "hex": "#727c54"
}
```

**Response 201 Created**

### #33 `PUT /api/admin/colors/{id}`

Updates a color.

- **Access:** Owner · **Day 2**

**Response 200 OK**

### #34 `DELETE /api/admin/colors/{id}`

Deletes an unused color.

- **Access:** Owner · **Day 2**

**Response 204 No Content**

**Errors**
- 409 IN_USE


---

## 10. Admin · Order APIs (`/api/admin/orders`)

_Access: Owner. Covers both ready-made and custom orders._

### #35 `GET /api/admin/orders`

Paged order board with filters.

- **Access:** Owner · **Day 3**
- **Query:** `?status=PendingConfirmation&status=Confirmed&type=Ready|Custom&q={number|phone|name}&from=&to=&page=1`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": 88,
      "number": "ZF-10234",
      "type": "Ready",
      "status": "PendingConfirmation",
      "customerName": "Mona Ahmed",
      "phone": "+201012345678",
      "zoneName": "Cairo",
      "total": 1765,
      "paymentStatus": "Unpaid",
      "createdAt": "…",
      "itemsCount": 2
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 1,
  "totalPages": 1
}
```

### #36 `GET /api/admin/orders/{id}`

Full order: unmasked customer data, lines, tailoring spec with a 10-minute signed photo URL, and the full status history with who made each change.

- **Access:** Owner · **Day 3**

**Response 200 OK**

### #37 `POST /api/admin/orders/{id}/status`

Moves the order to the next status.

- **Access:** Owner · **Day 3**

**Payload**

```json
{
  "to": "Confirmed",
  "note": "Confirmed by phone"
}
```

**Response 200 OK — updated order**

**Rules**
- Only the transitions in Appendix A are allowed.
- Cancelling a Ready order puts its stock back.
- Delivered sets paymentStatus = Paid automatically.

**Errors**
- 409 INVALID_STATUS_TRANSITION

### #38 `POST /api/admin/orders/{id}/quote`

Confirms or adjusts the estimated price of a Custom order.

- **Access:** Owner · **Day 4**

**Payload**

```json
{
  "price": 2400,
  "note": "Lined crepe, 2 fittings",
  "validDays": 7
}
```

**Response 200 OK — status QuoteSent**

**Rules**
- Same price as the estimate → the order moves straight to QuoteApproved (the customer already accepted it).
- Different price → status QuoteSent, and the customer gets the approval link.
- price > 0, validDays 1–30 (default 7).


---

## 11. Admin · Tailoring Catalog APIs (`/api/admin/tailoring/catalog`)

_Access: Owner. Lets the owner change styles and measurements without new code._

### #39 `GET /api/admin/tailoring/catalog`

Full catalog, including inactive items.

- **Access:** Owner · **Day 4**

**Response 200 OK — same shape as #12, plus isActive**

### #40 `PUT /api/admin/tailoring/catalog`

Replaces the whole catalog.

- **Access:** Owner · **Day 4**

**Response 200 OK**

**Rules**
- Every garment's groups must exist, and all keys must be unique.
- Existing orders keep their own snapshot of the measurement fields.


---

## 12. Admin · Delivery Zone APIs (`/api/admin/delivery-zones`)

_Access: Owner. All 27 governorates are seeded._

### #41 `GET /api/admin/delivery-zones`

All 27 governorates, including inactive ones.

- **Access:** Owner · **Day 3**

**Response 200 OK**

### #42 `PUT /api/admin/delivery-zones`

Bulk update of fees, delivery time and active flag.

- **Access:** Owner · **Day 3**

**Payload**

```json
[
  {
    "id": 1,
    "fee": 65,
    "etaDaysMin": 1,
    "etaDaysMax": 3,
    "isActive": true
  }
]
```

**Response 200 OK**


---

## 13. Admin · Site Settings APIs (`/api/admin/site-settings`)

_Access: Owner._

### #43 `GET /api/admin/site-settings`

Current settings for the edit form.

- **Access:** Owner · **Day 4**

**Response 200 OK — same shape as #8**

### #44 `PUT /api/admin/site-settings`

Saves home page content, contacts and social links.

- **Access:** Owner · **Day 4**

**Response 200 OK**

**Rules**
- Social links must start with https://.
- WhatsApp is stored as digits with the country code.


---

## 14. Admin · Price Rules APIs (`/api/admin/tailoring/pricing`)

_Access: Owner. The rules behind the price calculator._

### #45 `GET /api/admin/tailoring/pricing`

Current price rules: base price per style, fabric extras, lining, size and extra options.

- **Access:** Owner · **Day 4**

**Response 200 OK**

```json
{
  "styles": [
    {
      "styleId": "abaya",
      "basePrice": 1400
    }
  ],
  "fabrics": [
    {
      "key": "crepe",
      "extra": 250
    }
  ],
  "lining": 150,
  "sizeExtras": [
    {
      "fromSize": "XL",
      "extra": 100
    }
  ],
  "extras": [
    {
      "key": "embroidery",
      "nameAr": "تطريز",
      "nameEn": "Embroidery",
      "price": 300
    }
  ]
}
```

### #46 `PUT /api/admin/tailoring/pricing`

Saves the price rules. New estimates use them immediately.

- **Access:** Owner · **Day 4**

**Response 200 OK**

**Rules**
- All amounts ≥ 0. Every style in the tailoring catalog must have a base price.
- Existing orders keep the price they were given.


---

## 15. Admin · Dashboard API (`/api/admin`)

### #47 `GET /api/admin/dashboard`

Home screen numbers for the admin panel.

- **Access:** Owner · **Day 4**

**Response 200 OK**

```json
{
  "ordersToday": 7,
  "pendingConfirmation": 3,
  "awaitingQuote": 2,
  "inProduction": 4,
  "readyToShip": 5,
  "deliveredRevenueLast30Days": 48250,
  "lowStock": [
    {
      "variantId": 501,
      "sku": "ZF-12-M-beige",
      "productNameEn": "Modest Abaya",
      "stock": 1
    }
  ],
  "latestOrders": [
    "…5 AdminOrderRow"
  ]
}
```


---

## Health (not counted)
`GET /health` → `200 { "status": "Healthy", "db": "Healthy", "storage": "Healthy" }` · no auth · used by the uptime monitor and Docker.

---

## Appendix A — Enums & order status machine

```ts
type OrderType     = "Ready" | "Custom";
type OrderStatus   = "PendingConfirmation" | "Confirmed" | "AwaitingQuote" | "QuoteSent"
                   | "QuoteApproved" | "InProduction" | "QualityCheck" | "Packing"
                   | "Shipped" | "Delivered" | "Cancelled";
type PaymentMethod = "CashOnDelivery";           // Paymob comes in phase 2
type PaymentStatus = "Unpaid" | "Paid";
type SizingMode    = "Measurements" | "StandardSize";
type Role          = "Owner";                    // "Staff" can be added later
type StandardSize  = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "3XL" | "FreeSize";
```

```
Ready:   PendingConfirmation → Confirmed → Packing → Shipped → Delivered
Custom:  AwaitingQuote → QuoteSent → QuoteApproved → InProduction ⇄ QualityCheck → Packing → Shipped → Delivered
         AwaitingQuote → QuoteApproved directly when the owner keeps the estimated price
Cancel:  from PendingConfirmation, Confirmed, AwaitingQuote, QuoteSent, QuoteApproved
```

- Ready orders reserve stock at checkout; **Cancelled** puts it back.
- **Delivered** sets `paymentStatus = Paid` (cash on delivery).
- `QuoteSent → QuoteApproved` happens only through the customer endpoint (#15).
- Every status change writes one `OrderStatusHistory` row.
- Anything else → `409 INVALID_STATUS_TRANSITION`.

## Appendix B — Error codes

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | A field failed validation; see `errors{}` |
| 400 | `MISSING_CSRF_HEADER` | Admin mutation without `X-Requested-With` |
| 401 | `INVALID_CREDENTIALS` / — | Wrong login, or not signed in |
| 404 | — | Not found, or wrong tracking token |
| 409 | `OUT_OF_STOCK` · `PRICE_CHANGED` · `INVALID_STATUS_TRANSITION` · `CONCURRENCY_CONFLICT` · `IN_USE` · `DUPLICATE` | Business conflicts |
| 413 / 415 | — | Upload too large / wrong type |
| 422 | `QUOTE_EXPIRED` | Approval after `quoteValidUntil` |
| 423 | `LOCKED_OUT` | 5 failed logins |
| 429 | — | Rate limited (`Retry-After`) |
| 500 | — | Unexpected; only `traceId` returned |

## Appendix C — Endpoint index

| # | Method | Route | Access | Day |
|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | Public | 1 |
| 2 | POST | `/api/auth/logout` | Owner | 1 |
| 3 | GET | `/api/auth/me` | Owner | 1 |
| 4 | POST | `/api/auth/change-password` | Owner | 1 |
| 5 | GET | `/api/categories` | Public | 2 |
| 6 | GET | `/api/products` | Public | 2 |
| 7 | GET | `/api/products/{slug}` | Public | 2 |
| 8 | GET | `/api/site-settings` | Public | 2 |
| 9 | GET | `/api/delivery-zones` | Public | 3 |
| 10 | POST | `/api/orders` | Public | 3 |
| 11 | GET | `/api/orders/{number}` | Tracking token | 3 |
| 12 | GET | `/api/tailoring/catalog` | Public | 4 |
| 13 | POST | `/api/tailoring/estimate` | Public | 4 |
| 14 | POST | `/api/tailoring/requests` | Public | 4 |
| 15 | POST | `/api/orders/{number}/quote/approve` | Tracking token | 4 |
| 16 | POST | `/api/orders/{number}/quote/reject` | Tracking token | 4 |
| 17 | GET | `/api/admin/categories` | Owner | 2 |
| 18 | POST | `/api/admin/categories` | Owner | 2 |
| 19 | PUT | `/api/admin/categories/{id}` | Owner | 2 |
| 20 | DELETE | `/api/admin/categories/{id}` | Owner | 2 |
| 21 | GET | `/api/admin/products` | Owner | 2 |
| 22 | GET | `/api/admin/products/{id}` | Owner | 2 |
| 23 | POST | `/api/admin/products` | Owner | 2 |
| 24 | PUT | `/api/admin/products/{id}` | Owner | 2 |
| 25 | DELETE | `/api/admin/products/{id}` | Owner | 2 |
| 26 | POST | `/api/admin/products/{id}/variants` | Owner | 2 |
| 27 | PUT | `/api/admin/variants/{id}` | Owner | 2 |
| 28 | DELETE | `/api/admin/variants/{id}` | Owner | 2 |
| 29 | POST | `/api/admin/products/{id}/images` | Owner | 2 |
| 30 | DELETE | `/api/admin/images/{id}` | Owner | 2 |
| 31 | GET | `/api/admin/colors` | Owner | 2 |
| 32 | POST | `/api/admin/colors` | Owner | 2 |
| 33 | PUT | `/api/admin/colors/{id}` | Owner | 2 |
| 34 | DELETE | `/api/admin/colors/{id}` | Owner | 2 |
| 35 | GET | `/api/admin/orders` | Owner | 3 |
| 36 | GET | `/api/admin/orders/{id}` | Owner | 3 |
| 37 | POST | `/api/admin/orders/{id}/status` | Owner | 3 |
| 38 | POST | `/api/admin/orders/{id}/quote` | Owner | 4 |
| 39 | GET | `/api/admin/tailoring/catalog` | Owner | 4 |
| 40 | PUT | `/api/admin/tailoring/catalog` | Owner | 4 |
| 41 | GET | `/api/admin/delivery-zones` | Owner | 3 |
| 42 | PUT | `/api/admin/delivery-zones` | Owner | 3 |
| 43 | GET | `/api/admin/site-settings` | Owner | 4 |
| 44 | PUT | `/api/admin/site-settings` | Owner | 4 |
| 45 | GET | `/api/admin/tailoring/pricing` | Owner | 4 |
| 46 | PUT | `/api/admin/tailoring/pricing` | Owner | 4 |
| 47 | GET | `/api/admin/dashboard` | Owner | 4 |

## Phase 2 — not built now
- AI tools: design preview image, size helper, style assistant chat, owner assistant
- Online payments (Paymob) and courier integration (Bosta)
- Employee accounts (Staff role) — the role system is already in place
- Audit log, printable packing slips, drag-and-drop reordering
