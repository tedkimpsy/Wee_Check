import { useState } from 'react'
import { CalendarDays, Check, Plus, ToggleRight, Trash2 } from 'lucide-react'
import Modal from './Modal'
import { validateSlots, weekdays, type OpeningSettings as OpeningConfig, type TimeSlot } from './operation'

function DayEditor({ day, slots, onSave, onClose }: { day: number; slots: TimeSlot[]; onSave: (slots: TimeSlot[]) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState(slots.map(slot => ({ ...slot })))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const validation = validateSlots(draft)
    if (validation) { setError(validation); return }
    setBusy(true)
    setError('')
    try {
      await onSave([...draft].sort((a, b) => a.start.localeCompare(b.start)))
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '시간표를 저장하지 못했습니다.')
    } finally { setBusy(false) }
  }
  return <Modal title={`${weekdays[day]}요일 개방 시간`} onClose={onClose}>
    <p className="admin-v3-help">한국 시간 기준입니다. 시간이 하나도 없으면 그 요일은 닫힘으로 운영됩니다.</p>
    <div className="admin-v3-time-list">{draft.map((slot, index) => <div className="admin-v3-time-slot" key={index}><label>여는 시간<input type="time" value={slot.start} onChange={event => setDraft(draft.map((item, i) => i === index ? { ...item, start: event.target.value } : item))} /></label><span>—</span><label>닫는 시간<input type="time" value={slot.end} onChange={event => setDraft(draft.map((item, i) => i === index ? { ...item, end: event.target.value } : item))} /></label><button className="admin-v3-icon" aria-label="시간 삭제" onClick={() => setDraft(draft.filter((_, i) => i !== index))}><Trash2 size={17}/></button></div>)}</div>
    {!draft.length && <p className="admin-v3-help">등록된 개방 시간이 없습니다.</p>}
    <button className="admin-v3-secondary" onClick={() => setDraft([...draft, { start: '09:00', end: '10:00' }])}><Plus size={17}/> 시간대 추가</button>
    {error && <p className="admin-v3-form-error" role="alert">{error}</p>}
    <div className="admin-v3-form-actions split"><button className="admin-v3-secondary" onClick={onClose}>취소</button><button className="admin-v3-primary" disabled={busy} onClick={() => void save()}>{busy ? '저장 중…' : '시간표 저장'}</button></div>
  </Modal>
}

export default function OpeningSettings({ opening, onSave }: { opening: OpeningConfig; onSave: (opening: OpeningConfig) => Promise<void> }) {
  const [day, setDay] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle'|'saving'|'success'|'error'>('idle')
  const [message, setMessage] = useState('')
  const chooseMethod = async (method: OpeningConfig['method']) => {
    setStatus('saving')
    setMessage('')
    try {
      await onSave({ ...opening, method })
      setStatus('success')
      setMessage(method === 'manual' ? '수동 개방으로 변경했습니다.' : '요일별 시간표를 적용했습니다.')
    } catch (reason) {
      setStatus('error')
      setMessage(reason instanceof Error ? reason.message : '설정을 저장하지 못했습니다.')
    }
  }
  return <>
    <div className="opening-methods admin-v3-opening-methods" role="group" aria-label="개방 방식">
      <button disabled={status === 'saving'} className={`opening-method ${opening.method === 'manual' ? 'selected' : ''}`} aria-pressed={opening.method === 'manual'} onClick={() => void chooseMethod('manual')}><ToggleRight size={24}/><span><strong>수동 개방</strong><small>필요할 때 관리자가 직접 열고 닫습니다.</small></span>{opening.method === 'manual' && <Check size={18}/>}</button>
      <button disabled={status === 'saving'} className={`opening-method ${opening.method === 'schedule' ? 'selected' : ''}`} aria-pressed={opening.method === 'schedule'} onClick={() => void chooseMethod('schedule')}><CalendarDays size={24}/><span><strong>요일별 시간표</strong><small>정해진 시간에 자동으로 열고 닫습니다.</small></span>{opening.method === 'schedule' && <Check size={18}/>}</button>
    </div>
    {status === 'error' && <p className="admin-v3-form-error" role="alert">{message}</p>}
    {status === 'success' && <p className="admin-v3-form-success" role="status"><Check size={16}/>{message}</p>}
    {opening.method === 'manual' ? <div className="admin-v3-opening-hint"><ToggleRight size={28}/><span><strong>상단 운영 상태에서 개방 여부를 바꿉니다.</strong><p>마지막으로 저장한 상태는 서버를 다시 실행해도 유지됩니다.</p></span></div> : <><p className="admin-v3-help">열고 싶은 요일에 시간대를 추가하세요. 다른 운영 상태를 선택하면 시간표보다 우선합니다.</p><div className="admin-v3-week">{[1,2,3,4,5,6,0].map(weekDay => <div key={weekDay}><strong>{weekdays[weekDay]}요일</strong><span>{opening.week[weekDay].length ? opening.week[weekDay].map(slot => `${slot.start}–${slot.end}`).join(' / ') : '닫힘'}</span><button className="admin-v3-secondary" onClick={() => setDay(weekDay)}>{opening.week[weekDay].length ? '수정' : '시간 추가'}</button></div>)}</div></>}
    {day !== null && <DayEditor
      day={day}
      slots={opening.week[day]}
      onClose={() => setDay(null)}
      onSave={slots => onSave({ ...opening, week: opening.week.map((old, index) => index === day ? slots : old) })}
    />}
  </>
}
