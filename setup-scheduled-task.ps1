# PowerShell script to create a scheduled task for execView.js
# This task will run every day at 11:30 PM to capture end-of-day ticket snapshots

# Configuration
$taskName = "Zendesk-ExecView-Daily"
$scriptPath = "C:\Development\Zendesk\execView.js"
$nodePath = (Get-Command node).Source
$workingDirectory = "C:\Development\Zendesk"
$runTime = "23:30"  # 11:30 PM

Write-Host "🔧 Setting up scheduled task: $taskName"
Write-Host "📁 Script location: $scriptPath"
Write-Host "⏰ Run time: $runTime daily"
Write-Host ""

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  Task '$taskName' already exists. Removing it first..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action (run node execView.js)
$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "execView.js" `
    -WorkingDirectory $workingDirectory

# Create the trigger (daily at 11:30 PM)
$trigger = New-ScheduledTaskTrigger -Daily -At $runTime

# Create the principal (run whether user is logged in or not)
# Note: This requires the script to be run with administrator privileges
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType S4U `
    -RunLevel Highest

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Register the task
try {
    $task = Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description "Automatically fetches Zendesk Executive View data daily at 11:30 PM, capturing end-of-day ticket status snapshots and voice metrics."

    Write-Host "✅ Scheduled task created successfully!"
    Write-Host ""
    Write-Host "📋 Task Details:"
    Write-Host "   Name: $taskName"
    Write-Host "   Schedule: Daily at $runTime"
    Write-Host "   Script: $scriptPath"
    Write-Host "   Status: $(if ($task.State -eq 'Ready') { 'Ready' } else { $task.State })"
    Write-Host ""
    Write-Host "🔍 To view the task:"
    Write-Host "   - Open Task Scheduler (taskschd.msc)"
    Write-Host "   - Look for '$taskName' in Task Scheduler Library"
    Write-Host ""
    Write-Host "🧪 To test the task immediately:"
    Write-Host "   Start-ScheduledTask -TaskName '$taskName'"
    Write-Host ""
    Write-Host "❌ To remove the task:"
    Write-Host "   Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
    Write-Host ""
} catch {
    Write-Host "❌ Error creating scheduled task:"
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "💡 Note: You may need to run PowerShell as Administrator"
    exit 1
}
