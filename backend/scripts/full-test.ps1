# Full test of the Zamzam API: every endpoint, the business rules, and the security rules that must refuse things.
# It creates its own test data and removes it again (refused orders save nothing; the one real test order is
# cancelled, so its stock comes back). At the end it writes backend\test-report.html.
#
# Start the API first (dotnet run --project src/Zamzam.Api), then from the backend folder:
#   powershell -ExecutionPolicy Bypass -File .\scripts\full-test.ps1               # everything (asks the owner password)
#   powershell -ExecutionPolicy Bypass -File .\scripts\full-test.ps1 -PublicOnly   # no login: storefront + security only
#
# Rate limits are real: wait 10 minutes after another test run that placed orders (10 orders per 10 minutes per IP).

param(
    [string]$Api = 'http://localhost:5055',
    [switch]$PublicOnly
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$script:cookie = $null
$script:results = New-Object System.Collections.Generic.List[object]
$script:section = ''
$tmp = Join-Path $env:TEMP "zamzam-fulltest-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory $tmp | Out-Null
$run = ([guid]::NewGuid().ToString('N')).Substring(0, 6)   # makes every name unique, even after a failed run
$started = Get-Date

# ---------------------------------------------------------------- helpers

# One HTTP call with curl.exe. Returns @{ Status; Json; Headers; Raw }.
function Call {
    param([string]$Method, [string]$Path, $Body = $null, [hashtable]$Headers = @{}, [switch]$NoCsrf,
          [string[]]$Form = @(), [switch]$Compressed)
    $headersFile = Join-Path $tmp 'headers.txt'
    $curlArgs = @('-s', '-X', $Method, "$Api$Path", '-D', $headersFile, '-w', '\n%{http_code}')
    if (-not $NoCsrf) { $curlArgs += @('-H', 'X-Requested-With: zamzam-admin') }
    if ($Compressed) { $curlArgs += @('--compressed') }  # curl offers what it can decode (gzip at least)
    if ($script:cookie) { $curlArgs += @('-H', "Cookie: $($script:cookie)") }
    foreach ($k in $Headers.Keys) { $curlArgs += @('-H', "${k}: $($Headers[$k])") }
    foreach ($f in $Form) { $curlArgs += @('-F', $f) }
    if ($null -ne $Body) {
        $bodyFile = Join-Path $tmp 'body.json'
        [IO.File]::WriteAllText($bodyFile, (ConvertTo-Json -InputObject $Body -Depth 10 -Compress), [Text.UTF8Encoding]::new($false))
        $curlArgs += @('-H', 'Content-Type: application/json', '--data-binary', "@$bodyFile")
    }
    $out = (& curl.exe @curlArgs) -join "`n"
    $status = [int]($out.Substring($out.LastIndexOf("`n") + 1))
    $text = $out.Substring(0, $out.LastIndexOf("`n"))
    $json = $null
    if ($text.Trim().StartsWith('{') -or $text.Trim().StartsWith('[')) { try { $json = $text | ConvertFrom-Json } catch { } }
    @{ Status = $status; Json = $json; Headers = (Get-Content $headersFile -Raw); Raw = $text }
}

function Section([string]$name) {
    $script:section = $name
    Write-Host ''
    Write-Host $name -ForegroundColor Cyan
}

function Check([string]$name, [bool]$ok, [string]$info = '') {
    $script:results.Add([pscustomobject]@{ Section = $script:section; Name = $name; Ok = $ok; Info = $info })
    if ($ok) { Write-Host "  PASS  $name $info" -ForegroundColor Green }
    else { Write-Host "  FAIL  $name $info" -ForegroundColor Red }
}

function Header($r, [string]$name) { ([regex]::Match($r.Headers, "(?im)^$([regex]::Escape($name)):\s*(.+?)\s*$")).Groups[1].Value }

function NewPng([string]$path, [int]$w, [int]$h) {
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::FromArgb(214, 185, 149)); $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}

function Same($a, $b) { (ConvertTo-Json -InputObject $a -Depth 10 -Compress) -eq (ConvertTo-Json -InputObject $b -Depth 10 -Compress) }

# ---------------------------------------------------------------- tests
try {
    Write-Host ''
    Write-Host "Zamzam Fashion - full API test ($Api)" -ForegroundColor Cyan
    if (-not $PublicOnly) {
        $email = Read-Host 'Owner email [xyousefjoo@gmail.com]'
        if (-not $email) { $email = 'xyousefjoo@gmail.com' }
        $secure = Read-Host 'Owner password (hidden)' -AsSecureString
    }

    # ============================================================ A. storefront
    Section 'A. Storefront (public)'
    $r = Call GET '/health'
    Check 'health: API, database and storage' ($r.Status -eq 200 -and $r.Json.status -eq 'Healthy' -and $r.Json.db -eq 'Healthy') "($($r.Raw))"

    $r = Call GET '/api/categories'
    Check '#5 category tree' ($r.Status -eq 200 -and @($r.Json).Count -ge 1 -and $null -ne $r.Json[0].children) "($(@($r.Json).Count) main categories)"
    Check '#5 cached 5 minutes' ((Header $r 'Cache-Control') -match 'max-age=300')

    $r = Call GET '/api/products?pageSize=100&inStock=false'
    $all = @($r.Json.items)
    Check '#6 product list' ($r.Status -eq 200 -and $all.Count -ge 1 -and $r.Json.totalCount -eq $all.Count) "($($all.Count) products)"
    Check '#6 cached 60 seconds' ((Header $r 'Cache-Control') -match 'max-age=60')
    $r = Call GET '/api/products?pageSize=100' -Compressed
    Check '#6 compressed' ((Header $r 'Content-Encoding') -in 'br', 'gzip') "($(Header $r 'Content-Encoding'))"
    $inStock = @($r.Json.items)
    Check '#6 default list hides sold-out products' (@($inStock | Where-Object { -not $_.inStock }).Count -eq 0) "($($inStock.Count) in stock)"

    $r = Call GET '/api/products?pageSize=2&page=1'
    Check '#6 paging' ($r.Status -eq 200 -and @($r.Json.items).Count -le 2 -and $r.Json.pageSize -eq 2 -and $r.Json.totalPages -ge 1) "(page 1 of $($r.Json.totalPages))"
    $r = Call GET '/api/products?pageSize=500'
    Check '#6 page size capped at 100' ($r.Status -eq 400 -or $r.Json.pageSize -le 100) "($($r.Status), pageSize $($r.Json.pageSize))"

    $asc = @((Call GET '/api/products?pageSize=100&sort=price_asc').Json.items | ForEach-Object { [decimal]$_.minPrice })
    Check '#6 sort by price, low to high' (($asc -join ',') -eq (($asc | Sort-Object) -join ','))
    $desc = @((Call GET '/api/products?pageSize=100&sort=price_desc').Json.items | ForEach-Object { [decimal]$_.minPrice })
    Check '#6 sort by price, high to low' (($desc -join ',') -eq (($desc | Sort-Object -Descending) -join ','))
    $r = Call GET '/api/products?sort=cheapest'
    Check '#6 unknown sort refused' ($r.Status -eq 400) "($($r.Status))"

    $tree = (Call GET '/api/categories').Json
    $parent = @($tree | Where-Object { @($_.children).Count -gt 0 } | Select-Object -First 1)[0]
    if ($parent) {
        $slugs = @($parent.slug) + @($parent.children | ForEach-Object { $_.slug })
        $items = @((Call GET "/api/products?pageSize=100&inStock=false&category=$($parent.slug)").Json.items)
        Check '#6 category filter includes its sub-categories' (@($items | Where-Object { $slugs -notcontains $_.category.slug }).Count -eq 0) "($($parent.slug): $($items.Count))"
    }
    $sample = $all[0]
    $prices = @($all | ForEach-Object { [decimal]$_.minPrice } | Sort-Object)
    $min = $prices[0]; $max = $prices[[math]::Floor(($prices.Count - 1) / 2)]
    $items = @((Call GET "/api/products?pageSize=100&inStock=false&minPrice=$min&maxPrice=$max").Json.items)
    Check '#6 price range filter' ($items.Count -ge 1 -and @($items | Where-Object { [decimal]$_.maxPrice -lt $min -or [decimal]$_.minPrice -gt $max }).Count -eq 0) "($min-$max EGP: $($items.Count))"
    $word = ($sample.nameEn -split ' ')[-1]
    $items = @((Call GET "/api/products?pageSize=100&inStock=false&q=$([uri]::EscapeDataString($word))").Json.items)
    Check '#6 search' (@($items | Where-Object { $_.id -eq $sample.id }).Count -eq 1) "(""$word"": $($items.Count))"
    $size = @($inStock | ForEach-Object { $_.sizes } | Select-Object -First 1)[0]
    if ($size) {
        $items = @((Call GET "/api/products?pageSize=100&size=$size").Json.items)
        Check '#6 size filter' ($items.Count -ge 1 -and @($items | Where-Object { $_.sizes -notcontains $size }).Count -eq 0) "($($size): $($items.Count))"
    }
    $colorId = @($inStock | ForEach-Object { $_.colors } | Select-Object -First 1)[0].id
    if ($colorId) {
        $items = @((Call GET "/api/products?pageSize=100&color=$colorId").Json.items)
        Check '#6 color filter' ($items.Count -ge 1 -and @($items | Where-Object { @($_.colors.id) -notcontains $colorId }).Count -eq 0) "(color $($colorId): $($items.Count))"
    }

    $r = Call GET "/api/products/$($sample.slug)"
    Check '#7 product page' ($r.Status -eq 200 -and @($r.Json.variants).Count -ge 1 -and $r.Json.slug -eq $sample.slug) "($($r.Json.nameEn), $(@($r.Json.variants).Count) variants)"
    Check '#7 card and page agree on prices' ([decimal]$r.Json.minPrice -eq [decimal]$sample.minPrice -and [decimal]$r.Json.maxPrice -eq [decimal]$sample.maxPrice)
    Check '#7 stock shown only when 5 or fewer' (@($r.Json.variants | Where-Object { $null -ne $_.stock -and $_.stock -gt 5 }).Count -eq 0)
    $r = Call GET "/api/products/no-such-product-$run"
    Check '#7 unknown product is 404 NOT_FOUND' ($r.Status -eq 404 -and $r.Json.code -eq 'NOT_FOUND') "($($r.Status))"

    $r = Call GET '/api/site-settings'
    Check '#8 site settings' ($r.Status -eq 200 -and $null -ne $r.Json.contact -and $r.Json.contact.PSObject.Properties.Name -contains 'whatsApp' -and $r.Json.social.PSObject.Properties.Name -contains 'tikTok')
    $r = Call GET '/api/delivery-zones'
    $zones = @($r.Json)
    Check '#9 delivery zones' ($r.Status -eq 200 -and $zones.Count -ge 1 -and @($zones | Where-Object { $_.fee -lt 0 -or $_.etaDaysMin -gt $_.etaDaysMax }).Count -eq 0) "($($zones.Count) active)"

    $catalog = (Call GET '/api/tailoring/catalog').Json
    Check '#12 tailoring catalog' ($catalog.garments.Count -gt 0 -and $catalog.styles.Count -gt 0 -and $catalog.fabrics.Count -gt 0) "($($catalog.garments.Count) garments, $($catalog.styles.Count) styles)"
    $estimate = @{ styleId = 'maxi'; garment = 'dress'; fabric = 'crepe'; fit = 'Relaxed'; lining = $true; sizingMode = 'StandardSize'; standardSize = 'M'; extras = @('embroidery') }
    $r = Call POST '/api/tailoring/estimate' $estimate -NoCsrf
    $sum = [decimal]$r.Json.basePrice + [decimal](@($r.Json.items | ForEach-Object { [decimal]$_.amount }) | Measure-Object -Sum).Sum
    Check '#13 estimate adds up' ($r.Status -eq 200 -and [decimal]$r.Json.estimatedPrice -eq $sum -and $r.Json.noteEn) "($($r.Json.estimatedPrice) EGP)"
    $r = Call POST '/api/tailoring/estimate' @{ styleId = 'maxi'; garment = 'spaceship'; fabric = 'crepe'; fit = 'Relaxed'; lining = $false; sizingMode = 'StandardSize'; standardSize = 'M'; extras = @() } -NoCsrf
    Check '#13 unknown garment refused' ($r.Status -eq 400) "($($r.Status) $($r.Json.code))"

    # ============================================================ B. security
    Section 'B. Security (every rule that must refuse)'
    $r = Call GET '/api/products?pageSize=1'
    $need = @{ 'X-Content-Type-Options' = 'nosniff'; 'X-Frame-Options' = 'DENY'; 'Referrer-Policy' = 'no-referrer'
               'Content-Security-Policy' = "default-src 'none'"; 'Cross-Origin-Resource-Policy' = 'same-site'; 'X-Robots-Tag' = 'noindex' }
    foreach ($h in $need.Keys) { Check "header $h" ((Header $r $h) -match [regex]::Escape($need[$h])) "($(Header $r $h))" }
    $r = Call GET "/api/products/no-such-product-$run"
    Check 'headers on errors too' ((Header $r 'X-Frame-Options') -eq 'DENY' -and (Header $r 'X-Robots-Tag') -match 'noindex')
    Check 'no Server / X-Powered-By header' (-not (Header $r 'Server') -and -not (Header $r 'X-Powered-By'))

    $adminReads = @('/api/auth/me', '/api/admin/categories', '/api/admin/products', '/api/admin/products/1', '/api/admin/colors',
        '/api/admin/orders', '/api/admin/orders/1', '/api/admin/delivery-zones', '/api/admin/tailoring/catalog',
        '/api/admin/tailoring/pricing', '/api/admin/site-settings', '/api/admin/dashboard')
    $open = @($adminReads | Where-Object { (Call GET $_).Status -ne 401 })
    Check "all $($adminReads.Count) admin reads need login (401)" ($open.Count -eq 0) $(if ($open) { "(open: $($open -join ', '))" } else { '' })

    $adminWrites = @(
        @('POST', '/api/auth/change-password'), @('POST', '/api/admin/categories'), @('PUT', '/api/admin/categories/1'),
        @('DELETE', '/api/admin/categories/1'), @('POST', '/api/admin/products'), @('PUT', '/api/admin/products/1'),
        @('DELETE', '/api/admin/products/1'), @('POST', '/api/admin/products/1/variants'), @('PUT', '/api/admin/variants/1'),
        @('DELETE', '/api/admin/variants/1'), @('POST', '/api/admin/products/1/images'), @('DELETE', '/api/admin/images/1'),
        @('POST', '/api/admin/colors'), @('PUT', '/api/admin/colors/1'), @('DELETE', '/api/admin/colors/1'),
        @('POST', '/api/admin/orders/1/status'), @('POST', '/api/admin/orders/1/quote'), @('PUT', '/api/admin/delivery-zones'),
        @('PUT', '/api/admin/tailoring/catalog'), @('PUT', '/api/admin/tailoring/pricing'), @('PUT', '/api/admin/site-settings'))
    # The photo upload only accepts multipart (anything else is 415 before login is checked), so send it a real file.
    $tiny = Join-Path $tmp 'tiny.png'; NewPng $tiny 4 4
    function Attempt($write, [switch]$NoCsrf) {
        if ($write[1] -like '*/images' -and $write[0] -eq 'POST') { Call $write[0] $write[1] -Form @("file=@$tiny;type=image/png") -NoCsrf:$NoCsrf }
        else { Call $write[0] $write[1] @{} -NoCsrf:$NoCsrf }
    }
    $open = @($adminWrites | Where-Object { (Attempt $_).Status -ne 401 } | ForEach-Object { "$($_[0]) $($_[1])" })
    Check "all $($adminWrites.Count) admin writes need login (401)" ($open.Count -eq 0) $(if ($open) { "(open: $($open -join ', '))" } else { '' })
    $noGuard = @($adminWrites | Where-Object { $r = Attempt $_ -NoCsrf; -not ($r.Status -eq 400 -and $r.Json.code -eq 'MISSING_CSRF_HEADER') } | ForEach-Object { "$($_[0]) $($_[1])" })
    Check "all $($adminWrites.Count) admin writes need the CSRF header (400)" ($noGuard.Count -eq 0) $(if ($noGuard) { "(missing: $($noGuard -join ', '))" } else { '' })

    $r = Call POST '/api/auth/login' @{ email = "nobody-$run@example.com"; password = 'not-a-real-password' }
    Check '#1 wrong login: 401 INVALID_CREDENTIALS' ($r.Status -eq 401 -and $r.Json.code -eq 'INVALID_CREDENTIALS') "($($r.Status))"
    $r = Call GET '/api/orders/ZF-99999' -Headers @{ 'X-Tracking-Token' = 'wrong' }
    Check '#11 wrong order or token: 404' ($r.Status -eq 404)
    $r = Call GET '/api/orders/ZF-99999'
    Check '#11 no token: refused' ($r.Status -in 400, 404) "($($r.Status))"
    $r = Call OPTIONS '/api/orders' -NoCsrf -Headers @{ 'Origin' = 'https://evil.example'; 'Access-Control-Request-Method' = 'POST' }
    Check 'other websites get no CORS permission' (-not (Header $r 'Access-Control-Allow-Origin')) "($($r.Status))"

    if (-not $PublicOnly) {
        # ======================================================== C. admin catalog
        Section 'C. Admin: login and catalog'
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $r = Call POST '/api/auth/login' @{ email = $email; password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secure = $null
        Check '#1 owner login' ($r.Status -eq 200 -and $r.Json.role -eq 'Owner') "($($r.Status))"
        if ($r.Status -ne 200) { throw "Login failed ($($r.Status)): $($r.Json.detail)" }
        $script:cookie = ([regex]::Match($r.Headers, 'zz\.auth=[^;]+')).Value
        Check 'cookie is HttpOnly + Secure + SameSite=Strict' ($r.Headers -match '(?i)zz\.auth=.*httponly' -and $r.Headers -match '(?i)zz\.auth=.*secure' -and $r.Headers -match '(?i)samesite=strict')
        $r = Call GET '/api/auth/me'
        Check '#3 me' ($r.Status -eq 200 -and $r.Json.email) "($($r.Json.email), mustChangePassword=$($r.Json.mustChangePassword))"

        $r = Call POST '/api/admin/colors' @{ nameAr = 'لون اختبار'; nameEn = "Test Teal $run"; hex = '#127A7A' }
        Check '#32 create color' ($r.Status -eq 201 -and $r.Json.hex -eq '#127a7a') "($($r.Status))"
        $color = $r.Json
        $r = Call PUT "/api/admin/colors/$($color.id)" @{ nameAr = 'لون اختبار'; nameEn = "Test Teal $run"; hex = '#0F6B6B' }
        Check '#33 update color' ($r.Status -eq 200 -and $r.Json.hex -eq '#0f6b6b') "($($r.Status))"
        $r = Call GET '/api/admin/colors'
        Check '#31 colors list with usage' ($r.Status -eq 200 -and @($r.Json | Where-Object { $_.id -eq $color.id -and $_.usageCount -eq 0 }).Count -eq 1)
        $r = Call POST '/api/admin/colors' @{ nameAr = 'x'; nameEn = 'Bad'; hex = 'teal' }
        Check '#32 bad hex refused' ($r.Status -eq 400 -and $r.Json.code -eq 'VALIDATION_FAILED') "($($r.Status))"

        $r = Call POST '/api/admin/categories' @{ parentId = $null; nameAr = 'قسم اختبار'; nameEn = "Test Suite $run"; slug = $null; imageUrl = $null; isVisible = $false; sortOrder = 99 }
        Check '#18 create category' ($r.Status -eq 201 -and $r.Json.slug -eq "test-suite-$run") "($($r.Json.slug))"
        $category = $r.Json
        $r = Call POST '/api/admin/categories' @{ parentId = $null; nameAr = 'قسم'; nameEn = "Copy $run"; slug = $category.slug; imageUrl = $null; isVisible = $false; sortOrder = 0 }
        Check '#18 duplicate slug: 409 DUPLICATE' ($r.Status -eq 409 -and $r.Json.code -eq 'DUPLICATE') "($($r.Status))"
        $r = Call PUT "/api/admin/categories/$($category.id)" @{ parentId = $null; nameAr = 'قسم اختبار'; nameEn = "Test Suite $run"; slug = $category.slug; imageUrl = $null; isVisible = $true; sortOrder = 99 }
        Check '#19 update category (now visible)' ($r.Status -eq 200 -and $r.Json.isVisible -eq $true) "($($r.Status))"

        $r = Call POST '/api/admin/products' @{ categoryId = $category.id; nameAr = 'عباية اختبار'; nameEn = "Test Abaya $run"; slug = $null
            descriptionAr = $null; descriptionEn = 'Created by the full test'; basePrice = 999; isVisible = $true
            variants = @(@{ size = 'M'; colorId = $color.id; stock = 3; priceOverride = $null; sku = $null }) }
        Check '#23 create product with a variant' ($r.Status -eq 201 -and @($r.Json.variants).Count -eq 1) "($($r.Json.slug))"
        $product = $r.Json; $variant = $r.Json.variants[0]
        $r = Call POST "/api/admin/products/$($product.id)/variants" @{ size = 'L'; colorId = $color.id; stock = 2; priceOverride = 1100; sku = $null }
        Check '#26 add a second variant' ($r.Status -eq 201) "($($r.Json.sku))"
        $variantL = $r.Json
        $r = Call POST "/api/admin/products/$($product.id)/variants" @{ size = 'M'; colorId = $color.id; stock = 1; priceOverride = $null; sku = $null }
        Check '#26 same size + color: 409 DUPLICATE' ($r.Status -eq 409 -and $r.Json.code -eq 'DUPLICATE')
        $r = Call PUT "/api/admin/variants/$($variant.id)" @{ size = 'M'; colorId = $color.id; stock = 3; priceOverride = $null; version = ([int64]$variant.version + 1) }
        Check '#27 stale version: 409 CONCURRENCY_CONFLICT' ($r.Status -eq 409 -and $r.Json.code -eq 'CONCURRENCY_CONFLICT')
        $r = Call PUT "/api/admin/variants/$($variant.id)" @{ size = 'M'; colorId = $color.id; stock = 3; priceOverride = 1050; version = $variant.version }
        Check '#27 current version: price saved' ($r.Status -eq 200 -and [decimal]$r.Json.price -eq 1050)
        $r = Call PUT "/api/admin/products/$($product.id)" @{ categoryId = $category.id; nameAr = 'عباية اختبار'; nameEn = "Test Abaya $run"; slug = $product.slug
            descriptionAr = 'وصف'; descriptionEn = 'Updated by the full test'; basePrice = 999; isVisible = $true }
        Check '#24 update product' ($r.Status -eq 200 -and $r.Json.descriptionEn -eq 'Updated by the full test') "($($r.Status))"

        $png = Join-Path $tmp 'photo.png'; NewPng $png 1200 1600
        $r = Call POST "/api/admin/products/$($product.id)/images" -Form @("file=@$png;type=image/png", 'altEn=Front', 'altAr=أمام')
        Check '#29 upload photo' ($r.Status -eq 201 -and $r.Json.srcSet -match '1600w') "($($r.Status))"
        $image = $r.Json
        if ($image.url) {
            $public = & curl.exe -s -o NUL -w '%{http_code} %{content_type}' $image.url
            Check 'photo is public on Supabase as WebP' ($public -match '^200 image/webp') "($public)"
        }
        $fake = Join-Path $tmp 'fake.png'; [IO.File]::WriteAllText($fake, 'this is not a photo')
        $r = Call POST "/api/admin/products/$($product.id)/images" -Form @("file=@$fake;type=image/png")
        Check '#29 fake photo: 415 UNSUPPORTED_FILE_TYPE' ($r.Status -eq 415 -and $r.Json.code -eq 'UNSUPPORTED_FILE_TYPE') "($($r.Status))"
        $big = Join-Path $tmp 'big.png'
        $bytes = New-Object byte[] (5 * 1024 * 1024 + 200 * 1024)
        [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) | ForEach-Object -Begin { $i = 0 } -Process { $bytes[$i++] = $_ }
        [IO.File]::WriteAllBytes($big, $bytes)
        $r = Call POST "/api/admin/products/$($product.id)/images" -Form @("file=@$big;type=image/png")
        Check '#29 photo over 5 MB: 413 FILE_TOO_LARGE' ($r.Status -eq 413 -and $r.Json.code -eq 'FILE_TOO_LARGE') "($($r.Status))"

        $r = Call GET "/api/admin/products/$($product.id)"
        Check '#22 admin product: photo, 2 variants, real stock' ($r.Status -eq 200 -and @($r.Json.images).Count -eq 1 -and @($r.Json.variants).Count -eq 2 -and @($r.Json.variants | Where-Object { $_.stock -eq 3 }).Count -eq 1)
        $r = Call GET "/api/admin/products?q=$run"
        Check '#21 admin list finds it' ($r.Status -eq 200 -and $r.Json.totalCount -eq 1)
        $r = Call GET '/api/admin/categories'
        Check '#17 admin categories with product count' ($r.Status -eq 200 -and @($r.Json | Where-Object { $_.id -eq $category.id -and $_.productCount -eq 1 }).Count -eq 1)

        $r = Call GET "/api/products/$($product.slug)"
        Check 'visible product shows in the shop' ($r.Status -eq 200 -and @($r.Json.images).Count -eq 1) "($($r.Status))"
        $r = Call GET "/api/products?pageSize=100&category=$($category.slug)"
        Check 'shop card shows the main photo' (@($r.Json.items).Count -eq 1 -and $r.Json.items[0].image.altEn -eq 'Front')

        # ======================================================== D. checkout rules
        Section 'D. Checkout rules'
        $zone = $zones[0]
        function Order($lines, $total, [string]$key) {
            $body = @{ customer = @{ name = "Test Buyer $run"; phone = '01112345678'; email = $null; deliveryZoneId = $zone.id
                       city = 'Nasr City'; address = '12 Abbas El Akkad St, apt 7'; notes = 'automated full test' }
                       lines = $lines; paymentMethod = 'CashOnDelivery'; expectedTotal = $total; acceptTerms = $true }
            $h = @{}; if ($key) { $h['Idempotency-Key'] = $key }
            Call POST '/api/orders' $body -Headers $h -NoCsrf
        }
        $r = Order @(@{ variantId = $variant.id; qty = 1 }) (1050 + [decimal]$zone.fee) $null
        Check '#10 no Idempotency-Key: 400' ($r.Status -eq 400 -and $r.Json.code -eq 'IDEMPOTENCY_KEY_REQUIRED') "($($r.Status) $($r.Json.code))"
        $r = Call POST '/api/orders' @{ customer = @{ name = 'A'; phone = '123'; deliveryZoneId = $zone.id; city = ''; address = 'short' }; lines = @(); paymentMethod = 'CashOnDelivery'; expectedTotal = 0; acceptTerms = $false } -Headers @{ 'Idempotency-Key' = [guid]::NewGuid() } -NoCsrf
        $fields = if ($r.Json.errors) { @($r.Json.errors.PSObject.Properties.Name) } else { @() }
        Check '#10 bad form: 400 with field errors' ($r.Status -eq 400 -and $r.Json.code -eq 'VALIDATION_FAILED' -and $fields.Count -ge 3) "($($fields -join ', '))"
        $r = Order @(@{ variantId = $variant.id; qty = 4 }) (4 * 1050 + [decimal]$zone.fee) ([guid]::NewGuid())
        Check '#10 more than the stock: 409 OUT_OF_STOCK' ($r.Status -eq 409 -and $r.Json.code -eq 'OUT_OF_STOCK' -and $r.Json.items[0].available -eq 3) "(available $($r.Json.items[0].available))"
        $r = Order @(@{ variantId = $variant.id; qty = 1 }) 1 ([guid]::NewGuid())
        Check '#10 wrong total: 409 PRICE_CHANGED with the real total' ($r.Status -eq 409 -and $r.Json.code -eq 'PRICE_CHANGED' -and [decimal]$r.Json.total -eq (1050 + [decimal]$zone.fee)) "(real total $($r.Json.total))"
        $r = Call GET "/api/admin/products/$($product.id)"
        Check 'refused orders reserved no stock' (@($r.Json.variants | Where-Object { $_.id -eq $variant.id -and $_.stock -eq 3 }).Count -eq 1)

        # The one real order goes to an existing demo product, so the test product stays never-ordered and can be deleted.
        $demo = $null; $demoVariant = $null
        foreach ($card in $inStock) {
            if ($card.id -eq $product.id) { continue }
            $page = (Call GET "/api/products/$($card.slug)").Json
            $demoVariant = @($page.variants | Where-Object { $_.inStock }) | Select-Object -First 1
            if ($demoVariant) { $demo = $page; break }
        }
        $stockBefore = (Call GET "/api/admin/products/$($demo.id)").Json.variants | Where-Object { $_.id -eq $demoVariant.id } | ForEach-Object { $_.stock }
        $key = [guid]::NewGuid().ToString()
        $total = [decimal]$demoVariant.price + [decimal]$zone.fee
        $first = Order @(@{ variantId = $demoVariant.id; qty = 1 }) $total $key
        Check '#10 place an order' ($first.Status -eq 201 -and $first.Json.number -and $first.Json.trackingToken) "($($first.Json.number), $($first.Json.total) EGP)"
        $again = Order @(@{ variantId = $demoVariant.id; qty = 1 }) $total $key
        Check '#10 same Idempotency-Key twice: one order, same answer' ($again.Status -eq 201 -and $again.Json.number -eq $first.Json.number) "($($again.Json.number))"
        $stockNow = (Call GET "/api/admin/products/$($demo.id)").Json.variants | Where-Object { $_.id -eq $demoVariant.id } | ForEach-Object { $_.stock }
        Check 'stock went down by exactly 1' ($stockNow -eq $stockBefore - 1) "($stockBefore -> $stockNow)"
        $number = $first.Json.number; $token = $first.Json.trackingToken

        $r = Call GET "/api/orders/$number" -Headers @{ 'X-Tracking-Token' = $token }
        Check '#11 tracking (name and phone masked)' ($r.Status -eq 200 -and $r.Json.customer.name -eq 'Test B.' -and $r.Json.customer.phone -match '\*' -and @($r.Json.lines).Count -eq 1) "($($r.Json.customer.name), $($r.Json.customer.phone))"

        # ======================================================== E. order board
        Section 'E. Admin: orders'
        $r = Call GET "/api/admin/orders?q=$number"
        Check '#35 board finds the order' ($r.Status -eq 200 -and $r.Json.totalCount -eq 1)
        $orderId = $r.Json.items[0].id
        $r = Call GET '/api/admin/orders?status=PendingConfirmation&type=Ready&pageSize=5'
        Check '#35 board filters by status and type' ($r.Status -eq 200 -and @($r.Json.items | Where-Object { $_.status -ne 'PendingConfirmation' -or $_.type -ne 'Ready' }).Count -eq 0)
        $r = Call GET "/api/admin/orders/$orderId"
        Check '#36 details unmasked' ($r.Status -eq 200 -and $r.Json.customer.phone -eq '+201112345678')
        $r = Call POST "/api/admin/orders/$orderId/status" @{ to = 'Shipped'; note = $null }
        Check '#37 skipping steps: 409 INVALID_STATUS_TRANSITION' ($r.Status -eq 409 -and $r.Json.code -eq 'INVALID_STATUS_TRANSITION')
        $r = Call POST "/api/admin/orders/$orderId/status" @{ to = 'Confirmed'; note = 'Confirmed (full test)' }
        Check '#37 confirm' ($r.Status -eq 200 -and $r.Json.status -eq 'Confirmed')
        $r = Call POST "/api/admin/orders/$orderId/status" @{ to = 'Cancelled'; note = 'Full test clean-up' }
        Check '#37 cancel' ($r.Status -eq 200 -and $r.Json.status -eq 'Cancelled')
        $stockBack = (Call GET "/api/admin/products/$($demo.id)").Json.variants | Where-Object { $_.id -eq $demoVariant.id } | ForEach-Object { $_.stock }
        Check 'cancel put the stock back' ($stockBack -eq $stockBefore) "($stockBefore -> $stockBack)"
        $r = Call GET "/api/orders/$number" -Headers @{ 'X-Tracking-Token' = $token }
        Check '#11 customer sees the full timeline' (@($r.Json.timeline).Count -ge 3 -and $r.Json.timeline[-1].to -eq 'Cancelled') "($(@($r.Json.timeline).Count) steps)"

        # ======================================================== F. tailoring
        Section 'F. Tailoring and quotes'
        $data = Join-Path $tmp 'request.json'
        function Tailor([string]$photo) {
            $request = @{ customer = @{ name = "Test Tailor $run"; phone = '01112345678'; email = $null; deliveryZoneId = $zone.id
                    city = 'Nasr City'; address = '1 Test Street, apt 1'; notes = $null }
                styleId = 'maxi'; garment = 'dress'; fabric = 'crepe'; color = 'Navy'; fit = 'Relaxed'
                sizingMode = 'Measurements'; standardSize = $null; measurements = @{ bust = 92; waist = 74; dressLength = 140 }
                lining = $true; extras = @('embroidery'); notes = 'Full test - please ignore'; acceptTerms = $true }
            [IO.File]::WriteAllText($data, (ConvertTo-Json -InputObject $request -Depth 6 -Compress), [Text.UTF8Encoding]::new($false))
            $form = @("data=<$data;type=application/json")
            if ($photo) { $form += "referenceImage=@$photo;type=image/png" }
            Call POST '/api/tailoring/requests' -Form $form -NoCsrf -Headers @{ 'Idempotency-Key' = [guid]::NewGuid() }
        }
        $one = Tailor $png
        Check '#14 tailoring request with photo' ($one.Status -eq 201 -and $one.Json.status -eq 'AwaitingQuote' -and $one.Json.estimatedPrice -gt 0) "($($one.Json.number), $($one.Json.estimatedPrice) EGP)"
        $oneId = (Call GET "/api/admin/orders?q=$($one.Json.number)").Json.items[0].id
        $r = Call GET "/api/admin/orders/$oneId"
        Check '#36 private photo through a signed link' ($r.Json.tailoring.referenceImageUrl -match '/object/sign/')
        $r = Call POST "/api/admin/orders/$oneId/quote" @{ price = [decimal]$one.Json.estimatedPrice + 300; note = 'Test price'; validDays = 3 }
        Check '#38 new price: QuoteSent + customer link' ($r.Status -eq 200 -and $r.Json.order.status -eq 'QuoteSent' -and $r.Json.customerLink)
        $newToken = ([regex]::Match("$($r.Json.customerLink)", '[?&]t=([^&]+)')).Groups[1].Value
        $r = Call POST "/api/orders/$($one.Json.number)/quote/reject" @{ reason = 'Too expensive (test)' } -NoCsrf -Headers @{ 'X-Tracking-Token' = $one.Json.trackingToken }
        Check 'old link stops working after a new quote' ($r.Status -eq 404) "($($r.Status))"
        $r = Call POST "/api/orders/$($one.Json.number)/quote/reject" @{ reason = 'Too expensive (test)' } -NoCsrf -Headers @{ 'X-Tracking-Token' = $newToken }
        Check '#16 customer declines: Cancelled' ($r.Status -eq 200 -and $r.Json.status -eq 'Cancelled')

        $two = Tailor $null
        Check '#14 tailoring request without photo' ($two.Status -eq 201) "($($two.Json.number))"
        $twoId = (Call GET "/api/admin/orders?q=$($two.Json.number)").Json.items[0].id
        $r = Call POST "/api/admin/orders/$twoId/quote" @{ price = $two.Json.estimatedPrice; note = 'Same as the estimate'; validDays = 7 }
        Check '#38 same price as the estimate: straight to QuoteApproved' ($r.Status -eq 200 -and $r.Json.order.status -eq 'QuoteApproved')
        $r = Call POST "/api/orders/$($two.Json.number)/quote/approve" -NoCsrf -Headers @{ 'X-Tracking-Token' = $two.Json.trackingToken }
        Check '#15 approving twice: 409 INVALID_STATUS_TRANSITION' ($r.Status -eq 409 -and $r.Json.code -eq 'INVALID_STATUS_TRANSITION') "($($r.Status))"
        $r = Call POST "/api/admin/orders/$twoId/status" @{ to = 'Cancelled'; note = 'Full test clean-up' }
        Check 'tailoring test order cleaned up' ($r.Status -eq 200 -and $r.Json.status -eq 'Cancelled')

        # ======================================================== G. settings
        Section 'G. Admin: settings (read, save unchanged, compare)'
        foreach ($s in @(@('#41/#42 delivery zones', '/api/admin/delivery-zones'), @('#39/#40 tailoring catalog', '/api/admin/tailoring/catalog'),
                         @('#45/#46 price rules', '/api/admin/tailoring/pricing'), @('#43/#44 site settings', '/api/admin/site-settings'))) {
            $before = (Call GET $s[1]).Json
            $body = if ($s[1] -like '*delivery-zones') { @($before | ForEach-Object { @{ id = $_.id; fee = $_.fee; etaDaysMin = $_.etaDaysMin; etaDaysMax = $_.etaDaysMax; isActive = $_.isActive } }) } else { $before }
            $put = Call PUT $s[1] $body
            $after = (Call GET $s[1]).Json
            Check "$($s[0]) save works and changes nothing" ($put.Status -eq 200 -and (Same $before $after)) "($($put.Status))"
        }
        $r = Call GET '/api/admin/dashboard'
        Check '#47 dashboard' ($r.Status -eq 200 -and $null -ne $r.Json.latestOrders -and $r.Json.ordersToday -ge 1) "(today $($r.Json.ordersToday), low stock $(@($r.Json.lowStock).Count))"

        # ======================================================== H. clean-up
        Section 'H. Clean-up (everything the test made)'
        $r = Call PUT "/api/admin/products/$($product.id)" @{ categoryId = $category.id; nameAr = 'عباية اختبار'; nameEn = "Test Abaya $run"; slug = $product.slug
            descriptionAr = 'وصف'; descriptionEn = 'Updated by the full test'; basePrice = 999; isVisible = $false }
        $r = Call GET "/api/products/$($product.slug)"
        Check 'hidden product leaves the shop (404)' ($r.Status -eq 404) "($($r.Status))"
        $r = Call DELETE "/api/admin/images/$($image.id)"
        Check '#30 delete photo' ($r.Status -eq 204)
        $r = Call DELETE "/api/admin/variants/$($variantL.id)"
        Check '#28 delete variant' ($r.Status -eq 204)
        $r = Call DELETE "/api/admin/categories/$($category.id)"
        Check '#20 category with a product: 409 IN_USE' ($r.Status -eq 409 -and $r.Json.code -eq 'IN_USE')
        $r = Call DELETE "/api/admin/products/$($product.id)"
        Check '#25 delete product' ($r.Status -eq 204)
        $r = Call DELETE "/api/admin/categories/$($category.id)"
        Check '#20 delete category' ($r.Status -eq 204)
        $r = Call DELETE "/api/admin/colors/$($color.id)"
        Check '#34 delete color' ($r.Status -eq 204)
        $left = @((Call GET "/api/admin/products?q=$run").Json.items).Count
        Check 'nothing left behind' ($left -eq 0) "($left products)"

        $r = Call POST '/api/auth/logout'
        Check '#2 logout' ($r.Status -eq 204)
        $script:cookie = $null
        $r = Call GET '/api/auth/me'
        Check 'after logout, me is 401' ($r.Status -eq 401)
    }

    # ============================================================ I. rate limits (last: it uses up the tracking limit)
    Section 'I. Rate limits'
    $hit = 0
    for ($i = 1; $i -le 40; $i++) {
        $r = Call GET '/api/orders/ZF-99999' -Headers @{ 'X-Tracking-Token' = 'x' }
        if ($r.Status -eq 429) { $hit = $i; break }
    }
    Check 'tracking: 429 after 30 calls a minute' ($hit -ge 1 -and $hit -le 31) "(429 on call $hit)"
    Check '429 says when to retry (Retry-After)' ([int](Header $r 'Retry-After') -gt 0) "($(Header $r 'Retry-After') s)"
    $r = Call GET '/api/orders/ZF-99999' -Headers @{ 'X-Tracking-Token' = 'x'; 'X-Forwarded-For' = '203.0.113.7' }
    Check 'a faked X-Forwarded-For does not reset the limit' ($r.Status -eq 429) "($($r.Status))"
}
catch {
    Write-Host "  ERROR $($_.Exception.Message)" -ForegroundColor Red
    $script:results.Add([pscustomobject]@{ Section = $script:section; Name = 'script error'; Ok = $false; Info = $_.Exception.Message })
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------- summary + HTML report
$passed = @($script:results | Where-Object { $_.Ok }).Count
$failed = @($script:results | Where-Object { -not $_.Ok }).Count
$seconds = [int]((Get-Date) - $started).TotalSeconds
Write-Host ''
$colorName = if ($failed -eq 0) { 'Green' } else { 'Red' }
Write-Host "Result: $passed passed, $failed failed ($seconds s)" -ForegroundColor $colorName

$enc = { param($s) [System.Net.WebUtility]::HtmlEncode("$s") }
$rows = ($script:results | ForEach-Object {
    $mark = if ($_.Ok) { '<td class="ok">PASS</td>' } else { '<td class="bad">FAIL</td>' }
    "<tr>$mark<td>$(& $enc $_.Section)</td><td>$(& $enc $_.Name)</td><td>$(& $enc $_.Info)</td></tr>" }) -join "`n"
$sections = ($script:results | Group-Object Section | ForEach-Object {
    $p = @($_.Group | Where-Object { $_.Ok }).Count; $t = $_.Count
    $cls = if ($p -eq $t) { 'ok' } else { 'bad' }
    "<tr><td>$(& $enc $_.Name)</td><td class=""$cls"">$p / $t</td></tr>" }) -join "`n"
$mode = if ($PublicOnly) { 'public only (no login)' } else { 'full (owner login)' }
$html = @"
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Zamzam API test report</title>
<style>
body{font:14px/1.5 "Segoe UI",Arial,sans-serif;color:#1d1d1f;margin:24px auto;max-width:1000px;padding:0 16px}
h1{font-size:22px;margin:0}.sub{color:#666;margin:4px 0 16px}
.big{font-size:28px;font-weight:700}.ok{color:#2e7d32;font-weight:600}.bad{color:#c0392b;font-weight:600}
table{width:100%;border-collapse:collapse;margin:12px 0 24px}th{background:#1d1d1f;color:#fff;text-align:left;padding:6px 8px}
td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top}tr:nth-child(even) td{background:#f6f6f7}
</style></head><body>
<h1>Zamzam Fashion &mdash; API test report</h1>
<p class="sub">$(Get-Date -Format 'yyyy-MM-dd HH:mm') &middot; $(& $enc $Api) &middot; mode: $mode &middot; $seconds s</p>
<p class="big $(if ($failed -eq 0) { 'ok' } else { 'bad' })">$passed passed, $failed failed</p>
<table><tr><th>Section</th><th>Passed</th></tr>
$sections
</table>
<table><tr><th>Result</th><th>Section</th><th>Check</th><th>Details</th></tr>
$rows
</table></body></html>
"@
$report = Join-Path (Split-Path $PSScriptRoot -Parent) 'test-report.html'
[IO.File]::WriteAllText($report, $html, [Text.UTF8Encoding]::new($false))
Write-Host "Report: $report" -ForegroundColor Cyan
Write-Host 'Copy the FAIL lines to Claude (they contain no secrets).'
if ($failed -gt 0) { exit 1 }
