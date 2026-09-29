# Copies the Jewel design system into ./jewel so the site runs the latest version.
# Run after changing the design system, then commit the result:
#   npm run sync-jewel
#   npm run sync-jewel -- -Ref 46f2060     (a particular commit)
#
# It copies a Jewel commit (git archive), not Jewel's working folder, so
# half-finished or unpushed work there never leaks into the site. The parked
# light theme and Jewel's own tooling are left out, as the system's own
# instructions say.

param(
  [string]$Source = (Join-Path $env:USERPROFILE 'OneDrive\Documents\Claude files\jewel-design-system'),
  [string]$Ref = 'HEAD'
)

$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot 'jewel'

if (-not (Test-Path (Join-Path $Source 'css\jewel.css'))) {
  throw "No Jewel design system at $Source. Pass -Source <path>, or clone https://github.com/willchambers/jewel-design-system"
}

$commit = git -C $Source rev-parse --short $Ref
if ($LASTEXITCODE -ne 0) { throw "Can't find $Ref in $Source." }
if ($Ref -eq 'HEAD' -and (git -C $Source status --porcelain)) {
  Write-Host "Note: Jewel has uncommitted changes. Copying the last commit ($commit) without them."
}
$ahead = git -C $Source rev-list --count "origin/main..$commit" 2>$null
if ($ahead -and [int]$ahead -gt 0) {
  Write-Host "Note: $commit isn't pushed to Jewel's GitHub yet ($ahead commit(s) ahead of origin/main)."
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) "jewel-$commit-$PID"
$zip = "$tmp.zip"
git -C $Source archive --format=zip -o $zip $commit
if ($LASTEXITCODE -ne 0) { throw "git archive failed" }
Expand-Archive -Path $zip -DestinationPath $tmp -Force

# /MIR makes ./jewel an exact copy (it removes files deleted upstream).
robocopy $tmp $dest /MIR /XF CLAUDE.md /XD .claude parked /NFL /NDL /NJH /NJS | Out-Null
$code = $LASTEXITCODE
Remove-Item $zip, $tmp -Recurse -Force
if ($code -ge 8) { throw "robocopy failed with exit code $code" }

Write-Host "Jewel synced from $((Resolve-Path $Source).Path) @ $commit"
