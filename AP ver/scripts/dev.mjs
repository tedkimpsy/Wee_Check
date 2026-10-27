import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const adminPort = Number(process.env.WEE_CHECK_ADMIN_PORT || 4173)
const studentPort = Number(process.env.WEE_CHECK_STUDENT_PORT || 4174)
const webPort = 5173
const healthUrl = `http://127.0.0.1:${adminPort}/healthz`
const projectRoot = resolve(process.cwd())
const dataDirectory = process.env.WEE_CHECK_DATA_DIR || join(process.env.LOCALAPPDATA || projectRoot, 'WeeCheckAP')
const devStatePath = join(dataDirectory, 'wee-check-dev.json')
const children = new Map()
let stopping = false

function log(message) {
  console.log(`\n[Wee Check] ${message}`)
}

function validPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

function portIsAvailable(port) {
  return new Promise(resolve => {
    const probe = createServer()
    probe.unref()
    probe.once('error', () => resolve(false))
    probe.listen({ host: '127.0.0.1', port }, () => probe.close(() => resolve(true)))
  })
}

function powershellJson(script) {
  if (process.platform !== 'win32') return []
  const executable = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const result = spawnSync(executable, ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })
  if (result.status !== 0 || !result.stdout.trim()) return []
  try {
    const parsed = JSON.parse(result.stdout.trim())
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

function processRecords(processIds) {
  const ids = [...new Set(processIds.map(Number).filter(Number.isInteger))]
  if (!ids.length || process.platform !== 'win32') return []
  return powershellJson(`$ids=@(${ids.join(',')}); @((Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $ids -contains [int]$_.ProcessId } | Select-Object ProcessId,CommandLine)) | ConvertTo-Json -Compress`)
}

function portOwners(ports) {
  if (process.platform !== 'win32') return []
  const values = [...new Set(ports.map(Number).filter(Number.isInteger))]
  return powershellJson(`$ports=@(${values.join(',')}); $listeners=Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains [int]$_.LocalPort }; $rows=@(foreach($listener in $listeners){ $process=Get-CimInstance Win32_Process -Filter \"ProcessId = $($listener.OwningProcess)\" -ErrorAction SilentlyContinue; [pscustomobject]@{ LocalPort=[int]$listener.LocalPort; ProcessId=[int]$listener.OwningProcess; CommandLine=[string]$process.CommandLine } }); @($rows) | ConvertTo-Json -Compress`)
}

function belongsToThisProject(record) {
  const commandLine = String(record?.CommandLine || '').replaceAll('/', '\\').toLowerCase()
  const normalizedProject = projectRoot.replaceAll('/', '\\').toLowerCase()
  return commandLine.includes(normalizedProject)
}

function killProcessTree(processId) {
  if (!Number.isInteger(Number(processId)) || Number(processId) <= 0) return
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(processId), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  } else {
    try { process.kill(Number(processId), 'SIGTERM') } catch { /* Already stopped. */ }
  }
}

function readDevState() {
  if (!existsSync(devStatePath)) return undefined
  try {
    const value = JSON.parse(readFileSync(devStatePath, 'utf8'))
    return resolve(String(value.projectRoot || '')) === projectRoot ? value : undefined
  } catch {
    return undefined
  }
}

function writeDevState(extraProcessIds = []) {
  try {
    mkdirSync(dirname(devStatePath), { recursive: true })
    const pids = [...new Set([
      process.pid,
      ...[...children.values()].map(child => child.pid),
      ...extraProcessIds,
    ].map(Number).filter(Number.isInteger))]
    writeFileSync(devStatePath, `${JSON.stringify({ projectRoot, pids, ports: [adminPort, studentPort, webPort], updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
  } catch {
    // Development startup must not fail only because the recovery file cannot be written.
  }
}

function removeDevState() {
  try { rmSync(devStatePath, { force: true }) } catch { /* Best effort cleanup. */ }
}

function cleanupStaleOwnedProcesses() {
  if (process.platform !== 'win32') return
  const state = readDevState()
  const candidates = [
    ...processRecords(state?.pids || []),
    ...portOwners([adminPort, studentPort, webPort]),
  ]
  const ownedPids = [...new Set(candidates.filter(belongsToThisProject).map(record => Number(record.ProcessId)).filter(Number.isInteger))]
  if (ownedPids.length) {
    log(`이전에 남은 Wee Check 프로세스를 정리합니다. (PID ${ownedPids.join(', ')})`)
    for (const processId of ownedPids) killProcessTree(processId)
  }
  removeDevState()
}

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  log('로컬 관리자·학생 서버를 종료합니다.')
  const ownedPortPids = portOwners([adminPort, studentPort, webPort]).filter(belongsToThisProject).map(record => Number(record.ProcessId))
  for (const child of children.values()) {
    if (!child.pid || child.exitCode !== null) continue
    killProcessTree(child.pid)
  }
  for (const processId of ownedPortPids) killProcessTree(processId)
  const remainingOwnedPorts = portOwners([adminPort, studentPort, webPort]).filter(belongsToThisProject)
  if (remainingOwnedPorts.length) {
    console.error(`[Wee Check] 종료 후에도 포트가 남아 있습니다: ${[...new Set(remainingOwnedPorts.map(record => record.LocalPort))].join(', ')}`)
  } else {
    log('개발 서버가 종료되어 4173·4174·5173 포트 수신이 닫혔습니다.')
  }
  removeDevState()
  process.exit(exitCode)
}

function runNpmScript(name) {
  const npmCli = process.env.npm_execpath
  if (!npmCli) throw new Error('npm 실행 경로를 찾지 못했습니다. npm run dev로 실행해 주세요.')
  const child = spawn(process.execPath, [npmCli, 'run', name], {
    stdio: 'inherit',
    windowsHide: true,
  })
  children.set(name, child)
  writeDevState()
  child.on('error', error => {
    console.error(`[Wee Check] ${name} 실행 실패: ${error.message}`)
    stop(1)
  })
  child.on('exit', code => {
    if (!stopping) {
      console.error(`[Wee Check] ${name} 프로세스가 종료되었습니다. (코드 ${code ?? '알 수 없음'})`)
      stop(code || 1)
    }
  })
  return child
}

async function waitFor(url, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error(`${label} 준비 시간을 초과했습니다.${lastError instanceof Error ? ` (${lastError.message})` : ''}`)
}

async function reportStudentAccess() {
  let previousStatus = ''
  while (!stopping) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) })
      if (!response.ok) return
      const health = await response.json()
      const access = health.access || {}
      const status = `${access.state || ''}:${access.message || ''}`
      if (status !== previousStatus) {
        previousStatus = status
        if (access.state === 'starting') log('사설망 학생 접속 주소를 준비하고 있습니다...')
        if (access.state === 'starting' && access.message) console.log(`  ${access.message}`)
        if (access.state === 'online') {
          log('보안 AP 학생 접속 준비 완료')
          if (access.studentUrl) console.log(`  학생 접속: ${access.studentUrl}`)
          return
        }
        if (access.state === 'error') {
          console.error(`\n[Wee Check] 사설망 접속 오류: ${access.message || '상세 오류를 확인할 수 없습니다.'}`)
          return
        }
      }
    } catch {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
process.on('SIGHUP', () => stop(0))

try {
  const ports = [adminPort, studentPort, webPort]
  if (ports.some(port => !validPort(port))) throw new Error('포트 번호는 1~65535 사이의 정수여야 합니다.')
  if (new Set(ports).size !== ports.length) throw new Error('관리자, 학생, Vite 포트는 서로 달라야 합니다.')
  cleanupStaleOwnedProcesses()
  for (const port of ports) {
    if (!await portIsAvailable(port)) {
      const owner = portOwners([port])[0]
      throw new Error(`포트 ${port}가 다른 프로그램에서 사용 중입니다${owner?.ProcessId ? ` (PID ${owner.ProcessId})` : ''}. 해당 프로그램을 종료한 뒤 다시 실행해 주세요.`)
    }
  }

  log('1/3 로컬 관리자·학생 서버를 시작합니다.')
  runNpmScript('dev:server')
  await waitFor(healthUrl, '로컬 서버')

  log('2/3 웹 개발 서버를 시작합니다.')
  runNpmScript('dev:web')
  await waitFor(`http://127.0.0.1:${webPort}`, '웹 개발 서버')
  writeDevState(portOwners(ports).filter(belongsToThisProject).map(record => Number(record.ProcessId)))

  log('3/3 개발 환경 준비 완료')
  console.log(`  개발 화면: http://127.0.0.1:${webPort}`)
  console.log(`  관리자 API: http://127.0.0.1:${adminPort}`)
  console.log('  종료: Ctrl+C')
  void reportStudentAccess()
} catch (error) {
  console.error(`\n[Wee Check] 시작 실패: ${error instanceof Error ? error.message : String(error)}`)
  stop(1)
}
