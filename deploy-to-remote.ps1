# SFTP Deployment for automation.dtctools.esolutionsfurniture.com
# ============================================
# CONFIGURATION - Update these values
# ============================================

$sftpHost = "automation.dtctools.esolutionsfurniture.com"
$sftpPort = 22
$sftpUsername = "YOUR_USERNAME_HERE"  # <-- UPDATE THIS
$sftpPassword = "YOUR_PASSWORD_HERE"  # <-- UPDATE THIS
$remoteDirectory = "/var/www/zendesk"  # <-- UPDATE THIS if different

Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Zendesk Dashboard - SFTP Deployment     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Validate configuration
if ($sftpUsername -eq "YOUR_USERNAME_HERE" -or $sftpPassword -eq "YOUR_PASSWORD_HERE") {
    Write-Host "✗ ERROR: Please update the configuration at the top of this script" -ForegroundColor Red
    Write-Host "   Edit deploy-to-remote.ps1 and set your server credentials" -ForegroundColor Yellow
    exit 1
}

# Check if Posh-SSH is installed
try {
    Import-Module Posh-SSH -ErrorAction Stop
    Write-Host "✓ Posh-SSH module loaded" -ForegroundColor Green
} catch {
    Write-Host "✗ Posh-SSH module not found" -ForegroundColor Red
    Write-Host "`nInstalling Posh-SSH..." -ForegroundColor Yellow
    Install-Module -Name Posh-SSH -Force -Scope CurrentUser
    Import-Module Posh-SSH
}

try {
    # Create credential
    $securePassword = ConvertTo-SecureString $sftpPassword -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential ($sftpUsername, $securePassword)
    
    Write-Host "`n📡 Connecting to $sftpHost..." -ForegroundColor Yellow
    
    # Establish SFTP session
    $session = New-SFTPSession -ComputerName $sftpHost -Port $sftpPort -Credential $credential -AcceptKey
    
    Write-Host "✓ Connected successfully" -ForegroundColor Green
    
    # Files to upload (the ones that changed)
    $filesToUpload = @(
        @{Local="server.js"; Remote="$remoteDirectory/server.js"},
        @{Local="web\cx.html"; Remote="$remoteDirectory/web/cx.html"},
        @{Local="web\onlineAgents.html"; Remote="$remoteDirectory/web/onlineAgents.html"}
    )
    
    Write-Host "`n📤 Uploading updated files..." -ForegroundColor Yellow
    
    foreach ($file in $filesToUpload) {
        $localFile = Join-Path $PSScriptRoot $file.Local
        if (Test-Path $localFile) {
            Write-Host "   Uploading $($file.Local)..." -ForegroundColor Gray
            
            # Create remote directory if needed
            $remoteDir = Split-Path $file.Remote -Parent
            Invoke-SSHCommand -SessionId $session.SessionId -Command "mkdir -p `"$remoteDir`"" | Out-Null
            
            # Upload file
            Set-SFTPItem -SessionId $session.SessionId -Path $localFile -Destination $file.Remote -Force
            Write-Host "      ✓ Done" -ForegroundColor Green
        } else {
            Write-Host "   ✗ File not found: $($file.Local)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n✓ All files uploaded successfully!" -ForegroundColor Green
    
    # Now restart the server via SSH
    Write-Host "`n🔄 Restarting Node.js server..." -ForegroundColor Yellow
    
    # Try different restart methods
    $restartCommands = @(
        "cd $remoteDirectory && pm2 restart zendesk-dashboard",
        "cd $remoteDirectory && sudo systemctl restart zendesk-dashboard",
        "cd $remoteDirectory && pkill node && nohup node server.js > server.log 2>&1 &"
    )
    
    $restarted = $false
    foreach ($cmd in $restartCommands) {
        Write-Host "   Trying: $cmd" -ForegroundColor Gray
        $result = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd
        if ($result.ExitStatus -eq 0) {
            Write-Host "   ✓ Server restarted successfully" -ForegroundColor Green
            $restarted = $true
            break
        }
    }
    
    if (-not $restarted) {
        Write-Host "   ⚠ Could not auto-restart. Please SSH and restart manually:" -ForegroundColor Yellow
        Write-Host "   ssh $sftpUsername@$sftpHost" -ForegroundColor Gray
        Write-Host "   cd $remoteDirectory" -ForegroundColor Gray
        Write-Host "   pm2 restart zendesk-dashboard" -ForegroundColor Gray
    }
    
    Write-Host "`n🌐 Your Online Agents dashboard should now be available at:" -ForegroundColor Cyan
    Write-Host "   https://$sftpHost/web/onlineAgents.html" -ForegroundColor White
    
    Write-Host "`n📋 Test the API endpoint:" -ForegroundColor Cyan
    Write-Host "   https://$sftpHost/api/agents/online?date=2025-11-14" -ForegroundColor White
    
} catch {
    Write-Host "`n✗ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nStack trace:" -ForegroundColor Gray
    Write-Host $_.Exception.StackTrace -ForegroundColor DarkGray
} finally {
    # Cleanup - close SFTP session
    if ($session) {
        Remove-SFTPSession -SessionId $session.SessionId | Out-Null
        Write-Host "`n✓ Connection closed" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
