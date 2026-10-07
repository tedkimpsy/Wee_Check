import { useState, type CSSProperties } from 'react'
import RosterSettings from './RosterSettings'
import { requestPriority, type CounselingRequest } from './counseling'
import CounselingInbox from './CounselingInbox'
import Modal from './Modal'
import OpeningSettings from './OpeningSettings'
import { type SchoolSettings } from './roster'
import { ArrowLeft, Search, Users, LogIn, LogOut, CalendarDays, Cloud, CloudLightning, CloudRain, CloudSun, Sun, type LucideIcon } from 'lucide-react'
import { dailyMoodSummary, dailySummary, dateKey, moodLabel, moodOptions, timeLabel, type AttendanceRecord, type MoodValue } from './attendance'
import { isSpecialMode, operationModes, type OperationMode, type OpeningSettings as OpeningConfig } from './operation'

type Props = { records: AttendanceRecord[]; roster: Record<string, Record<string, string[]>>; onBack: () => void; mode: OperationMode; manualMode: OperationMode; onModeChange: (mode: OperationMode) => void; modeError: string; settings: SchoolSettings; onSaveSettings: (settings: SchoolSettings) => boolean; opening: OpeningConfig; onSaveOpening: (opening: OpeningConfig) => boolean; requests: CounselingRequest[]; onSaveRequests: (requests: CounselingRequest[]) => boolean }

const moodIcons: Record<MoodValue, LucideIcon> = {
  'sunny-full': Sun,
  'sunny-soft': CloudSun,
  cloudy: Cloud,
  drizzle: CloudRain,
  'heavy-rain': CloudLightning,
}

export default function Admin({ records, roster, onBack, mode, manualMode, onModeChange, modeError, settings, onSaveSettings, opening, onSaveOpening, requests, onSaveRequests }: Props) {
  const [modal, setModal] = useState<'roster' | 'opening' | 'students' | 'counseling' | 'moods' | 'stats' | 'grades' | null>(null)
  const [day, setDay] = useState(dateKey())
  const [grade, setGrade] = useState('')
  const [status, setStatus] = useState('in')
  const [search, setSearch] = useState('')
  const summary = dailySummary(records, day)
  const moodSummary = dailyMoodSummary(records, day)
  const rows = summary.latest.filter(record => (!grade || record.grade === grade) && (!status || record.direction === status) && record.name.includes(search.trim()))
  const today = day === dateKey()
  const present = summary.latest.filter(record => record.direction === 'in').sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  const pending = requests.filter(item => !item.completed)
  const urgentCount = pending.filter(item => requestPriority(item.details) === 'urgent').length
  const followupCount = pending.filter(item => requestPriority(item.details) === 'followup').length
  const modeList = Object.keys(operationModes) as OperationMode[]
  const modeIndex = Math.max(0, modeList.indexOf(mode))
  return <section className="admin-page">
    <div className="admin-bar">
      <button className="admin-back" onClick={onBack}><ArrowLeft size={17} /> 학생 화면으로</button>
      <div className="admin-bar-tools">
        <label className="date-filter"><CalendarDays size={18} /><span className="sr-only">조회 날짜</span><input type="date" value={day} max={dateKey()} onChange={event => { if (event.target.value) setDay(event.target.value) }} /></label>
        <span className={`mode-chip ${mode === 'open' ? 'on' : 'off'}`}><i /> {operationModes[mode].label}</span>
      </div>
    </div>

    <div className="mode-bar" style={{ '--count': modeList.length, '--i': modeIndex } as CSSProperties} role="group" aria-label="운영 상태">
      <span className="mode-thumb" aria-hidden="true" />
      {modeList.map(item => <button key={item} type="button" className={mode === item ? 'active' : ''} aria-pressed={mode === item} onClick={() => onModeChange(item)}>{operationModes[item].label}</button>)}
    </div>
    {opening.method === 'schedule' && isSpecialMode(mode) && <button className="admin-nav schedule-resume" onClick={() => onModeChange('open')}>시간표대로 다시 운영</button>}

    <div className="admin-heading"><div><p className="eyebrow"><span className="live-dot" /> 관리자 대시보드</p><h1>학생 출입 현황</h1><p>지금 누가 있는지, 급한 상담이 있는지 바로 확인할 수 있습니다.</p></div></div>
    {modeError && <p className="record-error" role="alert">{modeError}</p>}

    <div className="dashboard-hero">
      <section className="admin-panel present-panel">
        <div className="panel-heading"><h2>지금 이용 중인 학생 <span className="count-badge">{summary.present}</span></h2><button className="admin-nav" onClick={() => setModal('students')}>전체 명단 · 검색</button></div>
        <div className="student-summary present-list">{present.map(record => <span key={record.id}><strong>{record.name}</strong> {record.grade} {record.schoolClass}</span>)}{!present.length && <span>현재 이용 중인 학생이 없습니다.</span>}</div>
      </section>
      <section className="admin-panel counseling-panel">
        <div className="panel-heading"><h2>상담 신청 · 안전 확인</h2></div>
        <div className="counsel-list">
          <div className={`counsel-item urgent ${urgentCount ? 'alert' : ''}`}><strong>{urgentCount}</strong><span>지금 확인</span></div>
          <div className="counsel-item followup"><strong>{followupCount}</strong><span>먼저 확인</span></div>
          <div className="counsel-item"><strong>{pending.length}</strong><span>확인 대기</span></div>
        </div>
        <button className="admin-nav wide" onClick={() => setModal('counseling')}>신청 확인하기</button>
      </section>
    </div>

    <div className="dashboard-links">
      <button className="admin-nav" onClick={() => setModal('stats')}>오늘 통계</button>
      <button className="admin-nav" onClick={() => setModal('moods')}>마음 날씨</button>
      <button className="admin-nav" onClick={() => setModal('grades')}>학년별 방문</button>
      <button className="admin-nav" onClick={() => setModal('opening')}>개방 시간</button>
      <button className="admin-nav" onClick={() => setModal('roster')}>학교·명렬표</button>
    </div>

    {modal === 'stats' && <Modal title={`${day.replaceAll('-', '.')} 오늘 통계`} onClose={() => setModal(null)}><section className="admin-panel">
      <div className="admin-stats">
        <article className="stat-card featured"><Users size={23} /><span>{today ? '현재 Wee클래스 이용 학생' : '마지막 확인 때 이용 중인 학생'}</span><strong>{summary.present}<small>명</small></strong><p>선택한 날짜에 들어온 뒤 아직 나가기를 누르지 않은 학생</p></article>
        <article className="stat-card"><LogIn size={23} /><span>{today ? '오늘 방문한 학생' : '방문한 학생'}</span><strong>{summary.arrivals}<small>명</small></strong><p>들어오기를 확인한 학생 · 중복 제외</p></article>
        <article className="stat-card"><LogOut size={23} /><span>{today ? '오늘 나간 학생' : '나간 학생'}</span><strong>{summary.departures}<small>명</small></strong><p>나가기를 확인한 학생 · 중복 제외</p></article>
      </div>
    </section></Modal>}

    {modal === 'grades' && <Modal title={`${day.replaceAll('-', '.')} 학년별 방문 현황`} onClose={() => setModal(null)}><section className="admin-panel"><div className="grade-stats">{Object.keys(roster).map(item => {
      const data = dailySummary(records.filter(record => record.grade === item), day)
      const total = Object.values(roster[item]).reduce((sum, names) => sum + names.length, 0)
      return <div className="grade-stat" key={item}><div><strong>{item}</strong><span>방문 {data.arrivals}명 / 명단 {total}명</span></div><div className="grade-track"><i style={{ width: `${Math.min(100, data.arrivals / total * 100)}%` }} /></div><small>이용 중 {data.present}명</small></div>
    })}</div></section></Modal>}

    {modal === 'moods' && <Modal title={`${day.replaceAll('-', '.')} 마음 날씨`} onClose={() => setModal(null)}><section className="admin-panel mood-dashboard">
      <div className="panel-heading"><div><h2>마음 날씨 분포 <span className="count-badge">{moodSummary.responses.length}건</span></h2><p>{day.replaceAll('-', '.')} 입장 응답 기준</p></div></div>
      <div className="mood-stats">{moodOptions.map(option => {
        const Icon = moodIcons[option.value]
        const count = moodSummary.counts[option.value]
        const percent = moodSummary.responses.length ? Math.round(count / moodSummary.responses.length * 100) : 0
        const difficult = option.value === 'drizzle' || option.value === 'heavy-rain'
        return <article className={`mood-stat mood-${option.value} ${difficult ? 'difficult' : ''}`} key={option.value}><span><Icon size={28} /></span><strong>{option.label}</strong><b>{count}<small>건</small></b><div className="mood-track"><i style={{ width: `${percent}%` }} /></div><em>{percent}%</em></article>
      })}<article className="mood-stat mood-skipped"><span>—</span><strong>선택하지 않음</strong><b>{moodSummary.skipped}<small>건</small></b><div className="mood-track"><i style={{ width: `${moodSummary.responses.length ? Math.round(moodSummary.skipped / moodSummary.responses.length * 100) : 0}%` }} /></div><em>{moodSummary.responses.length ? Math.round(moodSummary.skipped / moodSummary.responses.length * 100) : 0}%</em></article></div>
      {!moodSummary.responses.length && <p className="mood-empty">선택한 날짜에 수집된 마음 날씨가 없습니다.</p>}
      {moodSummary.legacy > 0 && <p className="mood-legacy">마음 날씨 기능 전에 저장된 미수집 입장 기록 {moodSummary.legacy}건은 분포에서 제외했습니다.</p>}
      <p className="mood-disclaimer">마음 날씨는 심리 검사나 진단 도구가 아닙니다. 걱정되는 학생이 있으면 직접 만나 이야기해 주세요.</p>
      <div className="table-scroll"><table><thead><tr><th>입장 시각</th><th>학생 이름</th><th>학년 / 반</th><th>마음 날씨</th></tr></thead><tbody>{moodSummary.entries.map(record => {
        const collected = 'mood' in record
        const difficult = record.mood === 'drizzle' || record.mood === 'heavy-rain'
        return <tr className={difficult ? 'difficult-mood-row' : ''} key={record.id}><td>{timeLabel(record.timestamp)}</td><td><strong>{record.name}</strong></td><td>{record.grade} {record.schoolClass}</td><td><span className={`mood-pill ${difficult ? 'difficult' : ''} ${record.mood === null ? 'skipped' : ''} ${!collected ? 'legacy' : ''}`}>{collected ? moodLabel(record.mood ?? null) : '미수집 기록'}</span></td></tr>
      })}</tbody></table></div>
      {!moodSummary.entries.length && <div className="admin-empty"><Cloud size={30} /><strong>아직 마음 날씨 기록이 없습니다.</strong><p>학생이 들어오기를 확인하면 이곳에 표시됩니다.</p></div>}
    </section></Modal>}

    {modal === 'counseling' && <Modal title="상담 신청 · 안전 확인" onClose={() => setModal(null)}><CounselingInbox requests={requests} onSave={onSaveRequests} /></Modal>}
    {modal === 'roster' && <Modal title="학교 설정 · 학생 명렬표" onClose={() => setModal(null)}><RosterSettings settings={settings} onSave={onSaveSettings} /></Modal>}
    {modal === 'opening' && <Modal title="개방 방식 · 요일별 시간표" onClose={() => setModal(null)}><OpeningSettings opening={opening} onSave={onSaveOpening} /></Modal>}
    {modal === 'students' && <Modal title="학생 목록 · 검색" onClose={() => setModal(null)}><section className="admin-panel"><div className="panel-heading"><h2>학생 목록 <span className="count-badge">{rows.length}</span></h2><span>학생별 마지막 이용 상태</span></div>
      <div className="admin-filters"><label className="search-field"><Search size={18} /><input aria-label="학생 이름 검색" placeholder="학생 이름 검색" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="학년 필터" value={grade} onChange={event => setGrade(event.target.value)}><option value="">전체 학년</option>{Object.keys(roster).map(item => <option key={item}>{item}</option>)}</select><select aria-label="출입 상태 필터" value={status} onChange={event => setStatus(event.target.value)}><option value="in">이용 중인 학생</option><option value="out">나간 학생</option><option value="">방문한 모든 학생</option></select></div>
      <div className="table-scroll"><table><thead><tr><th>학생 이름</th><th>학년 / 반</th><th>상태</th><th>마지막 확인 시간</th></tr></thead><tbody>{rows.map(record => <tr key={record.id}><td><strong>{record.name}</strong></td><td>{record.grade} {record.schoolClass}</td><td><span className={`status-pill ${record.direction}`}>{record.direction === 'in' ? '이용 중' : '나감'}</span></td><td>{timeLabel(record.timestamp)}</td></tr>)}</tbody></table></div>
      {!rows.length && <div className="admin-empty"><Users size={30} /><strong>{summary.daily.length ? '조건에 맞는 학생이 없습니다.' : '아직 출입 기록이 없습니다.'}</strong><p>{summary.daily.length ? '이름이나 필터를 변경해야 합니다.' : '학생이 들어오기·나가기를 확인하면 이곳에 표시됩니다.'}</p></div>}
    </section></Modal>}

    <p className="storage-note">이 기기의 브라우저에 저장된 기록입니다. 다른 기기와의 공유 및 관리자 로그인은 서버 연결이 필요합니다.</p>
  </section>
}
