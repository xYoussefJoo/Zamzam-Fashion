# Zamzam Fashion — Database

PostgreSQL 17 (Supabase) · EF Core · schema `zamzam`. Readable version: [database-erd.pdf](database-erd.pdf) (overview + one page per group) or the images in [database/](database/). GitHub draws the diagram below automatically.

Every table that inherits `Entity` also has `CreatedAt` and `UpdatedAt` (set automatically when saving).

```mermaid
erDiagram
    %% ===== Catalog =====
    Categories ||--o{ Categories : "parent of"
    Categories ||--o{ Products : contains
    Products ||--o{ ProductImages : has
    Products ||--o{ ProductVariants : "sold as"
    Colors ||--o{ ProductVariants : "color of"

    %% ===== Orders =====
    DeliveryZones ||--o{ Orders : "delivers to"
    Orders ||--o{ OrderLines : contains
    ProductVariants ||--o{ OrderLines : "ordered as"
    Orders ||--o{ OrderStatusHistory : tracks
    Orders ||--o| TailoringSpecs : "custom details"
    AspNetUsers ||--o{ OrderStatusHistory : "changed by"

    %% ===== Identity (owner only) =====
    AspNetUsers ||--o{ AspNetUserRoles : has
    AspNetRoles ||--o{ AspNetUserRoles : grants

    Categories {
        int Id PK
        int ParentId FK "null = main category"
        string NameAr
        string NameEn
        string Slug UK
        string ImageUrl
        int SortOrder
        bool IsVisible
        datetime CreatedAt
        datetime UpdatedAt
    }
    Products {
        int Id PK
        int CategoryId FK
        string NameAr
        string NameEn
        string Slug UK
        text DescriptionAr
        text DescriptionEn
        decimal BasePrice
        bool IsVisible
        bool IsDeleted "soft delete"
        datetime CreatedAt
        datetime UpdatedAt
    }
    ProductImages {
        int Id PK
        int ProductId FK
        string StorageKey "Supabase Storage key"
        string AltAr
        string AltEn
        int SortOrder "0 = main photo"
    }
    ProductVariants {
        int Id PK
        int ProductId FK
        int ColorId FK
        string Size "UK with ProductId + ColorId"
        string Sku UK
        int Stock
        decimal PriceOverride "null = base price"
        bool IsDeleted
        uint xmin "concurrency token"
    }
    Colors {
        int Id PK
        string NameAr
        string NameEn
        string Hex "#rrggbb"
    }
    DeliveryZones {
        int Id PK
        string Key UK "cairo, giza, ..."
        string NameAr
        string NameEn
        decimal Fee
        int EtaDaysMin
        int EtaDaysMax
        bool IsActive
    }
    Orders {
        int Id PK
        string Number UK "ZF-10234"
        string TrackingTokenHash "token itself never stored"
        string Type "Ready | Custom"
        string Status
        string CustomerName
        string Phone "+201xxxxxxxxx"
        string Email "optional"
        int DeliveryZoneId FK
        string City
        string Address
        string Notes
        decimal Subtotal
        decimal DeliveryFee
        decimal Total
        string PaymentMethod
        string PaymentStatus
        datetime CreatedAt
        datetime UpdatedAt
    }
    OrderLines {
        int Id PK
        int OrderId FK
        int VariantId FK
        string ProductNameAr "snapshot"
        string ProductNameEn "snapshot"
        string Size "snapshot"
        string ColorNameAr "snapshot"
        string ColorNameEn "snapshot"
        decimal UnitPrice "snapshot"
        int Quantity
        decimal LineTotal
        string ImageUrl
    }
    OrderStatusHistory {
        int Id PK
        int OrderId FK
        string FromStatus
        string ToStatus
        string ChangedByUserId FK "null = customer or system"
        datetime ChangedAt
        string Note
    }
    TailoringSpecs {
        int Id PK
        int OrderId FK "1 to 1"
        string StyleId "null = own design"
        string Garment
        string Fabric
        string Color
        string Fit
        string SizingMode
        string StandardSize
        jsonb Measurements "key to cm"
        bool HasLining
        jsonb Extras "embroidery, ..."
        string ReferenceImageKey "private bucket"
        decimal EstimatedPrice
        decimal QuotedPrice
        string QuoteNote
        datetime QuoteValidUntil
        datetime QuoteApprovedAt
    }
    IdempotencyKeys {
        string Key PK
        string Endpoint
        string RequestHash
        int StatusCode
        jsonb ResponseJson
        datetime CreatedAt "kept 24 h"
    }
    SiteSettings {
        int Id PK "single row"
        jsonb Content "hero, contacts, social"
        datetime UpdatedAt
    }
    TailoringCatalog {
        int Id PK "single row"
        jsonb Content "garments, styles, fabrics, fields"
        datetime UpdatedAt
    }
    PriceRules {
        int Id PK "single row"
        jsonb Content "base per style + extras"
        datetime UpdatedAt
    }
    AspNetUsers {
        string Id PK
        string FullName
        string Email UK
        string PasswordHash
        bool MustChangePassword
        datetime LockoutEnd
        int AccessFailedCount
    }
    AspNetRoles {
        string Id PK
        string Name UK "Owner"
    }
    AspNetUserRoles {
        string UserId PK
        string RoleId PK
    }
```
