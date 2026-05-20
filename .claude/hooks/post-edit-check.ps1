# Lightweight check after Edit/Write.
# Runs `git diff --check` to catch conflict markers and whitespace errors.
# If it finds issues, it blocks the next model step and asks Claude to fix them.

$ErrorActionPreference = "SilentlyContinue"

git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
    exit 0
}

$checkOutput = git diff --check 2>&1
$exit = $LASTEXITCODE

if ($exit -ne 0) {
    $reason = "git diff --check found whitespace errors or conflict markers. Fix these before continuing:`n$checkOutput"
    $response = @{
        decision = "block"
        reason = $reason
    }
    $response | ConvertTo-Json -Compress
    exit 0
}

exit 0
