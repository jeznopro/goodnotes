$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$probe = Join-Path $PSScriptRoot 'SetupProbe.exe'
& $compiler /nologo /target:exe /platform:x64 "/out:$probe" (Join-Path $PSScriptRoot 'SetupProbe.cs')
if ($LASTEXITCODE -ne 0) { throw 'Installer test compilation failed.' }
& $probe (Join-Path $project 'dist\PaperNote-Setup.exe') (Join-Path $PSScriptRoot 'results\installer-shortcuts')
if ($LASTEXITCODE -ne 0) { throw 'Installer extraction or shortcut checks failed.' }
