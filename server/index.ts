import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import staticPlugin from '@fastify/static'
import QRCode from 'qrcode'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { CapacityError, Store } from './store.js'
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

function cloudflaredExecutable() {
  if (process.env.WEE_CHECK_CLOUDFLARED_PATH) return process.env.WEE_CHECK_CLOUDFLARED_PATH
  const bundledName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
  const bundled = resolve(process.cwd(), 'bin', bundledName)
  return existsSync(bundled) ? bundled : 'cloudflared'
}

function emit(type='update') { for (const reply of listeners) reply.write(`event: ${type}\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`) }
function openEventStream(request: any, reply: any) { reply.hijack(); reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'}); listeners.add(reply.raw); reply.raw.write('retry: 2000\nevent: ready\ndata: {}\n\n'); const heartbeat=setInterval(()=>reply.raw.write(': keepalive\n\n'),25_000); request.raw.on('close',()=>{clearInterval(heartbeat);listeners.delete(reply.raw)}) }
function bearer(header?: string) { return header?.startsWith('Bearer ') ? header.slice(7) : '' }
function requireAdmin(request: any, reply: any, done: any) { const sid=request.cookies?.wee_admin; const expiry=sid&&adminSessions.get(sid); if(!expiry||expiry<Date.now()) return reply.code(401).send({error:'로그인이 필요합니다.'}); done() }
function publicMode() { return store.operation() }
function rosterResponse() { const settings=store.settings(); return { roster:settings.roster, rosterDetails:settings.rosterDetails } }

const admin = Fastify({ logger: { level: 'warn', redact: ['req.headers.authorization','req.headers.cookie','body'] }, bodyLimit: 1024*1024 })
await admin.register(cookie)
admin.addHook('onSend', async (_req, reply, payload) => { reply.header('Cache-Control','no-store'); reply.header('X-Content-Type-Options','nosniff'); reply.header('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"); return payload })
admin.post('/api/admin/login', async (request:any, reply) => {
  const ip=request.ip, state=loginAttempts.get(ip); if(state&&state.until>Date.now()) return reply.code(429).send({error:'로그인 시도가 잠시 제한되었습니다.'})
  if(!await store.verifyPassword(String(request.body?.password||''))) { const count=(state?.count||0)+1; loginAttempts.set(ip,{count,until:count>=5?Date.now()+60_000:0}); await new Promise(r=>setTimeout(r,Math.min(1500,count*250))); return reply.code(401).send({error:'비밀번호가 올바르지 않습니다.'}) }
  loginAttempts.delete(ip); const sid=randomUUID(); adminSessions.set(sid,Date.now()+8*60*60*1000); reply.setCookie('wee_admin',sid,{httpOnly:true,sameSite:'strict',path:'/',maxAge:8*60*60}); return {ok:true}
})
admin.post('/api/admin/logout',{preHandler:requireAdmin},async(request:any,reply)=>{ if(request.cookies.wee_admin) adminSessions.delete(request.cookies.wee_admin); reply.clearCookie('wee_admin',{path:'/'}); return {ok:true} })
admin.get('/api/admin/bootstrap',{preHandler:requireAdmin},async()=>({ settings:store.settings(), records:store.records(), requests:store.requests(), capacity:store.queueSnapshot(), waitlist:store.adminWaitlist(), passwordChanged:store.passwordChanged(), access:tunnelStatus.state==='online'?{...store.activeSession(),...tunnelStatus}:tunnelStatus }))
admin.put('/api/admin/password',{preHandler:requireAdmin},async(request:any,reply)=>{ const password=String(request.body?.password||''); if(password.length<8) return reply.code(400).send({error:'비밀번호는 8자 이상이어야 합니다.'}); await store.changePassword(password); return {ok:true} })
admin.put('/api/admin/school',{preHandler:requireAdmin},async(request:any)=>{ store.saveSchool(request.body); emit(); return {ok:true,settings:store.settings()} })
admin.put('/api/admin/operation',{preHandler:requireAdmin},async(request:any)=>{ store.saveOperation(request.body); emit(); return {ok:true} })
admin.post('/api/admin/roster/classes',{preHandler:requireAdmin},async(request:any,reply)=>{try{store.createClass(String(request.body?.grade||''),String(request.body?.name||''));emit();return{ok:true,...rosterResponse()}}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'학급을 추가하지 못했습니다.'})}})
admin.patch('/api/admin/roster/classes/:id',{preHandler:requireAdmin},async(request:any,reply)=>{try{store.renameClass(String(request.params.id),String(request.body?.name||''));emit();return{ok:true,...rosterResponse()}}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'학급을 수정하지 못했습니다.'})}})
admin.delete('/api/admin/roster/classes/:id',{preHandler:requireAdmin},async(request:any,reply)=>{try{store.deleteClass(String(request.params.id));emit();return{ok:true,...rosterResponse()}}catch(e){return reply.code(409).send({error:e instanceof Error?e.message:'학급을 삭제하지 못했습니다.'})}})
admin.post('/api/admin/roster/students',{preHandler:requireAdmin},async(request:any,reply)=>{try{store.addStudent(String(request.body?.grade||''),String(request.body?.schoolClass||''),String(request.body?.name||''));emit();return{ok:true,...rosterResponse()}}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'학생을 추가하지 못했습니다.'})}})
admin.patch('/api/admin/roster/students/:id',{preHandler:requireAdmin},async(request:any,reply)=>{try{store.updateStudent(String(request.params.id),String(request.body?.grade||''),String(request.body?.schoolClass||''),String(request.body?.name||''));emit();return{ok:true,...rosterResponse()}}catch(e){return reply.code(409).send({error:e instanceof Error?e.message:'학생을 수정하지 못했습니다.'})}})
admin.post('/api/admin/roster/students/remove',{preHandler:requireAdmin},async(request:any,reply)=>{try{const ids=Array.isArray(request.body?.ids)?request.body.ids.map(String):[];if(!ids.length)throw new Error('제외할 학생을 선택해 주세요.');store.removeStudents(ids);emit();return{ok:true,...rosterResponse()}}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'학생을 제외하지 못했습니다.'})}})
admin.post('/api/admin/roster/students/move',{preHandler:requireAdmin},async(request:any,reply)=>{try{const ids=Array.isArray(request.body?.ids)?request.body.ids.map(String):[];if(!ids.length)throw new Error('이동할 학생을 선택해 주세요.');store.moveStudents(ids,String(request.body?.grade||''),String(request.body?.schoolClass||''));emit();return{ok:true,...rosterResponse()}}catch(e){return reply.code(409).send({error:e instanceof Error?e.message:'학생을 이동하지 못했습니다.'})}})
admin.post('/api/admin/roster/bulk/preview',{preHandler:requireAdmin},async(request:any,reply)=>{try{if(request.body?.scope==='class'){const names:string[]=[...new Set<string>((Array.isArray(request.body?.names)?request.body.names:[]).map((name:any)=>String(name).trim()).filter(Boolean))];const current=store.roster()[String(request.body.grade)]?.[String(request.body.schoolClass)]||[],next:string[]=request.body?.mode==='append'?[...new Set<string>([...current,...names])]:names;return{added:next.filter(name=>!current.includes(name)).length,removed:current.filter(name=>!next.includes(name)).length,kept:next.filter(name=>current.includes(name)).length,total:next.length,names:next}}const roster=request.body?.roster;if(!roster||typeof roster!=='object')throw new Error('명렬표 데이터를 확인해 주세요.');return store.rosterPreview(roster)}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'미리보기를 만들지 못했습니다.'})}})
admin.post('/api/admin/roster/bulk/commit',{preHandler:requireAdmin},async(request:any,reply)=>{try{if(request.body?.scope==='class')store.replaceClass(String(request.body.grade),String(request.body.schoolClass),(Array.isArray(request.body.names)?request.body.names:[]).map((name:any)=>String(name).trim()).filter(Boolean),request.body?.mode==='append'?'append':'replace');else store.replaceRoster(request.body?.roster||{});emit();return{ok:true,...rosterResponse()}}catch(e){return reply.code(409).send({error:e instanceof Error?e.message:'명렬표를 반영하지 못했습니다.'})}})
admin.get('/api/admin/waitlist',{preHandler:requireAdmin},async()=>({capacity:store.queueSnapshot(),items:store.adminWaitlist()}))
admin.post('/api/admin/waitlist/:id/cancel',{preHandler:requireAdmin},async(request:any,reply)=>{try{store.adminCancelWait(String(request.params.id));emit('capacity');return{ok:true}}catch(e){return reply.code(404).send({error:e instanceof Error?e.message:'대기를 취소하지 못했습니다.'})}})
admin.post('/api/admin/waitlist/:id/advance',{preHandler:requireAdmin},async(request:any,reply)=>{try{store.adminAdvanceWait(String(request.params.id));emit('capacity');return{ok:true}}catch(e){return reply.code(404).send({error:e instanceof Error?e.message:'다음 학생을 호출하지 못했습니다.'})}})
admin.post('/api/admin/counseling/:id/complete',{preHandler:requireAdmin},async(request:any)=>{ store.completeRequest(request.params.id); emit(); return {ok:true} })
admin.get('/api/admin/events',{preHandler:requireAdmin},openEventStream)

async function startAccess() {
  if(tunnel) { tunnel.kill(); tunnel=null }
  store.stopSessions(); currentStudentToken=randomBytes(32).toString('base64url'); tunnelStatus={state:'starting'}
  const localUrl='http://127.0.0.1:4174'
  if(process.env.WEE_CHECK_NO_TUNNEL==='1') { const publicUrl=localUrl, studentUrl=`${publicUrl}/#/s/${currentStudentToken}`; store.createAccessSession(currentStudentToken,publicUrl); tunnelStatus={state:'online',publicUrl,studentUrl,qr:await QRCode.toDataURL(studentUrl)} as any; emit(); return tunnelStatus }
  return await new Promise<any>((resolvePromise)=>{
    try { tunnel=spawn(cloudflaredExecutable(),['tunnel','--url',localUrl,'--no-autoupdate'],{windowsHide:true}); let settled=false
      const handle=(data:Buffer)=>{ const text=data.toString(); const match=text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i); if(match&&!settled){settled=true; const publicUrl=match[0], studentUrl=`${publicUrl}/#/s/${currentStudentToken}`; store.createAccessSession(currentStudentToken,publicUrl); QRCode.toDataURL(studentUrl).then(qr=>{tunnelStatus={state:'online',publicUrl,studentUrl,qr} as any;emit();resolvePromise(tunnelStatus)})} }
      tunnel.stdout.on('data',handle); tunnel.stderr.on('data',handle); tunnel.on('exit',()=>{tunnel=null;if(tunnelStatus.state!=='stopped'){tunnelStatus={state:'error',message:'학생 접속 터널이 종료되었습니다.'};store.stopSessions();emit()}})
      tunnel.on('error',()=>{if(!settled){settled=true;tunnel=null;tunnelStatus={state:'error',message:'cloudflared를 실행할 수 없습니다. 배포 파일을 확인해 주세요.'};emit();resolvePromise(tunnelStatus)}})
      setTimeout(()=>{if(!settled){settled=true;tunnel?.kill();tunnelStatus={state:'error',message:'cloudflared를 시작하지 못했습니다. 설치와 인터넷 연결을 확인하세요.'};emit();resolvePromise(tunnelStatus)}},15000)
    } catch { tunnelStatus={state:'error',message:'cloudflared를 실행할 수 없습니다.'};emit();resolvePromise(tunnelStatus) }
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
student.addHook('preHandler',async(request:any,reply)=>{ const streamToken=request.url.startsWith('/api/student/events?')?String(request.query?.token||''):''; if(request.url.startsWith('/api/student')&&!store.validateToken(bearer(request.headers.authorization)||streamToken)) return reply.code(401).send({error:'학생 접속 시간이 끝났거나 QR이 올바르지 않습니다.'}) })
student.get('/api/student/events',openEventStream)
student.get('/api/student/operation',async()=>publicMode())
student.get('/api/student/bootstrap',async()=>{const settings=store.settings();return {settings:{schoolName:settings.schoolName,schoolType:settings.schoolType,roster:settings.roster},operation:publicMode(),capacity:store.queueSnapshot(),records:store.records(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()))}})
student.get('/api/student/capacity',async()=>store.queueSnapshot())
student.get('/api/student/waitlist/:ticket',async(request:any,reply)=>{try{return store.waitStatus(String(request.params.ticket))}catch(e){return reply.code(404).send({error:e instanceof Error?e.message:'대기표를 확인하지 못했습니다.'})}})
student.post('/api/student/waitlist',async(request:any,reply)=>{try{const body=request.body||{},studentId=store.studentId(String(body.grade),String(body.schoolClass),String(body.name));if(!studentId)throw new Error('학생을 찾을 수 없습니다.');const result=store.joinWaitlist(studentId,body.mood);emit('capacity');return result}catch(e){return reply.code(409).send({error:e instanceof Error?e.message:'대기를 신청하지 못했습니다.'})}})
student.delete('/api/student/waitlist/:ticket',async(request:any,reply)=>{try{store.cancelWait(String(request.params.ticket));emit('capacity');return{ok:true}}catch(e){return reply.code(404).send({error:e instanceof Error?e.message:'대기를 취소하지 못했습니다.'})}})
student.post('/api/student/attendance',async(request:any,reply)=>{try{const body=request.body||{},studentId=store.studentId(String(body.grade),String(body.schoolClass),String(body.name));if(!studentId)throw new Error('학생을 찾을 수 없습니다.');const result=store.addAttendance(studentId,body.direction,body.mood,body.waitlistTicket);emit('capacity');return result}catch(e){if(e instanceof CapacityError)return reply.code(409).send({error:e.message,code:e.code,...e.details});return reply.code(409).send({error:e instanceof Error?e.message:'저장하지 못했습니다.'})}})
student.post('/api/student/counseling',async(request:any,reply)=>{try{const body=request.body||{};if(!validDetails(body.details))throw new Error('상담 신청 내용을 확인해 주세요.');const studentId=store.studentId(String(body.grade),String(body.schoolClass),String(body.name));if(!studentId)throw new Error('학생을 찾을 수 없습니다.');const id=store.addRequest(studentId,body.details,requestPriority(body.details));emit('counseling');return {id,timestamp:new Date().toISOString()}}catch(e){return reply.code(400).send({error:e instanceof Error?e.message:'상담 신청을 저장하지 못했습니다.'})}})
if(existsSync(dist)) await student.register(staticPlugin,{root:dist,wildcard:false})
student.setNotFoundHandler((request,reply)=>request.url.startsWith('/admin')||request.url.startsWith('/api/admin')?reply.code(404).send({error:'이 주소에서는 관리자 화면을 사용할 수 없습니다.'}):existsSync(resolve(dist,'index.html'))?reply.sendFile('index.html'):reply.code(404).send({error:'학생 화면을 먼저 빌드해야 합니다.'}))

await Promise.all([
  admin.listen({host:'127.0.0.1',port:Number(process.env.WEE_CHECK_ADMIN_PORT||4173)}),
  student.listen({host:'127.0.0.1',port:Number(process.env.WEE_CHECK_STUDENT_PORT||4174)}),
])
void startAccess().catch(error => {
  tunnelStatus={state:'error',message:error instanceof Error?error.message:'학생 접속 터널을 시작하지 못했습니다.'}
  emit()
})
setInterval(()=>{ const active=store.activeSession(); if(!active&&tunnelStatus.state==='online'){tunnelStatus={state:'stopped'};currentStudentToken='';tunnel?.kill();tunnel=null;emit()} },30_000).unref()
setInterval(()=>{ store.reconcileQueue();emit('capacity') },15_000).unref()
setInterval(()=>{ try { store.backup() } catch { /* The admin dashboard reports explicit backup failures. */ } },24*60*60*1000).unref()
console.log(`Wee Check 관리자: http://127.0.0.1:${process.env.WEE_CHECK_ADMIN_PORT||4173}/admin`)
