# Blocks or asks confirmation for dangerous Bash commands requested by Claude Code.
# Claude Code sends hook input as JSON on stdin.
# This script is intentionally conservative and local-project only.

$ErrorActionPreference = "SilentlyContinue"

$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) {
    exit 0
}

try {
    $payload = $inputJson | ConvertFrom-Json
    $command = [string]$payload.tool_input.command
} catch {
    exit 0
}

if ([string]::IsNullOrWhiteSpace($command)) {
    exit 0
}

$normalized = $command.ToLowerInvariant()

# Hard deny: destructive or high-risk commands.
$denyPatterns = @(
    "rm -rf /",
    "rm -rf /*",
    "remove-item -recurse -force c:\",
    "rd /s /q c:\",
    "format ",
    "diskpart",
    "reg delete",
    "git reset --hard",
    "git clean -fd",
    "git clean -xfd",
    "docker system prune",
    "kubectl delete",
    "helm uninstall",
    "terraform destroy",
    "drop database",
    "truncate table"
)

foreach ($pattern in $denyPatterns) {
    if ($normalized.Contains($pattern)) {
        $response = @{
            hookSpecificOutput = @{
                hookEventName = "PreToolUse"
                permissionDecision = "deny"
                permissionDecisionReason = "Blocked by project hook: command looks destructive or high-risk: $pattern"
            }
        }
        $response | ConvertTo-Json -Compress
        exit 0
    }
}

# Ask user: commands that may publish, deploy, push, or mutate shared infrastructure.
$askPatterns = @(
    "git push",
    "npm publish",
    "mvn deploy",
    "gradle publish",
    "terraform apply",
    "kubectl apply",
    "kubectl rollout",
    "helm upgrade"
)

foreach ($pattern in $askPatterns) {
    if ($normalized.Contains($pattern)) {
        $response = @{
            hookSpecificOutput = @{
                hookEventName = "PreToolUse"
                permissionDecision = "ask"
                permissionDecisionReason = "Project hook requires confirmation for command: $pattern"
            }
        }
        $response | ConvertTo-Json -Compress
        exit 0
    }
}

exit 0
