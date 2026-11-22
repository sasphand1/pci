$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$serverPath = Join-Path $root 'Module_1_Adapter\src\server.ts'
$errorPath = Join-Path $root 'Module_1_Adapter\src\lib\errors.ts'
if (-not (Test-Path $serverPath) -or -not (Test-Path $errorPath)) { throw 'Extract ZIP into PCI_Clean root; backend files not found.' }
$server = [System.IO.File]::ReadAllText($serverPath).Replace("`r`n","`n")
$errors = [System.IO.File]::ReadAllText($errorPath).Replace("`r`n","`n")
if ($server.Contains('PCI_STARTUP_READY_GATE_V1') -or $errors.Contains('PCI_DIAGNOSTIC_V1')) { throw 'Patch already applied or partially applied. No files changed. Inspect files before retry.' }
foreach ($marker in @("app.use('/api/v1',unifiedPublicRoutes);", "app.use('/api/v1/admin',unifiedAdminRoutes);", "app.use('/api/v1',crossPublicRoutes);", "app.use('/api/v1/admin',crossAdminRoutes);", 'await ensureUnifiedSchema();', 'await ensureRedis();')) { if (-not $server.Contains($marker)) { throw "Incompatible server version, missing: $marker" } }
$needle = "export function makeApp() {"
if (-not $server.Contains($needle)) { throw 'Cannot locate app factory.' }
$server = $server.Replace($needle, "// PCI_STARTUP_READY_GATE_V1: report readiness only after dependencies initialize.`nlet pciStartupReady = false;`n`n$needle")
$needle = '  app.use(cookieParser());'
if (-not $server.Contains($needle)) { throw 'Cannot locate cookie-parser middleware.' }
$server = $server.Replace($needle, $needle + @'

  // Avoid requests racing with database/Redis initialization.
  app.use('/api/v1',(_req,res,next)=>{
    if (!pciStartupReady) return res.status(503).json({error:{code:'SERVICE_INITIALIZING',message:'Backend dependencies are initializing'}});
    next();
  });
'@)
$old = @'
  app.get('/health/ready',handler(async(_req,res)=>{
    await pool.query('SELECT 1');await redis.ping();
    res.json({status:'ready'});
  }));
'@
$new = @'
  app.get('/health/ready',handler(async(_req,res)=>{
    if (!pciStartupReady) return res.status(503).json({status:'initializing'});
    await pool.query('SELECT 1');await redis.ping();
    res.json({status:'ready'});
  }));
'@
if (-not $server.Contains($old)) { throw 'Cannot locate expected ready endpoint; no files changed.' }
$server = $server.Replace($old,$new)
$start = $server.IndexOf('async function main(){')
$end = $server.IndexOf("if(process.env.NODE_ENV!=='test')main()", $start)
if ($start -lt 0 -or $end -lt 0) { throw 'Cannot safely locate startup function.' }
$replacement = @'
async function main(){
  // Hostinger expects a listening socket promptly. Do NOT block listen() on network I/O.
  const httpServer=createServer(makeApp());
  const io=attachWall(httpServer);
  await new Promise<void>((resolve,reject)=>{
    httpServer.once('error',reject);
    httpServer.listen(config.PORT,'0.0.0.0',()=>{
      httpServer.off('error',reject);
      logger.info({port:config.PORT},'API socket listening');
      resolve();
    });
  });
  // Initialization runs after listen; API returns 503 until PostgreSQL/Redis are ready.
  void (async()=>{
    try {
      await pool.query('SELECT 1');
      try {
        await ensureUnifiedSchema();
        logger.info('Unified creator schema verified');
      } catch(err) {
        logger.error({err},'Unified schema verification failed; inspect unified routes');
        console.error('[PCI_SCHEMA_FAILURE] review-schema initialization failed');
      }
      await ensureRedis();
      pciStartupReady=true;
      logger.info('API server ready');
    } catch(err) {
      logger.error({err},'Backend dependency initialization failed');
      console.error('[PCI_STARTUP_FAILURE] database or Redis connection failed');
    }
  })();
  let shutdownStarted=false;
  const shutdown=async()=>{
    if(shutdownStarted)return;shutdownStarted=true;
    pciStartupReady=false;
    logger.info('Shutting down API');
    const force=setTimeout(()=>process.exit(1),10_000);force.unref();
    await new Promise<void>(resolve=>io.close(()=>resolve()));
    await new Promise<void>(resolve=>httpServer.close(()=>resolve()));
    await Promise.allSettled([pool.end(),redis.quit()]);
    process.exit(0);
  };
  process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
}
'@
$server = $server.Substring(0,$start) + $replacement + "`n" + $server.Substring($end)
$needle = "  logger.error({err,requestId:rid,route:req.path},'request failed');"
if (-not $errors.Contains($needle)) { throw 'Cannot locate structured error logging. No files changed.' }
$errors = $errors.Replace($needle, @'
  // PCI_DIAGNOSTIC_V1: plain text survives Hostinger log UI, without SQL values or secrets.
  const failure=err&&typeof err==='object'?err as {code?:unknown;name?:unknown}:{};
  const sqlstate=typeof failure.code==='string' && /^[A-Z0-9]{5}$/.test(failure.code)?failure.code:'none';
  const kind=typeof failure.name==='string'?failure.name:'UnknownError';
  console.error(`[PCI_API_FAILURE] method=${req.method} path=${req.path} requestId=${rid} type=${kind} sqlstate=${sqlstate}`);
  logger.error({err,requestId:rid,route:req.path},'request failed');
'@)
# All validations were completed before writes. Keep backups in case local modifications differ.
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
Copy-Item $serverPath "$serverPath.backup_$stamp"
Copy-Item $errorPath "$errorPath.backup_$stamp"
[System.IO.File]::WriteAllText($serverPath,$server,(New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText($errorPath,$errors,(New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Patched backend startup and sanitized request diagnostics.'
Write-Host 'Existing routes, API credentials, database data, and frontend files were NOT changed.'
