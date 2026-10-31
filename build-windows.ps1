$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
Set-Location -LiteralPath $project
& node build.cjs
if ($LASTEXITCODE -ne 0) { throw 'UI build failed' }
$output = Join-Path $project 'dist\PaperNote'
New-Item -ItemType Directory -Force -Path $output | Out-Null
Copy-Item -LiteralPath 'web' -Destination $output -Recurse -Force
Copy-Item -LiteralPath 'vendor\webview2\lib\net462\Microsoft.Web.WebView2.Core.dll','vendor\webview2\lib\net462\Microsoft.Web.WebView2.WinForms.dll','vendor\webview2\runtimes\win-x64\native\WebView2Loader.dll' -Destination $output
Copy-Item -LiteralPath 'vendor\webview2\LICENSE.txt' -Destination (Join-Path $output 'web\licenses\WebView2.txt')
Copy-Item -LiteralPath 'PaperNote.ico','README.md' -Destination $output
$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$references = @('/r:System.dll','/r:System.Core.dll','/r:System.Drawing.dll','/r:System.Windows.Forms.dll','/r:System.Web.Extensions.dll','/r:System.Web.dll','/r:System.Net.Http.dll','/r:System.Security.dll',"/r:$output\Microsoft.Web.WebView2.Core.dll","/r:$output\Microsoft.Web.WebView2.WinForms.dll")
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /win32manifest:native\app.manifest /win32icon:PaperNote.ico "/out:$output\PaperNote.exe" $references native\Host.cs native\DriveSync.cs native\MathWindow.cs
if ($LASTEXITCODE -ne 0) { throw 'Windows app compilation failed' }
Compress-Archive -Path (Join-Path $output '*') -DestinationPath 'dist\payload.zip' -Force
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /win32manifest:native\app.manifest /win32icon:PaperNote.ico /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /resource:dist\payload.zip,payload.zip /out:dist\PaperNote-Setup.exe native\Setup.cs
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed' }
Write-Output 'Built dist\PaperNote-Setup.exe and dist\PaperNote\PaperNote.exe'
