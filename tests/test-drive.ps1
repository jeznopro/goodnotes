$ErrorActionPreference = 'Stop'
$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$probe = Join-Path $PSScriptRoot 'DriveProbe.exe'
& $compiler /nologo /target:exe /platform:x64 "/out:$probe" /r:System.dll /r:System.Core.dll /r:System.Web.dll /r:System.Web.Extensions.dll /r:System.Security.dll /r:System.Net.Http.dll (Join-Path $PSScriptRoot 'DriveProbe.cs') (Join-Path $PSScriptRoot '..\native\DriveSync.cs')
if ($LASTEXITCODE -ne 0) { throw 'Drive checks did not compile.' }
$directory = Join-Path $PSScriptRoot ('results\drive-probe-' + [guid]::NewGuid().ToString('N'))
& $probe $directory
if ($LASTEXITCODE -ne 0) { throw 'Drive sync checks failed.' }
