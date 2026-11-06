# Asks for the API's secrets and stores them with dotnet user-secrets (on this PC only, never in git).
# Run from the backend folder:
#   powershell -ExecutionPolicy Bypass -File .\scripts\set-secrets.ps1

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)   # keep Arabic names intact when piping
$project = Join-Path $PSScriptRoot '..\src\Zamzam.Api'

function Read-Plain([string]$prompt, [string]$default = '') {
    $label = if ($default) { "$prompt [$default]" } else { $prompt }
    $value = Read-Host $label
    if ([string]::IsNullOrWhiteSpace($value)) { $default } else { $value.Trim() }
}

function Read-Secret([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

# Values with ; or quotes must be quoted inside a connection string.
function Quote-ConnValue([string]$value) {
    if ($value -match "[;'`"=\s]") { "'" + $value.Replace("'", "''") + "'" } else { $value }
}

Write-Host ''
Write-Host 'Zamzam Fashion - API secrets' -ForegroundColor Cyan
Write-Host 'Typed secrets are hidden. Press Enter to keep a [default].'
Write-Host ''

# --- Supabase database (Connect -> Session pooler)
$dbHost = Read-Plain 'Supabase pooler host' 'aws-1-eu-central-1.pooler.supabase.com'
$dbUser = Read-Plain 'Database user' 'postgres.cngczppokulovwegzhdq'
$dbPass = Read-Secret 'Database password (hidden)'
if (-not $dbPass) { throw 'The database password is required.' }

# --- Supabase Storage (Project Settings -> API Keys -> Secret keys)
$storageKey = Read-Secret 'Supabase secret key sb_secret_... (hidden)'
if (-not $storageKey) { throw 'The Supabase secret key is required for photo uploads.' }

# --- First owner account (created on first start, then the owner must change the password)
Write-Host ''
$ownerEmail = Read-Plain 'Owner email' 'xyousefjoo@gmail.com'
if ($ownerEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'Enter a valid owner email.' }
$ownerName = Read-Plain 'Owner name' 'Youssef Gamal'
$ownerPass = Read-Secret 'Owner first password, 10+ characters (hidden)'
if ($ownerPass.Length -lt 10) { throw 'The owner password must be at least 10 characters.' }
$ownerPass2 = Read-Secret 'Repeat the owner password (hidden)'
if ($ownerPass -ne $ownerPass2) { throw 'The two owner passwords are different.' }

$connection = "Host=$dbHost;Port=5432;Database=postgres;Username=$dbUser;Password=$(Quote-ConnValue $dbPass);SSL Mode=Require"

# Piping JSON keeps special characters safe (no command-line quoting problems).
$secrets = [ordered]@{
    'ConnectionStrings:Zamzam' = $connection
    'Storage:ServiceKey'       = $storageKey
    'Seed:OwnerEmail'          = $ownerEmail.ToLowerInvariant()
    'Seed:OwnerName'           = $ownerName
    'Seed:OwnerPassword'       = $ownerPass
}
$secrets | ConvertTo-Json -Compress | dotnet user-secrets set --project $project | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'dotnet user-secrets failed.' }

Write-Host ''
Write-Host 'Saved (values hidden):' -ForegroundColor Green
dotnet user-secrets list --project $project | ForEach-Object { ($_ -split ' = ')[0] + ' = (set)' }
Write-Host ''
Write-Host 'Done. Tell Claude: "secrets are set".' -ForegroundColor Green
