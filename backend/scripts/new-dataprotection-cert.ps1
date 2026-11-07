# Makes the certificate that encrypts the API's cookie keys on the server (run once per environment).
# It prints two values to paste into MonsterASP's environment variables:
#   DataProtection__CertificateBase64   and   DataProtection__CertificatePassword
# Keep them only there (and in your password manager). Never commit them.
#   powershell -ExecutionPolicy Bypass -File .\scripts\new-dataprotection-cert.ps1

$ErrorActionPreference = 'Stop'

# A random password for the .pfx file.
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes) # works in Windows PowerShell 5.1 too
$password = [Convert]::ToBase64String($bytes)

# Self-signed is fine: the certificate only encrypts keys, nobody needs to trust it. 5 years.
$rsa = [System.Security.Cryptography.RSA]::Create(3072)
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    'CN=Zamzam DataProtection', $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddYears(5))
$pfx = $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)

Write-Host ''
Write-Host 'DataProtection__CertificateBase64 =' -ForegroundColor Cyan
Write-Host ([Convert]::ToBase64String($pfx))
Write-Host ''
Write-Host 'DataProtection__CertificatePassword =' -ForegroundColor Cyan
Write-Host $password
Write-Host ''
Write-Host 'Expires:' $certificate.NotAfter.ToString('yyyy-MM-dd') '- make a new one before then (old keys stay readable only with the old certificate).' -ForegroundColor Yellow
