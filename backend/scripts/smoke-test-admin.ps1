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
        [IO.File]::WriteAllText($bodyFile, (ConvertTo-Json -InputObject $body -Depth 6 -Compress), [Text.UTF8Encoding]::new($false))
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

    # ---------- Day 3: orders (#9-11, #35-37, #41-42) on a demo product
    $r = Call GET '/api/delivery-zones'
    Check '#9 public delivery zones' ($r.Status -eq 200 -and $r.Json.Count -ge 1) "($($r.Json.Count) active)"
    $zone = $r.Json[0]

    $r = Call GET '/api/admin/delivery-zones'
    Check '#41 admin delivery zones' ($r.Status -eq 200 -and $r.Json.Count -eq 27) "($($r.Json.Count))"
    $z = $r.Json | Where-Object { $_.id -eq $zone.id }
    $r = Call PUT '/api/admin/delivery-zones' @(@{ id = $z.id; fee = $z.fee; etaDaysMin = $z.etaDaysMin; etaDaysMax = $z.etaDaysMax; isActive = $true })
    Check '#42 update delivery zones' ($r.Status -eq 200) "($($r.Status))"

    $r = Call GET '/api/products/classic-blouse'
    $v = $r.Json.variants | Where-Object { $_.inStock } | Select-Object -First 1
    $stockBefore = if ($v.stock -ne $null) { $v.stock } else { 'more than 5' }
    $order = @{
        customer = @{ name = 'Smoke Test Buyer'; phone = '01112345678'; email = $null; deliveryZoneId = $zone.id
                      city = 'Nasr City'; address = '12 Abbas El Akkad St, apt 7'; notes = 'automated smoke test' }
        lines = @(@{ variantId = $v.id; qty = 1 }); paymentMethod = 'CashOnDelivery'
        expectedTotal = [decimal]$v.price + [decimal]$zone.fee; acceptTerms = $true
    }
    $curlKey = "smoke-$([guid]::NewGuid().ToString('N'))"
    $saved = $csrf; $script:csrf = "Idempotency-Key: $curlKey"
    $r = Call POST '/api/orders' $order
    $script:csrf = $saved
    Check '#10 place an order' ($r.Status -eq 201) "($($r.Json.number), total $($r.Json.total))"
    $number = $r.Json.number; $token = $r.Json.trackingToken

    $track = & curl.exe -s "$api/api/orders/$number" -H "X-Tracking-Token: $token" | ConvertFrom-Json
    Check '#11 customer tracking (masked)' ($track.customer.name -eq 'Smoke T.') "($($track.customer.name), $($track.customer.phone))"

    $r = Call GET "/api/admin/orders?q=$number"
    Check '#35 order board finds it' ($r.Status -eq 200 -and $r.Json.totalCount -eq 1)
    $orderId = $r.Json.items[0].id

    $r = Call GET "/api/admin/orders/$orderId"
    Check '#36 order details (unmasked)' ($r.Status -eq 200 -and $r.Json.customer.phone -eq '+201112345678')

    $r = Call POST "/api/admin/orders/$orderId/status" @{ to = 'Shipped'; note = $null }
    Check '#37 skipping steps refused' ($r.Status -eq 409 -and $r.Json.code -eq 'INVALID_STATUS_TRANSITION')
    $r = Call POST "/api/admin/orders/$orderId/status" @{ to = 'Confirmed'; note = 'Confirmed by phone (smoke test)' }
    Check '#37 confirm' ($r.Status -eq 200 -and $r.Json.status -eq 'Confirmed') "(by $($r.Json.history[-1].changedBy))"
    $r = Call POST "/api/admin/orders/$orderId/status" @{ to = 'Cancelled'; note = 'Smoke test clean-up' }
    Check '#37 cancel' ($r.Status -eq 200 -and $r.Json.status -eq 'Cancelled')

    $after = (Call GET '/api/products/classic-blouse').Json.variants | Where-Object { $_.id -eq $v.id }
    $stockAfter = if ($after.stock -ne $null) { $after.stock } else { 'more than 5' }
    Check 'cancel put the stock back' ("$stockAfter" -eq "$stockBefore") "(before $stockBefore, after $stockAfter)"

    # ---------- Day 4: custom tailoring (#12-15, #38) + settings (#39-40, #43-47)
    $catalog = (Call GET '/api/tailoring/catalog').Json
    Check '#12 tailoring catalog' ($catalog.garments.Count -gt 0 -and $catalog.liningPrice -ge 0) "($($catalog.garments.Count) garments)"
    $r = Call POST '/api/tailoring/estimate' @{ styleId = 'maxi'; garment = 'dress'; fabric = 'crepe'; fit = 'Relaxed'
        lining = $true; sizingMode = 'StandardSize'; standardSize = 'M'; extras = @('embroidery') }
    Check '#13 estimate' ($r.Status -eq 200 -and $r.Json.estimatedPrice -gt 0) "($($r.Json.estimatedPrice) EGP)"

    $zoneId = (Call GET '/api/delivery-zones').Json[0].id
    $dataFile = Join-Path $tmp 'request.json'
    $request = @{
        customer = @{ name = 'Smoke Tailor'; phone = '01112345678'; email = $null; deliveryZoneId = $zoneId
            city = 'Nasr City'; address = '1 Smoke Test Street, apt 1'; notes = $null }
        styleId = 'maxi'; garment = 'dress'; fabric = 'crepe'; color = 'Navy'; fit = 'Relaxed'
        sizingMode = 'Measurements'; standardSize = $null; measurements = @{ bust = 92; waist = 74; dressLength = 140 }
        lining = $true; extras = @('embroidery'); notes = 'Smoke test - please ignore'; acceptTerms = $true
    }
    [IO.File]::WriteAllText($dataFile, ($request | ConvertTo-Json -Depth 6 -Compress), [Text.UTF8Encoding]::new($false))
    # The PNG from the photo test above doubles as the reference photo.
    $placed = & curl.exe -s -X POST "$api/api/tailoring/requests" -H "Idempotency-Key: smoke-$([guid]::NewGuid())" `
        -F "data=<$dataFile;type=application/json" -F "referenceImage=@$png;type=image/png" | ConvertFrom-Json
    Check '#14 tailoring request (with photo)' ($placed.status -eq 'AwaitingQuote') "($($placed.number), estimate $($placed.estimatedPrice))"

    $customId = (Call GET "/api/admin/orders?q=$($placed.number)").Json.items[0].id
    $r = Call GET "/api/admin/orders/$customId"
    Check '#36 notes + private photo link' ($r.Json.tailoring.notes -like 'Smoke*' -and $r.Json.tailoring.referenceImageUrl -match '/object/sign/')

    $r = Call POST "/api/admin/orders/$customId/quote" @{ price = $placed.estimatedPrice + 250; note = 'Smoke test price'; validDays = 3 }
    Check '#38 new price -> QuoteSent + one-time link' ($r.Status -eq 200 -and $r.Json.order.status -eq 'QuoteSent' -and $r.Json.customerLink)
    $newToken = ([regex]::Match("$($r.Json.customerLink)", '[?&]t=([^&]+)')).Groups[1].Value

    $old = & curl.exe -s -o NUL -w '%{http_code}' -X POST "$api/api/orders/$($placed.number)/quote/approve" -H "X-Tracking-Token: $($placed.trackingToken)"
    Check 'old link stops working' ($old -eq '404') "($old)"
    $answer = & curl.exe -s -X POST "$api/api/orders/$($placed.number)/quote/approve" -H "X-Tracking-Token: $newToken" | ConvertFrom-Json
    Check '#15 customer approves' ($answer.status -eq 'QuoteApproved')

    $r = Call GET '/api/admin/dashboard'
    Check '#47 dashboard' ($r.Status -eq 200 -and $null -ne $r.Json.latestOrders) "(today $($r.Json.ordersToday), low stock $($r.Json.lowStock.Count))"
    $r = Call POST "/api/admin/orders/$customId/status" @{ to = 'Cancelled'; note = 'Smoke test clean-up' }
    Check 'custom order cleaned up' ($r.Status -eq 200 -and $r.Json.status -eq 'Cancelled')

    # Read + write back the same settings: proves the PUTs work without changing anything.
    $r = Call GET '/api/admin/tailoring/catalog'
    $r2 = Call PUT '/api/admin/tailoring/catalog' $r.Json
    Check '#39/#40 tailoring catalog' ($r.Status -eq 200 -and $r2.Status -eq 200) "($($r2.Status))"
    $r = Call GET '/api/admin/tailoring/pricing'
    $r2 = Call PUT '/api/admin/tailoring/pricing' $r.Json
    Check '#45/#46 price rules' ($r.Status -eq 200 -and $r2.Status -eq 200) "($($r2.Status))"
    $r = Call GET '/api/admin/site-settings'
    $r2 = Call PUT '/api/admin/site-settings' $r.Json
    Check '#43/#44 site settings' ($r.Status -eq 200 -and $r2.Status -eq 200) "($($r2.Status))"

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
