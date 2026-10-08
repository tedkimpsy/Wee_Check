import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import staticPlugin from '@fastify/static'
import QRCode from 'qrcode'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Store } from './store.js'
import { requestPriority, validDetails } from '../src/counseling.js'

const store = new Store()
await store.initialize()
store.stopSessions()
const dist = resolve(process.cwd(), 'dist')
const adminSessions = new Map<string, number>()
const loginAttempts = new Map<string, { count: number; until: number }>()
const listeners = new Set<NodeJS.WritableStream>()
let tunnel: ChildProcessWithoutNullStreams | null = null
let tunnelStatus: { state: 'stopped'|'starting'|'online'|'error'; publicUrl?: string; message?: string; qr?: string } = { state: 'stopped' }
let currentStudentToken = ''

function emit(type='update') { for (const reply of listeners) reply.write(`event: ${type}\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`) }
function bearer(header?: string) { return header?.startsWith('Bearer ') ? header.slice(7) : '' }
function requireAdmin(request: any, reply: any, done: any) { const sid=request.cookies?.wee_admin; const expiry=sid&&adminSessions.get(sid); if(!expiry||expiry<Date.now()) return reply.code(401).send({error:'로그인이 필요합니다.'}); done() }
function publicMode() { const settings=store.settings(); return { manualMode:settings.manualMode, opening:settings.opening } }

const admin = Fastify({ logger: { level: 'warn', redact: ['req.headers.authorization','req.headers.cookie','body'] }, bodyLimit: 1024*1024 })
await admin.register(cookie)
admin.addHook('onSend', async (_req, reply, payload) => { reply.header('Cache-Control','no-store'); reply.header('X-Content-Type-Options','nosniff'); reply.header('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"); return payload })
admin.post('/api/admin/login', async (request:any, reply) => {
  const ip=request.ip, state=loginAttempts.get(ip); if(state&&state.until>Date.now()) return reply.code(429).send({error:'로그인 시도가 잠시 제한되었습니다.'})
  if(!await store.verifyPassword(String(request.body?.password||''))) { const count=(state?.count||0)+1; loginAttempts.set(ip,{count,until:count>=5?Date.now()+60_000:0}); await new Promise(r=>setTimeout(r,Math.min(1500,count*250))); return reply.code(401).send({error:'비밀번호가 올바르지 않습니다.'}) }
  loginAttempts.delete(ip); const sid=randomUUID(); adminSessions.set(sid,Date.now()+8*60*60*1000); reply.setCookie('wee_admin',sid,{httpOnly:true,sameSite:'strict',path:'/',maxAge:8*60*60}); return {ok:true}
})
admin.post('/api/admin/logout',{preHandler:requireAdmin},async(request:any,reply)=>{ if(request.cookies.wee_admin) adminSessions.delete(request.cookies.wee_admin); reply.clearCookie('wee_admin',{path:'/'}); return {ok:true} })
admin.get('/api/admin/bootstrap',{preHandler:requireAdmin},async()=>({ settings:store.settings(), records:store.records(), requests:store.requests(), passwordChanged:store.passwordChanged(), access:tunnelStatus.state==='online'?{...store.activeSession(),...tunnelStatus}:tunnelStatus }))
admin.put('/api/admin/password',{preHandler:requireAdmin},async(request:any,reply)=>{ const password=String(request.body?.password||''); if(password.length<8) return reply.code(400).send({error:'비밀번호는 8자 이상이어야 합니다.'}); await store.changePassword(password); return {ok:true} })
admin.put('/api/admin/school',{preHandler:requireAdmin},async(request:any)=>{ store.saveSchool(request.body); emit(); return {ok:true,settings:store.settings()} })
admin.put('/api/admin/operation',{preHandler:requireAdmin},async(request:any)=>{ store.saveOperation(request.body); emit(); return {ok:true} })
admin.post('/api/admin/counseling/:id/complete',{preHandler:requireAdmin},async(request:any)=>{ store.completeRequest(request.params.id); emit(); return {ok:true} })
admin.get('/api/admin/events',{preHandler:requireAdmin},async(request:any,reply)=>{ reply.hijack(); reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'}); listeners.add(reply.raw); reply.raw.write('event: ready\ndata: {}\n\n'); request.raw.on('close',()=>listeners.delete(reply.raw)) })

async function startAccess() {
  if(tunnel) { tunnel.kill(); tunnel=null }
  store.stopSessions(); currentStudentToken=randomBytes(32).toString('base64url'); tunnelStatus={state:'starting'}
  const localUrl='http://127.0.0.1:4174'
  if(process.env.WEE_CHECK_NO_TUNNEL==='1') { const publicUrl=localUrl, studentUrl=`${publicUrl}/#/s/${currentStudentToken}`; store.createAccessSession(currentStudentToken,publicUrl); tunnelStatus={state:'online',publicUrl,studentUrl,qr:await QRCode.toDataURL(studentUrl)} as any; emit(); return tunnelStatus }
  return await new Promise<any>((resolvePromise)=>{
    try { tunnel=spawn('cloudflared',['tunnel','--url',localUrl,'--no-autoupdate'],{windowsHide:true}); let settled=false
      const handle=(data:Buffer)=>{ const text=data.toString(); const match=text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i); if(match&&!settled){settled=true; const publicUrl=match[0], studentUrl=`${publicUrl}/#/s/${currentStudentToken}`; store.createAccessSession(currentStudentToken,publicUrl); QRCode.toDataURL(studentUrl).then(qr=>{tunnelStatus={state:'online',publicUrl,studentUrl,qr} as any;emit();resolvePromise(tunnelStatus)})} }
      tunnel.stdout.on('data',handle); tunnel.stderr.on('data',handle); tunnel.on('exit',()=>{tunnel=null;if(tunnelStatus.state!=='stopped'){tunnelStatus={state:'error',message:'학생 접속 터널이 종료되었습니다.'};store.stopSessions();emit()}})
      setTimeout(()=>{if(!settled){settled=true;tunnel?.kill();tunnelStatus={state:'error',message:'cloudflared를 시작하지 못했습니다. 설치와 인터넷 연결을 확인하세요.'};resolvePromise(tunnelStatus)}},15000)
    } catch { tunnelStatus={state:'error',message:'cloudflared를 실행할 수 없습니다.'};resolvePromise(tunnelStatus) }
  })
}
admin.post('/api/admin/access/start',{preHandler:requireAdmin},async()=>startAccess())
admin.post('/api/admin/access/stop',{preHandler:requireAdmin},async()=>{tunnelStatus={state:'stopped'};currentStudentToken='';store.stopSessions();tunnel?.kill();tunnel=null;emit();return {ok:true}})
admin.post('/api/admin/backup',{preHandler:requireAdmin},async()=>({path:store.backup()}))
admin.get('/api/admin/backups',{preHandler:requireAdmin},async()=>({files:store.backups()}))
admin.post('/api/admin/backups/:name/restore',{preHandler:requireAdmin},async(request:any)=>{store.restoreNamed(request.params.name);setTimeout(()=>process.exit(0),250);return {ok:true,restarting:true}})
admin.post('/api/admin/academic-year/close',{preHandler:requireAdmin},async()=>({backup:store.closeAcademicYear()}))
if(existsSync(dist)) await admin.register(staticPlugin,{root:dist,wildcard:false})
admin.setNotFoundHandler((request,reply)=>{ if(existsSync(resolve(dist,'index.html'))) return reply.sendFile('index.html'); reply.code(404).send({error:'관리자 화면을 먼저 빌드해야 합니다.'}) })

const student = Fastify({ logger: { level:'warn',redact:['req.headers.authorization','body'] },bodyLimit:64*1024 })
await student.register(rateLimit,{max:120,timeWindow:'1 minute'})
student.get('/healthz',async()=>({ok:true,access:tunnelStatus.state}))
student.addHook('onSend',async(_req,reply,payload)=>{reply.header('Cache-Control','no-store');reply.header('X-Robots-Tag','noindex, nofollow, noarchive');reply.header('X-Content-Type-Options','nosniff');return payload})
student.addHook('preHandler',async(request:any,reply)=>{ if(request.url.startsWith('/api/student')&&!store.validateToken(bearer(request.headers.authorization))) return reply.code(401).send({error:'학생 접속 시간이 끝났거나 QR이 올바르지 않습니다.'}) })
student.get('/api/student/bootstrap',async()=>{const settings=store.settings();return {settings:{schoolName:settings.schoolName,schoolType:settings.schoolType,roster:settings.roster},operation:publicMode(),records:store.records(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()))}})
student.post('/api/student/attendance',async(request:any,reply)=>{try{const body=request.body||{};const studentId=store.studentId(String(body.grade),String(body.schoolClass),String(body.name));if(!studentId)throw new Error('학생을 찾을 수 없습니다.');const result=store.addAttendance(studentId,body.direction,body.mood);emit();return result}catch(e){return reply.code(409).send({error:e instanceof Error?e.message:'저장하지 못했습니다.'})}})
student.post('/api/student/counseling',async(request:any,reply)=>{try{const body=request.body||{};if(!validDetails(body.details))throw new Error('상담 신청 내용을 확인해 주세요.');const studentId=store.studentId(String(body.grade),String(body.schoolClass),String(body.name));if(!studentId)throw new Error('학생을 찾을 수 없습니다.');const id=store.addRequest(studentId,body.details,requestPriority(body.details));emit('counseling');return {id,timestamp:new Date().toISOString()}}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'상담 신청을 저장하지 못했습니다.'})}})
if(existsSync(dist)) await student.register(staticPlugin,{root:dist,wildcard:false})
student.setNotFoundHandler((request,reply)=>request.url.startsWith('/admin')||request.url.startsWith('/api/admin')?reply.code(404).send({error:'이 주소에서는 관리자 화면을 사용할 수 없습니다.'}):existsSync(resolve(dist,'index.html'))?reply.sendFile('index.html'):reply.code(404).send({error:'학생 화면을 먼저 빌드해야 합니다.'}))

await admin.listen({host:'127.0.0.1',port:Number(process.env.WEE_CHECK_ADMIN_PORT||4173)})
await student.listen({host:'127.0.0.1',port:Number(process.env.WEE_CHECK_STUDENT_PORT||4174)})
setInterval(()=>{ const active=store.activeSession(); if(!active&&tunnelStatus.state==='online'){tunnelStatus={state:'stopped'};currentStudentToken='';tunnel?.kill();tunnel=null;emit()} },30_000).unref()
setInterval(()=>{ try { store.backup() } catch { /* The admin dashboard reports explicit backup failures. */ } },24*60*60*1000).unref()
console.log('Wee Check 관리자: http://127.0.0.1:4173/admin')
