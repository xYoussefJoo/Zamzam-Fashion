# Database backups

`.github/workflows/database-backup.yml` dumps the `zamzam` schema every night at 01:41 UTC, encrypts it with
`BACKUP_PASSPHRASE` (AES-256), and keeps it **7 days** as a workflow artifact. Photos are not in it: they live in
Supabase Storage and are never deleted by the app's normal use.

## Set up (once)

1. Make a long passphrase (for example 6 random words) and save it in your password manager.
   **Without it no backup can be opened.**
2. GitHub → repo → Settings → Secrets and variables → Actions → New repository secret:
   `BACKUP_PASSPHRASE` = that passphrase. (`SUPABASE_DEV_DB_PASSWORD` already exists for the keep-alive.)
3. Actions → **Database backup** → **Run workflow**. Green, with a `zamzam-YYYY-MM-DD` artifact, means it works.

## Restore

You need `pg_restore` (PostgreSQL client tools, same major version as the server) and `gpg`.

```bash
# 1. Download the artifact from the Actions run and unzip it, then decrypt:
gpg --decrypt --output zamzam.dump zamzam-2026-11-08.dump.gpg     # asks for BACKUP_PASSPHRASE

# 2. Look inside first (lists every table):
pg_restore --list zamzam.dump

# 3. Restore into the database. --clean drops the current zamzam tables first, so stop the API before this.
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "host=<pooler host> port=5432 dbname=postgres user=<user> sslmode=require" zamzam.dump
```

To recover only a few rows, restore into a **new, empty** Supabase project instead and copy what you need from there.

## At launch

Point the workflow's `PGHOST` / `PGUSER` and the password secret at the **production** database. On Supabase's
paid plan, daily backups are included as well; keep this one anyway, it's the copy you control.
