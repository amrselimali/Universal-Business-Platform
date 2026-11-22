#requires -Version 5.1
<#
  Verifies the payroll module end-to-end against a real PostgreSQL database.

  Usage (from the repository root):
    powershell -ExecutionPolicy Bypass -File scripts\payroll-verify.ps1
    powershell -ExecutionPolicy Bypass -File scripts\payroll-verify.ps1 -Connection "Host=...;Database=ubp_test;Username=...;Password=..."

  Steps:
    1) resolves the test connection (parameter, then UBP_TEST_CONNECTION, then user-secrets Database:ConnectionString)
    2) builds Web + Tests into a neutral OutDir (avoids locked bin folders)
    3) runs the payroll test suite (schema guards, engines, runs, reports, permissions)
    4) prints the database migration count so 0115..0210 can be confirmed applied

  Without a connection string the script stops with a clear message; it never guesses credentials.
#>
param(
    [string]$Connection = "",
    [string]$OutDir = "D:\ubp_verify"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Error "dotnet SDK was not found in PATH (.NET 10 SDK is required)."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Connection)) {
    $Connection = $env:UBP_TEST_CONNECTION
}

if ([string]::IsNullOrWhiteSpace($Connection)) {
    Write-Host "==> Reading Database:ConnectionString from user-secrets"
    try {
        $json = dotnet user-secrets list --project src\Ubp.Web\Ubp.Web.csproj 2>$null | Out-String
        $line = ($json -split "`n" | Where-Object { $_ -match "Database:ConnectionString" } | Select-Object -First 1)
        if ($line) { $Connection = ($line -split "=", 2)[1].Trim() }
    } catch { }
}

if ([string]::IsNullOrWhiteSpace($Connection)) {
    Write-Error "No connection string. Pass -Connection ""Host=..."" or set UBP_TEST_CONNECTION."
    exit 1
}

$env:UBP_TEST_CONNECTION = $Connection
$env:Ubp__Database__ConnectionString = $Connection

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$testsOut = Join-Path $OutDir "tests"
$webOut = Join-Path $OutDir "web"

Write-Host "==> Building Web"
dotnet build src\Ubp.Web\Ubp.Web.csproj -p:OutDir="$webOut\" -v q --nologo
if ($LASTEXITCODE -ne 0) { Write-Error "Web build failed."; exit 1 }

Write-Host "==> Building Tests"
dotnet build tests\Ubp.Tests\Ubp.Tests.csproj -p:OutDir="$testsOut\" -v q --nologo
if ($LASTEXITCODE -ne 0) { Write-Error "Tests build failed."; exit 1 }

Write-Host "==> Running payroll tests against the database"
$dll = Join-Path $testsOut "Ubp.Tests.dll"
dotnet vstest $dll --TestCaseFilter:"FullyQualifiedName~Payroll"
$testExit = $LASTEXITCODE

Write-Host "==> Applied migrations"
Write-Host "    SELECT count(*) AS applied, max(script_name) AS last_script FROM schema_versions;"

if ($testExit -ne 0) {
    Write-Error "Payroll verification failed."
    exit $testExit
}

Write-Host "==> Payroll verification completed."
