$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$python = $env:PAPERNOTE_PYTHON
if (-not $python) { $python = 'C:\Users\MinhTriet\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' }
if (-not (Test-Path -LiteralPath $python)) { throw 'Set PAPERNOTE_PYTHON to a Python executable with Playwright installed.' }
$existing = Get-NetTCPConnection -LocalPort 50339 -State Listen -ErrorAction SilentlyContinue
$server = $null
try {
    & node --test (Join-Path $PSScriptRoot 'ink.test.mjs') (Join-Path $PSScriptRoot 'ink-smoothing.test.mjs') (Join-Path $PSScriptRoot 'schema.test.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Ink or backup validation checks failed.' }
    & node (Join-Path $PSScriptRoot 'make-pdf.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'PDF fixture creation failed.' }
    if (-not $existing) {
        $server = Start-Process -FilePath $python -ArgumentList @('-m','http.server','50339','--bind','127.0.0.1') -WorkingDirectory (Join-Path $project 'web') -WindowStyle Hidden -PassThru
        Start-Sleep -Milliseconds 800
    }
    & $python (Join-Path $PSScriptRoot 'test_app.py')
    if ($LASTEXITCODE -ne 0) { throw 'PaperNote UI checks failed.' }
    & $python (Join-Path $PSScriptRoot 'test_v2.py')
    if ($LASTEXITCODE -ne 0) { throw 'PaperNote V2 checks failed.' }
    & $python (Join-Path $PSScriptRoot 'test_smoothing.py')
    if ($LASTEXITCODE -ne 0) { throw 'Ink smoothing checks failed.' }
    & $python (Join-Path $PSScriptRoot 'test_ui22.py')
    if ($LASTEXITCODE -ne 0) { throw 'Zoom, cursor or icon checks failed.' }
    & $python (Join-Path $PSScriptRoot 'test_reference24.py')
    if ($LASTEXITCODE -ne 0) { throw 'Reference UI or nib cursor checks failed.' }
    & $python (Join-Path $PSScriptRoot 'test_original_icons.py')
    if ($LASTEXITCODE -ne 0) { throw 'Original icon checks failed.' }
    & $python (Join-Path $PSScriptRoot 'test_drive_ui.py')
    if ($LASTEXITCODE -ne 0) { throw 'Drive UI checks failed.' }
    & powershell -NoProfile -File (Join-Path $PSScriptRoot 'test-drive.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Drive sync checks failed.' }
} finally {
    if ($server -and -not $server.HasExited) { $server.Kill() }
}
