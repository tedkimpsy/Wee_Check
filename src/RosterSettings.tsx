import { useState } from 'react'
import { gradeCount, parseRoster, schoolTypes, visibleRoster, type Roster, type SchoolSettings, type SchoolType } from './roster'

export default function RosterSettings({ settings, onSave }: { settings: SchoolSettings; onSave: (settings: SchoolSettings) => boolean }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Roster | null>(null)
  const [message, setMessage] = useState('')
  const current = visibleRoster(settings)
  const count = (roster: Roster) => Object.values(roster).reduce((sum, classes) => sum + Object.values(classes).reduce((n, names) => n + names.length, 0), 0)
  const changeType = (schoolType: SchoolType) => {
    if (onSave({ ...settings, schoolType })) { setPreview(null); setMessage(`${schoolTypes[schoolType]} 설정을 저장했습니다.`) }
    else setMessage('설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.')
  }
  const check = () => {
    try { setPreview(parseRoster(text, settings.schoolType)); setMessage('미리보기를 확인한 뒤 아래 적용 버튼을 눌러 주세요.') }
    catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : '표를 확인해 주세요.') }
  }
  return <section className="admin-panel roster-settings">
    <div className="panel-heading"><h2>학교 설정 · 학생 명렬표</h2><span>현재 {count(current)}명</span></div>
    <label className="school-level-field">학교급<select value={settings.schoolType} onChange={event => changeType(event.target.value as SchoolType)}>{Object.entries(schoolTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <p className="operation-help">{schoolTypes[settings.schoolType]}는 1~{gradeCount(settings.schoolType)}학년을 표시합니다. 안내 문구는 모든 학교급에 공통으로 사용합니다. 학교급 변경 시 기존 명렬표는 보관하며 해당 학년만 표시합니다.</p>
    <h3>엑셀에서 학생 명렬표 가져오기</h3>
    <p className="operation-help">엑셀에서 학년·반·이름 순서의 세 열을 복사해 붙여넣어 주세요. 쉼표로 구분한 표도 가능합니다. 명렬표 전체를 교체하며 기존 출입 기록은 유지합니다.</p>
    <label className="sr-only" htmlFor="roster-input">학생 명렬표 입력</label><textarea id="roster-input" value={text} placeholder={'학년\t반\t이름\n1\t1\t김민준\n1\t1\t김서연'} onChange={event => { setText(event.target.value); setPreview(null); setMessage('') }} />
    <div className="roster-actions"><button className="admin-nav" onClick={() => { setText('학년\t반\t이름\n' + Object.entries(current).flatMap(([grade, classes]) => Object.entries(classes).flatMap(([label, names]) => names.map(name => `${grade}\t${label}\t${name}`))).join('\n')); setPreview(null); setMessage('현재 명렬표를 불러왔습니다. 수정 후 미리보기를 눌러 주세요.') }}>현재 명렬표 불러오기</button><button className="admin-nav" onClick={check}>미리보기</button></div>
    {message && <p className="operation-help" role="status">{message}</p>}
    {preview && <div className="roster-preview"><h3>변경할 명렬표: {count(preview)}명</h3><div className="table-scroll"><table><thead><tr><th>학년 / 반</th><th>인원</th><th>이름</th></tr></thead><tbody>{Object.entries(preview).flatMap(([grade, classes]) => Object.entries(classes).map(([label, names]) => <tr key={`${grade}-${label}`}><td>{grade} {label}</td><td>{names.length}명</td><td>{names.join(', ')}</td></tr>))}</tbody></table></div><button className="primary-button" onClick={() => { if (onSave({ ...settings, roster: preview })) { setPreview(null); setMessage('학생 명렬표를 변경했습니다.') } else setMessage('명렬표를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.') }}>이 명렬표로 전체 교체</button></div>}
  </section>
}
