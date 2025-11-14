# Alternative SFTP Deployment using Posh-SSH
# Install first with: Install-Module -Name Posh-SSH -Force

# ============================================
# CONFIGURATION - Update these values
# ============================================

$sftpHost = "your-server.com"
$sftpPort = 22
$sftpUsername = "your-username"
$sftpPassword = "your-password"  # Or use $null and provide SSH key
$remoteDirectory = "/var/www/zendesk"

Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Zendesk Dashboard - SFTP Deployment     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

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
    
    # Create remote directory
    Write-Host "`n📁 Creating remote directory: $remoteDirectory" -ForegroundColor Yellow
    Invoke-SSHCommand -SessionId $session.SessionId -Command "mkdir -p $remoteDirectory" | Out-Null
    
    # Files to upload
    $filesToUpload = @(
        "server.js",
        "package.json",
        "package-lock.json",
        ".env.example",
        "DEPLOYMENT.md"
    )
    
    Write-Host "`n📤 Uploading files..." -ForegroundColor Yellow
    
    foreach ($file in $filesToUpload) {
        $localFile = Join-Path $PSScriptRoot $file
        if (Test-Path $localFile) {
            Write-Host "   Uploading $file..." -ForegroundColor Gray
            Set-SFTPItem -SessionId $session.SessionId -Path $localFile -Destination "$remoteDirectory/$file" -Force
        }
    }
    
    # Upload directories
    $foldersToUpload = @("src", "web", "data")
    
    foreach ($folder in $foldersToUpload) {
        $localFolder = Join-Path $PSScriptRoot $folder
        if (Test-Path $localFolder) {
            Write-Host "   Uploading $folder directory..." -ForegroundColor Gray
            
            # Create remote folder
            Invoke-SSHCommand -SessionId $session.SessionId -Command "mkdir -p $remoteDirectory/$folder" | Out-Null
            
            # Upload all files in folder recursively
            Get-ChildItem -Path $localFolder -Recurse -File | ForEach-Object {
                $relativePath = $_.FullName.Substring($localFolder.Length + 1)
                $remoteFilePath = "$remoteDirectory/$folder/$($relativePath -replace '\\', '/')"
                $remoteDir = Split-Path $remoteFilePath -Parent
                
                # Create remote subdirectory if needed
                Invoke-SSHCommand -SessionId $session.SessionId -Command "mkdir -p `"$remoteDir`"" | Out-Null
                
                # Upload file
                Set-SFTPItem -SessionId $session.SessionId -Path $_.FullName -Destination $remoteFilePath -Force
            }
        }
    }
    
    Write-Host "`n✓ All files uploaded successfully!" -ForegroundColor Green
    
    Write-Host "`n📋 Next steps on your server:" -ForegroundColor Cyan
    Write-Host "   1. SSH into: $sftpHost" -ForegroundColor White
    Write-Host "   2. cd $remoteDirectory" -ForegroundColor Gray
    Write-Host "   3. cp .env.example .env" -ForegroundColor Gray
    Write-Host "   4. nano .env  # Add your Zendesk credentials" -ForegroundColor Gray
    Write-Host "   5. npm install" -ForegroundColor Gray
    Write-Host "   6. npm start  # Or use PM2: pm2 start server.js" -ForegroundColor Gray
    
    Write-Host "`n🌐 Your dashboard will be available at:" -ForegroundColor Cyan
    Write-Host "   http://$sftpHost/web/cx.html" -ForegroundColor White
    
} catch {
    Write-Host "`n✗ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # Cleanup - close SFTP session
    if ($session) {
        Remove-SFTPSession -SessionId $session.SessionId | Out-Null
        Write-Host "`n✓ Connection closed" -ForegroundColor Green
    }
}

Write-Host ""
