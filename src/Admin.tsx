import { useState } from 'react'
import RosterSettings from './RosterSettings'
import { requestPriority, type CounselingRequest } from './counseling'
import CounselingInbox from './CounselingInbox'
import Modal from './Modal'
import OpeningSettings from './OpeningSettings'
import { schoolTypes, type SchoolSettings } from './roster'
import { ArrowLeft, Search, Users, LogIn, LogOut, CalendarDays } from 'lucide-react'
import { dailySummary, dateKey, timeLabel, type AttendanceRecord } from './attendance'
import { isSpecialMode, operationModes, weekdays, type OperationMode, type OpeningSettings as OpeningConfig } from './operation'

type Props = { records: AttendanceRecord[]; roster: Record<string, Record<string, string[]>>; onBack: () => void; mode: OperationMode; manualMode: OperationMode; onModeChange: (mode: OperationMode) => void; modeError: string; settings: SchoolSettings; onSaveSettings: (settings: SchoolSettings) => boolean; opening: OpeningConfig; onSaveOpening: (opening: OpeningConfig) => boolean; requests: CounselingRequest[]; onSaveRequests: (requests: CounselingRequest[]) => boolean }

export default function Admin({ records, roster, onBack, mode, manualMode, onModeChange, modeError, settings, onSaveSettings, opening, onSaveOpening, requests, onSaveRequests }: Props) {
  const [modal, setModal] = useState<'roster' | 'opening' | 'students' | 'counseling' | null>(null)
  const [day, setDay] = useState(dateKey())
  const [grade, setGrade] = useState('')
  const [status, setStatus] = useState('in')
  const [search, setSearch] = useState('')
  const summary = dailySummary(records, day)
  const rows = summary.latest.filter(record => (!grade || record.grade === grade) && (!status || record.direction === status) && record.name.includes(search.trim()))
  const today = day === dateKey()
  return <section className="admin-page">
    <button className="admin-back" onClick={onBack}><ArrowLeft size={17} /> 학생 화면으로</button>
    <div className="admin-heading"><div><p className="eyebrow"><span className="live-dot" /> 관리자 대시보드</p><h1>학생 출입 현황</h1><p>누가 왔는지, 지금 누가 있는지 한눈에 확인하세요.</p></div><label className="date-filter"><CalendarDays size={18} /><span className="sr-only">조회 날짜</span><input type="date" value={day} max={dateKey()} onChange={event => { if (event.target.value) setDay(event.target.value) }} /></label></div>
    <div className="dashboard-tools"><section className="admin-panel operation-panel">
      <div className="panel-heading"><h2>운영 모드</h2><span>현재: {operationModes[mode].label}</span></div>
      <div className="opening-toggle-row"><div><strong>{mode === 'open' ? 'Wee클래스 개방' : '학생 이용 잠시 멈춤'}</strong><small>{opening.method === 'schedule' ? '정해진 시간에 자동으로 열고 닫습니다' : '스위치로 개방 여부를 변경하세요'}</small></div><button className={`opening-toggle ${mode === 'open' ? 'on' : ''}`} role="switch" aria-label="Wee클래스 개방" aria-checked={mode === 'open'} disabled={opening.method === 'schedule'} onClick={() => onModeChange(mode === 'open' ? 'closed' : 'open')}><span className="toggle-label">{mode === 'open' ? '개방' : '닫힘'}</span><span className="toggle-knob" /></button></div>
      <div className="operation-options" role="group" aria-label="운영 모드 선택">{(Object.keys(operationModes) as OperationMode[]).filter(isSpecialMode).map(item => <button key={item} className={`operation-option ${mode === item ? 'selected' : ''}`} aria-pressed={mode === item} onClick={() => onModeChange(item)}><strong>{operationModes[item].label}</strong></button>)}</div>
      {opening.method === 'schedule' && <button className="admin-nav schedule-resume" disabled={!isSpecialMode(manualMode)} onClick={() => onModeChange('open')}>시간표대로 다시 운영</button>}
      <p className="operation-help">{opening.method === 'manual' ? '회의·상담 등의 상태를 선택하면 학생 화면에 안내가 나옵니다. 다시 열려면 개방 스위치를 켜 주세요.' : '회의·상담 등의 상태를 선택하면 시간표와 관계없이 닫힙니다. 끝나면 위의 시간표대로 다시 운영 버튼을 눌러 주세요.'}</p>
      {modeError && <p className="record-error" role="alert">{modeError}</p>}
      <p className="operation-feedback" role="status">{operationModes[mode].label} 모드가 적용되어 있습니다.</p>
    </section><section className="admin-panel dashboard-setting"><div className="panel-heading"><h2>개방 시간</h2><button className="admin-nav" onClick={() => setModal('opening')}>설정</button></div><strong>{opening.method === 'manual' ? '수동 개방' : '요일별 시간표'}</strong><div className="schedule-summary">{[1,2,3,4,5,6,0].map(day => <span key={day}>{weekdays[day]} <b>{opening.week[day].length ? `${opening.week[day].length}개` : '—'}</b></span>)}</div><p className="operation-help">요일별 시간은 설정 창에서 추가·수정합니다.</p></section>
    <section className="admin-panel dashboard-setting"><div className="panel-heading"><h2>학교 · 명렬표</h2><button className="admin-nav" onClick={() => setModal('roster')}>관리</button></div><strong>{schoolTypes[settings.schoolType]}</strong><p className="operation-help">{Object.values(roster).reduce((sum, classes) => sum + Object.values(classes).reduce((n, names) => n + names.length, 0), 0)}명 등록 · {Object.keys(roster).length}개 학년</p><span className="setting-caption">엑셀에서 가져오기 · 미리보기 · 변경</span></section></div>
    <div className="admin-stats">
      <article className="stat-card featured"><Users size={23} /><span>{today ? '현재 Wee클래스 이용 학생' : '마지막 확인 때 이용 중인 학생'}</span><strong>{summary.present}<small>명</small></strong><p>선택한 날짜에 들어온 뒤 아직 나가기를 누르지 않은 학생</p></article>
      <article className="stat-card"><LogIn size={23} /><span>{today ? '오늘 방문한 학생' : '방문한 학생'}</span><strong>{summary.arrivals}<small>명</small></strong><p>들어오기를 확인한 학생 · 중복 제외</p></article>
      <article className="stat-card"><LogOut size={23} /><span>{today ? '오늘 나간 학생' : '나간 학생'}</span><strong>{summary.departures}<small>명</small></strong><p>나가기를 확인한 학생 · 중복 제외</p></article>
    </div>
    <section className="admin-panel"><div className="panel-heading"><h2>학년별 방문 현황</h2><span>{day.replaceAll('-', '.')} 기준</span></div><div className="grade-stats">{Object.keys(roster).map(item => {
      const data = dailySummary(records.filter(record => record.grade === item), day)
      const total = Object.values(roster[item]).reduce((sum, names) => sum + names.length, 0)
      return <div className="grade-stat" key={item}><div><strong>{item}</strong><span>방문 {data.arrivals}명 / 명단 {total}명</span></div><div className="grade-track"><i style={{ width: `${Math.min(100, data.arrivals / total * 100)}%` }} /></div><small>이용 중 {data.present}명</small></div>
    })}</div></section>
    <section className="admin-panel dashboard-students"><div className="panel-heading"><h2>이용 학생 <span className="count-badge">{summary.present}</span></h2><button className="admin-nav" onClick={() => setModal('students')}>전체 목록 · 검색</button></div><div className="student-summary">{summary.latest.filter(record => record.direction === 'in').slice(0, 6).map(record => <span key={record.id}><strong>{record.name}</strong> {record.grade} {record.schoolClass}</span>)}{!summary.present && <span>현재 이용 중인 학생이 없습니다.</span>}{summary.present > 6 && <span>외 {summary.present - 6}명</span>}</div></section>
    <button className="admin-nav counseling-admin-link" onClick={() => setModal('counseling')}>상담 신청 · 안전 확인 <span className="count-badge">확인 대기 {requests.filter(item => !item.completed).length}건</span><span className="priority-badge urgent">지금 확인 {requests.filter(item => !item.completed && requestPriority(item.details) === 'urgent').length}건</span><span className="priority-badge followup">먼저 확인 {requests.filter(item => !item.completed && requestPriority(item.details) === 'followup').length}건</span></button>
    {modal === 'counseling' && <Modal title="상담 신청 · 안전 확인" onClose={() => setModal(null)}><CounselingInbox requests={requests} onSave={onSaveRequests} /></Modal>}
    {modal === 'roster' && <Modal title="학교 설정 · 학생 명렬표" onClose={() => setModal(null)}><RosterSettings settings={settings} onSave={onSaveSettings} /></Modal>}
    {modal === 'opening' && <Modal title="개방 방식 · 요일별 시간표" onClose={() => setModal(null)}><OpeningSettings opening={opening} onSave={onSaveOpening} /></Modal>}
    {modal === 'students' && <Modal title="학생 목록 · 검색" onClose={() => setModal(null)}><section className="admin-panel"><div className="panel-heading"><h2>학생 목록 <span className="count-badge">{rows.length}</span></h2><span>학생별 마지막 이용 상태</span></div>
      <div className="admin-filters"><label className="search-field"><Search size={18} /><input aria-label="학생 이름 검색" placeholder="학생 이름 검색" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="학년 필터" value={grade} onChange={event => setGrade(event.target.value)}><option value="">전체 학년</option>{Object.keys(roster).map(item => <option key={item}>{item}</option>)}</select><select aria-label="출입 상태 필터" value={status} onChange={event => setStatus(event.target.value)}><option value="in">이용 중인 학생</option><option value="out">나간 학생</option><option value="">방문한 모든 학생</option></select></div>
      <div className="table-scroll"><table><thead><tr><th>학생 이름</th><th>학년 / 반</th><th>상태</th><th>마지막 확인 시간</th></tr></thead><tbody>{rows.map(record => <tr key={record.id}><td><strong>{record.name}</strong></td><td>{record.grade} {record.schoolClass}</td><td><span className={`status-pill ${record.direction}`}>{record.direction === 'in' ? '이용 중' : '나감'}</span></td><td>{timeLabel(record.timestamp)}</td></tr>)}</tbody></table></div>
      {!rows.length && <div className="admin-empty"><Users size={30} /><strong>{summary.daily.length ? '조건에 맞는 학생이 없습니다.' : '아직 출입 기록이 없습니다.'}</strong><p>{summary.daily.length ? '이름이나 필터를 변경해 주세요.' : '학생이 들어오기·나가기를 확인하면 이곳에 표시됩니다.'}</p></div>}
    </section></Modal>}
    <p className="storage-note">이 기기의 브라우저에 저장된 기록입니다. 다른 기기와의 공유 및 관리자 로그인은 서버 연결이 필요합니다.</p>
  </section>
}
