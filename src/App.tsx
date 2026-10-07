import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, Building2, Check, ChevronRight, Clock3, DoorOpen, HelpCircle, LogIn, LogOut, School, Settings, ShieldCheck, UserRound } from 'lucide-react'

type Direction = 'in' | 'out'
type Step = 'home' | 'grade' | 'class' | 'student' | 'success'

const roster: Record<string, Record<string, string[]>> = {
  '1학년': {
    '1반': ['김민준', '김서연', '박도윤', '박지우', '이서준', '이하은', '최윤호', '최지민'],
    '2반': ['강예준', '김수아', '문지호', '박예린', '윤도현', '이채원', '정우진', '한서윤'],
    '3반': ['김시우', '나유진', '박준영', '송하린', '오지후', '이유나', '정현우', '최아린'],
  },
  '2학년': {
    '1반': ['강민재', '김나은', '박지훈', '서예은', '이건우', '임소율', '정도윤', '한지아'],
    '2반': ['김태윤', '남서아', '박시온', '송예진', '유승민', '이주원', '정하준', '최다은'],
    '3반': ['권민서', '김도현', '박채린', '신준우', '오하윤', '이예성', '조은서', '황지호'],
  },
  '3학년': {
    '1반': ['강준서', '김유빈', '박서우', '서지안', '안도윤', '이수민', '정예준', '최하린'],
    '2반': ['김우주', '노서윤', '박현우', '송지유', '유민준', '이아인', '전시후', '한예원'],
    '3반': ['김지호', '문채원', '백서준', '심하은', '오윤재', '이지민', '조도현', '최유나'],
  },
  '4학년': {
    '1반': ['김건우', '김연우', '박민서', '서하준', '윤서아', '이주호', '정가은', '최시우'],
    '2반': ['강지훈', '김예나', '박도현', '송유진', '오준서', '이채윤', '조민재', '한수아'],
  },
  '5학년': {
    '1반': ['김재윤', '김하은', '박시우', '서예린', '유지호', '이도연', '정민준', '최서윤'],
    '2반': ['강우진', '김아현', '문준영', '박유나', '윤현우', '이서아', '조예준', '한지민'],
  },
  '6학년': {
    '1반': ['김도윤', '김지우', '박서준', '서채원', '안민재', '이하윤', '정시온', '최예은'],
    '2반': ['강현우', '김수빈', '박지호', '송아인', '오태윤', '이유진', '조하준', '한서아'],
  },
}

function Logo() {
  return <div className="brand"><span className="brand-mark"><Check size={18} strokeWidth={3} /></span><span>위체크 학교</span></div>
}

function App() {
  const [direction, setDirection] = useState<Direction>('in')
  const [step, setStep] = useState<Step>('home')
  const [grade, setGrade] = useState('')
  const [schoolClass, setSchoolClass] = useState('')
  const [student, setStudent] = useState('')
  const grades = Object.keys(roster)
  const classes = useMemo(() => grade ? Object.keys(roster[grade]) : [], [grade])
  const students = useMemo(() => grade && schoolClass ? roster[grade][schoolClass] : [], [grade, schoolClass])

  const reset = () => { setGrade(''); setSchoolClass(''); setStudent(''); setStep('home') }
  const start = (next: Direction) => { setDirection(next); setGrade(''); setSchoolClass(''); setStudent(''); setStep('grade') }
  const goBack = () => {
    if (step === 'grade') reset()
    if (step === 'class') setStep('grade')
    if (step === 'student') setStep('class')
  }
  const chooseGrade = (value: string) => { setGrade(value); setSchoolClass(''); setStudent(''); setStep('class') }
  const chooseClass = (value: string) => { setSchoolClass(value); setStudent(''); setStep('student') }
  const chooseStudent = (value: string) => { setStudent(value); setStep('success') }

  return (
    <main className="app-shell">
      <header className="topbar">
        <Logo />
        <div className="top-actions">
          <button className="icon-button" aria-label="알림"><Bell size={20} /></button>
          <button className="icon-button" aria-label="학생 명단 설정"><Settings size={21} /></button>
        </div>
      </header>

      <section className="kiosk">
        {step === 'home' && <>
          <div className="hero">
            <div className="hero-copy">
              <p className="eyebrow"><span className="live-dot" /> 오늘도 반가워요</p>
              <h1><em>등교</em> 또는 <em>하교</em>를<br />선택해 주세요.</h1>
              <p className="hero-description">학년과 반을 고른 뒤 내 이름을 누르면 완료돼요.</p>
              <div className="today-stats">
                <span><LogIn size={17} /> 등교 <strong>423명</strong></span><span className="divider" />
                <span><LogOut size={17} /> 하교 <strong>81명</strong></span>
              </div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="building-card">
                <div className="building-icon"><School size={64} strokeWidth={1.6} /></div>
                <div className="access-pill"><ShieldCheck size={16} /> 우리 학교 출입 확인</div>
              </div>
            </div>
          </div>

          <div className="choice-section">
            <div className="choice-grid">
              <button className="choice-card entry" onClick={() => start('in')}>
                <span className="door-illustration"><DoorOpen size={58} strokeWidth={1.5} /><ArrowRight className="door-arrow" size={25} strokeWidth={3} /></span>
                <span className="choice-title">등교 확인하기</span><span className="choice-help">학교에 도착했어요</span>
              </button>
              <button className="choice-card exit" onClick={() => start('out')}>
                <span className="door-illustration"><DoorOpen size={58} strokeWidth={1.5} /><ArrowRight className="door-arrow out" size={25} strokeWidth={3} /></span>
                <span className="choice-title">하교 확인하기</span><span className="choice-help">이제 집으로 가요</span>
              </button>
            </div>
            <div className="school-note"><Building2 size={18} /><span>샘물초등학교</span><span className="school-note-divider" /><span>2026학년도 학생 명단</span></div>
          </div>

          <footer className="help-bar">
            <div><HelpCircle size={18} /><span><strong>내 이름이 보이지 않나요?</strong><small>선생님께 학년·반 명단을 확인해 달라고 해주세요.</small></span></div>
            <span className="system-status"><i /> 시스템 정상</span>
          </footer>
        </>}

        {step !== 'home' && <div className="flow-screen roster-flow">
          {step !== 'success' && <button className="back-button" onClick={goBack}><ArrowLeft size={20} /> 이전</button>}

          {step === 'grade' && <div className="flow-content roster-content">
            <span className={`flow-badge ${direction}`}><School size={25} /></span>
            <p className="eyebrow">{direction === 'in' ? '등교' : '하교'} 확인 · 1/3</p>
            <h2>몇 학년인가요?</h2><p className="flow-description">내 학년을 눌러 주세요.</p>
            <div className="selection-grid grade-grid">{grades.map(item =>
              <button key={item} onClick={() => chooseGrade(item)}><strong>{item.replace('학년', '')}</strong><span>학년</span><ChevronRight size={18} /></button>
            )}</div>
          </div>}

          {step === 'class' && <div className="flow-content roster-content">
            <div className="breadcrumb"><span>{grade}</span><ChevronRight size={14} /><strong>반 선택</strong></div>
            <p className="eyebrow">{direction === 'in' ? '등교' : '하교'} 확인 · 2/3</p>
            <h2>{grade}, 몇 반인가요?</h2><p className="flow-description">내 반을 눌러 주세요.</p>
            <div className="selection-grid class-grid">{classes.map(item =>
              <button key={item} onClick={() => chooseClass(item)}><strong>{item.replace('반', '')}</strong><span>반</span><ChevronRight size={18} /></button>
            )}</div>
          </div>}

          {step === 'student' && <div className="flow-content roster-content student-content">
            <div className="breadcrumb"><span>{grade}</span><ChevronRight size={14} /><span>{schoolClass}</span><ChevronRight size={14} /><strong>이름 선택</strong></div>
            <p className="eyebrow">{direction === 'in' ? '등교' : '하교'} 확인 · 3/3</p>
            <h2>내 이름을 찾아<br />눌러 주세요.</h2><p className="flow-description">가나다순으로 표시되어 있어요.</p>
            <div className="student-grid">{students.map(name =>
              <button key={name} onClick={() => chooseStudent(name)}><span className="student-initial">{name.slice(0, 1)}</span><strong>{name}</strong><ChevronRight size={18} /></button>
            )}</div>
          </div>}

          {step === 'success' && <div className="flow-content success-flow">
            <div className="success-check"><Check size={46} strokeWidth={2.5} /></div>
            <p className="eyebrow">확인이 완료됐어요</p>
            <h2>{student} 학생,<br /><em>{direction === 'in' ? '등교' : '하교'}</em> 처리됐어요.</h2>
            <div className="student-ticket">
              <div className="avatar"><UserRound size={24} /></div><div><strong>{student}</strong><small>{grade} {schoolClass}</small></div>
              <div className="ticket-time"><Clock3 size={16} /><strong>12:42</strong></div>
            </div>
            <p className="success-note">잠시 후 처음 화면으로 돌아갑니다.</p>
            <button className="primary-button" onClick={reset}>처음 화면으로</button>
          </div>}
        </div>}
      </section>
    </main>
  )
}

export default App
