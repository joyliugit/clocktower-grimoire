param(
    [string]$ApiToken = "",
    [string]$AccountId = "",
    [string]$ConfigPath = "",
    [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'

function Require-Value($label, $value) {
    if ($value -and $value.Trim()) { return $value.Trim() }
    $inputValue = Read-Host -Prompt $label
    if (-not $inputValue -or -not $inputValue.Trim()) {
        throw "Missing $label"
    }
    return $inputValue.Trim()
}

function Load-ConfigFile($path) {
    if (-not $path -or -not (Test-Path $path)) { return }
    $content = Get-Content $path -Raw
    $tokenMatch = [regex]::Match($content, '\$CloudflareApiToken\s*=\s*"([^"]+)"')
    $accountMatch = [regex]::Match($content, '\$CloudflareAccountId\s*=\s*"([^"]+)"')
    if (-not $script:ApiToken -and $tokenMatch.Success) {
        $script:ApiToken = $tokenMatch.Groups[1].Value.Trim()
    }
    if (-not $script:AccountId -and $accountMatch.Success) {
        $script:AccountId = $accountMatch.Groups[1].Value.Trim()
    }
}

function Run-CommandCapture([string[]]$arguments) {
    $quotedArgs = $arguments | ForEach-Object {
        if ($_ -match '\s') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
    }
    $commandLine = "npx.cmd $($quotedArgs -join ' ') 2>&1"
    $output = & cmd.exe /c $commandLine
    $text = ($output | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: npx.cmd $($arguments -join ' ')`n$text"
    }
    return $text
}

function Extract-NamespaceId([string]$text) {
    $match = [regex]::Match($text, 'id\s*=\s*"([a-f0-9]{32})"', 'IgnoreCase')
    if ($match.Success) { return $match.Groups[1].Value }
    $match = [regex]::Match($text, '([a-f0-9]{32})', 'IgnoreCase')
    if ($match.Success) { return $match.Groups[1].Value }
    throw "Could not parse KV namespace id from output:`n$text"
}

function Get-WorkerNamespaceTitle([string]$suffix) {
    $wranglerConfigPath = Join-Path $scriptDir 'wrangler.jsonc'
    $configText = Get-Content $wranglerConfigPath -Raw
    $nameMatch = [regex]::Match($configText, '"name"\s*:\s*"([^"]+)"')
    $workerName = if ($nameMatch.Success) { $nameMatch.Groups[1].Value.Trim() } else { 'clocktower-grimoire-room-api' }
    return "$workerName-$suffix"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$defaultConfigPath = Join-Path $scriptDir 'cloudflare-config.local.ps1'
if (-not $ConfigPath) {
    $ConfigPath = $defaultConfigPath
} elseif (-not [System.IO.Path]::IsPathRooted($ConfigPath)) {
    $ConfigPath = Join-Path $scriptDir $ConfigPath
}

Load-ConfigFile $ConfigPath

$ApiToken = Require-Value 'Cloudflare API Token' $ApiToken
$AccountId = Require-Value 'Cloudflare Account ID' $AccountId

$env:CLOUDFLARE_API_TOKEN = $ApiToken
$env:CLOUDFLARE_ACCOUNT_ID = $AccountId
if (-not $env:HTTPS_PROXY -and $env:HTTP_PROXY) {
    $env:HTTPS_PROXY = $env:HTTP_PROXY
}

Write-Host "[0/4] Checking Cloudflare auth..."
$whoamiOutput = Run-CommandCapture @('wrangler', 'whoami')
Write-Host $whoamiOutput

$prodNamespaceTitle = Get-WorkerNamespaceTitle 'ROOMS_KV'
$previewNamespaceTitle = Get-WorkerNamespaceTitle 'ROOMS_KV_preview'

Write-Host "[1/4] Creating production KV namespace..."
$prodOutput = Run-CommandCapture @('wrangler', 'kv', 'namespace', 'create', $prodNamespaceTitle, '--experimental-provision')
$prodId = Extract-NamespaceId $prodOutput

Write-Host "[2/4] Creating preview KV namespace..."
$previewOutput = Run-CommandCapture @('wrangler', 'kv', 'namespace', 'create', $previewNamespaceTitle, '--preview', '--experimental-provision')
$previewId = Extract-NamespaceId $previewOutput

Write-Host "[3/4] Updating wrangler.jsonc ..."
$wranglerConfigPath = Join-Path $scriptDir 'wrangler.jsonc'
$configText = Get-Content $wranglerConfigPath -Raw
$configText = $configText.Replace('REPLACE_WITH_YOUR_KV_NAMESPACE_ID', $prodId)
$configText = $configText.Replace('REPLACE_WITH_YOUR_KV_PREVIEW_ID', $previewId)
Set-Content -Path $wranglerConfigPath -Value $configText -Encoding UTF8

if (-not $SkipDeploy) {
    Write-Host "[4/4] Deploying worker..."
    $deployOutput = Run-CommandCapture @('wrangler', 'deploy')
    Write-Host $deployOutput
} else {
    Write-Host "[4/4] Deploy skipped."
}

Write-Host "Done."
Write-Host "Production KV ID: $prodId"
Write-Host "Preview KV ID: $previewId"
