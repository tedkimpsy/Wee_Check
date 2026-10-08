import Database from 'better-sqlite3'
import argon2 from 'argon2'
import { randomUUID, createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultRoster } from '../src/defaultRoster.js'
import { blindIndex, dataDir, decryptBytes, decryptText, encryptBytes, encryptText } from './security.js'

export type OperationMode = 'open' | 'closed' | 'meeting' | 'counseling' | 'class' | 'trip' | 'meal' | 'away'
export type Opening = { method: 'manual' | 'schedule'; week: { start: string; end: string }[][] }
const dbPath = join(dataDir, 'wee-check.sqlite')
const backupDir = join(dataDir, 'backups')
const emptyOpening = (): Opening => ({ method: 'manual', week: Array.from({ length: 7 }, () => []) })
const kstDay = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)

export class Store {
  db = new Database(dbPath)
  constructor() {
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admins(id TEXT PRIMARY KEY, password_hash TEXT NOT NULL, password_changed INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY, grade TEXT NOT NULL, class_name TEXT NOT NULL, name_cipher TEXT NOT NULL, identity_hash TEXT UNIQUE NOT NULL, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS attendance(id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id), direction TEXT NOT NULL CHECK(direction IN ('in','out')), mood TEXT, occurred_at TEXT NOT NULL, day TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS attendance_day_idx ON attendance(day, occurred_at);
      CREATE TABLE IF NOT EXISTS counseling(id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id), details_cipher TEXT NOT NULL, priority TEXT NOT NULL, completed_at TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS access_sessions(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, public_url TEXT, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, occurred_at TEXT NOT NULL);
    `)
  }
  async initialize() {
    if (!this.db.prepare('SELECT 1 FROM admins LIMIT 1').get()) this.db.prepare('INSERT INTO admins VALUES(?,?,0)').run('admin', await argon2.hash('0000', { type: argon2.argon2id }))
    if (!this.getSetting('school')) this.setSetting('school', { schoolType: 'elementary', schoolName: '', academicYear: String(new Date().getFullYear()) })
    if (!this.getSetting('operation')) this.setSetting('operation', { manualMode: 'open', opening: emptyOpening() })
    if (!this.db.prepare('SELECT 1 FROM students LIMIT 1').get()) this.replaceRoster(defaultRoster)
  }
  getSetting<T>(key: string): T | null { const row = this.db.prepare('SELECT value FROM app_settings WHERE key=?').get(key) as { value: string } | undefined; return row ? JSON.parse(row.value) : null }
  setSetting(key: string, value: unknown) { this.db.prepare('INSERT INTO app_settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value)) }
  audit(action: string, entityType: string, entityId?: string) { this.db.prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?)').run(randomUUID(), action, entityType, entityId || null, new Date().toISOString()) }
  async verifyPassword(password: string) { const row = this.db.prepare('SELECT password_hash FROM admins WHERE id=?').get('admin') as { password_hash: string }; return argon2.verify(row.password_hash, password) }
  passwordChanged() { return Boolean((this.db.prepare('SELECT password_changed FROM admins WHERE id=?').get('admin') as { password_changed: number }).password_changed) }
  async changePassword(password: string) { this.db.prepare('UPDATE admins SET password_hash=?, password_changed=1 WHERE id=?').run(await argon2.hash(password, { type: argon2.argon2id }), 'admin'); this.audit('password_changed', 'admin', 'admin') }
  replaceRoster(roster: Record<string, Record<string, string[]>>) {
    this.db.transaction(() => {
      this.db.prepare('UPDATE students SET active=0').run()
      const find = this.db.prepare('SELECT id FROM students WHERE identity_hash=?')
      const insert = this.db.prepare('INSERT INTO students VALUES(?,?,?,?,?,1)')
      const activate = this.db.prepare('UPDATE students SET active=1, grade=?, class_name=?, name_cipher=? WHERE id=?')
      for (const [grade, classes] of Object.entries(roster)) for (const [className, names] of Object.entries(classes)) for (const name of names) {
        const hash = blindIndex(`${grade}\0${className}\0${name}`); const row = find.get(hash) as { id: string } | undefined
        if (row) activate.run(grade, className, encryptText(name), row.id); else insert.run(randomUUID(), grade, className, encryptText(name), hash)
      }
      this.audit('roster_replaced', 'students')
    })()
  }
  roster() {
    const result: Record<string, Record<string, string[]>> = {}
    const rows = this.db.prepare('SELECT id,grade,class_name,name_cipher FROM students WHERE active=1 ORDER BY grade,class_name').all() as any[]
    for (const row of rows) ((result[row.grade] ??= {})[row.class_name] ??= []).push(decryptText(row.name_cipher))
    return result
  }
  studentId(grade: string, className: string, name: string) {
    const exact = this.db.prepare('SELECT id FROM students WHERE identity_hash=? AND active=1').get(blindIndex(`${grade}\0${className}\0${name}`)) as {id:string}|undefined
    if (exact) return exact.id
    const candidates = this.db.prepare('SELECT id,name_cipher FROM students WHERE grade=? AND class_name=? AND active=1').all(grade, className) as {id:string;name_cipher:string}[]
    return candidates.find(item => decryptText(item.name_cipher) === name)?.id
  }
  settings() { return { ...(this.getSetting<any>('school') || {}), roster: this.roster(), ...(this.getSetting<any>('operation') || {}) } }
  saveSchool(input: any) { this.setSetting('school', { schoolType: input.schoolType, schoolName: input.schoolName, academicYear: input.academicYear || String(new Date().getFullYear()) }); if (input.roster) this.replaceRoster(input.roster); this.audit('school_saved', 'settings') }
  saveOperation(input: any) { this.setSetting('operation', input); this.audit('operation_saved', 'settings') }
  records(day?: string) {
    const rows = this.db.prepare(`SELECT a.*,s.grade,s.class_name,s.name_cipher FROM attendance a JOIN students s ON s.id=a.student_id ${day ? 'WHERE a.day=?' : ''} ORDER BY a.occurred_at`).all(...(day ? [day] : [])) as any[]
    return rows.map(r => ({ id: r.id, studentId: r.student_id, grade: r.grade, schoolClass: r.class_name, name: decryptText(r.name_cipher), direction: r.direction, mood: r.mood, timestamp: r.occurred_at }))
  }
  addAttendance(studentId: string, direction: 'in' | 'out', mood?: string | null) {
    return this.db.transaction(() => {
      const student = this.db.prepare('SELECT id FROM students WHERE id=? AND active=1').get(studentId); if (!student) throw new Error('학생을 찾을 수 없습니다.')
      const day = kstDay(); const latest = this.db.prepare('SELECT direction FROM attendance WHERE student_id=? AND day=? ORDER BY occurred_at DESC LIMIT 1').get(studentId, day) as any
      if (direction === 'in' && latest?.direction === 'in') throw new Error('이미 들어온 상태입니다.')
      if (direction === 'out' && latest?.direction !== 'in') throw new Error('오늘 들어오기 기록이 없습니다.')
      const id = randomUUID(), timestamp = new Date().toISOString()
      this.db.prepare('INSERT INTO attendance VALUES(?,?,?,?,?,?)').run(id, studentId, direction, direction === 'in' ? mood ?? null : null, timestamp, day)
      this.audit(`attendance_${direction}`, 'attendance', id); return { id, timestamp }
    })()
  }
  requests() {
    const rows = this.db.prepare('SELECT c.*,s.grade,s.class_name,s.name_cipher FROM counseling c JOIN students s ON s.id=c.student_id ORDER BY c.created_at DESC').all() as any[]
    return rows.map(r => ({ id: r.id, studentId: r.student_id, grade: r.grade, schoolClass: r.class_name, name: decryptText(r.name_cipher), timestamp: r.created_at, completed: Boolean(r.completed_at), details: JSON.parse(decryptText(r.details_cipher)), priority: r.priority }))
  }
  addRequest(studentId: string, details: any, priority: string) { const id=randomUUID(); this.db.prepare('INSERT INTO counseling VALUES(?,?,?,?,NULL,?)').run(id, studentId, encryptText(JSON.stringify(details)), priority, new Date().toISOString()); this.audit('counseling_created','counseling',id); return id }
  completeRequest(id: string) { this.db.prepare('UPDATE counseling SET completed_at=? WHERE id=?').run(new Date().toISOString(), id); this.audit('counseling_completed','counseling',id) }
  createAccessSession(token: string, publicUrl?: string) { this.db.prepare('UPDATE access_sessions SET active=0').run(); const id=randomUUID(), starts=new Date(), ends=new Date(starts); ends.setHours(24,0,0,0); this.db.prepare('INSERT INTO access_sessions VALUES(?,?,?,?,?,1)').run(id,createHash('sha256').update(token).digest('hex'),publicUrl||null,starts.toISOString(),ends.toISOString()); return {id, startsAt:starts.toISOString(), endsAt:ends.toISOString()} }
  validateToken(token: string) { return Boolean(this.db.prepare('SELECT 1 FROM access_sessions WHERE token_hash=? AND active=1 AND ends_at>?').get(createHash('sha256').update(token).digest('hex'),new Date().toISOString())) }
  activeSession() { return this.db.prepare('SELECT id,public_url publicUrl,starts_at startsAt,ends_at endsAt FROM access_sessions WHERE active=1 AND ends_at>? ORDER BY starts_at DESC LIMIT 1').get(new Date().toISOString()) || null }
  stopSessions() { this.db.prepare('UPDATE access_sessions SET active=0').run(); this.audit('access_stopped','access_session') }
  backup() {
    this.db.pragma('wal_checkpoint(TRUNCATE)'); const stamp=new Date().toISOString().replace(/[:.]/g,'-'); const path=join(backupDir,`wee-check-${stamp}.wcbak`)
    if (!existsSync(backupDir)) mkdirSync(backupDir,{recursive:true})
    writeFileSync(path, encryptBytes(readFileSync(dbPath)))
    const files=readdirSync(backupDir).filter(x=>x.endsWith('.wcbak')).sort().reverse(); for(const old of files.slice(30)) unlinkSync(join(backupDir,old))
    return path
  }
  backups() { if(!existsSync(backupDir)) return []; return readdirSync(backupDir).filter(name=>name.endsWith('.wcbak')).sort().reverse() }
  restoreNamed(name: string) { if(!/^[a-zA-Z0-9._-]+\.wcbak$/.test(name)) throw new Error('올바르지 않은 백업 이름입니다.'); this.restore(join(backupDir,name)) }
  restore(path: string) { const temp=`${dbPath}.restore`; writeFileSync(temp,decryptBytes(readFileSync(path))); const check=new Database(temp,{readonly:true}); check.prepare('PRAGMA integrity_check').get(); check.close(); this.db.close(); copyFileSync(dbPath,`${dbPath}.before-restore`); renameSync(temp,dbPath) }
  closeAcademicYear() { const backup=this.backup(); this.db.transaction(()=>{ this.stopSessions(); this.db.prepare('DELETE FROM attendance').run(); this.db.prepare('DELETE FROM counseling').run(); this.db.prepare('UPDATE students SET active=0').run(); this.audit('academic_year_closed','system') })(); return backup }
}
