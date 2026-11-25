$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'Could not push source to GitHub.' }
    $webCommit = git subtree split --prefix=dist main
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the web branch.' }
    git push origin "${webCommit}:refs/heads/gh-pages"
    if ($LASTEXITCODE -ne 0) { throw 'Could not push the web branch. No history was overwritten.' }
    Write-Host 'Published game files. GitHub Pages will update the live website.'
    Write-Host 'https://hungvaanh114.github.io/veins-of-mud/'
}
finally {
    Pop-Location
}
