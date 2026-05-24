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

function Test-LightsailInstance {
    param([string]$Name, [string]$Region)

    $instances = aws lightsail get-instances `
        --region $Region `
        --query "instances[?name=='$Name'].name" `
        --output text

    return [bool]$instances
}

function Test-LightsailStaticIp {
    param([string]$Name, [string]$Region)

    $ips = aws lightsail get-static-ips `
        --region $Region `
        --query "staticIps[?name=='$Name'].name" `
        --output text

    return [bool]$ips
}

Import-Config -Path $ConfigPath

Write-Host "Provisioning Lightsail backend in $AWS_REGION..."

if (-not (Test-LightsailInstance -Name $INSTANCE_NAME -Region $AWS_REGION)) {
    $userDataPath = Join-Path $PSScriptRoot "user-data.sh"
    Write-Host "Creating instance $INSTANCE_NAME ($BUNDLE_ID)..."

    aws lightsail create-instances `
        --region $AWS_REGION `
        --instance-names $INSTANCE_NAME `
        --availability-zone $AWS_AVAILABILITY_ZONE `
        --blueprint-id $BLUEPRINT_ID `
        --bundle-id $BUNDLE_ID `
        --user-data "file://$userDataPath" | Out-Null
} else {
    Write-Host "Instance $INSTANCE_NAME already exists."
}

Write-Host "Waiting for instance to become running..."
for ($i = 0; $i -lt 60; $i++) {
    $state = aws lightsail get-instance `
        --region $AWS_REGION `
        --instance-name $INSTANCE_NAME `
        --query "instance.state.name" `
        --output text

    if ($state -eq "running") { break }
    Start-Sleep -Seconds 5
}

if ($state -ne "running") {
    throw "Instance did not reach running state (last state: $state)."
}

if (-not (Test-LightsailStaticIp -Name $STATIC_IP_NAME -Region $AWS_REGION)) {
    Write-Host "Allocating static IP $STATIC_IP_NAME..."
    aws lightsail allocate-static-ip `
        --region $AWS_REGION `
        --static-ip-name $STATIC_IP_NAME | Out-Null
} else {
    Write-Host "Static IP $STATIC_IP_NAME already exists."
}

Write-Host "Attaching static IP to instance..."
aws lightsail attach-static-ip `
    --region $AWS_REGION `
    --static-ip-name $STATIC_IP_NAME `
    --instance-name $INSTANCE_NAME | Out-Null

Write-Host "Opening TCP port $CONTAINER_PORT..."
aws lightsail open-instance-public-ports `
    --region $AWS_REGION `
    --instance-name $INSTANCE_NAME `
    --port-info fromPort=$CONTAINER_PORT,toPort=$CONTAINER_PORT,protocol=tcp | Out-Null

$publicIp = aws lightsail get-static-ip `
    --region $AWS_REGION `
    --static-ip-name $STATIC_IP_NAME `
    --query "staticIp.ipAddress" `
    --output text

Write-Host ""
Write-Host "Provision complete."
Write-Host "  Instance:  $INSTANCE_NAME"
Write-Host "  Public IP: $publicIp"
Write-Host "  API:       http://${publicIp}:${CONTAINER_PORT}/"
Write-Host "  WebSocket: ws://${publicIp}:${CONTAINER_PORT}/api/ws/canvas"
Write-Host ""
Write-Host "Next: run scripts/deploy.ps1 to build and deploy the backend container."
