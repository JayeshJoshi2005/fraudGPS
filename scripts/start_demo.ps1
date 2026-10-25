param(
    [switch]$Stop,
    [switch]$SkipInstall,
    [switch]$NoBuild,
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backend = Join-Path $root 'fraud-gps\backend'
$frontend = Join-Path $root 'fraud-gps\frontend'
$runDir = Join-Path $root '.demo'
$statePath = Join-Path $runDir 'processes.json'
$owned = @()
$started = @()

function Stop-Owned($records) {
    foreach ($record in $records) {
        $process = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq [long]$record.started -and
            $process.Path -eq $record.path) {
            # Windows venv launchers can own a separate Python child process.
            & taskkill.exe /PID $process.Id /T /F | Out-Null
            if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
                throw "Could not stop owned demo process $($process.Id)."
            }
        }
    }
}
function Invoke-Checked([string]$program, [string[]]$arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $program $arguments" }
}
function Read-Json([string]$url) {
    try { return Invoke-RestMethod -Uri $url -TimeoutSec 2 } catch { return $null }
}
function Wait-Ready([string]$url, $process) {
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    while ([DateTime]::UtcNow -lt $deadline) {
        $process.Refresh()
        if ($process.HasExited) { throw "Service exited before readiness. See $runDir logs." }
        try { return Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2 } catch { }
        Start-Sleep -Milliseconds 300
    }
    throw "Service readiness timed out: $url. See $runDir logs."
}
function Start-ServiceProcess([string]$name, [string]$program, [string[]]$arguments, [string]$directory) {
    # Arguments are trusted fixed switches or absolute workspace paths. Quote paths with spaces.
    $quoted = ($arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' '
    $process = Start-Process -FilePath $program -ArgumentList $quoted -WorkingDirectory $directory `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDir "$name.out.log") `
        -RedirectStandardError (Join-Path $runDir "$name.err.log")
    return $process
}
try {
    if (Test-Path -LiteralPath $statePath) {
        $records = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
        foreach ($record in $records) {
            if (-not $record.pid -or -not $record.started -or -not $record.path) {
                throw 'Invalid demo ownership record. No existing process was stopped.'
            }
            $owned += @{ pid = [int]$record.pid; started = [long]$record.started; path = [string]$record.path }
        }
    }
    if ($Stop) {
        Stop-Owned $owned
        if (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath }
        Write-Host 'Stopped demo processes started by this launcher. Other services were left running.'
        exit 0
    }
    Write-Host 'Preparing Fraud GPS local demo...'
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'Install Node.js 22.12 or later (including npm), then run start_demo.bat again.'
    }
    $nodeVersion = [version]((& node --version).TrimStart('v'))
    if ($nodeVersion -lt [version]'22.12.0') { throw 'Node.js 22.12 or later is required.' }
    $python = Join-Path $backend '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $python)) {
        if ($SkipInstall) { throw 'Backend .venv is missing. Run again without -SkipInstall.' }
        Push-Location $backend
        try {
            if (Get-Command py -ErrorAction SilentlyContinue) { Invoke-Checked 'py' @('-3.13', '-m', 'venv', '.venv') }
            elseif (Get-Command python -ErrorAction SilentlyContinue) { Invoke-Checked 'python' @('-m', 'venv', '.venv') }
            else { throw 'Install Python 3.13, then run start_demo.bat again.' }
        } finally { Pop-Location }
    }
    $pythonVersion = [version](& $python -c 'import sys; print(sys.version.split()[0])')
    if ($pythonVersion.Major -ne 3 -or $pythonVersion.Minor -ne 13) { throw 'The pinned backend environment requires Python 3.13.' }
    $checker = Join-Path $PSScriptRoot 'check_demo.py'
    $deps = & $python $checker dependencies | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency inspection failed.' }
    if (-not $deps.ready) {
        if ($SkipInstall) { throw "Missing backend dependencies: $($deps.missing -join ', ')." }
        Push-Location $backend
        try { Invoke-Checked $python @('-m', 'pip', 'install', '-r', 'requirements.txt') } finally { Pop-Location }
    }
    $data = & $python $checker dataset | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Dataset validation failed; existing files were preserved.' }
    if ($data.absent) {
        Invoke-Checked $python @((Join-Path $backend 'generate_data.py'), '--output-dir', $data.directory)
        $data = & $python $checker dataset | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw 'Generated dataset validation failed.' }
    }
    Push-Location $frontend
    try {
        $ErrorActionPreference = 'Continue'
        & npm.cmd ls --depth=0 --json 2>$null | Out-Null
        $dependencyStatus = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        if ($dependencyStatus -ne 0) {
            if ($SkipInstall) { throw 'Frontend dependencies are missing or changed. Run without -SkipInstall.' }
            Invoke-Checked 'npm.cmd' @('ci', '--no-audit', '--no-fund')
        }
        if (-not $NoBuild) { Invoke-Checked 'npm.cmd' @('run', 'build') }
        if (-not (Test-Path -LiteralPath 'dist\index.html')) { throw 'Frontend build is missing. Run without -NoBuild.' }
    } finally { Pop-Location }
    if ($CheckOnly) { Write-Host "Preflight passed. Dataset $($data.version)."; exit 0 }
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    $version = (Get-Content -Raw (Join-Path $frontend 'package.json') | ConvertFrom-Json).version
    $health = Read-Json 'http://127.0.0.1:8000/health'
    $schema = Read-Json 'http://127.0.0.1:8000/openapi.json'
    if ($health) {
        if ($health.status -ne 'ok' -or $health.dataset_version -ne $data.version -or
            $schema.info.title -ne 'Fraud GPS: Powered by Fraud DNA' -or $schema.info.version -ne $version) {
            throw 'Port 8000 has a different app, version, or dataset. Stop that server and retry.'
        }
        Write-Host 'Reusing verified backend on port 8000.'
    } else {
        $process = Start-ServiceProcess 'backend' $python @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') $backend
        $record = @{ pid = $process.Id; started = $process.StartTime.ToUniversalTime().Ticks; path = $python }
        $started += $record
        $owned += $record
        Wait-Ready 'http://127.0.0.1:8000/health' $process | Out-Null
    }
    $existing = $null
    try { $existing = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000' -TimeoutSec 2 } catch { }
    if ($existing) {
        $expected = [IO.File]::ReadAllText((Join-Path $frontend 'dist\index.html'))
        $actual = [Text.Encoding]::UTF8.GetString($existing.RawContentStream.ToArray())
        if ($actual.Trim() -ne $expected.Trim()) { throw 'Port 3000 serves a different frontend build. Stop that server and retry.' }
        Write-Host 'Reusing verified frontend on port 3000.'
    } else {
        $node = (Get-Command node).Source
        $vite = Join-Path $frontend 'node_modules\vite\bin\vite.js'
        $process = Start-ServiceProcess 'frontend' $node @($vite, 'preview', '--host', '127.0.0.1', '--port', '3000', '--strictPort') $frontend
        $record = @{ pid = $process.Id; started = $process.StartTime.ToUniversalTime().Ticks; path = $node }
        $started += $record
        $owned += $record
        Wait-Ready 'http://127.0.0.1:3000' $process | Out-Null
    }
    ConvertTo-Json -InputObject @($owned) | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Host "Ready. Frontend: http://127.0.0.1:3000  Backend: http://127.0.0.1:8000/docs"
    Write-Host "Logs: $runDir  Stop owned services: start_demo.bat -Stop"
} catch {
    Stop-Owned $started
    Write-Error $_
    exit 1
}
