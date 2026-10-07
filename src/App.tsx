import { useEffect, useMemo, useState } from 'react'
import Admin from './Admin'
import { COUNSELING_KEY, readRequests, requestPriority, type RequestDetails, type CounselingRequest } from './counseling'
import CounselingForm from './CounselingForm'
import { readSettings, SETTINGS_KEY, visibleRoster, type SchoolSettings } from './roster'
import { OPERATION_KEY, OPENING_KEY, effectiveMode, readOpening, readOperationMode, type OpeningSettings, type OperationMode } from './operation'
import PauseScreen from './PauseScreen'
import { dailySummary, dateKey, moodLabel, moodOptions, readRecords, STORAGE_KEY, studentKey, timeLabel, type AttendanceRecord, type MoodValue } from './attendance'
import { ArrowLeft, Bell, Building2, Check, ChevronRight, Clock3, Cloud, CloudLightning, CloudRain, CloudSun, HelpCircle, LogIn, LogOut, MessageCircleHeart, School, Settings, ShieldCheck, Sun, UserRound, type LucideIcon } from 'lucide-react'

type Direction = 'in' | 'out'
type Step = 'home' | 'grade' | 'class' | 'student' | 'mood' | 'exit' | 'request' | 'success'

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
  const [requests, setRequests] = useState<CounselingRequest[]>(readRequests)
  const [counseling, setCounseling] = useState(false)
  const [urgentRequest, setUrgentRequest] = useState(false)
  const [settings, setSettings] = useState<SchoolSettings>(readSettings)
  const roster = useMemo(() => visibleRoster(settings), [settings])
  const [manualMode, setMode] = useState<OperationMode>(readOperationMode)
  const [opening, setOpening] = useState<OpeningSettings>(readOpening)
  const [now, setNow] = useState(() => new Date())
  const mode = effectiveMode(manualMode, opening, now)
  const [modeError, setModeError] = useState('')
  const entryBlocked = mode !== 'open'
  const [admin, setAdmin] = useState(false)
  const [records, setRecords] = useState<AttendanceRecord[]>(readRecords)
  const [recordError, setRecordError] = useState('')
  const [confirmedAt, setConfirmedAt] = useState('')
  const [today, setToday] = useState(dateKey())
  const summary = dailySummary(records, today)
  const presentStudents = summary.latest.filter(record => record.direction === 'in').sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setRecords(readRecords())
      if (event.key === COUNSELING_KEY || event.key === null) setRequests(readRequests())
      if (event.key === OPERATION_KEY || event.key === null) setMode(readOperationMode())
      if (event.key === OPENING_KEY || event.key === null) setOpening(readOpening())
      if (event.key === SETTINGS_KEY || event.key === null) { setSettings(readSettings()); setStep('home'); setGrade(''); setSchoolClass(''); setStudent('') }
    }
    window.addEventListener('storage', sync)
    const refresh = () => { setNow(new Date()); setToday(dateKey()) }
    const timer = window.setInterval(refresh, 1000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.clearInterval(timer) }
  }, [])
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

  const reset = () => { setGrade(''); setSchoolClass(''); setStudent(''); setConfirmedMood(undefined); setRecordError(''); setStep('home') }
  const start = (next: Direction) => {
    const storedMode = readOperationMode()
    const storedOpening = readOpening()
    const currentMode = effectiveMode(storedMode, storedOpening)
    setMode(storedMode); setOpening(storedOpening); setNow(new Date())
    if (currentMode !== 'open') { reset(); return }
    setRecords(readRecords()); setToday(dateKey())
    setCounseling(false); setDirection(next); setGrade(''); setSchoolClass(''); setStudent(''); setConfirmedMood(undefined); setRecordError(''); setStep(next === 'out' ? 'exit' : 'grade')
  }
  const changeMode = (next: OperationMode) => {
    try { localStorage.setItem(OPERATION_KEY, next) }
    catch { setModeError('운영 모드를 저장하지 못했습니다. 브라우저 저장 공간을 확인해야 합니다.'); return }
    setMode(next); setModeError('')
  }
  const saveSettings = (next: SchoolSettings) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) }
    catch { return false }
    setSettings(next); reset(); return true
  }
  const saveRequests = (next: CounselingRequest[]) => {
    try { localStorage.setItem(COUNSELING_KEY, JSON.stringify(next)) }
    catch { return false }
    setRequests(next); return true
  }
  const submitRequest = (details: RequestDetails) => {
    const stored = readRequests()
    const previous = stored.find(item => !item.completed && item.grade === grade && item.schoolClass === schoolClass && item.name === student)
    const timestamp = new Date().toISOString()
    const updated = previous ? stored.map(item => item.id === previous.id ? { ...item, details, timestamp } : item) : [...stored, { id: crypto.randomUUID(), grade, schoolClass, name: student, timestamp, completed: false, details }]
    if (!saveRequests(updated)) { setRecordError('상담 신청이 전달되지 않았어요. 선생님께 직접 알려 주세요.'); return }
    setUrgentRequest(requestPriority(details) === 'urgent' || requestPriority(details) === 'followup'); setConfirmedAt(timestamp); setRecordError(''); setStep('success')
  }
  const saveOpening = (next: OpeningSettings) => {
    try { localStorage.setItem(OPENING_KEY, JSON.stringify(next)) }
    catch { return false }
    setOpening(next); setNow(new Date()); return true
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
  }
  const chooseGrade = (value: string) => { setGrade(value); setSchoolClass(''); setStudent(''); setStep('class') }
  const chooseClass = (value: string) => { setSchoolClass(value); setStudent(''); setStep('student') }
  const chooseStudent = (value: string, selectedGrade = grade, selectedClass = schoolClass) => {
    if (counseling) { setStudent(value); setRecordError(''); setStep('request'); return }
    if (direction === 'in') {
      const stored = readRecords()
      const candidate = { grade: selectedGrade, schoolClass: selectedClass, name: value }
      const latest = dailySummary(stored, dateKey()).latest.find(item => studentKey(item) === studentKey(candidate))
      if (latest?.direction === 'in') { setRecords(stored); setRecordError('이미 들어온 상태예요. 이름이 맞는지 확인하고 선생님께 알려 주세요.'); return }
      setStudent(value); setRecordError(''); setStep('mood'); return
    }
    saveAttendance(undefined, value, selectedGrade, selectedClass)
  }
  const saveAttendance = (mood: MoodValue | null | undefined, selectedStudent = student, selectedGrade = grade, selectedClass = schoolClass) => {
    const storedMode = readOperationMode()
    const storedOpening = readOpening()
    const currentMode = effectiveMode(storedMode, storedOpening)
    setMode(storedMode); setOpening(storedOpening); setNow(new Date())
    if (currentMode !== 'open') { reset(); return }
    const timestamp = new Date().toISOString()
    const record: AttendanceRecord = { id: crypto.randomUUID(), grade: selectedGrade, schoolClass: selectedClass, name: selectedStudent, direction, timestamp, ...(direction === 'in' ? { mood: mood ?? null } : {}) }
    const stored = readRecords()
    const latest = dailySummary(stored, dateKey()).latest.find(item => studentKey(item) === studentKey(record))
    if (direction === 'out' && latest?.direction !== 'in') { setRecords(stored); setRecordError('지금 Wee클래스에 있는 친구 명단에서 이름을 찾지 못했어요. 선생님께 알려 주세요.'); return }
    if (latest?.direction === direction) { setRecordError('이미 들어온 상태예요. 이름이 맞는지 확인하고 선생님께 알려 주세요.'); return }
    const next = [...stored, record]
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
    catch { setRecordError('들어오기나 나가기를 확인하지 못했어요. 선생님께 알려 주세요.'); return }
    setRecords(next); setToday(dateKey()); setConfirmedAt(timestamp); setConfirmedMood(direction === 'in' ? mood ?? null : undefined); setRecordError(''); setGrade(selectedGrade); setSchoolClass(selectedClass); setStudent(selectedStudent); setStep('success')
  }
  useEffect(() => {
    if (step !== 'success' || admin || (counseling && urgentRequest)) return
    const timer = window.setTimeout(() => { setGrade(''); setSchoolClass(''); setStudent(''); setStep('home') }, 5000)
    return () => window.clearTimeout(timer)
  }, [step, admin, counseling, urgentRequest])

  return (
    <main className={`app-shell ${admin ? 'admin-shell' : 'student-shell'}${!admin && step === 'home' && mode === 'open' ? ' view-home' : ''}`}>
      <header className="topbar">
        <Logo name={settings.schoolName} />
        <div className="top-actions">
          {(!entryBlocked || admin) && <button className="icon-button" aria-label="알림"><Bell size={20} /></button>}
          <button className="admin-nav" onClick={() => { reset(); setAdmin(!admin) }}><Settings size={18} />{admin ? '학생 화면' : '관리자'}</button>
        </div>
      </header>

      {admin ? <Admin requests={requests} onSaveRequests={saveRequests} records={records} roster={roster} settings={settings} onSaveSettings={saveSettings} mode={mode} manualMode={manualMode} opening={opening} onSaveOpening={saveOpening} onModeChange={changeMode} modeError={modeError} onBack={() => { setAdmin(false); reset() }} /> : mode !== 'open' ? <PauseScreen mode={mode} /> : <section className={`kiosk ${step === 'home' ? 'kiosk-home' : ''}`}>
        {step === 'home' && <>
          <div className="hero">
            <div className="hero-copy">
              <p className="eyebrow"><span className="live-dot" /> 오늘도 반가워요</p>
              <h1>우리 학교 마음지키미,<br />{settings.schoolName ? `${settings.schoolName} ` : ''}<em>Wee클래스</em></h1><p className="hero-description">들어오거나 나갈 때, 내 이름을 눌러 주세요.</p>
              <div className="today-stats">
                <span><LogIn size={17} /> 지금 함께하는 친구 <strong>{summary.present}명</strong></span>
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
          {step !== 'success' && <button className="back-button" onClick={goBack}><ArrowLeft size={20} /> 이전</button>}

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
            {recordError && <p className="record-error" role="alert">{recordError}</p>}
            <div className="mood-grid">{moodOptions.map(option => {
              const Icon = moodIcons[option.value]
              return <button className={`mood-card mood-${option.value}`} key={option.value} onClick={() => saveAttendance(option.value)}><span><Icon size={52} strokeWidth={1.7} /></span><strong>{option.label}</strong></button>
            })}</div>
            <button className="mood-skip" onClick={() => saveAttendance(null)}>선택하지 않을래요</button>
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
