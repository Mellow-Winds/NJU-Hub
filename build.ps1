# build.ps1 — 将 options/sections/*.html 和 options/modules/*.js 拼接回 options/options.html
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1. 读取模板
$template = Get-Content -Path "options\options.html" -Raw -Encoding UTF8

# 2. 拼接 sections/*.html
$sectionsDir = "options\sections"
$sectionsHtml = ""
Get-ChildItem -Path $sectionsDir -Filter "*.html" | Sort-Object Name | ForEach-Object {
    $content = Get-Content -Path $_.FullName -Raw -Encoding UTF8
    $sectionsHtml += "`n<!-- ===== $($_.BaseName) ===== -->`n"
    $sectionsHtml += $content.Trim() + "`n"
}
$template = $template -replace '<!--\s*SECTIONS\s*-->', $sectionsHtml

# 3. 生成 modules/*.js 的 script 标签
$modulesDir = "options\modules"
$modulesTags = ""
Get-ChildItem -Path $modulesDir -Filter "*.js" | Sort-Object Name | ForEach-Object {
    $modulesTags += "`n  <script src=""modules/$($_.Name)""></script>"
}
$template = $template -replace '<!--\s*MODULES\s*-->', $modulesTags

# 4. 写回 options.html
$outPath = "options\options.html"
[System.IO.File]::WriteAllText((Resolve-Path $outPath), $template, [System.Text.UTF8Encoding]::new($false))
Write-Host "✅ build.ps1: options.html 已生成 ($(($template.Length)) 字符)" -ForegroundColor Green