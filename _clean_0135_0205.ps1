$root = "src/Ubp.Infrastructure/Migrations/Scripts"
$bak = "_bak_db_seq_0135_0205_$(Get-Date -Format yyyyMMdd_HHmmss)"
New-Item -ItemType Directory -Path $bak -Force | Out-Null
$files = Get-ChildItem -LiteralPath $root -Filter "*.sql" -File | Where-Object { $_.BaseName -match '^0*(\d+)' -and [int]$matches[1] -ge 135 -and [int]$matches[1] -le 205 } | Sort-Object Name
$changed = 0
foreach ($f in $files) {
    $orig = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
    $lines = $orig -split "\r?\n"
    $filtered = @()
    $skipBlock = $false
    $blockBuffer = @()
    foreach ($line in $lines) {
        if (-not $skipBlock -and $line -match '(?i)\b(?:DO\s+\$\$|IF\s+to_regclass\s*\(\s*''(?:public\.)?db_sequence''\s*\))') {
            $skipBlock = $true
            $blockBuffer = @($line)
            continue
        }
        if ($skipBlock) {
            $blockBuffer += $line
            if ($line -match '(?i)\bEND\s+(?:IF|\$\$);') {
                $joinedBlock = $blockBuffer -join "`n"
                if ($joinedBlock -notmatch '(?i)\bdb_sequence\b|\bpayroll_migration_seq\b') { $filtered += $blockBuffer }
                $skipBlock = $false
                $blockBuffer = @()
            }
            continue
        }
        if ($line -match '(?i)\bdb_sequence\b|\bpayroll_migration_seq\b') { continue }
        $filtered += $line
 






   }
    if ($skipBlock -and $blockBuffer.Count -gt 0) { $filtered += $blockBuffer }
    $newText = ($filtered -join "`r`n")
    if ($newText -ne $orig) {
        Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $bak $f.Name) -Force
        Set-Content -LiteralPath $f.FullName -Value $newText -Encoding UTF8 -NoNewline
        $changed++
        "CLEANED: $($f.Name)"
 







   }
}
"CHANGED_FILES: $changed"
"REMAINING_0135_0205:"
Get-ChildItem -LiteralPath $root -Filter "*.sql" -File | Where-Object { $_.BaseName -match '^0*(\d+)' -and [int]$matches[1] -ge 135 -and [int]$matches[1] -le 205 } | Select-String -Pattern "db_sequence|payroll_migration_seq" | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }
