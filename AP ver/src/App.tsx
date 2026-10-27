import { useEffect, useMemo, useState } from 'react'
import Admin from './Admin'
import { COUNSELING_KEY, readRequests, requestPriority, type RequestDetails, type CounselingRequest } from './counseling'
import CounselingForm from './CounselingForm'
import { readSettings, SETTINGS_KEY, visibleRoster, type Roster, type RosterClass, type SchoolSettings } from './roster'
import { OPERATION_KEY, OPENING_KEY, effectiveMode, readOpening, readOperationMode, type OpeningSettings, type OperationMode } from './operation'
import PauseScreen from './PauseScreen'
import { dailySummary, dateKey, moodLabel, moodOptions, studentKey, timeLabel, type AttendanceRecord, type MoodValue } from './attendance'
import { emptyOpening } from './operation'
import { api } from './api'
import Login from './Login'
import { ArrowLeft, Bell, Building2, Check, ChevronRight, Clock3, Cloud, CloudLightning, CloudRain, CloudSun, HelpCircle, Hourglass, LogIn, LogOut, MessageCircleHeart, School, Settings, ShieldCheck, Sun, UserRound, Users, type LucideIcon } from 'lucide-react'

type Direction = 'in' | 'out'
type Step = 'home' | 'grade' | 'class' | 'student' | 'mood' | 'exit' | 'request' | 'wait-confirm' | 'waiting' | 'success'
type WaitContext = { ticket:string; grade:string; schoolClass:string; name:string; mood:MoodValue|null }

const moodIcons: Record<MoodValue, LucideIcon> = {
  'sunny-full': Sun,
  'sunny-soft': CloudSun,
  cloudy: Cloud,
  drizzle: CloudRain,
  'heavy-rain': CloudLightning,
}

function Logo({ name }: { name?: string }) {
  return <div className="brand"><span className="brand-mark"><Check size={18} strokeWidth={3} /></span><span>{name ? `${name} Wee클래스` : 'Wee클래스'}</span></div>
}

function App() {
  const adminRoute = location.pathname.startsWith('/admin')
  const [requests, setRequests] = useState<CounselingRequest[]>([])
  const [counseling, setCounseling] = useState(false)
  const [urgentRequest, setUrgentRequest] = useState(false)
  const [settings, setSettings] = useState<SchoolSettings>({ schoolType: 'elementary', schoolName: '', roster: {} })
  const roster = useMemo(() => visibleRoster(settings), [settings])
  const [manualMode, setMode] = useState<OperationMode>('open')
  const [opening, setOpening] = useState<OpeningSettings>(emptyOpening)
  const [now, setNow] = useState(() => new Date())
  const mode = effectiveMode(manualMode, opening, now)
  const [modeError, setModeError] = useState('')
  const entryBlocked = mode !== 'open'
  const [admin, setAdmin] = useState(adminRoute)
  const [authenticated, setAuthenticated] = useState(!adminRoute)
  const [loading, setLoading] = useState(true)
  const [passwordChanged, setPasswordChanged] = useState(true)
  const [access, setAccess] = useState<any>({ state: 'stopped' })
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [capacity,setCapacity]=useState<any>({enabled:true,limit:10,present:0,reserved:0,waiting:0,available:10})
  const [waitlist,setWaitlist]=useState<any[]>([])
  const [capacityFull,setCapacityFull]=useState<any>(null)
  const [waitContext,setWaitContext]=useState<WaitContext|null>(null)
  const [waitStatus,setWaitStatus]=useState<any>(null)
  const [recordError, setRecordError] = useState('')
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting'>('connected')
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const [confirmedAt, setConfirmedAt] = useState('')
  const [today, setToday] = useState(dateKey())
  const summary = dailySummary(records, today)
  const presentStudents = summary.latest.filter(record => record.direction === 'in').sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  const applyBootstrap = (data: any) => {
    if (data.settings) { setSettings({ schoolType: data.settings.schoolType, schoolName: data.settings.schoolName, roster: data.settings.roster, rosterDetails:data.settings.rosterDetails||[] }); setMode(data.settings.manualMode || data.operation?.manualMode || 'open'); setOpening(data.settings.opening || data.operation?.opening || emptyOpening()) }
    setRecords(data.records || []); setRequests(data.requests || []); if(data.capacity)setCapacity(data.capacity);if(data.waitlist)setWaitlist(data.waitlist);if ('passwordChanged' in data) setPasswordChanged(data.passwordChanged); if (data.access) setAccess(data.access)
  }
  const reload = async () => { try { const data = adminRoute ? await api.adminBootstrap() : await api.studentBootstrap(); applyBootstrap(data); setAuthenticated(true); setConnectionStatus('connected'); setLastUpdated(new Date()) } catch (error: any) { if (adminRoute && error?.status === 401) setAuthenticated(false); else { setConnectionStatus('reconnecting'); setRecordError(error instanceof Error ? error.message : '서버에 연결하지 못했습니다.') } } finally { setLoading(false) } }
  useEffect(() => {
    void reload()
    const refresh = () => { setNow(new Date()); setToday(dateKey()) }
    const timer = window.setInterval(refresh, 1000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const events = adminRoute && authenticated ? new EventSource('/api/admin/events') : !adminRoute && api.studentToken() ? new EventSource(api.studentEventsUrl()) : null
    if (events) {
      events.addEventListener('open', () => setConnectionStatus('connected'))
      events.addEventListener('update', () => void reload())
      events.addEventListener('counseling', () => void reload())
      events.addEventListener('capacity', () => void reload())
      events.addEventListener('error', () => setConnectionStatus('reconnecting'))
    }
    let syncingOperation = false
    const syncStudentOperation = async () => { if (adminRoute || !api.studentToken() || syncingOperation) return; syncingOperation = true; try { const operation=await api.studentOperation(); setMode(operation.manualMode||'open'); setOpening(operation.opening||emptyOpening()); setConnectionStatus('connected') } catch { setConnectionStatus('reconnecting') } finally { syncingOperation=false } }
    const operationTimer = !adminRoute && api.studentToken() ? window.setInterval(() => void syncStudentOperation(), 1000) : 0
    return () => { events?.close(); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer); if(operationTimer) window.clearInterval(operationTimer) }
  }, [authenticated])
  const [direction, setDirection] = useState<Direction>('in')
  const [step, setStep] = useState<Step>('home')
  const [grade, setGrade] = useState('')
  const [schoolClass, setSchoolClass] = useState('')
  const [student, setStudent] = useState('')
  const [confirmedMood, setConfirmedMood] = useState<MoodValue | null | undefined>(undefined)
  const grades = Object.keys(roster)
  const classes = useMemo(() => Object.keys(roster[grade] || {}), [grade, roster])
  const rosterStudents = useMemo(() => roster[grade]?.[schoolClass] || [], [grade, schoolClass, roster])
  const students = counseling ? rosterStudents : rosterStudents.filter(name => !presentStudents.some(record => record.grade === grade && record.schoolClass === schoolClass && record.name === name))

  const reset = () => { setGrade(''); setSchoolClass(''); setStudent(''); setConfirmedMood(undefined); setCapacityFull(null); setWaitStatus(null); setRecordError(''); setStep('home') }
  const start = (next: Direction) => {
    const currentMode = effectiveMode(manualMode, opening)
    setNow(new Date())
    if (currentMode !== 'open') { reset(); return }
    setToday(dateKey())
    setCounseling(false); setDirection(next); setGrade(''); setSchoolClass(''); setStudent(''); setConfirmedMood(undefined); setRecordError(''); setStep(next === 'out' ? 'exit' : 'grade')
  }
  const changeMode = async (next: OperationMode) => {
    setModeError('')
    try { await api.saveOperation({ manualMode: next, opening }); setMode(next); setNow(new Date()) }
    catch (error) { const message = error instanceof Error ? error.message : '운영 상태를 저장하지 못했습니다.'; setModeError(message); throw error }
  }
  const saveSettings = async (next: SchoolSettings) => {
    await api.saveSchool(next)
    setSettings(next)
    reset()
  }
  const rosterChanged=(next:Roster,details:RosterClass[])=>setSettings(current=>({...current,roster:next,rosterDetails:details}))
  const saveRequests = async (next: CounselingRequest[]) => {
    const completed = next.find(item => item.completed && !requests.find(old => old.id === item.id)?.completed)
    if (completed) await api.completeRequest(completed.id)
    setRequests(next)
  }
  const submitRequest = async (details: RequestDetails) => {
    try { const result = await api.counseling({ grade, schoolClass, name: student, details, priority: requestPriority(details) }); setUrgentRequest(requestPriority(details) === 'urgent' || requestPriority(details) === 'followup'); setConfirmedAt(result.timestamp); setRecordError(''); setStep('success') }
    catch { setRecordError('상담 신청이 전달되지 않았어요. 선생님께 직접 알려 주세요.') }
  }
  const saveOpening = async (next: OpeningSettings) => {
    setModeError('')
    try { await api.saveOperation({ manualMode, opening: next }); setOpening(next); setNow(new Date()) }
    catch (error) { const message = error instanceof Error ? error.message : '개방 설정을 저장하지 못했습니다.'; setModeError(message); throw error }
  }
  useEffect(() => {
    if (mode !== 'open' && step !== 'home') {
      setGrade(''); setSchoolClass(''); setStudent(''); setRecordError(''); setStep('home')
    }
  }, [mode, direction, step])
  const goBack = () => {
    if (step === 'grade' || step === 'exit') reset()
    if (step === 'class') setStep('grade')
    if (step === 'student') setStep('class')
    if (step === 'mood') { setRecordError(''); setStep('student') }
    if (step === 'request') { setRecordError(''); setStep('student') }
    if (step === 'wait-confirm') { setCapacityFull(null); setStep('mood') }
  }
  const chooseGrade = (value: string) => { setGrade(value); setSchoolClass(''); setStudent(''); setStep('class') }
  const chooseClass = (value: string) => { setSchoolClass(value); setStudent(''); setStep('student') }
  const chooseStudent = (value: string, selectedGrade = grade, selectedClass = schoolClass) => {
    if (counseling) { setStudent(value); setRecordError(''); setStep('request'); return }
    if (direction === 'in') {
      const stored = records
      const candidate = { grade: selectedGrade, schoolClass: selectedClass, name: value }
      const latest = dailySummary(stored, dateKey()).latest.find(item => studentKey(item) === studentKey(candidate))
      if (latest?.direction === 'in') { setRecords(stored); setRecordError('이미 들어온 상태예요. 이름이 맞는지 확인하고 선생님께 알려 주세요.'); return }
      setStudent(value); setRecordError(''); setStep('mood'); return
    }
    saveAttendance(undefined, value, selectedGrade, selectedClass)
  }
  const saveAttendance = async (mood: MoodValue | null | undefined, selectedStudent = student, selectedGrade = grade, selectedClass = schoolClass, waitlistTicket?:string) => {
    if (attendanceSaving) return
    const currentMode = effectiveMode(manualMode, opening)
    setNow(new Date())
    if (currentMode !== 'open') { reset(); return }
    const timestamp = new Date().toISOString()
    const stored = records
    const record: AttendanceRecord = { id: '', grade: selectedGrade, schoolClass: selectedClass, name: selectedStudent, direction, timestamp, ...(direction === 'in' ? { mood: mood ?? null } : {}) }
    const latest = dailySummary(stored, dateKey()).latest.find(item => studentKey(item) === studentKey(record))
    if (direction === 'out' && latest?.direction !== 'in') { setRecords(stored); setRecordError('지금 Wee클래스에 있는 친구 명단에서 이름을 찾지 못했어요. 선생님께 알려 주세요.'); return }
    if (latest?.direction === direction) { setRecordError('이미 들어온 상태예요. 이름이 맞는지 확인하고 선생님께 알려 주세요.'); return }
    setAttendanceSaving(true)
    try { const result = await api.attendance({ grade:selectedGrade, schoolClass:selectedClass, name:selectedStudent, direction, mood, waitlistTicket }); record.id=result.id; record.timestamp=result.timestamp;record.plannedEndAt=result.plannedEndAt;record.maxPlayMinutes=result.maxPlayMinutes }
    catch (error:any) { if(direction==='in'&&error?.code==='CAPACITY_FULL'){setCapacityFull(error);setConfirmedMood(mood??null);setStep('wait-confirm');return}setRecordError(error instanceof Error ? error.message : '들어오기나 나가기를 확인하지 못했어요. 선생님께 알려 주세요.'); return }
    finally { setAttendanceSaving(false) }
    const next = [...stored, record]
    setRecords(next); setToday(dateKey()); setConfirmedAt(record.timestamp); setConfirmedMood(direction === 'in' ? mood ?? null : undefined); setRecordError(''); setGrade(selectedGrade); setSchoolClass(selectedClass); setStudent(selectedStudent);if(waitlistTicket){localStorage.removeItem('wee-check-wait-ticket');setWaitContext(null);setWaitStatus(null)} setStep('success')
  }
  const joinWaitlist=async()=>{try{const result=await api.joinWaitlist({grade,schoolClass,name:student,mood:confirmedMood??null}),context={ticket:result.ticket,grade,schoolClass,name:student,mood:confirmedMood??null};localStorage.setItem('wee-check-wait-ticket',JSON.stringify(context));setWaitContext(context);setWaitStatus(result);setRecordError('');setStep('waiting')}catch(error){setRecordError(error instanceof Error?error.message:'대기를 신청하지 못했습니다.')}}
  const cancelWait=async()=>{if(!waitContext){reset();return}try{await api.cancelWaitlist(waitContext.ticket)}catch{/* The reservation may already have ended. */}localStorage.removeItem('wee-check-wait-ticket');setWaitContext(null);reset()}
  useEffect(()=>{if(adminRoute)return;try{const saved=JSON.parse(localStorage.getItem('wee-check-wait-ticket')||'null') as WaitContext|null;if(saved?.ticket){setWaitContext(saved);setGrade(saved.grade);setSchoolClass(saved.schoolClass);setStudent(saved.name);setConfirmedMood(saved.mood);setStep('waiting')}}catch{localStorage.removeItem('wee-check-wait-ticket')}},[])
  useEffect(()=>{if(!waitContext||step!=='waiting')return;let stopped=false;const refresh=async()=>{try{const status=await api.waitlistStatus(waitContext.ticket);if(!stopped)setWaitStatus(status)}catch{if(!stopped)setWaitStatus({status:'ended'})}};void refresh();const timer=window.setInterval(()=>void refresh(),2000);return()=>{stopped=true;window.clearInterval(timer)}},[waitContext,step])
  useEffect(() => {
    if (step !== 'success' || admin || (counseling && urgentRequest)) return
    const timer = window.setTimeout(() => { setGrade(''); setSchoolClass(''); setStudent(''); setStep('home') }, 5000)
    return () => window.clearTimeout(timer)
  }, [step, admin, counseling, urgentRequest])

  if (loading) return <main className="loading-page">Wee Check 서버에 연결하는 중…</main>
  if (adminRoute && !authenticated) return <Login onLogin={() => { setLoading(true); void reload() }} />
  return (
    <main className={`app-shell ${admin ? 'admin-shell' : 'student-shell'}${!admin && step === 'home' && mode === 'open' ? ' view-home' : ''}`}>
      {!adminRoute && <header className="topbar">
        <Logo name={settings.schoolName} />
        <div className="top-actions">
          {(!entryBlocked || admin) && <button className="icon-button" aria-label="알림"><Bell size={20} /></button>}
          {adminRoute ? <button className="admin-nav" onClick={() => { void api.logout().then(() => setAuthenticated(false)) }}><Settings size={18} />로그아웃</button> : !api.studentToken() && <button className="admin-nav" onClick={() => { location.href='/admin' }}><Settings size={18} />관리자</button>}
        </div>
      </header>}

      {admin ? <Admin requests={requests} onSaveRequests={saveRequests} records={records} roster={roster} settings={settings} onSaveSettings={saveSettings} onRosterChanged={rosterChanged} capacity={capacity} waitlist={waitlist} mode={mode} manualMode={manualMode} opening={opening} onSaveOpening={saveOpening} onModeChange={changeMode} modeError={modeError} passwordChanged={passwordChanged} access={access} connectionStatus={connectionStatus} lastUpdated={lastUpdated} onLogout={async()=>{await api.logout();setAuthenticated(false)}} onStartAccess={async()=>{setAccess({state:'starting'});try{setAccess(await api.startAccess())}catch(e){setAccess({state:'error',message:e instanceof Error?e.message:'시작하지 못했습니다.'});throw e}}} onStopAccess={async()=>{await api.stopAccess();setAccess({state:'stopped'})}} onChangePassword={async(password)=>{await api.changePassword(password);setPasswordChanged(true)}} onBackup={async()=>{const result=await api.backup();return result.path}} onListBackups={async()=>{const result=await api.backups();return result.files}} onRestore={async(name)=>{await api.restore(name)}} onCloseAcademicYear={async()=>{const result=await api.closeAcademicYear();await reload();return result.backup}} /> : mode !== 'open' ? <PauseScreen mode={mode} /> : <section className={`kiosk ${step === 'home' ? 'kiosk-home' : ''}`}>
        {step === 'home' && <>
          <div className="hero">
            <div className="hero-copy">
              <p className="eyebrow"><span className="live-dot" /> 오늘도 반가워요</p>
              <h1>우리 학교 마음지키미,<br />{settings.schoolName ? `${settings.schoolName} ` : ''}<em>Wee클래스</em></h1><p className="hero-description">들어오거나 나갈 때, 내 이름을 눌러 주세요.</p>
              <div className="today-stats" aria-label="현재 이용 현황">
                <div className="today-stat today-stat-present">
                  <span className="today-stat-icon"><Users size={21} aria-hidden="true" /></span>
                  <span className="today-stat-label">지금 이용 중</span>
                  <strong>{capacity.present ?? summary.present}<small>명</small></strong>
                </div>
                <span className="today-stats-divider" aria-hidden="true" />
                <div className="today-stat today-stat-available">
                  <span className="today-stat-icon"><LogIn size={21} aria-hidden="true" /></span>
                  <span className="today-stat-label">남은 자리</span>
                  <strong>{capacity.enabled ? Math.max(0, Number(capacity.available ?? 0)) : '제한 없음'}{capacity.enabled && <small>자리</small>}</strong>
                </div>
                <span className="capacity-caption">
                  <span className="capacity-caption-icon" aria-hidden="true"><Users size={16} strokeWidth={2} /></span>
                  <span>{capacity.enabled
                    ? `전체 ${capacity.limit}자리${capacity.reserved ? ` · 예약 ${capacity.reserved}자리 포함` : ''}`
                    : '정원 제한 없이 이용할 수 있어요'}</span>
                </span>
              </div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="building-card">
                <div className="building-icon"><School size={64} strokeWidth={1.6} /></div>
                <div className="access-pill"><ShieldCheck size={16} /> Wee클래스가 열려 있어요</div>
              </div>
            </div>
          </div>

          <div className="choice-section">
            <div className="choice-grid">
              <button className="choice-card entry" onClick={() => start('in')}>
                <span className="door-illustration"><LogIn size={42} strokeWidth={1.7} /></span>
                <span className="choice-title">들어오기</span><span className="choice-help">잠깐 쉬거나 놀고 싶어요</span>
              </button>
              <button className="choice-card exit" onClick={() => start('out')}>
                <span className="door-illustration"><LogOut size={42} strokeWidth={1.7} /></span>
                <span className="choice-title">나가기</span><span className="choice-help">잘 쉬었어요. 다음에 또 올게요!</span>
              </button>
              <button className="choice-card counseling-choice" onClick={() => { start('in'); setCounseling(true) }}><span className="counseling-symbol"><MessageCircleHeart size={42} strokeWidth={1.7} /></span><span className="choice-title">상담 신청하기</span><span className="choice-help">선생님과 이야기하고 싶어요</span></button>
            </div>
            <div className="school-note"><Building2 size={18} /><span>마음이 쉬어가는 곳, Wee클래스</span></div>
          </div>

          <footer className="help-bar">
            <div><HelpCircle size={18} /><span><strong>내 이름이 보이지 않나요?</strong><small>선생님께 내 이름이 안 보인다고 알려 주세요.</small></span></div>
            <span className="system-status"><i /> Wee클래스가 열려 있어요</span>
          </footer>
        </>}

        {step !== 'home' && <div className="flow-screen roster-flow">
          {step !== 'success' && step !== 'waiting' && <button className="back-button" onClick={goBack}><ArrowLeft size={20} /> 이전</button>}

          {step === 'exit' && <div className="flow-content roster-content student-content">
            <p className="eyebrow">Wee클래스 나가기</p>
            <h2>머물렀던 자리는 정리했나요?<br />놓고 가는 물건은 없는지 확인해 주세요.</h2>
            <p className="flow-description">지금 Wee클래스에 있는 친구들만 보여요.</p>
            {recordError && <p className="record-error" role="alert">{recordError}</p>}
            <div className="student-grid exit-student-grid">{presentStudents.map(item => <button key={studentKey(item)} onClick={() => chooseStudent(item.name, item.grade, item.schoolClass)}><span className="student-initial">{item.name.slice(0, 1)}</span><span className="exit-student-info"><strong>{item.name}</strong><small>{item.grade} {item.schoolClass}</small></span><ChevronRight size={18} /></button>)}</div>
            {!presentStudents.length && <div className="admin-empty"><UserRound size={32} /><strong>지금은 Wee클래스에 있는 친구가 없어요.</strong><p>내 이름이 보이지 않으면 선생님께 알려 주세요.</p><button className="primary-button" onClick={reset}>처음 화면으로</button></div>}
          </div>}

          {step === 'grade' && <div className="flow-content roster-content">
            <span className={`flow-badge ${direction}`}><School size={25} /></span>
            <p className="eyebrow">{counseling ? '상담 신청 · 1/3' : 'Wee클래스 들어오기 · 1/4'}</p>
            <h2>몇 학년인가요?</h2><p className="flow-description">아래에서 선택해 주세요.</p>
            <div className="selection-grid grade-grid">{grades.map(item =>
              <button key={item} onClick={() => chooseGrade(item)}><strong>{item.replace('학년', '')}</strong><span>학년</span><ChevronRight size={18} /></button>
            )}</div>
          </div>}

          {step === 'class' && <div className="flow-content roster-content">
            <div className="breadcrumb"><span>{grade}</span><ChevronRight size={14} /><strong>반 선택</strong></div>
            <p className="eyebrow">{counseling ? '상담 신청 · 2/3' : 'Wee클래스 들어오기 · 2/4'}</p>
            <h2>{grade}, 몇 반인가요?</h2><p className="flow-description">아래에서 선택해 주세요.</p>
            <div className="selection-grid class-grid">{classes.map(item =>
              <button key={item} onClick={() => chooseClass(item)}><strong>{item.replace('반', '')}</strong><span>반</span><ChevronRight size={18} /></button>
            )}</div>
          </div>}

          {step === 'student' && <div className="flow-content roster-content student-content">
            <div className="breadcrumb"><span>{grade}</span><ChevronRight size={14} /><span>{schoolClass}</span><ChevronRight size={14} /><strong>이름 선택</strong></div>
            <p className="eyebrow">{counseling ? '상담 신청 · 3/3' : 'Wee클래스 들어오기 · 3/4'}</p>
            <h2>내 이름을<br />눌러 주세요.</h2><p className="flow-description">이름은 가나다순으로 있어요.</p>
            {recordError && <p className="record-error" role="alert">{recordError}</p>}
            <div className="student-grid">{students.map(name =>
              <button key={name} onClick={() => chooseStudent(name)}><span className="student-initial">{name.slice(0, 1)}</span><strong>{name}</strong><ChevronRight size={18} /></button>
            )}</div>
            {!students.length && <div className="admin-empty"><UserRound size={32} /><strong>{counseling ? '이 반에 등록된 친구가 없어요.' : '이 반 친구들은 모두 들어와 있어요.'}</strong></div>}
          </div>}

          {step === 'mood' && <div className="flow-content mood-content">
            <div className="breadcrumb"><span>{grade}</span><ChevronRight size={14} /><span>{schoolClass}</span><ChevronRight size={14} /><strong>{student}</strong></div>
            <p className="eyebrow">Wee클래스 들어오기 · 4/4</p>
            <h2>오늘 내 마음은<br />어떤 날씨인가요?</h2>
            <p className="flow-description">내 마음과 가장 가까운 날씨를 골라 주세요.</p>
            {attendanceSaving ? <p className="operation-feedback" role="status">입장 처리 중이에요. 잠시만 기다려 주세요.</p> : recordError && <p className="record-error" role="alert">{recordError}</p>}
            <div className="mood-grid">{moodOptions.map(option => {
              const Icon = moodIcons[option.value]
              return <button className={`mood-card mood-${option.value}`} key={option.value} disabled={attendanceSaving} onClick={() => void saveAttendance(option.value)}><span><Icon size={52} strokeWidth={1.7} /></span><strong>{option.label}</strong></button>
            })}</div>
            <button className="mood-skip" disabled={attendanceSaving} onClick={() => void saveAttendance(null)}>선택하지 않을래요</button>
          </div>}

          {step === 'wait-confirm' && capacityFull && <div className="flow-content wait-flow">
            <span className="flow-badge wait"><Hourglass size={28}/></span><p className="eyebrow">현재 정원이 모두 찼어요</p><h2>대기 명단에<br/>이름을 올릴까요?</h2>
            <div className="student-wait-summary"><div><span>현재 이용</span><strong>{capacityFull.present}/{capacityFull.limit}명</strong></div><div><span>예상 순번</span><strong>{capacityFull.proposedPosition}번째</strong></div><div><span>예상 입실</span><strong>{capacityFull.delayed?'퇴실 확인 대기 중':capacityFull.estimatedAt?`약 ${Math.max(1,Math.ceil((Date.parse(capacityFull.estimatedAt)-Date.now())/60000))}분 · ${timeLabel(capacityFull.estimatedAt)}경`:'운영 시간 내 어려울 수 있음'}</strong></div></div>
            {capacityFull.grades?.length>0&&!capacityFull.grades.includes(grade)&&<p className="record-error" role="alert">현재 대기는 {capacityFull.grades.join(', ')} 학생만 신청할 수 있어요.</p>}{recordError&&<p className="record-error" role="alert">{recordError}</p>}
            <div className="wait-actions"><button className="primary-button" disabled={capacityFull.grades?.length>0&&!capacityFull.grades.includes(grade)} onClick={()=>void joinWaitlist()}>대기 신청</button><button className="mood-skip" onClick={reset}>신청하지 않고 돌아가기</button></div>
          </div>}

          {step === 'waiting' && <div className="flow-content wait-flow" aria-live="polite">
            <span className={`flow-badge wait ${waitStatus?.status==='reserved'?'ready':''}`}><Hourglass size={28}/></span>{waitStatus?.status==='reserved'?<><p className="eyebrow">입실할 차례예요</p><h2>5분 안에<br/>들어오기를 눌러 주세요</h2><div className="reservation-countdown"><Clock3 size={20}/><strong>{waitStatus.expiresAt?`${Math.max(0,Math.ceil((Date.parse(waitStatus.expiresAt)-Date.now())/60000))}분 남음`:'확인 중'}</strong></div><button className="primary-button" onClick={()=>waitContext&&void saveAttendance(waitContext.mood,waitContext.name,waitContext.grade,waitContext.schoolClass,waitContext.ticket)}>지금 들어가기</button></>:waitStatus?.status==='waiting'?<><p className="eyebrow">대기 신청 완료</p><h2>{waitStatus.position}번째로<br/>기다리고 있어요</h2><div className="student-wait-summary"><div><span>예상 입실</span><strong>{waitStatus.delayed?'퇴실 확인 대기 중':waitStatus.estimatedAt?`약 ${Math.max(1,Math.ceil((Date.parse(waitStatus.estimatedAt)-Date.now())/60000))}분 · ${timeLabel(waitStatus.estimatedAt)}경`:'운영 시간 내 어려울 수 있음'}</strong></div></div><p className="flow-description">순서가 되면 이 화면에서 바로 알려드릴게요.</p></>:<><p className="eyebrow">대기가 종료되었어요</p><h2>선생님께<br/>확인해 주세요</h2></>}{recordError&&<p className="record-error" role="alert">{recordError}</p>}<button className="mood-skip" onClick={()=>void cancelWait()}>{waitStatus?.status==='waiting'||waitStatus?.status==='reserved'?'대기 취소':'처음 화면으로'}</button>
          </div>}

          {step === 'request' && <CounselingForm name={student} grade={grade} schoolClass={schoolClass} schoolType={settings.schoolType} error={recordError} onSubmit={submitRequest} />}
          {step === 'success' && <div className="flow-content success-flow">
            <div className="success-check"><Check size={46} strokeWidth={2.5} /></div>
            <h2><em>{counseling ? '상담 신청이 접수됐어요.' : direction === 'in' ? '반가워요!' : '다음에 또 만나요!'}</em></h2>
            {(counseling || direction === 'in') && <p className="flow-description">{counseling ? '선생님이 신청을 확인한 뒤 상담 시간을 알려 주실 거예요.' : '필요한 게 있으면 선생님에게 말해 주세요.'}</p>}
            <div className="student-ticket">
              <div className="avatar"><UserRound size={24} /></div><div><strong>{student}</strong><small>{grade} {schoolClass}</small></div>
              <div className="ticket-time"><Clock3 size={16} /><strong>{confirmedAt && timeLabel(confirmedAt)}</strong></div>
            </div>
            {!counseling && direction === 'in' && confirmedMood !== undefined && <p className="confirmed-mood">오늘의 마음 날씨 <strong>{moodLabel(confirmedMood)}</strong></p>}
            {counseling && urgentRequest ? <div className="safety-help" role="status"><strong>가까운 선생님이나 믿을 수 있는 어른에게 지금 알려 주세요.</strong><p>선생님이 신청을 읽기까지 시간이 걸릴 수 있어요. 혼자 기다리지 말고 가까운 선생님이나 어른에게 바로 도움을 청해 주세요.</p></div> : <p className="success-note">잠시 뒤 처음 화면으로 돌아가요.</p>}
            <button className="primary-button" onClick={reset}>처음 화면으로</button>
          </div>}
        </div>}
      </section>}
    </main>
  )
}

export default App
