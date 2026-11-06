# Zamzam Fashion

Bilingual (Arabic / English) online store for ready-made clothes and made-to-measure tailoring.
Guest checkout with cash on delivery, an instant price calculator for custom orders, and an owner dashboard.

## Stack

| Part | Tech |
|---|---|
| Backend | ASP.NET Core 10 Web API (Controllers) · Clean Architecture · EF Core · PostgreSQL 17 |
| Frontend | Next.js (App Router) · TypeScript · Tailwind CSS |
| Auth | ASP.NET Identity httpOnly cookie (owner only; customers check out as guests) |

## Repository layout

```
Zamzam Fashion/
├─ backend/                  .NET solution (Zamzam.slnx)
│  ├─ src/
│  │  ├─ Zamzam.Domain/          entities, enums, business rules (no dependencies)
│  │  ├─ Zamzam.Application/     use cases, validation, interfaces
│  │  ├─ Zamzam.Infrastructure/  EF Core, Identity, image storage
│  │  └─ Zamzam.Api/             controllers, Program.cs
│  └─ tests/Zamzam.Tests/
├─ frontend/                 Next.js app (storefront + /admin)
├─ docs/                     API plan, API contract, production plan
├─ docker-compose.yml        local PostgreSQL
└─ .github/workflows/ci.yml  build + test on every push
```

Dependency rule: `Api → Infrastructure → Application → Domain`. Domain references nothing.

## Getting started

Requirements: .NET SDK 10, Node.js 24, Docker Desktop.

```bash
# 1. Database
cp .env.example .env            # set DB_PASSWORD
docker compose up -d

# 2. Backend  → http://localhost:5055  (health: /health, OpenAPI: /openapi/v1.json)
cd backend
# one-time: secrets stay on your machine, never in git
# Supabase (Connect → Session pooler). Local PostgreSQL works too: Host=localhost;Database=zamzam;...
dotnet user-secrets set "ConnectionStrings:Zamzam" "Host=<pooler host>;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<db password>;SSL Mode=Require" --project src/Zamzam.Api
# Supabase Storage for product photos (Project Settings → API Keys → service_role / secret key)
dotnet user-secrets set "Storage:ServiceKey" "<service_role key>" --project src/Zamzam.Api
dotnet user-secrets set "Seed:OwnerEmail" "owner@example.com" --project src/Zamzam.Api
dotnet user-secrets set "Seed:OwnerPassword" "<at least 10 characters>" --project src/Zamzam.Api
dotnet user-secrets set "Seed:OwnerName" "Owner Name" --project src/Zamzam.Api
# on start the API applies migrations (schema "zamzam"), seeds governorates, colors, tailoring catalog,
# prices, the owner, a demo catalog (Development only) and creates the storage buckets
dotnet run --project src/Zamzam.Api
dotnet test   # 133 unit tests (+4 PostgreSQL integration tests that run in GitHub Actions; skipped without Docker)

# 3. Frontend → http://localhost:3000
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend forwards `/api/*` to the backend (see `frontend/next.config.ts`), so the browser only ever talks to one origin.

## Docs

- `docs/Zamzam-API-Plan.docx` — the 47 endpoints, one line each
- `docs/API-CONTRACT.md` — full request/response contract
- `docs/Zamzam-Fashion-Production-Plan.pdf` — audit of the old prototype and the 7-day plan

## Workflow

- `main` is protected; work on feature branches and open a pull request.
- CI must be green before merging.
- Never commit secrets: use `.env` (root), `frontend/.env.local`, and `dotnet user-secrets` for the API.
