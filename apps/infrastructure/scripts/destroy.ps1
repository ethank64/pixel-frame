param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "..\config.env")
)

$ErrorActionPreference = "Stop"

function Import-Config {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Missing config file: $Path. Copy config.example.env to config.env first."
    }

    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $name, $value = $_ -split '=', 2
        Set-Variable -Name $name.Trim() -Value $value.Trim() -Scope Script
    }
}

Import-Config -Path $ConfigPath

Write-Host "Destroying Lightsail resources in $AWS_REGION..."

$staticIp = aws lightsail get-static-ips `
    --region $AWS_REGION `
    --query "staticIps[?name=='$STATIC_IP_NAME'].name" `
    --output text

if ($staticIp) {
    Write-Host "Detaching and deleting static IP $STATIC_IP_NAME..."
    aws lightsail detach-static-ip `
        --region $AWS_REGION `
        --static-ip-name $STATIC_IP_NAME 2>$null | Out-Null
    aws lightsail release-static-ip `
        --region $AWS_REGION `
        --static-ip-name $STATIC_IP_NAME | Out-Null
}

$instance = aws lightsail get-instances `
    --region $AWS_REGION `
    --query "instances[?name=='$INSTANCE_NAME'].name" `
    --output text

if ($instance) {
    Write-Host "Deleting instance $INSTANCE_NAME..."
    aws lightsail delete-instance `
        --region $AWS_REGION `
        --instance-name $INSTANCE_NAME `
        --force-delete-add-ons | Out-Null
}

Write-Host "Destroy complete."
