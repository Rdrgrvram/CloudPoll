# Reemplazar iconos feos con Font Awesome
$indexFile = 'c:\Users\Lenovo\Documents\CloudPoll\frontend\index.html'
$adminFile = 'c:\Users\Lenovo\Documents\CloudPoll\frontend\admin.html'

# index.html
$content = Get-Content $indexFile -Raw
$content = $content -replace '"⚠"', "'<i class=""fas fa-exclamation-triangle""></i>'"
$content = $content -replace '"ℹ"', "'<i class=""fas fa-info-circle""></i>'"
$content | Set-Content $indexFile

# admin.html
$content = Get-Content $adminFile -Raw
$content = $content -replace '"⚠"', "'<i class=""fas fa-exclamation-triangle""></i>'"
$content = $content -replace '"✓"', "'<i class=""fas fa-check-circle""></i>'"
$content = $content -replace '"ℹ"', "'<i class=""fas fa-info-circle""></i>'"
$content | Set-Content $adminFile

Write-Host "Iconos reemplazados exitosamente"
