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

function Get-LightsailKeyPath {
    param([string]$Region)

    $sshDir = Join-Path $env:USERPROFILE ".ssh"
    New-Item -ItemType Directory -Force -Path $sshDir | Out-Null

    $keyPath = Join-Path $sshDir "LightsailDefaultKey-$Region.pem"
    if (-not (Test-Path $keyPath)) {
        Write-Host "Downloading Lightsail default SSH key..."
        $keyJson = aws lightsail download-default-key-pair --region $Region --output json | ConvertFrom-Json
        Set-Content -Path $keyPath -Value $keyJson.privateKeyBase64 -NoNewline
        icacls $keyPath /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
    }

    return $keyPath
}

function Invoke-Ssh {
    param(
        [string]$KeyPath,
        [string]$PublicIp,
        [string]$Command
    )

    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    ssh `
        -i $KeyPath `
        -o StrictHostKeyChecking=no `
        -o LogLevel=ERROR `
        ec2-user@$PublicIp `
        $Command 2>$null | Out-Null
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorAction
    return $exitCode
}

function Wait-ForInstanceReady {
    param(
        [string]$InstanceName,
        [string]$Region,
        [string]$KeyPath,
        [string]$PublicIp
    )

    Write-Host "Waiting for cloud-init and Docker on $PublicIp..."
    for ($i = 0; $i -lt 60; $i++) {
        $exitCode = Invoke-Ssh -KeyPath $KeyPath -PublicIp $PublicIp -Command "test -f /var/lib/pixel-frame-ready && command -v docker"
        if ($exitCode -eq 0) { return }
        Start-Sleep -Seconds 10
    }

    throw "Instance did not become ready for deployment."
}

Import-Config -Path $ConfigPath

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$backendDir = Join-Path $repoRoot "apps\backend"
$imageTar = Join-Path $env:TEMP "pixel-frame-backend.tar"

if (-not (Test-Path $backendDir)) {
    throw "Backend directory not found: $backendDir"
}

$publicIp = aws lightsail get-static-ip `
    --region $AWS_REGION `
    --static-ip-name $STATIC_IP_NAME `
    --query "staticIp.ipAddress" `
    --output text

if (-not $publicIp) {
    throw "Static IP not found. Run scripts/provision.ps1 first."
}

$keyPath = Get-LightsailKeyPath -Region $AWS_REGION
Wait-ForInstanceReady -InstanceName $INSTANCE_NAME -Region $AWS_REGION -KeyPath $keyPath -PublicIp $publicIp

Write-Host "Building Docker image from $backendDir..."
docker build -t $IMAGE_NAME $backendDir
if ($LASTEXITCODE -ne 0) { throw "Docker build failed." }

Write-Host "Saving image to $imageTar..."
if (Test-Path $imageTar) { Remove-Item $imageTar -Force }
docker save $IMAGE_NAME -o $imageTar
if ($LASTEXITCODE -ne 0) { throw "Docker save failed." }

Write-Host "Uploading image to $publicIp..."
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
scp `
    -i $keyPath `
    -o StrictHostKeyChecking=no `
    -o LogLevel=ERROR `
    $imageTar `
    ec2-user@${publicIp}:/tmp/pixel-frame-backend.tar 2>$null | Out-Null
$ErrorActionPreference = $previousErrorAction
if ($LASTEXITCODE -ne 0) { throw "SCP upload failed." }

$remoteScript = "sudo docker load -i /tmp/pixel-frame-backend.tar && sudo docker rm -f $CONTAINER_NAME 2>/dev/null || true && sudo docker run -d --name $CONTAINER_NAME --restart unless-stopped -p ${CONTAINER_PORT}:8000 $IMAGE_NAME && rm -f /tmp/pixel-frame-backend.tar && curl -sf http://127.0.0.1:${CONTAINER_PORT}/"

Write-Host "Starting container on instance..."
$exitCode = Invoke-Ssh -KeyPath $keyPath -PublicIp $publicIp -Command $remoteScript
if ($exitCode -ne 0) { throw "Remote deployment failed (exit code $exitCode)." }

Remove-Item $imageTar -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Deploy complete."
Write-Host "  Health:    http://${publicIp}:${CONTAINER_PORT}/"
Write-Host "  WebSocket: ws://${publicIp}:${CONTAINER_PORT}/api/ws/canvas"
Write-Host ""
Write-Host "Update apps/firmware/secrets.h with:"
Write-Host "  WS_HOST `"$publicIp`""
Write-Host "  WS_PORT $CONTAINER_PORT"
Write-Host "  WS_PATH `"/api/ws/canvas`""
