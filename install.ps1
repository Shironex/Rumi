# Install the latest rumi release for Windows.
#   irm https://raw.githubusercontent.com/Shironex/Rumi/main/install.ps1 | iex
# Override the destination with $env:RUMI_INSTALL_DIR before running.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = "Shironex/Rumi"
$installDir = if ($env:RUMI_INSTALL_DIR) { $env:RUMI_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Programs\rumi" }

# Windows builds are x64 only for now; arm64 Windows runs the x64 binary under emulation.
$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -ne "AMD64" -and $arch -ne "ARM64") {
  Write-Error "Unsupported architecture: $arch. Build from source: https://github.com/$repo#build-from-source"
  exit 1
}

$asset = "rumi-windows-x64.exe"
$url = "https://github.com/$repo/releases/latest/download/$asset"
$target = Join-Path $installDir "rumi.exe"

Write-Host "Installing rumi (windows-x64) into $installDir..."
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# PS 5.1 defaults to TLS 1.0 and the IE parsing engine; pin TLS 1.2 and use basic
# parsing so the download works on a stock Windows PowerShell.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$tmp = Join-Path $env:TEMP "rumi-$PID.exe"
try {
  Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
} catch {
  Write-Error "Download failed. No release asset at: $url"
  exit 1
}

# A running rumi.exe is locked by Windows and can't be overwritten. Tell the user
# rather than failing with a cryptic access-denied; `rumi update` handles the
# in-place swap once installed.
try {
  Move-Item -Path $tmp -Destination $target -Force
} catch {
  Remove-Item $tmp -ErrorAction SilentlyContinue
  Write-Error "Couldn't write $target. If rumi is running, close it and re-run this installer."
  exit 1
}

# Add the install dir to the *user* PATH if it isn't already there. SetEnvironmentVariable
# (not setx, which truncates at 1024 chars); the User PATH can be null on a fresh box.
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$entries = if ($userPath) { $userPath -split ";" } else { @() }
if ($entries -notcontains $installDir) {
  $newPath = if ($userPath) { "$userPath;$installDir" } else { $installDir }
  [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
  $env:Path = "$env:Path;$installDir"
  Write-Host "Installed rumi to $target"
  Write-Host "Added $installDir to your PATH. Open a new terminal, then run: rumi"
} else {
  Write-Host "Installed rumi to $target"
  Write-Host "Run: rumi"
}
