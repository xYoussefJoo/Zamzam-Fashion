# Logs in as the owner and tests the admin catalog APIs end to end, including a real photo upload
# to Supabase Storage. Everything it creates is deleted again at the end.
# Start the API first (dotnet run --project src/Zamzam.Api), then run from the backend folder:
#   powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test-admin.ps1

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$api = 'http://localhost:5055'
$csrf = 'X-Requested-With: zamzam-admin'
$script:cookie = $null
$script:passed = 0; $script:failed = 0
$tmp = Join-Path $env:TEMP "zamzam-smoke-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory $tmp | Out-Null

# One HTTP call with curl.exe. Returns @{ Status; Json; Headers }.
function Call([string]$method, [string]$path, $body = $null, [string]$file = $null) {
    $headersFile = Join-Path $tmp 'headers.txt'
    $curlArgs = @('-s', '-X', $method, "$api$path", '-D', $headersFile, '-w', '\n%{http_code}', '-H', $csrf)
    if ($script:cookie) { $curlArgs += @('-H', "Cookie: $($script:cookie)") }
    if ($file) { $curlArgs += @('-F', "file=@$file;type=image/png", '-F', 'altEn=Smoke test photo') }
    if ($null -ne $body) {
        $bodyFile = Join-Path $tmp 'body.json'
        [IO.File]::WriteAllText($bodyFile, ($body | ConvertTo-Json -Depth 6 -Compress), [Text.UTF8Encoding]::new($false))
        $curlArgs += @('-H', 'Content-Type: application/json', '--data-binary', "@$bodyFile")
    }
    $out = (& curl.exe @curlArgs) -join "`n"
    if ($bodyFile) { Remove-Item $bodyFile -ErrorAction SilentlyContinue }
    $status = [int]($out.Substring($out.LastIndexOf("`n") + 1))
    $text = $out.Substring(0, $out.LastIndexOf("`n"))
    $json = $null; if ($text.Trim().StartsWith('{') -or $text.Trim().StartsWith('[')) { $json = $text | ConvertFrom-Json }
    @{ Status = $status; Json = $json; Headers = (Get-Content $headersFile -Raw) }
}

function Check([string]$name, [bool]$ok, [string]$info = '') {
    if ($ok) { $script:passed++; Write-Host "  PASS  $name $info" -ForegroundColor Green }
    else { $script:failed++; Write-Host "  FAIL  $name $info" -ForegroundColor Red }
}

try {
    Write-Host ''
    Write-Host 'Zamzam Fashion - admin smoke test' -ForegroundColor Cyan
    $email = Read-Host 'Owner email [xyousefjoo@gmail.com]'
    if (-not $email) { $email = 'xyousefjoo@gmail.com' }
    $secure = Read-Host 'Owner password (hidden)' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Write-Host ''

    # ---------- login (#1, #3)
    $r = Call POST '/api/auth/login' @{ email = $email; password = $password }
    $password = $null
    Check '#1 login' ($r.Status -eq 200) "($($r.Status))"
    if ($r.Status -ne 200) { throw "Login failed: $($r.Json.detail)" }
    $script:cookie = ([regex]::Match($r.Headers, 'zz\.auth=[^;]+')).Value
    Check 'cookie is HttpOnly + SameSite=Strict' ($r.Headers -match 'zz\.auth=.*httponly' -and $r.Headers -match 'samesite=strict')
    $r = Call GET '/api/auth/me'
    Check '#3 me' ($r.Status -eq 200 -and $r.Json.role -eq 'Owner') "($($r.Json.email), mustChangePassword=$($r.Json.mustChangePassword))"

    # ---------- colors, categories, products (#32, #18, #23)
    $r = Call POST '/api/admin/colors' @{ nameAr = 'تجربة'; nameEn = 'Smoke Teal'; hex = '#127A7A' }
    Check '#32 create color' ($r.Status -eq 201 -and $r.Json.hex -eq '#127a7a') "($($r.Status))"
    $colorId = $r.Json.id

    $r = Call POST '/api/admin/categories' @{ parentId = $null; nameAr = 'تجربة'; nameEn = 'Smoke Test'; isVisible = $false }
    Check '#18 create category' ($r.Status -eq 201 -and $r.Json.slug -eq 'smoke-test') "($($r.Status))"
    $categoryId = $r.Json.id

    $r = Call POST '/api/admin/products' @{
        categoryId = $categoryId; nameAr = 'عباية تجربة'; nameEn = 'Smoke Test Abaya'; slug = $null
        descriptionAr = $null; descriptionEn = 'Created by the smoke test'; basePrice = 999; isVisible = $true
        variants = @(@{ size = 'M'; colorId = $colorId; stock = 3 })
    }
    Check '#23 create product + variant' ($r.Status -eq 201 -and $r.Json.variants.Count -eq 1) "(SKU $($r.Json.variants[0].sku))"
    $productId = $r.Json.id
    $variant = $r.Json.variants[0]

    $r = Call POST "/api/admin/products/$productId/variants" @{ size = 'M'; colorId = $colorId; stock = 1 }
    Check '#26 duplicate size+color refused' ($r.Status -eq 409 -and $r.Json.code -eq 'DUPLICATE') "($($r.Status) $($r.Json.code))"

    # ---------- variant version check (#27)
    $r = Call PUT "/api/admin/variants/$($variant.id)" @{ size = 'M'; colorId = $colorId; stock = 7; priceOverride = 1050; version = ([int64]$variant.version + 1) }
    Check '#27 old version refused' ($r.Status -eq 409 -and $r.Json.code -eq 'CONCURRENCY_CONFLICT') "($($r.Status) $($r.Json.code))"
    $r = Call PUT "/api/admin/variants/$($variant.id)" @{ size = 'M'; colorId = $colorId; stock = 7; priceOverride = 1050; version = $variant.version }
    Check '#27 current version accepted' ($r.Status -eq 200 -and $r.Json.stock -eq 7 -and $r.Json.price -eq 1050) "(stock $($r.Json.stock), price $($r.Json.price))"

    # ---------- real photo upload to Supabase Storage (#29)
    Add-Type -AssemblyName System.Drawing
    $png = Join-Path $tmp 'photo.png'
    $bitmap = New-Object System.Drawing.Bitmap 1200, 1600
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::FromArgb(214, 185, 149)); $graphics.Dispose()
    $bitmap.Save($png, [System.Drawing.Imaging.ImageFormat]::Png); $bitmap.Dispose()

    $r = Call POST "/api/admin/products/$productId/images" -file $png
    Check '#29 upload photo' ($r.Status -eq 201) "($($r.Status)) $($r.Json.detail)"
    $imageUrl = $r.Json.url
    if ($imageUrl) {
        $public = & curl.exe -s -o NUL -w '%{http_code} %{content_type}' $imageUrl
        Check 'photo is public on Supabase as WebP' ($public -match '^200 image/webp') "($public)"
        $large = ($r.Json.srcSet -split ', ' | Where-Object { $_ -match '1600w' }) -replace ' 1600w', ''
        $largeInfo = & curl.exe -s -o NUL -w '%{http_code} %{size_download}' $large
        Check '1600px version exists' ($largeInfo -match '^200') "($largeInfo bytes)"
    }

    $r = Call GET "/api/admin/products/$productId"
    Check '#22 admin product shows the photo' ($r.Status -eq 200 -and $r.Json.images.Count -eq 1)

    $r = Call GET '/api/admin/products?q=smoke'
    Check '#21 admin list finds it' ($r.Status -eq 200 -and $r.Json.totalCount -ge 1) "(total $($r.Json.totalCount))"

    # ---------- clean up: delete product (#25), category (#20), color (#34)
    $r = Call DELETE "/api/admin/categories/$categoryId"
    Check '#20 category with a product refused' ($r.Status -eq 409 -and $r.Json.code -eq 'IN_USE') "($($r.Status))"

    $r = Call DELETE "/api/admin/products/$productId"
    Check '#25 delete product (never ordered = real delete)' ($r.Status -eq 204) "($($r.Status))"
    if ($imageUrl) {
        # The CDN may keep serving its cached copy (photos are cached for a year on purpose),
        # so ask past the cache with a unique query string.
        Start-Sleep -Seconds 2
        $gone = & curl.exe -s -o NUL -w '%{http_code}' "$($imageUrl)?check=$([guid]::NewGuid().ToString('N'))"
        Check 'photo files removed from Supabase' ($gone -ne '200') "($gone)"
    }
    $r = Call DELETE "/api/admin/categories/$categoryId"
    Check '#20 delete empty category' ($r.Status -eq 204) "($($r.Status))"
    $r = Call DELETE "/api/admin/colors/$colorId"
    Check '#34 delete unused color' ($r.Status -eq 204) "($($r.Status))"

    # ---------- logout (#2)
    $r = Call POST '/api/auth/logout'
    Check '#2 logout' ($r.Status -eq 204)
    $script:cookie = $null
    $r = Call GET '/api/auth/me'
    Check 'after logout, me is 401' ($r.Status -eq 401)
}
catch {
    Write-Host "  ERROR $($_.Exception.Message)" -ForegroundColor Red
    $script:failed++
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
$color = if ($script:failed -eq 0) { 'Green' } else { 'Red' }
Write-Host "Result: $($script:passed) passed, $($script:failed) failed" -ForegroundColor $color
Write-Host 'Copy these lines to Claude (they contain no secrets).'
