import { useEffect, useMemo, useState } from 'react'
import { Check, FileSpreadsheet, Save, Upload } from 'lucide-react'
import { gradeCount, parseRoster, schoolTypes, visibleRoster, type Roster, type SchoolSettings, type SchoolType } from './roster'

type Props = {
  settings: SchoolSettings
  onSave: (settings: SchoolSettings) => Promise<void>
  view?: 'school' | 'roster'
}

const rosterCount = (roster: Roster) => Object.values(roster).reduce(
  (sum, classes) => sum + Object.values(classes).reduce((count, names) => count + names.length, 0), 0,
)

export default function RosterSettings({ settings, onSave, view = 'roster' }: Props) {
  const [schoolName, setSchoolName] = useState(settings.schoolName)
  const [schoolType, setSchoolType] = useState<SchoolType>(settings.schoolType)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Roster | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const current = useMemo(() => visibleRoster(settings), [settings])

  useEffect(() => {
    setSchoolName(settings.schoolName)
    setSchoolType(settings.schoolType)
  }, [settings.schoolName, settings.schoolType])

  const runSave = async (next: SchoolSettings, success: string) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await onSave(next)
      setMessage(success)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return false
    } finally {
      setBusy(false)
    }
  }

  if (view === 'school') return <section className="admin-v3-card roster-settings">
    <header className="admin-v3-card-head"><h2>학교 정보</h2><span>학생 화면과 관리자 메뉴에 표시됩니다.</span></header>
    <div className="admin-v3-form-grid">
      <label>학교급<select value={schoolType} onChange={event => setSchoolType(event.target.value as SchoolType)}>{Object.entries(schoolTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>학교 이름<input type="text" value={schoolName} placeholder="예: 한마음초등학교" onChange={event => setSchoolName(event.target.value)} /></label>
    </div>
    <p className="admin-v3-help">{schoolTypes[schoolType]} 기준으로 1~{gradeCount(schoolType)}학년을 표시합니다. 학교급을 바꿔도 기존 명렬표 데이터는 보존됩니다.</p>
    {error && <p className="admin-v3-form-error" role="alert">{error}</p>}
    {message && <p className="admin-v3-form-success" role="status"><Check size={16}/>{message}</p>}
    <div className="admin-v3-form-actions"><button className="admin-v3-primary" disabled={busy || !schoolName.trim()} onClick={() => void runSave({ ...settings, schoolName: schoolName.trim(), schoolType }, '학교 정보를 저장했습니다.')}><Save size={17}/>{busy ? '저장 중…' : '학교 정보 저장'}</button></div>
  </section>

  const loadCurrent = () => {
    const rows = Object.entries(current).flatMap(([grade, classes]) => Object.entries(classes).flatMap(([schoolClass, names]) => names.map(name => `${grade.replace('학년', '')}\t${schoolClass.replace('반', '')}\t${name}`)))
    setText(`학년\t반\t이름\n${rows.join('\n')}`)
    setPreview(null)
    setError('')
    setMessage('현재 명렬표를 편집 영역에 불러왔습니다.')
  }
  const check = () => {
    setError('')
    setMessage('')
    try {
      setPreview(parseRoster(text, settings.schoolType))
      setMessage('미리보기를 확인한 뒤 전체 교체를 눌러 주세요.')
    } catch (reason) {
      setPreview(null)
      setError(reason instanceof Error ? reason.message : '입력 형식을 확인해 주세요.')
    }
  }
  const replaceRoster = async () => {
    if (!preview) return
    if (!window.confirm(`현재 학생 명렬표를 ${rosterCount(preview)}명의 새 명렬표로 교체할까요? 기존 출입 기록은 유지됩니다.`)) return
    if (await runSave({ ...settings, roster: preview }, '학생 명렬표를 교체했습니다.')) setPreview(null)
  }

  return <section className="admin-v3-card roster-settings">
    <header className="admin-v3-card-head"><h2>학생 명렬표 전체 교체</h2><span>현재 {rosterCount(current)}명</span></header>
    <div className="admin-v3-roster-guide"><FileSpreadsheet size={22}/><p><strong>엑셀에서 학년·반·이름 열을 복사해 붙여넣으세요.</strong><span>탭 또는 쉼표로 구분된 값을 지원합니다. 교체해도 기존 출입·상담 기록은 유지됩니다.</span></p></div>
    <label className="sr-only" htmlFor="roster-input">학생 명렬표 입력</label>
    <textarea id="roster-input" value={text} placeholder={'학년\t반\t이름\n1\t1\t김서연\n1\t1\t박도윤'} onChange={event => { setText(event.target.value); setPreview(null); setMessage(''); setError('') }} />
    <div className="admin-v3-form-actions split"><button className="admin-v3-secondary" onClick={loadCurrent}>현재 명렬표 불러오기</button><button className="admin-v3-primary" disabled={!text.trim()} onClick={check}><Upload size={17}/> 미리보기</button></div>
    {error && <p className="admin-v3-form-error" role="alert">{error}</p>}
    {message && <p className="admin-v3-form-success" role="status"><Check size={16}/>{message}</p>}
    {preview && <div className="admin-v3-roster-preview"><h3>교체할 명렬표 · {rosterCount(preview)}명</h3><div className="admin-v3-table-wrap"><table className="admin-v3-table"><thead><tr><th>학년·반</th><th>인원</th><th>이름</th></tr></thead><tbody>{Object.entries(preview).flatMap(([grade, classes]) => Object.entries(classes).map(([schoolClass, names]) => <tr key={`${grade}-${schoolClass}`}><td>{grade} {schoolClass}</td><td>{names.length}명</td><td>{names.join(', ')}</td></tr>))}</tbody></table></div><button className="admin-v3-primary" disabled={busy} onClick={() => void replaceRoster()}>{busy ? '교체 중…' : '이 명렬표로 전체 교체'}</button></div>}
  </section>
}
