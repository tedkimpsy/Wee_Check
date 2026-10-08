import { spawn } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = ['dev:web', 'dev:server'].map(script => spawn(npm, ['run', script], { stdio: 'inherit', windowsHide: true }))
const stop = () => { for (const child of children) child.kill(); process.exit() }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const child of children) child.on('exit', code => { if (code) stop() })
