# Copies the Jewel design system into ./jewel so the site runs the latest version.
# Run after changing the design system, then commit the result:
#   npm run sync-jewel
# The parked light theme is left out, as the system's own instructions say.

param([string]$Source = (Join-Path $env:USERPROFILE 'OneDrive\Documents\Claude files\jewel-design-system'))

$dest = Join-Path $PSScriptRoot 'jewel'
if (-not (Test-Path (Join-Path $Source 'css\jewel.css'))) {
  throw "No Jewel design system at $Source. Pass -Source <path>, or clone https://github.com/willchambers/jewel-design-system"
}

# /MIR makes ./jewel an exact copy (it removes files deleted upstream).
robocopy $Source $dest /MIR /XF CLAUDE.md /XD .git parked /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

$commit = git -C $Source rev-parse --short HEAD 2>$null
Write-Host "Jewel synced from $((Resolve-Path $Source).Path)$(if ($commit) { " @ $commit" })"
