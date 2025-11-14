# SFTP Deployment Script for Zendesk Dashboard
# This script uploads your project files to a remote server via SFTP

# ============================================
# CONFIGURATION - Update these values
# ============================================

$sftpHost = "your-server.com"           # Your SFTP server hostname or IP
$sftpPort = 22                          # SFTP port (usually 22)
$sftpUsername = "your-username"         # Your SFTP username
$sftpPassword = "your-password"         # Your SFTP password (or use key below)
$remoteDirectory = "/var/www/zendesk"   # Remote directory where files should be uploaded

# Alternatively, use SSH key authentication (leave password empty if using key)
$sshKeyPath = ""  # Example: "C:\Users\YourName\.ssh\id_rsa"

# ============================================
# Files and folders to deploy
# ============================================

$localPath = $PSScriptRoot  # Current directory

$filesToDeploy = @(
    "server.js",
    "package.json",
    "package-lock.json",
    ".env.example",
    "DEPLOYMENT.md",
    "README.md"
)

$foldersToSync = @(
    "src",
    "web",
    "data"
)

# Files/folders to EXCLUDE
$excludePatterns = @(
    ".env",           # Never upload .env with credentials!
    ".git",
    "node_modules",
    "*.log",
    ".vscode",
    "test*.js"
)

# ============================================
# SCRIPT START
# ============================================

Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Zendesk Dashboard - SFTP Deployment     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if WinSCP is installed (recommended for Windows SFTP)
$winscpPath = "C:\Program Files (x86)\WinSCP\WinSCP.com"

if (Test-Path $winscpPath) {
    Write-Host "✓ WinSCP found" -ForegroundColor Green
    
    # Create WinSCP session script
    $sessionScript = @"
option batch abort
option confirm off

# Connect to SFTP server
open sftp://${sftpUsername}:${sftpPassword}@${sftpHost}:${sftpPort}

# Create remote directory if it doesn't exist
call mkdir -p $remoteDirectory

# Change to remote directory
cd $remoteDirectory

# Upload files
"@

    # Add individual files
    foreach ($file in $filesToDeploy) {
        if (Test-Path (Join-Path $localPath $file)) {
            $sessionScript += "`nput `"$localPath\$file`""
        }
    }

    # Add folders
    foreach ($folder in $foldersToSync) {
        if (Test-Path (Join-Path $localPath $folder)) {
            $sessionScript += "`nput -r `"$localPath\$folder\`""
        }
    }

    $sessionScript += @"

# Close session
close

# Exit WinSCP
exit
"@

    # Save script to temp file
    $scriptPath = Join-Path $env:TEMP "zendesk-deploy.txt"
    $sessionScript | Out-File -FilePath $scriptPath -Encoding ASCII

    Write-Host "`n📤 Uploading files to $sftpHost..." -ForegroundColor Yellow
    Write-Host "   Remote directory: $remoteDirectory" -ForegroundColor Gray
    
    # Execute WinSCP
    try {
        & $winscpPath /script="$scriptPath"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✓ Deployment successful!" -ForegroundColor Green
            Write-Host "`nNext steps on your server:" -ForegroundColor Cyan
            Write-Host "1. SSH into your server" -ForegroundColor White
            Write-Host "2. cd $remoteDirectory" -ForegroundColor Gray
            Write-Host "3. cp .env.example .env" -ForegroundColor Gray
            Write-Host "4. nano .env  # Edit with your credentials" -ForegroundColor Gray
            Write-Host "5. npm install" -ForegroundColor Gray
            Write-Host "6. npm start" -ForegroundColor Gray
        } else {
            Write-Host "`n✗ Deployment failed with error code: $LASTEXITCODE" -ForegroundColor Red
        }
    } finally {
        # Cleanup temp script
        Remove-Item $scriptPath -ErrorAction SilentlyContinue
    }
    
} else {
    Write-Host "✗ WinSCP not found" -ForegroundColor Red
    Write-Host "`nPlease install WinSCP from: https://winscp.net/eng/download.php" -ForegroundColor Yellow
    Write-Host "Or use alternative deployment method:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Use built-in SFTP (requires PowerShell 7+)" -ForegroundColor Cyan
    Write-Host "  Install-Module -Name Posh-SSH" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Manual SFTP via FileZilla" -ForegroundColor Cyan
    Write-Host "  Download FileZilla from: https://filezilla-project.org/" -ForegroundColor Gray
    Write-Host "  Upload these folders: src, web, data" -ForegroundColor Gray
    Write-Host "  Upload these files: server.js, package.json" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 3: Use Git on the server" -ForegroundColor Cyan
    Write-Host "  SSH to server and run:" -ForegroundColor Gray
    Write-Host "  git clone https://github.com/hpanag/zendesk.git" -ForegroundColor Gray
}

Write-Host ""
